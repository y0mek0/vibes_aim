// VALORANT crosshair profile codec — pure, no DOM (node-testable).
// Format: `0;s;1;P;<tokens>[;A;<tokens>][;S;<tokens>]` — P = primary, A = ADS,
// S = sniper scope. Token reference (Liquipedia Module:Crosshair + community
// reverse-engineering, see DATA_SOURCES.md):
//   c color 0..8 | u custom RRGGBB | h outlines 0/1 | o outline opacity 0..1
//   t outline thickness 1..6 | d center dot 0/1 | a dot opacity | z dot size 1..6
//   0b/1b show inner/outer | 0l/1l length | 0t/1t thickness | 0o/1o offset
//   0a/1a opacity | 0m/1m move error 0/1 | 0f/1f fire error 0/1
//   0s/1s move mult 0..3 | 0e/1e fire mult 0..3 | m override flag | f fade flag
// Unknown keys (e.g. b, p) and A/S segments are preserved verbatim so pro
// codes survive an import -> export round-trip byte-identical in spirit.

export const PRESET_COLORS = [
  { name: 'White', hex: '#FFFFFF' }, { name: 'Green', hex: '#00FF00' },
  { name: 'Yellow-Green', hex: '#7FFF00' }, { name: 'Green-Yellow', hex: '#DFFF00' },
  { name: 'Yellow', hex: '#FFFF00' }, { name: 'Cyan', hex: '#00FFFF' },
  { name: 'Pink', hex: '#FF00FF' }, { name: 'Red', hex: '#FF0000' },
];

// VALORANT client defaults (missing token = this value)
const DEF = {
  c: 0, h: 1, o: 0.5, t: 1, d: 0, a: 1, z: 2,
  '0b': 1, '0a': 0.8, '0l': 6, '0t': 2, '0o': 3, '0m': 0, '0f': 1, '0s': 1, '0e': 1,
  '1b': 1, '1a': 0.35, '1l': 2, '1t': 2, '1o': 10, '1m': 0, '1f': 1, '1s': 1, '1e': 1,
  m: 0, f: 1,
};

export function freshCrosshair() {
  return {
    color: '#00FFFF', colorIdx: 5,
    outline: true, outlineOp: 0.5, outlineTh: 1,
    dot: false, dotOp: 1, dotSize: 2,
    innerShow: true, len: 6, thick: 2, gap: 3, op: 1,
    outer: false, oLen: 2, oThick: 2, oGap: 10, oOp: 0.35,
    moveErr: false, fireErr: true, moveMult: 1, fireMult: 1,
    fade: true, mOverride: false,
  };
}

// Migrate legacy trainer saves {color,len,thick,gap,dot,outline} — look preserved.
export function migrateCrosshair(sc) {
  const ch = freshCrosshair();
  if (!sc || typeof sc !== 'object') return ch;
  if (Number.isFinite(sc.len)) ch.len = sc.len;
  if (Number.isFinite(sc.thick)) ch.thick = sc.thick;
  if (Number.isFinite(sc.gap)) ch.gap = sc.gap;
  if (typeof sc.dot === 'boolean') ch.dot = sc.dot;
  if (typeof sc.outline === 'boolean') ch.outline = sc.outline;
  if (typeof sc.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(sc.color)) {
    ch.color = sc.color.toUpperCase(); ch.colorIdx = 8; // custom: exact look kept
  }
  for (const k of ['colorIdx', 'outlineOp', 'outlineTh', 'dotOp', 'dotSize', 'innerShow',
    'op', 'outer', 'oLen', 'oThick', 'oGap', 'oOp', 'moveErr', 'fireErr',
    'moveMult', 'fireMult', 'fade', 'mOverride']) {
    if (sc[k] !== undefined) ch[k] = sc[k];
  }
  return sanitize(ch);
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, fb) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; };

