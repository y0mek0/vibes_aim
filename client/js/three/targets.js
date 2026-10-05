// Targets — shared geos/mats (never per-spawn), orb hover, bot lean.
// Caller owns the `targets` array + raycast list via rebuild().

import * as THREE from 'three';
import { spawnIntro } from '../core/gunplay.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createTargets(scene) {
  const orbGeo = new THREE.SphereGeometry(0.26, 18, 12);
  // Project palette: stable yellow targets on a dark field; no animated emissive pulse.
  const orbMat = new THREE.MeshLambertMaterial({ color: 0xf6d447, emissive: 0x6f5b12, emissiveIntensity: 0.35 });
  const orbFlash = new THREE.MeshBasicMaterial({ color: 0xf4f1ea });
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x26313a, emissive: 0x090d10, emissiveIntensity: 0.2 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xf4f1ea, emissive: 0x27303a, emissiveIntensity: 0.2 });
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x07070c });
  const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.85, 4, 10);
  const headGeo = new THREE.SphereGeometry(0.165, 14, 10);
  const chestGeo = new THREE.BoxGeometry(0.62, 0.5, 0.34);
  const visorGeo = new THREE.BoxGeometry(0.22, 0.06, 0.05);
  const shadowGeo = new THREE.CircleGeometry(0.42, 16);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
  // HP bars: 2 shared-material sprites per bot (no per-hit allocation, transform-only updates)
  const hpBgMat = new THREE.SpriteMaterial({ color: 0x0b0e12, transparent: true, opacity: 0.65, depthWrite: false });
  const hpFgG = new THREE.SpriteMaterial({ color: 0x7df9c5, depthWrite: false });
  const hpFgY = new THREE.SpriteMaterial({ color: 0xf6d447, depthWrite: false });
  const hpFgR = new THREE.SpriteMaterial({ color: 0x7df9c5, depthWrite: false });

  // specular glint: one shared additive sprite per orb, offset top-front so the
  // sphere reads glossy as it moves (1 tiny draw each, no per-frame cost)
  const glintTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glintMat = new THREE.SpriteMaterial({ map: glintTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });

  const targets = [];
  let meshes = [];
  const rebuild = () => { meshes = []; for (const t of targets) for (const m of t.meshes) meshes.push(m); };

  // hpTier: 100 | 125 | 150. scale: XS head-size .. XL (group-scaled, raycast follows).
  function spawnOrb(p, hpTier, scale = 1) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(orbGeo, orbMat);
    g.add(mesh);
    const glint = new THREE.Sprite(glintMat);
    glint.scale.setScalar(0.24); glint.position.set(0.10, 0.11, 0.20); g.add(glint);
    g.scale.setScalar(scale); g.position.copy(p); scene.add(g);
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2; sh.position.set(p.x, 0.02, p.z);
    sh.scale.setScalar(clamp(1.2 - p.y * 0.08, 0.4, 1) * scale); scene.add(sh);
    const t = { type: 'orb', group: g, shadow: sh, meshes: [mesh], hp: hpTier, maxHp: hpTier,
      spawnT: performance.now(), alive: true, baseY: p.y, ax: p.x, az: p.z, orbScale: scale,
      strafeR: 1.0 + Math.random() * 0.5, strafeSp: 1.2 + Math.random() * 0.8,
      phase: Math.random() * 6.28 };
    mesh.userData = { t, part: 'orb' };
    targets.push(t); rebuild(); return t;
  }
  function setOrbScaleAll(scale) { // live resize (size selector): existing orbs follow
    for (const t of targets) {
      if (t.type !== 'orb') continue;
      t.orbScale = scale; t.group.scale.setScalar(scale);
    }
  }
  function spawnBot(p, hpTier) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = 0.95;
    const chest = new THREE.Mesh(chestGeo, bodyMat); chest.position.y = 1.18; chest.position.z = 0.02;
    const head = new THREE.Mesh(headGeo, headMat); head.position.y = 1.66;
    const visor = new THREE.Mesh(visorGeo, visorMat); visor.position.set(0, 1.68, 0.14);
    const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015;
    const hpBg = new THREE.Sprite(hpBgMat); hpBg.scale.set(0.95, 0.12, 1); hpBg.position.y = 2.02;
    const hpFg = new THREE.Sprite(hpFgG); hpFg.scale.set(0.9, 0.07, 1); hpFg.position.y = 2.02;
    g.add(body, chest, head, visor, sh, hpBg, hpFg); g.position.copy(p); scene.add(g);
    const t = { type: 'bot', group: g, meshes: [body, chest, head], hp: hpTier, maxHp: hpTier, spawnT: performance.now(), alive: true, head, hpbar: hpFg, phase: Math.random() * 6.28 };
    body.userData = { t, part: 'body' }; chest.userData = { t, part: 'body' }; head.userData = { t, part: 'head' };
    targets.push(t); rebuild(); return t;
  }
  function setHpBar(t) { // call after damage: scale + green->yellow->red via shared mats
    if (!t.hpbar) return;
    const f = clamp(t.hp / t.maxHp, 0, 1);
    t.hpbar.scale.x = Math.max(0.001, 0.9 * f);
    t.hpbar.material = f > 0.5 ? hpFgG : f > 0.25 ? hpFgY : hpFgR;
  }
  function remove(t) {
    t.alive = false; scene.remove(t.group); if (t.shadow) scene.remove(t.shadow);
    const i = targets.indexOf(t); if (i >= 0) targets.splice(i, 1); rebuild();
  }
  function clear() { while (targets.length) remove(targets[0]); }
  function idle(now, move) {
    for (const t of targets) {
      const age = now - t.spawnT;
      const intro = age < 300 ? spawnIntro(age) : 1; // spawn pop: scale in with overshoot
      if (t.type === 'orb') {
        t.group.scale.setScalar(t.orbScale * intro);
        const m = move || 'drift';
        if (m === 'strafe') {
          t.group.position.x = t.ax + Math.sin(now * 0.001 * t.strafeSp + t.phase) * t.strafeR;
          t.group.position.z = t.az + Math.cos(now * 0.0008 * t.strafeSp + t.phase) * t.strafeR * 0.6;
          t.group.position.y = t.baseY + Math.sin(now * 0.004 + t.phase) * 0.06;
        } else if (m === 'drift') {
          t.group.position.x = t.ax; t.group.position.z = t.az;
          t.group.position.y = t.baseY + Math.sin(now * 0.003 + t.phase) * 0.09;
        } else { // still: dead static for pure precision reads
          t.group.position.x = t.ax; t.group.position.z = t.az; t.group.position.y = t.baseY;
        }
        if (t.shadow) {
          t.shadow.position.x = t.group.position.x; t.shadow.position.z = t.group.position.z;
          t.shadow.scale.setScalar(clamp(1.2 - t.group.position.y * 0.08, 0.4, 1) * t.orbScale);
        }
      } else {
        t.group.scale.setScalar(Math.max(0.05, intro)); // bots pop in too
        t.group.position.y = Math.abs(Math.sin(now * 0.004 + t.phase)) * 0.03;
        t.group.rotation.y = Math.sin(now * 0.001 + t.phase) * 0.08;
      }
    }
  }
  return { targets, meshes: () => meshes, spawnOrb, spawnBot, remove, clear, idle, setHpBar, setOrbScaleAll, orbFlash, orbMat };
}
