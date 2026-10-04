// Stats engine — derived combat stats recomputed on an 80ms ticker (12.5 Hz),
// DOM touched only when a rendered value actually changes (cached strings).
// The per-frame sim only bumps raw counters; all division/formatting lives here.

import { STAT_TICK_MS } from '../data/mechanics.js';

export function createStats() {
  const raw = {
    shots: 0, pulls: 0, pellets: 0, pelletHits: 0, hits: 0, head: 0, body: 0, leg: 0,
    kills: 0, damage: 0, headKills: 0, score: 0, streak: 0, bestStreak: 0,
    ttks: [], held: 0, onT: 0,
  };
  const cache = {};
  let pipCache = '';
  const set = (id, v) => {
    if (cache[id] === v) return;
    cache[id] = v;
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  // mag pips: rebuilt only when ammo/mag changes (skipped for >30rd mags + knife)
  const renderPips = extra => {
    const box = document.getElementById('magpips');
    if (!box) return;
    const key = extra.mag + ':' + extra.ammo;
    if (key === pipCache) return;
    pipCache = key;
    if (!extra.mag || extra.mag > 30) { box.innerHTML = ''; return; }
    let s = '';
    for (let i = 0; i < extra.mag; i++) s += `<i class="${i < extra.ammo ? 'on' : ''}"></i>`;
    box.innerHTML = s;
  };
  return {
    raw,
    reset() { for (const k of Object.keys(raw)) raw[k] = Array.isArray(raw[k]) ? [] : 0; for (const k of Object.keys(cache)) delete cache[k]; pipCache = ''; },
    // 80ms render pass — call from setInterval, never from rAF
    render(mode, timeLeft, elapsed, extra = {}) {
      const r = raw;
      const acc = r.shots > 0 ? Math.round(100 * r.hits / r.shots) : null;
      const hsp = r.hits > 0 ? Math.round(100 * r.head / r.hits) : null;
      const kps = elapsed > 1 ? (r.kills / elapsed) : null;
      set('st-score', String(r.score));
      set('st-kills', String(r.kills));
      set('st-timer', mode === 'flick' ? `${r.kills} / 30` : Math.max(0, timeLeft).toFixed(1));
      set('st-hs', hsp === null ? '—' : hsp + '%');
      set('st-acc', acc === null ? '—' : acc + '%');
      set('st-dmg', String(Math.round(r.damage)));
      set('st-kps', extra.tracking
        ? (r.held > 0 ? Math.round(100 * r.onT / r.held) + '%' : '—')
        : (kps === null ? '—' : kps.toFixed(2)));
      set('st-streak', String(r.streak));
      if (extra.hp !== undefined) set('st-hp', extra.hp);
      if (extra.ammo !== undefined) set('st-ammo', extra.noReload ? '∞ / ∞' : extra.equipping ? 'EQUIPPING' : extra.reloading ? 'RELOADING' : `${extra.ammo} / ∞`);
      if (extra.range !== undefined) set('st-range', extra.range >= 0 ? extra.range.toFixed(0) + 'm' : '—');
      renderPips(extra);
    },
    startLoop(mode, ctx) {
      this.stopLoop();
      this._t = setInterval(() => this.render(mode, ctx.timeLeft(), ctx.elapsed(), ctx.extra()), STAT_TICK_MS);
    },
    stopLoop() { if (this._t) { clearInterval(this._t); this._t = null; } },
  };
}

// Killfeed — fixed pool of 5 rows, VALORANT style: YOU [gun] BOT 125
export function createKillfeed() {
  const box = document.getElementById('killfeed');
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const d = document.createElement('div');
    d.className = 'kf-row'; d.style.opacity = '0';
    box.appendChild(d); rows.push({ el: d, t: 0 });
  }
  let idx = 0;
  return {
    push(gunName, dmg, head, dist) {
      const r = rows[idx++ % rows.length];
      r.el.innerHTML = `<span class="kf-you">YOU</span><span class="kf-gun">${gunName}</span><span class="kf-vic">${head ? 'HEADSHOT' : 'BOT'} ${Math.round(dmg)}</span><span class="kf-dist">${dist.toFixed(0)}m</span>`;
      r.el.classList.toggle('head', head);
      r.el.style.opacity = '1';
      r.t = performance.now();
    },
    tick() {
      const now = performance.now();
      for (const r of rows) if (r.t && now - r.t > 4000) { r.el.style.opacity = '0'; r.t = 0; }
    },
  };
}