function sanitize(ch) {
  ch.colorIdx = clamp(Math.round(num(ch.colorIdx, 5)) | 0, 0, 8);
  const preset = PRESET_COLORS[ch.colorIdx];
  if (ch.colorIdx < 8) ch.color = preset.hex;
  else if (!/^#[0-9A-F]{6}$/.test(ch.color)) ch.color = '#FFFFFF';
  else ch.color = ch.color.toUpperCase();
  ch.outlineOp = clamp(num(ch.outlineOp, 0.5), 0, 1);
  ch.outlineTh = clamp(Math.round(num(ch.outlineTh, 1)), 1, 6);
  ch.dotOp = clamp(num(ch.dotOp, 1), 0, 1);
  ch.dotSize = clamp(Math.round(num(ch.dotSize, 2)), 1, 6);
  ch.len = clamp(Math.round(num(ch.len, 6)), 0, 20);
  ch.thick = clamp(Math.round(num(ch.thick, 2)), 0, 10);
  ch.gap = clamp(Math.round(num(ch.gap, 3)), 0, 20);
  ch.op = clamp(num(ch.op, 1), 0, 1);
  ch.oLen = clamp(Math.round(num(ch.oLen, 2)), 0, 10);
  ch.oThick = clamp(Math.round(num(ch.oThick, 2)), 0, 10);
  ch.oGap = clamp(Math.round(num(ch.oGap, 10)), 0, 40);
  ch.oOp = clamp(num(ch.oOp, 0.35), 0, 1);
  ch.moveMult = clamp(num(ch.moveMult, 1), 0, 3);
  ch.fireMult = clamp(num(ch.fireMult, 1), 0, 3);
  for (const k of ['outline', 'dot', 'innerShow', 'outer', 'moveErr', 'fireErr', 'fade', 'mOverride']) ch[k] = !!ch[k];
  return ch;
}

// Minimal number formatting VALORANT accepts (1, 0.5, 0.506 — never 1.0).
export function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Number.isInteger(r) ? String(r) : String(r);
}

// Parse any real code. Tolerant: NaN/garbage tokens become warnings, unknown
// keys + A/S segments are preserved for byte-faithful re-export.
export function parseCode(input) {
  const errors = [], warnings = [], unknown = [];
  const segments = { A: null, S: null };
  if (typeof input !== 'string' || !input.trim()) return { ok: false, errors: ['empty code'], warnings, unknown, segments };
  const raw = input.trim();
  const parts = raw.split(';');
  if (parts[0] !== '0' || !parts.includes('P')) {
    return { ok: false, errors: ['not a VALORANT profile code (must start with 0; and contain P;)'], warnings, unknown, segments };
  }
  const ch = freshCrosshair();
  const map = {}; // P-segment key -> raw string value
  let seg = '0';
  const segPairs = { A: [], S: [] };
  for (let i = 1; i < parts.length; i += 2) {
    const k = parts[i], v = parts[i + 1];
    if (k === 'P' || k === 'A' || k === 'S') { seg = k; i -= 1; continue; }
    if (v === undefined) { warnings.push(`dangling token '${k}' ignored`); break; }
    if (seg === 'A' || seg === 'S') { segPairs[seg].push(k, v); continue; }
    map[k] = v;
  }
  for (const s of ['A', 'S']) if (segPairs[s].length) segments[s] = segPairs[s].join(';');
  const KNOWN = new Set(Object.keys(DEF).concat(['u', '0v', '0g', '1v', '1g']));
  for (const [k, v] of Object.entries(map)) {
    if (!KNOWN.has(k)) { unknown.push(k, v); warnings.push(`unknown token '${k}' preserved`); }
  }
  const bad = k => { warnings.push(`token '${k}' invalid ('${map[k]}') — default used`); };
  const getN = (k, min, max) => {
    if (!(k in map)) return DEF[k];
    const n = parseFloat(map[k]);
    if (!Number.isFinite(n)) { bad(k); return DEF[k]; }
    if (n < min || n > max) warnings.push(`token '${k}' clamped ${n} -> [${min},${max}]`);
    return clamp(n, min, max);
  };
  const getB = k => {
    if (!(k in map)) return !!DEF[k];
    const n = parseFloat(map[k]);
    if (n !== 0 && n !== 1) { bad(k); return !!DEF[k]; }
    return n === 1;
  };
  ch.colorIdx = Math.round(getN('c', 0, 8));
  if (ch.colorIdx === 8) {
    const u = (map.u || '').toUpperCase();
    if (/^[0-9A-F]{6}$/.test(u)) ch.color = '#' + u;
    else { warnings.push('custom color missing/invalid — white used'); ch.color = '#FFFFFF'; }
  } else ch.color = PRESET_COLORS[ch.colorIdx].hex;
  ch.outline = getB('h'); ch.outlineOp = getN('o', 0, 1); ch.outlineTh = Math.round(getN('t', 1, 6));
  ch.dot = getB('d'); ch.dotOp = getN('a', 0, 1); ch.dotSize = Math.round(getN('z', 1, 6));
  ch.innerShow = getB('0b'); ch.op = getN('0a', 0, 1);
  ch.len = Math.round(getN('0l', 0, 20)); ch.thick = Math.round(getN('0t', 0, 10)); ch.gap = Math.round(getN('0o', 0, 20));
  ch.moveErr = getB('0m'); ch.fireErr = getB('0f'); ch.moveMult = getN('0s', 0, 3); ch.fireMult = getN('0e', 0, 3);
  ch.outer = getB('1b'); ch.oOp = getN('1a', 0, 1);
  ch.oLen = Math.round(getN('1l', 0, 10)); ch.oThick = Math.round(getN('1t', 0, 10)); ch.oGap = Math.round(getN('1o', 0, 40));
  ch._outerMove = getB('1m'); ch._outerFire = getB('1f'); ch._outerMoveMult = getN('1s', 0, 3); ch._outerFireMult = getN('1e', 0, 3);
  ch.mOverride = getB('m'); ch.fade = getB('f');
  if ('0v' in map || '0g' in map) warnings.push('unlinked vertical inner length merged into length');
  if ('1v' in map || '1g' in map) warnings.push('unlinked vertical outer length merged into length');
  sanitize(ch);
  return { ok: true, settings: ch, errors, warnings, unknown, segments };
}

