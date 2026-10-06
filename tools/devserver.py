# tools/devserver.py - local static file server with no-cache headers.
#
# Replaces `python -m http.server 4173 --directory client` when the dev
# loop needs to ensure the browser always reads the latest ESM modules.
# ESM imports are cached aggressively by the browser, and any stale
# module (e.g. an old api.js with the legacy `3000` baseUrl) can silently
# break the boot path. We force no-cache on every .js / .css / .html
# response so a hard refresh is enough to pick up new code.
#
# Usage: python tools/devserver.py [port]  (default 4173)
import sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client')
os.chdir(ROOT)

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for everything; ESM is sensitive to stale modules.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quieter logs: skip per-request noise, only show 4xx/5xx.
        status = args[1] if len(args) > 1 else ''
        if status and (status.startswith('4') or status.startswith('5')):
            super().log_message(fmt, *args)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    print(f'[devserver] serving {ROOT} on http://127.0.0.1:{port} (no-cache)')
    ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
