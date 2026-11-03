import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync(new URL('../client/js/game.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const upstream = fs.readFileSync(new URL('../client/css/upstream.css', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../client/css/style.css', import.meta.url), 'utf8');

assert.match(game, /document\.body\.classList\.toggle\('buy-open', open\)/);
assert.match(upstream, /body\.playing:not\(\.buy-open\)\{cursor:none\}/);
assert.match(style, /#buy \.gsil \{[^}]*height:\s*14px/);
assert.match(style, /#buy \.buy-meta b \{[^}]*font-size:\s*22px[^}]*white-space:\s*nowrap/);
assert.match(style, /#buy \.nvda-boost-badge \{[^}]*font-size:\s*11px/);
assert.match(style, /#menu \.brand-logo-top,\s*#menu \.brand-logo-bot \{[^}]*color:\s*#fff/);
assert.match(style, /#menu \.brand-link:hover \.brand-logo-top,\s*#menu \.brand-link:hover \.brand-logo-bot \{[^}]*color:\s*#f6d447/);
assert.match(style, /#buy \.nvda-boost-badge \{[^}]*background:\s*transparent/);
assert.doesNotMatch(index, /BUY PHASE/);
assert.match(game, /class="boost-mark"/);
assert.match(game, /class="owned-state"/);
assert.match(game, /class="equipped-state"/);
assert.match(game, /const priceText = `\$\$\{priceStable\.toLocaleString\(\)\}`;/);
assert.match(game, /class="price price-available">\$\{priceText\}/);
assert.doesNotMatch(game, /BUY \$\$\{priceStable\.toFixed\(2\)\}/);
assert.doesNotMatch(game, /priceStable\.toFixed\(2\)/);
assert.doesNotMatch(game, /\$\{price\.toLocaleString\(\)\} Stable/);
assert.match(style, /#buy \.price-available \{[^}]*font:\s*700 24px/);
assert.match(style, /#buy \.locked \{[^}]*font:\s*700 20px/);
assert.match(style, /#buy \.equipped-state \{[^}]*background:\s*transparent/);

console.log('Buy-menu cursor, weapon-card readability, and logo hover: ALL PASS');
