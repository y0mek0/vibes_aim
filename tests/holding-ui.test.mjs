import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../client/css/style.css', import.meta.url), 'utf8');
const holding = fs.readFileSync(new URL('../client/js/holding.js', import.meta.url), 'utf8');
const game = fs.readFileSync(new URL('../client/js/game.js', import.meta.url), 'utf8');
const aim = fs.readFileSync(new URL('../server/src/routes/aim.js', import.meta.url), 'utf8');

assert.match(index, /data-dashboard-section="holding">A2S Holding/);
assert.match(index, /id="vibes-holding"/);
assert.match(index, /data-holding-matrix-body/);
assert.match(index, /js\/holding\.js\?v=/);
assert.match(holding, /getHoldingMatrix/);
assert.match(css, /\.ah-table td\.is-current/);
assert.match(game, /BOOST NVDA/);
assert.match(aim, /effectiveTicker = nvdaBoosted \? 'NVDA' : ticker/);
console.log('holding UI and NVDA boost wiring: ALL PASS');
