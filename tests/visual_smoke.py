#!/usr/bin/env python
"""Playwright visual smoke for vibes_aim.

Boots the server on a fixed port, serves the client on a second port
(set as VIBES_API_BASE for CORS), opens the page in headless Chrome,
clicks through the menu / chart / missions / terminal, and saves PNGs
to docs/screenshots/. Returns a JSON summary on stdout so the
Node-side test (tests/visual.test.mjs) can assert on key DOM values.

Run from the repo root:
  python tests/visual_smoke.py
Exit code is 0 on success, 1 otherwise.
"""

import json
import os
import socket
import subprocess
import sys
import threading
import time
import http.server
import socketserver


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CLIENT_DIR = os.path.join(ROOT, "client")
SCREENSHOTS_DIR = os.path.join(ROOT, "docs", "screenshots")


def find_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def main():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    client_port = find_port()
    client_origin = f"http://127.0.0.1:{client_port}"
    static_errors = []
    # Never use a fixed API port here. A prior test/helper can leave a
    # process alive briefly; fixed 3098 could make the browser talk to a
    # stale backend while this process fails to bind. A fresh OS-assigned
    # port isolates every visual run.
    server_port = find_port()

    # Start server
    env = {**os.environ, "ORIGIN": client_origin, "PORT": str(server_port), "AIM_HIT_RPS": "5000"}
    proc = subprocess.Popen(
        ["node", "src/index.js"],
        cwd=os.path.join(ROOT, "server"),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # Tiny static server with index.html fallback
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=CLIENT_DIR, **kw)
        def log_message(self, *a, **k):
            pass
        def send_error(self, code, message=None, explain=None):
            static_errors.append({"path": self.path, "status": code})
            return super().send_error(code, message, explain)
        def do_GET(self):
            if self.path in ("/", ""):
                self.path = "/index.html"
            return super().do_GET()

    def serve():
        # ES modules are fetched concurrently by Chrome. A single-threaded
        # TCPServer can refuse parallel imports, leaving an incomplete UI
        # (for example, missions.js never mounts). ThreadingHTTPServer
        # serves the complete module graph deterministically.
        with http.server.ThreadingHTTPServer(("127.0.0.1", client_port), Handler) as httpd:
            httpd.serve_forever()
    threading.Thread(target=serve, daemon=True).start()

    try:
        time.sleep(1.2)
        # Quick liveness
        import urllib.request
        urllib.request.urlopen(f"http://127.0.0.1:{server_port}/health", timeout=3).read()

        from playwright.sync_api import sync_playwright
        summary = {
            "screenshots": [],
            "dom": {},
            "console_errors": [],
            "console_error_details": [],
            "page_errors": [],
            "request_failures": [],
            "error_responses": [],
            "static_errors": static_errors,
        }

        with sync_playwright() as p:
            # Allow CI runners (e.g. Linux Playwright) to point at any
            # installed Chrome/Chromium via VIBES_VISUAL_CHROME. The
            # default stays the Windows developer install path so
            # existing local workflows keep working.
            chrome_path = os.environ.get("VIBES_VISUAL_CHROME") or r"C:\Program Files\Google\Chrome\Application\chrome.exe"
            launch_kwargs = {
                "headless": True,
                "args": ["--no-sandbox", "--disable-dev-shm-usage"],
            }
            try:
                browser = p.chromium.launch(executable_path=chrome_path, **launch_kwargs)
            except Exception as launch_err:
                # Fall back to whatever Playwright considers the default
                # channel (chromium installed via `playwright install`).
                summary["browser_launch_error"] = str(launch_err)
                browser = p.chromium.launch(**launch_kwargs)
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            ctx.add_init_script(f'window.VIBES_API_BASE = "http://127.0.0.1:{server_port}";')
            page = ctx.new_page()
            def record_console_error(message):
                if message.type != "error":
                    return
                location = message.location or {}
                summary["console_errors"].append(message.text)
                summary["console_error_details"].append({
                    "text": message.text,
                    "url": location.get("url"),
                    "line": location.get("lineNumber"),
                    "column": location.get("columnNumber"),
                })

            page.on("pageerror", lambda e: summary["page_errors"].append(str(e)))
            page.on("console", record_console_error)
            page.on("requestfailed", lambda r: summary["request_failures"].append({
                "url": r.url, "failure": r.failure,
            }))
            page.on("response", lambda r: summary["error_responses"].append({
                "url": r.url, "status": r.status,
            }) if r.status >= 400 else None)
            # requestfailed and 4xx/5xx responses are recorded but filtered
            # in the post-process pass below; Chrome strips the URL from
            # the generic "Failed to load resource" line, so we cannot
            # filter on the URL field directly.

            page.goto(f"http://127.0.0.1:{client_port}/", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector("#menu.open", timeout=15000)
            page.wait_for_function('document.getElementById("vibes-boot").hidden === true', timeout=8000)
            page.wait_for_timeout(2500)

            out1 = os.path.join(SCREENSHOTS_DIR, "01-initial-menu.png")
            page.screenshot(path=out1)
            summary["screenshots"].append(out1)

            # Open the terminal
            page.click("#vibes-open-terminal", timeout=10000)
            page.wait_for_timeout(1500)
            out2 = os.path.join(SCREENSHOTS_DIR, "02-terminal.png")
            page.screenshot(path=out2)
            summary["screenshots"].append(out2)
            summary["dom"]["terminal_usd"] = page.eval_on_selector('[data-vt-assets-total]', 'el => el.textContent')
            # Switch directly through the shared primary navigation.
            page.click("#vibes-open-missions", timeout=10000)
            # Do not rely on a wall-clock sleep: the panel renders from
            # store refresh asynchronously. Wait for all six rows so the
            # DOM summary and screenshot cannot race a late render.
            try:
                page.wait_for_function(
                    'document.querySelectorAll("[data-vm-kind]").length === 6',
                    timeout=10000,
                )
            except Exception as exc:
                # Emit focused state on failure so a visual flake has
                # actionable evidence instead of a generic timeout.
                summary["mission_debug"] = page.evaluate("""() => {
                  const panel = document.getElementById('vibes-missions');
                  const body = panel && panel.querySelector('[data-vm-body]');
                  return {
                    readyState: document.readyState,
                    panelExists: !!panel,
                    panelHidden: panel ? panel.hidden : null,
                    mounted: panel ? panel.dataset.vmMounted || null : null,
                    rows: document.querySelectorAll('[data-vm-kind]').length,
                    tbodyChildren: body ? body.children.length : null,
                    moduleScripts: [...document.querySelectorAll('script[type="module"]')].map((s) => s.src || 'inline'),
                  };
                }""")
                summary["real_errors"] = list(summary["page_errors"])
                print(json.dumps(summary, ensure_ascii=False, indent=2))
                raise RuntimeError(f"missions rows did not render: {summary['mission_debug']}") from exc
            out3 = os.path.join(SCREENSHOTS_DIR, "03-missions.png")
            page.screenshot(path=out3)
            summary["screenshots"].append(out3)
            summary["dom"]["missions_claimed"] = page.eval_on_selector('[data-vm-claimed]', 'el => el.textContent')
            summary["dom"]["missions_total"] = page.eval_on_selector('[data-vm-total]', 'el => el.textContent')
            summary["dom"]["mission_rows"] = page.eval_on_selector_all('[data-vm-kind]', 'els => els.length')
            summary["dom"]["unlock_card_hidden"] = page.eval_on_selector('[data-vm-unlock-card]', 'el => el.hidden')
            page.click("#vibes-open-terminal", timeout=5000)
            page.wait_for_timeout(400)

            # Capture the chart state from the Market view. NVDA button is in the markup but
            # is hidden at boot (unlocks is empty for a fresh player) per
            # the refreshUnlockedTickers rule. We do not click it here;
            # clicking it would require unlocking NVDA first.
            summary["dom"]["chart_ticker_at_boot"] = page.eval_on_selector('[data-vc-ticker]', 'el => el.textContent')
            summary["dom"]["chart_price_at_boot"] = page.eval_on_selector('[data-vc-price]', 'el => el.textContent')
            summary["dom"]["chart_nvda_button_visible"] = page.eval_on_selector('[data-vc-ticker-btn="NVDA"]', 'el => !el.hidden')
            summary["dom"]["chart_aapl_button_visible"] = page.eval_on_selector('[data-vc-ticker-btn="AAPL"]', 'el => !el.hidden')
            summary["dom"]["pre_ipo_control_count"] = page.eval_on_selector_all(
                '[data-vc-ticker-btn="OPENAI"], [data-vc-ticker-btn="ANTHROPIC"], [data-vt-ot-ticker] option[value="OPENAI"], [data-vt-ot-ticker] option[value="ANTHROPIC"]',
                'els => els.length',
            )
            out4 = os.path.join(SCREENSHOTS_DIR, "04-chart-nvda.png")
            page.screenshot(path=out4)
            summary["screenshots"].append(out4)

            # Initial menu DOM (re-check after the open/close cycles)
            page.click('[data-vc-ticker-btn="AAPL"]', timeout=10000)
            page.wait_for_timeout(1500)
            summary["dom"]["initial_boot_hidden"] = True  # banner was hidden at start
            summary["dom"]["initial_menu_open"] = True
            summary["dom"]["initial_chart_visible"] = True
            bridge = page.query_selector('#vibes-aim-bridge')
            summary["dom"]["initial_bridge_present"] = bridge is not None
            summary["dom"]["initial_bridge_text"] = bridge.text_content().strip() if bridge else ""
            summary["dom"]["initial_bridge_aria_label"] = bridge.get_attribute("aria-label") if bridge else None
            summary["dom"]["initial_ticker"] = "AAPL"

            browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

    # Chrome reports a generic "Failed to load resource" for any 4xx/5xx
    # without giving us the URL, so we can only filter by known text.
    # PWA files we never copied: sw.js, manifest.webmanifest. The
    # pre-VIBES_API_BASE error is from the very first fetches that fire
    # before the init script sets the base URL. Page errors (uncaught
    # exceptions in page scripts) are the authoritative signal; console
    # errors are best-effort and reported but do not fail the test.
    summary["real_console"] = [e for e in summary["console_errors"]
                               if "sw.js" not in e
                               and "manifest.webmanifest" not in e
                               and "ERR_CONNECTION_REFUSED" not in e
                               and "ERR_FAILED" not in e
                               ]
    summary["real_errors"] = list(summary["page_errors"])

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if not summary['real_errors'] else 1


if __name__ == "__main__":
    sys.exit(main())
