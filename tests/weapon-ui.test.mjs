import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync(new URL('../client/js/game.js', import.meta.url), 'utf8');
const upstream = fs.readFileSync(new URL('../client/css/upstream.css', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../client/css/style.css', import.meta.url), 'utf8');

assert.match(game, /document\.body\.classList\.toggle\('buy-open', open\)/);
assert.match(upstream, /body\.playing:not\(\.buy-open\)\{cursor:none\}/);
assert.match(style, /#buy \.gsil \{[^}]*height:\s*14px/);
assert.match(style, /#buy \.buy-meta b \{[^}]*font-size:\s*18px/);
assert.match(style, /#buy \.nvda-boost-badge \{[^}]*font-size:\s*10px/);
assert.match(style, /#menu \.brand-logo-top,\s*#menu \.brand-logo-bot \{[^}]*color:\s*#fff/);
assert.match(style, /#menu \.brand-link:hover \.brand-logo-top,\s*#menu \.brand-link:hover \.brand-logo-bot \{[^}]*color:\s*#f6d447/);
assert.match(style, /#buy \.buy-meta \.eq \{[^}]*-webkit-text-stroke:\s*\.5px #000/);

console.log('Buy-menu cursor, weapon-card readability, and logo hover: ALL PASS');
