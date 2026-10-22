import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../client/js/auth.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../client/css/style.css', import.meta.url), 'utf8');

assert.match(html, /class="nav-signin-btn" id="auth-signin"/);
assert.match(html, /class="nav-account-chip" id="auth-profile-btn"/);
assert.match(html, /data-auth-avatar/);
assert.match(html, /data-auth-name/);
assert.doesNotMatch(html, /Sign in with Google/);
assert.match(auth, /function accountLabel\(email\)/);
assert.match(auth, /Open account for/);
assert.match(css, /\.nav-account-chip/);
assert.match(css, /\.nav-account-status/);
console.log('Account header states are clear: ALL PASS');
