import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const home = read('client/index.html');
const page = read('client/updates.html');
const script = read('client/js/updates.js');
const styles = read('client/css/updates.css');
const archive = JSON.parse(read('client/data/update-history.json'));

assert.match(home, /<button type="button" class="nav-link nav-updates" id="updates-open" hidden>/);
const vercel = JSON.parse(read('vercel.json'));
assert.ok(vercel.rewrites.some((route) => route.source === '/updates.html' && route.destination === '/client/updates.html'));
assert.ok(vercel.rewrites.some((route) => route.source === '/data/:path*' && route.destination === '/client/data/:path*'));
assert.match(page, /href="\/"/);
assert.doesNotMatch(home, /updates-panel|updates-modal|updates-close/);
assert.match(page, /id="updates-list"/);
assert.match(page, /Dates are taken from project Git history/);
assert.match(page, /css\/updates\.css\?v=\d{8}-\d+/);
assert.match(page, /js\/updates\.js\?v=\d{8}-\d+/);
assert.match(script, /PLAYER_CHANGE/);
assert.match(script, /INTERNAL_CHANGE/);
assert.match(script, /document\.createElement\('details'\)/);
assert.doesNotMatch(script, /timePart|innerHTML\s*=/);
assert.match(styles, /@media \(max-width: 600px\)/);
assert.equal(archive.source, 'git-commit-history');
assert.equal(archive.timestampField, 'committer-date');
assert.equal(archive.commits.length, archive.count);
assert.ok(archive.count > 0);
assert.equal(archive.commits[0].timestamp, archive.firstCommit);
assert.equal(archive.commits.at(-1).timestamp, archive.latestCommit);
assert.equal(archive.commits.at(-1).hash, archive.latestHash);
assert.equal(new Set(archive.commits.map((commit) => commit.hash)).size, archive.count);
for (const commit of archive.commits) {
  assert.match(commit.hash, /^[a-f0-9]{7}$/);
  assert.match(commit.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.ok(commit.subject.trim());
  assert.ok(['feature', 'fix', 'design', 'qa', 'docs', 'build'].includes(commit.category));
}

console.log(`PASS Updates archive contains ${archive.count} Git commits through ${archive.latestHash}; the page filters to player-facing changes`);
