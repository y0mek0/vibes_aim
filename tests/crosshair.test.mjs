// Node test: crosshair codec vs real VALORANT pro codes.
// Run: node tests/crosshair.test.mjs (from valotrainer/)
import { parseCode, buildCode, freshCrosshair, PRESET_COLORS } from '../client/js/core/crosshair.js';

let fails = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) { fails++; console.error(`FAIL ${label} ${extra}`); }
  else console.log(`ok   ${label}`);
};
const eq = (label, got, want) => ok(label, Object.is(got, want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// --- real pro codes decode correctly ---
{
  const r = parseCode('0;s;1;P;c;5;h;0;m;1;0l;4;0o;2;0a;1;0f;0;1b;0;S;c;4;o;1'); // TenZ
  eq('tenz ok', r.ok, true);
  eq('tenz cyan', r.settings.colorIdx, 5);
  eq('tenz outlines off', r.settings.outline, false);
  eq('tenz m-override', r.settings.mOverride, true);
  eq('tenz len', r.settings.len, 4);
  eq('tenz gap', r.settings.gap, 2);
  eq('tenz fireerr off', r.settings.fireErr, false);
  eq('tenz outer off', r.settings.outer, false);
  eq('tenz S preserved', r.segments.S, 'c;4;o;1');
  eq('tenz color hex', r.settings.color, '#00FFFF');
}
{
  const r = parseCode('0;P;h;0;0l;4;0o;0;0a;1;0f;0;1b;0'); // Aspas
  eq('aspas ok', r.ok, true);
  eq('aspas white default', r.settings.colorIdx, 0);
  eq('aspas zero gap', r.settings.gap, 0);
}
{
  const r = parseCode('0;P;o;0.506;d;1;z;1;0t;1;0l;4;0o;2;0a;1;0f;0;1b;0'); // Shroud
  eq('shroud outline op', r.settings.outlineOp, 0.506);
  eq('shroud dot', r.settings.dot, true);
  eq('shroud dot size', r.settings.dotSize, 1);
  eq('shroud thick', r.settings.thick, 1);
}
{
  const r = parseCode('0;P;c;1;h;0;d;1;z;1;0t;1;0l;2;0a;1;0f;0;1l;5;1o;4;1a;1;1m;0;1f;0'); // Hiko
  eq('hiko outer on (default 1b)', r.settings.outer, true);
  eq('hiko outer len', r.settings.oLen, 5);
  eq('hiko outer gap', r.settings.oGap, 4);
  eq('hiko outer op', r.settings.oOp, 1);
}
{
  const r = parseCode('0;P;c;8;o;1;d;1;b;1;z;1;0t;1;0l;1;0o;0;0a;1;0f;0;1b;0'); // dot build
  eq('dot custom idx', r.settings.colorIdx, 8);
  eq('dot unknown b kept', r.unknown.join(';'), 'b;1');
  ok('dot warns missing u', r.warnings.length > 0);
}
{
  // corrupted codes in the wild (NaN) must not crash
  const r = parseCode('0;P;c;8;b;1;t;1;o;0.5;z;2;a;1;0t;2;0l;3;0v;3;0o;1;0a;1;0s;1;0e;1;1t;2;1l;2;1v;2;1o;10;1a;0.35;1s;1;1e;1;u;000000;d;0;h;0;0g;0;1g;0;0f;0;1f;1;0m;0;1m;1;0b;1;1b;0;m;0;1;NaN;f;0;S;NaN');
  eq('corrupt parses', r.ok, true);
  eq('corrupt outline op', r.settings.outlineOp, 0.5);
}

// --- rejects garbage ---
for (const bad of ['', 'hello', '0;P;c;9', '1;2;3']) {
  const r = parseCode(bad);
  if (bad === '0;P;c;9') { ok('clamps bad color not reject', r.ok === true); continue; }
  ok(`rejects '${bad}'`, r.ok === false);
}

// --- exports look native: 0;s;1;P; prefix, digit end, no spaces ---
{
  const s = freshCrosshair();
  s.colorIdx = 5; s.color = '#00FFFF'; s.outline = false; s.len = 4; s.gap = 2; s.fireErr = false;
  const code = buildCode(s);
  ok('export shape', /^0;s;1;P;[^ ]*$/.test(code) && /\d$/.test(code), code);
  ok('export has 1b;0', code.includes('1b;0'));
  ok('export drops defaults', !code.includes('0t;') && !code.includes('0b;'));
  // decode stability: settings survive the round trip
  const back = parseCode(code).settings;
  for (const k of ['colorIdx', 'color', 'outline', 'len', 'gap', 'fireErr', 'outer', 'fade', 'mOverride'])
    eq(`roundtrip ${k}`, back[k], s[k]);
}
// --- full-feature round trip (outer on, custom color, mults, scope segment) ---
{
  const s = freshCrosshair();
  Object.assign(s, { colorIdx: 8, color: '#FF66AA', outlineOp: 0.7, outlineTh: 2, dot: true, dotSize: 3,
    outer: true, oLen: 5, oGap: 7, moveErr: true, moveMult: 1.5, mOverride: true });
  const code = buildCode(s, { S: 'c;4;o;1' });
  ok('custom hex emitted', code.includes('u;FF66AA'));
  ok('S segment kept', code.endsWith(';S;c;4;o;1'));
  const back = parseCode(code).settings;
  for (const k of ['colorIdx', 'color', 'outlineOp', 'outlineTh', 'dot', 'dotSize', 'outer', 'oLen', 'oGap', 'moveErr', 'moveMult', 'mOverride'])
    eq(`full roundtrip ${k}`, back[k], s[k]);
}
eq('8 presets', PRESET_COLORS.length, 8);

if (fails) { console.error(`${fails} FAILURES`); process.exit(1); }
console.log('ALL PASS');
