// Pooled effects + per-gun viewmodel. Fixed memory, zero per-shot allocation.
// Pools: 24 sparks, 10 tracers, 18 decals, 6 damage numbers.

import * as THREE from 'three';

export function createEffects(scene, camera, orbFlash, orbMat) {
  const V1 = new THREE.Vector3(), TV = new THREE.Vector3();

  const sparkGeo = new THREE.SphereGeometry(0.07, 6, 5);
  const sparks = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    m.visible = false; scene.add(m); sparks.push({ m, t: 1, life: 0.16, vx: 0, vy: 0, vz: 0 });
  }
  let sparkIdx = 0;
  const spark = (point, color) => {
    const s = sparks[sparkIdx++ % sparks.length];
    s.m.visible = true; s.m.position.copy(point); s.m.material.color.setHex(color);
    s.m.material.opacity = 0.95; s.m.scale.setScalar(1); s.t = 0;
    s.vx = (Math.random() - 0.5) * 3; s.vy = Math.random() * 3; s.vz = (Math.random() - 0.5) * 3;
  };

  const tracerGeo = new THREE.BoxGeometry(0.02, 0.02, 1);
  const tracers = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xf6d447, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.visible = false; scene.add(m); tracers.push({ m, t: 1 });
  }
  let tracerIdx = 0;
  const tracer = (from, to, color = 0xf6d447) => {
    const tr = tracers[tracerIdx++ % tracers.length];
    TV.addVectors(from, to).multiplyScalar(0.5);
    tr.m.position.copy(TV); tr.m.lookAt(to);
    tr.m.scale.set(1, 1, from.distanceTo(to));
    tr.m.material.color.setHex(color); tr.m.material.opacity = 0.55; tr.m.visible = true; tr.t = 0;
  };

  const decalGeo = new THREE.CircleGeometry(0.09, 10);
  const decals = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ color: 0x343a40, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; scene.add(m); decals.push({ m, t: 1 });
  }
  let decalIdx = 0;
  const decal = (point, normal) => {
    const d = decals[decalIdx++ % decals.length];
    d.m.visible = true; d.m.position.copy(point).addScaledVector(normal, 0.015);
    d.m.lookAt(TV.copy(d.m.position).add(normal));
    d.m.material.opacity = 0.7; d.t = 0;
  };

  const flashes = [];
  const flash = mesh => flashes.push({ mesh, t: 0 });

  // --- viewmodels: one silhouette per class, only the equipped is visible ---
  // (Sheriff -> Vandal is unmistakable now). Anchor `gun` keeps kick/bob.
  const CLASS_TINT = { Sidearm: 0x343a40, SMG: 0x293d36, Shotgun: 0x4a4635, Rifle: 0x343a40, Sniper: 0x3b3945, Heavy: 0x4a4635 };
  const gun = new THREE.Group();
  const _dotMat = new THREE.MeshBasicMaterial({ color: 0xf6d447 });
  const models = {};

  function modelFor(cls) {
    if (models[cls]) return models[cls];
    const dark = new THREE.MeshLambertMaterial({ color: 0x151a20 });
    const mid = new THREE.MeshLambertMaterial({ color: 0x343a40 });
    const tint = new THREE.MeshLambertMaterial({ color: CLASS_TINT[cls] || 0x343a40 });
    const g = new THREE.Group();
    const a = (w, h, d, x, y, z, m) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || dark); q.position.set(x, y, z); g.add(q); };
    const dot = (x, y, z) => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.06), _dotMat); d.position.set(x, y, z); g.add(d); };
    if (cls === 'Sidearm') {
      a(0.07, 0.09, 0.30, 0.22, -0.20, -0.42); a(0.06, 0.15, 0.08, 0.22, -0.29, -0.34, mid);
      a(0.05, 0.05, 0.12, 0.22, -0.185, -0.60, tint); dot(0.22, -0.135, -0.42);
    } else if (cls === 'SMG') {
      a(0.08, 0.10, 0.45, 0.22, -0.20, -0.55); a(0.035, 0.035, 0.32, 0.22, -0.19, -0.93, tint);
      a(0.06, 0.15, 0.10, 0.22, -0.28, -0.48, mid); a(0.09, 0.03, 0.20, 0.22, -0.145, -0.55, mid); dot(0.22, -0.13, -0.55);
    } else if (cls === 'Shotgun') {
      a(0.10, 0.12, 0.50, 0.22, -0.20, -0.55); a(0.11, 0.07, 0.22, 0.22, -0.26, -0.72, tint);
      a(0.06, 0.06, 0.45, 0.22, -0.175, -0.95, mid); a(0.07, 0.14, 0.10, 0.22, -0.28, -0.40, mid);
    } else if (cls === 'Sniper') {
      a(0.09, 0.11, 0.60, 0.22, -0.20, -0.55); a(0.035, 0.035, 0.75, 0.22, -0.185, -1.15, tint);
      a(0.05, 0.06, 0.30, 0.22, -0.10, -0.55, mid); a(0.02, 0.10, 0.06, 0.22, -0.06, -0.42, mid);
      a(0.07, 0.15, 0.12, 0.20, -0.27, -0.32, mid); dot(0.22, -0.085, -0.55);
    } else if (cls === 'Heavy') {
      a(0.12, 0.14, 0.60, 0.22, -0.20, -0.55); a(0.10, 0.18, 0.16, 0.22, -0.32, -0.50, tint);
      a(0.06, 0.06, 0.35, 0.22, -0.18, -0.95, mid); a(0.03, 0.08, 0.25, 0.22, -0.09, -0.55, mid); dot(0.22, -0.12, -0.60);
    } else { // Rifle (default)
      a(0.09, 0.11, 0.55, 0.22, -0.20, -0.55); a(0.05, 0.05, 0.42, 0.22, -0.18, -1.0, tint);
      a(0.07, 0.16, 0.12, 0.22, -0.28, -0.45, mid); a(0.03, 0.06, 0.10, 0.22, -0.12, -0.62, mid);
      a(0.10, 0.02, 0.30, 0.22, -0.145, -0.50, mid); dot(0.22, -0.095, -0.62);
    }
    gun.add(g); models[cls] = g; return g;
  }
  camera.add(gun);
  const setGunClass = cls => { for (const k of Object.keys(models)) models[k].visible = false; modelFor(cls).visible = true; };
  setGunClass('Rifle');
  const setSniperScope = on => { gun.visible = !on; }; // hide viewmodel when scoped like real ADS

  const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xf6d447, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  muzzle.position.set(0.22, -0.18, -1.28); muzzle.scale.set(0.22, 0.22, 1);
  camera.add(muzzle);
  let muzzleT = 1;
  const popMuzzle = (shotgun) => { muzzleT = 0; if (shotgun) muzzle.scale.set(0.34, 0.34, 1); else muzzle.scale.set(0.22, 0.22, 1); };

  const dmgPool = [];
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('div'); d.className = 'dmgnum';
    document.getElementById('dmg-layer').appendChild(d); dmgPool.push(d);
  }
  let dmgIdx = 0;
  const dmgNum = (worldPos, txt, head) => {
    const d = dmgPool[dmgIdx++ % dmgPool.length];
    V1.copy(worldPos).project(camera);
    if (V1.z > 1) return;
    d.textContent = txt; d.className = 'dmgnum' + (head ? ' head' : '');
    d.style.left = ((V1.x * 0.5 + 0.5) * innerWidth) + 'px';
    d.style.top = ((-V1.y * 0.5 + 0.5) * innerHeight) + 'px';
    d.style.animation = 'none';
    requestAnimationFrame(() => { d.style.animation = ''; d.classList.add('show'); });
  };

  function update(dt, playing) {
    const sdt = playing ? dt : dt * 0.25;
    for (const s of sparks) {
      if (s.t >= s.life) { s.m.visible = false; continue; }
      s.t += sdt; const k = Math.min(s.t / s.life, 1);
      s.m.position.x += s.vx * sdt; s.m.position.y += s.vy * sdt; s.m.position.z += s.vz * sdt;
      s.vy -= 9 * sdt;
      s.m.scale.setScalar(1 + k * 2.2); s.m.material.opacity = 0.95 * (1 - k);
    }
    for (const tr of tracers) {
      if (tr.t > 0.07) { tr.m.visible = false; continue; }
      tr.t += sdt; tr.m.material.opacity = Math.max(0, 0.55 * (1 - tr.t / 0.07));
    }
    for (const d of decals) {
      if (d.t > 5) { d.m.visible = false; continue; }
      d.t += sdt; if (d.t > 4) d.m.material.opacity = Math.max(0, 0.7 * (1 - (d.t - 4)));
    }
    if (muzzleT < 0.05) { muzzleT += sdt; muzzle.material.opacity = muzzleT < 0.05 ? 0.9 : 0; }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.t += sdt; f.mesh.material = orbFlash;
      if (f.t > 0.06) { f.mesh.material = orbMat; flashes.splice(i, 1); }
    }
  }
  // first-frame warmup: compile pooled effects behind the menu.
  function warmup(renderer, cam) {
    renderer.compile(scene, cam);
    const moved = [];
    const show = m => { moved.push([m, m.visible, m.position.y]); m.visible = true; m.position.y -= 100; };
    sparks.forEach(s => show(s.m)); tracers.forEach(t => show(t.m)); decals.forEach(d => show(d.m));
    Object.values(models).forEach(show);
    show(muzzle);
    const s1 = new THREE.Mesh(sparkGeo, orbFlash); s1.position.set(0, -100, 0); scene.add(s1);
    const s2 = new THREE.Mesh(sparkGeo, orbMat); s2.position.set(0, -100, 0); scene.add(s2);
    renderer.render(scene, cam);
    for (const [m, v, y] of moved) { m.visible = v; m.position.y = y; }
    scene.remove(s1); scene.remove(s2);
  }
  return { spark, tracer, decal, flash, dmgNum, update, gun, popMuzzle, setGunClass, setSniperScope, warmup,
    kick: () => { gun.position.z = 0.06; },
    recover: (dt, elapsed, speedFrac, recoil, lagYaw, lagPitch) => {
      gun.position.z += (0 - gun.position.z) * Math.min(1, dt * 14);
      gun.position.y = Math.sin(elapsed * 9) * 0.008 * speedFrac;
      gun.rotation.x = recoil * 6 + (lagPitch || 0); // viewmodel lags the look (all weapons)
      gun.rotation.y = lagYaw || 0;
    } };
}
