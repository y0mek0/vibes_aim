import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync('client/js/game.js', 'utf8');
const html = fs.readFileSync('client/index.html', 'utf8');
const terminal = fs.readFileSync('client/js/terminal.js', 'utf8');

assert.match(game, /qualifyingAimSession\(\{ mode, durationSeconds, completed: completedFullSession \}\)/);
assert.match(game, /qualifiedScores\(m\)/);
assert.match(game, /rankProgress\.aim\[m\] = aimRankFromScores/);
assert.match(game, /RANK_STAGES\.filter/);
assert.match(game, /data-rank-rows/);
assert.match(game, /BALANCE_THRESHOLDS_USD\[balancePoint\]/);
assert.match(html, /data-rank-profile/);
assert.match(html, /Ranked runs: 5 min · completed sessions only/);
assert.match(html, /class="rank-legend"/);
assert.match(terminal, /window\.__aim2stockPortfolioValue/);
assert.match(terminal, /window\.renderMenuStats\(\)/);

console.log('rank runtime wiring: ALL PASS');
