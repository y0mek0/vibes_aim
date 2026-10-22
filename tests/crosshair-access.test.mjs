import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const game = fs.readFileSync(new URL('../client/js/game.js', import.meta.url), 'utf8');
const crosshairPane = html.split('data-customize-pane="crosshair"')[1].split('data-customize-pane="bots"')[0];
const profilePane = html.split('data-customize-pane="profile"')[1].split('</section>')[0];

assert.match(crosshairPane, /id="x-export"/);
assert.match(crosshairPane, /id="x-import"/);
assert.doesNotMatch(profilePane, /id="x-export"|id="x-import"/);
assert.match(html, /id="p-crosshair"/);
assert.match(game, /\$\('p-crosshair'\)\.addEventListener\('click'/);
console.log('Crosshair profile placement and pause entry: ALL PASS');
