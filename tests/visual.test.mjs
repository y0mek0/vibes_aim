// tests/visual.test.mjs — runs the Playwright visual smoke (Python) and
// asserts the critical DOM state and that all 4 screenshots exist.
// Falls back to a no-op pass if Python+Playwright are not installed, so
// `npm test` is still green in environments without a browser.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

let fails = 0;
const ok  = (m) => console.log(`ok   ${m}`);
const bad = (m) => { fails++; console.error(`FAIL ${m}`); };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const py = path.join(root, 'tests', 'visual_smoke.py');
const screenshots = path.join(root, 'docs', 'screenshots');

// Probe Python + Playwright availability quickly. If the probe fails
// we skip the visual test (still green) and surface a single line of
// guidance so the developer knows how to enable it.
function probe() {
  const r = spawnSync('python', ['-c', 'import playwright'], { encoding: 'utf8' });
  return r.status === 0;
}

if (!probe()) {
  console.log('skip   visual smoke (python playwright not available)');
  console.log('ALL PASS');
  process.exit(0);
}

const r = spawnSync('python', [py], { encoding: 'utf8', cwd: root });
if (r.status !== 0) {
  console.error('visual_smoke.py failed');
  console.error('stdout:', r.stdout);
  console.error('stderr:', r.stderr);
  process.exit(1);
}

// Extract the last JSON block from stdout (the helper script prints
// the summary to stdout). The helper script also writes PNG files; we
// assert on both.
let summary;
try {
  const match = r.stdout.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no JSON found in stdout');
  summary = JSON.parse(match[0]);
} catch (e) {
  console.error('failed to parse visual_smoke summary:', e.message);
  console.error('stdout was:', r.stdout.slice(-2000));
  process.exit(1);
}

// 1. screenshots exist
const required = [
  '01-initial-menu.png',
  '02-terminal.png',
  '03-missions.png',
  '04-chart-nvda.png',
];
for (const name of required) {
  const p = path.join(screenshots, name);
  if (existsSync(p) && readFileSync(p).length > 1024) ok(`screenshot exists and non-trivial: ${name}`);
  else bad(`screenshot missing or empty: ${name}`);
}

// 2. critical DOM state
assert.equal(summary.dom.initial_menu_open, true, 'engine menu should open');
ok('engine menu opened on boot');
assert.equal(summary.dom.initial_chart_visible, true, 'chart panel should be visible');
ok('chart panel is visible on boot');
assert.equal(summary.dom.initial_bridge_present, false, 'aim-bridge HUD chip should be removed from the dashboard');
ok('aim-bridge HUD chip is absent');
assert.equal(summary.dom.initial_bridge_text, '', 'removed HUD chip should not render text');
assert.equal(summary.dom.initial_bridge_aria_label, null, 'removed HUD chip should not render an aria label');
assert.equal(summary.dom.initial_ticker, 'AAPL', 'default ticker should be AAPL');
ok('default ticker is AAPL');
assert.equal(summary.dom.terminal_stable, '200.00', 'fresh player has 200 Stable');
ok('fresh player has 200.00 Stable in the shared Market workspace');
assert.equal(summary.dom.missions_claimed, '0', 'no missions claimed at boot');
assert.equal(summary.dom.missions_total, '6', '6 missions exist');
assert.equal(summary.dom.mission_rows, 6, 'mission table has 6 rows');
assert.equal(summary.dom.unlock_card_hidden, true, 'unlock card hidden until all 6 are claimed');
ok('missions fresh state: 0/6, unlock card hidden, 6 rows');
// At boot, AAPL is always visible (default ticker) and NVDA is hidden
// (unlocks is empty until the player completes the AAPL chain).
assert.equal(summary.dom.chart_aapl_button_visible, true, 'AAPL ticker button visible');
ok('AAPL ticker button is visible at boot');
assert.equal(summary.dom.chart_nvda_button_visible, false, 'NVDA ticker button hidden at boot');
ok('NVDA ticker button is hidden at boot (unlocks empty)');
assert.equal(summary.dom.pre_ipo_control_count, 0, 'pre-IPO tickers must not have chart or terminal controls');
ok('pre-IPO tickers have no selectable chart or terminal control');
if (/^[0-9]+\./.test(summary.dom.chart_price_at_boot)) {
  ok(`chart shows AAPL price at boot: ${summary.dom.chart_price_at_boot}`);
} else {
  bad(`chart AAPL price at boot not numeric: ${summary.dom.chart_price_at_boot}`);
}

// 3. Zero unexpected browser errors. The Python harness preserves URL-level
// diagnostics for any failure, so a generic 404 cannot silently pass.
if (Array.isArray(summary.real_errors) && summary.real_errors.length === 0) {
  ok('no real page errors during the smoke');
} else {
  bad(`page errors during smoke: ${JSON.stringify(summary.real_errors).slice(0, 400)}`);
}
if (Array.isArray(summary.real_console) && summary.real_console.length === 0) {
  ok('no unexpected console errors during the smoke');
} else {
  const details = JSON.stringify(summary.console_error_details || []).slice(0, 800);
  bad(`console errors during smoke: ${details}`);
}
if (Array.isArray(summary.request_failures) && summary.request_failures.length === 0) {
  ok('no failed browser requests during the smoke');
} else {
  bad(`failed browser requests: ${JSON.stringify(summary.request_failures).slice(0, 800)}`);
}
if (Array.isArray(summary.error_responses) && summary.error_responses.length === 0) {
  ok('no 4xx/5xx app responses during the smoke');
} else {
  bad(`4xx/5xx app responses: ${JSON.stringify(summary.error_responses).slice(0, 800)}`);
}
if (Array.isArray(summary.static_errors) && summary.static_errors.length === 0) {
  ok('no 4xx/5xx static-host responses during the smoke');
} else {
  bad(`4xx/5xx static-host responses: ${JSON.stringify(summary.static_errors).slice(0, 800)}`);
}

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
