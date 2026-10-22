import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../client/css/style.css', import.meta.url), 'utf8');
const game = fs.readFileSync(new URL('../client/js/game.js', import.meta.url), 'utf8');

assert.match(html, /id="p-crosshair">Settings<\/button>/);
assert.match(html, /class="pause-actions"/);
assert.match(html, /class="pause-action primary" id="p-resume"/);
assert.match(html, /class="pause-action" id="p-crosshair"/);
assert.match(html, /class="pause-action" id="p-quit"/);
assert.match(css, /#pause \.pause-action/);
assert.match(css, /#pause \.pause-actions/);
assert.match(game, /priceStable/);
assert.doesNotMatch(game, /\$\{g\.price\} cr/);
console.log('Pause controls and weapon price labels: ALL PASS');
