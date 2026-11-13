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

assert.match(game, /class="rank-domain-row\$\{item\.label === 'Trading Balance' \? ' rank-domain-balance' : ''\}"/);
assert.doesNotMatch(game, /<em>\$\{item\.point\}\/\$\{TOTAL_RANK_POINTS\}<\/em>/);
assert.match(html, /class="rank-overall-label" id="rank-profile-title">Overall Rank/);
assert.match(html, /rank-info-tooltip/);
assert.match(html, /data-rank-overall-next>Mark II/);
assert.match(html, /style\.css\?v=20261110-5/);
assert.match(fs.readFileSync('client/css/style.css', 'utf8'), /\.rank-domain-list \{ display: grid; grid-template-columns: minmax\(0,1fr\) minmax\(0,1fr\) minmax\(0,1\.12fr\)/);
assert.match(fs.readFileSync('client/css/style.css', 'utf8'), /\.rank-domain-balance \{ grid-column: 3; grid-row: 1 \/ span 2/);
assert.match(game, /data-tooltip="Next \$\{item\.next\}" tabindex="0"/);

console.log('rank runtime wiring: ALL PASS');
