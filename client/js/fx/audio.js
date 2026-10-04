// Procedural WebAudio — per-gun timbre, zero assets, rate-limited for perf.
// Heavy-user note: one shared AudioContext, one cached noise buffer, short
// envelopes only. No per-frame work.

let AC = null, noiseBuf = null, lastShotT = 0;
const ac = () => {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
};
const noise = () => {
  if (!noiseBuf) {
    const n = ac().sampleRate * 0.12, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
  }
  return noiseBuf;
};
const env = (t0, peak, dur, vol) => {
  const g = ac().createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak * vol, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(AC.destination);
  return g;
};

export const audio = {
  vol: 0.5,
  unlock() { try { ac(); } catch (e) {} },
  // gunshot: bandpassed noise crack + class body thump. minGap avoids overlap pile-up at 16rps.
  shot(freq, dur, minGap = 0.03) {
    if (!this.vol) return;
    const now = performance.now() / 1000;
    if (now - lastShotT < minGap) return;
    lastShotT = now;
    try {
      const t = ac().currentTime;
      const src = AC.createBufferSource(); src.buffer = noise();
      const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.6;
      src.connect(f); f.connect(env(t, 0.16, dur + 0.04, this.vol)); src.start(t); src.stop(t + dur + 0.05);
      const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = Math.max(80, freq * 0.12);
      o.connect(env(t, 0.10, dur + 0.06, this.vol)); o.start(t); o.stop(t + dur + 0.07);
    } catch (e) {}
  },
  body() { this.blip('square', 420, 220, 0.06, 0.12); },
  ding() { // ~1245 Hz VALORANT headshot ding (dual partial)
    if (!this.vol) return;
    try {
      const t = ac().currentTime;
      [[1244.5, 0.22, 0.28], [1864, 0.07, 0.28]].forEach(([fr, p, d]) => {
        const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
        o.connect(env(t, p, d, this.vol)); o.start(t); o.stop(t + d + 0.02);
      });
    } catch (e) {}
  },
  kill() { this.blip('sine', 660, null, 0.16, 0.15, 880); },
  click() { this.blip('square', 900, null, 0.03, 0.05); },
  reload() { this.blip('square', 300, 500, 0.09, 0.08); },
  // katana: soft grip tick NOW, airy whoosh peaking AT the strike (~0.19 s), shing on connect
  katanaSwing(heavy) {
    if (!this.vol) return;
    const vol = this.vol;
    try {
      const t = ac().currentTime;
      const tick = AC.createOscillator(); tick.type = 'triangle'; tick.frequency.value = heavy ? 180 : 260;
      tick.connect(env(t, 0.05, 0.05, vol)); tick.start(t); tick.stop(t + 0.07);
      setTimeout(() => {
        if (!vol) return;
        try {
          const t2 = ac().currentTime;
          const src = AC.createBufferSource(); src.buffer = noise();
          const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
          f.frequency.setValueAtTime(heavy ? 600 : 1100, t2);
          f.frequency.exponentialRampToValueAtTime(heavy ? 180 : 2600, t2 + 0.10);
          src.connect(f); f.connect(env(t2, 0.15, 0.16, vol));
          src.start(t2); src.stop(t2 + 0.2);
        } catch (e) {}
      }, heavy ? 110 : 90);
    } catch (e) {}
  },
  katanaHit() {
    if (!this.vol) return;
    try {
      const t = ac().currentTime;
      [[3400, 0.10, 0.14], [5100, 0.06, 0.10]].forEach(([fr, p, d]) => {
        const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        o.connect(env(t, p, d, this.vol)); o.start(t); o.stop(t + d + 0.02);
      });
      this.blip('triangle', 220, 110, 0.08, 0.10);
    } catch (e) {}
  },
  inspectSpin() {
    if (!this.vol) return;
    try {
      const t = ac().currentTime;
      const src = AC.createBufferSource(); src.buffer = noise();
      const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
      src.connect(f); f.connect(env(t + 0.15, 0.08, 0.9, this.vol));
      src.start(t + 0.15); src.stop(t + 1.1);
      this.blip('square', 500, null, 0.03, 0.07);
      setTimeout(() => this.katanaHit(), 900);
    } catch (e) {}
  },
  blip(type, f0, f1, dur, peak, f1b) {
    if (!this.vol) return;
    try {
      const t = ac().currentTime, o = AC.createOscillator();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      if (f1b) o.frequency.setValueAtTime(f1b, t + 0.07);
      o.connect(env(t, peak, dur, this.vol)); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  },
};