// Canonical export: `0;s;1;P;<non-default tokens>` + preserved A/S. Omits
// defaults so output looks exactly like native VALORANT exports.
export function buildCode(ch, preserved) {
  const c = sanitize({ ...ch });
  const T = [];
  const put = (k, v, def) => { if (v !== def) T.push(k, fmt(v)); };
  const putB = (k, v, def) => { if (!!v !== !!def) T.push(k, v ? 1 : 0); };
  T.push('c', c.colorIdx);
  if (c.colorIdx === 8) T.push('u', c.color.slice(1));
  putB('h', c.outline, 1);
  if (c.outline) { put('o', c.outlineOp, 0.5); put('t', Math.round(c.outlineTh), 1); }
  putB('d', c.dot, 0);
  if (c.dot) { put('a', c.dotOp, 1); put('z', Math.round(c.dotSize), 2); }
  putB('0b', c.innerShow, 1);
  if (c.innerShow) {
    put('0l', Math.round(c.len), 6); put('0t', Math.round(c.thick), 2);
    put('0o', Math.round(c.gap), 3); put('0a', c.op, 0.8);
    putB('0m', c.moveErr, 0); putB('0f', c.fireErr, 1);
    put('0s', c.moveMult, 1); put('0e', c.fireMult, 1);
  }
  T.push('1b', c.outer ? 1 : 0);
  if (c.outer) {
    put('1l', Math.round(c.oLen), 2); put('1t', Math.round(c.oThick), 2);
    put('1o', Math.round(c.oGap), 10); put('1a', c.oOp, 0.35);
    putB('1m', !!c._outerMove, 0); putB('1f', c._outerFire !== undefined ? !!c._outerFire : true, 1);
    put('1s', c._outerMoveMult !== undefined ? c._outerMoveMult : 1, 1);
    put('1e', c._outerFireMult !== undefined ? c._outerFireMult : 1, 1);
  }
  putB('m', c.mOverride, 0);
  putB('f', c.fade, 1);
  let code = '0;s;1;P;' + T.join(';');
  if (preserved) {
    if (preserved.A) code += ';A;' + preserved.A;
    if (preserved.S) code += ';S;' + preserved.S;
  }
  return code;
}
