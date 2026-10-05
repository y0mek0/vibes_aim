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
