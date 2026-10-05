// Themed VALORANT scenery — one hall footprint, nine skins. Perf rules:
// Lambert/Basic only, NO new lights (glow = unlit materials), all static,
// repeats instanced. buildWorld(scene, camera, themeId) -> handles
// { group, occluders, updateJumbo, pulseKill, tick }. disposeWorld tears down
// textures/geometries/materials so theme switches leak nothing.

import * as THREE from 'three';
import { themeById } from '../data/themes.js';

export function buildWorld(scene, camera, themeId) {
  const TH = themeById(themeId);
  const group = new THREE.Group(); scene.add(group);
  const occluders = [];
  const has = k => TH.extras.includes(k);
  const add = m => { group.add(m); return m; };
  const occ = m => { occluders.push(m); return m; };

  scene.background = new THREE.Color(TH.bg);
  scene.fog = new THREE.Fog(TH.fog[0], TH.fog[1], TH.fog[2]);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight(TH.hemi[0], TH.hemi[1], TH.hemi[2]); add(hemi);
  const sunL = new THREE.DirectionalLight(TH.dir[0], TH.dir[1]);
  sunL.position.set(-14, 24, 10); add(sunL);

  const canvasTex = (w, h, draw, rx = 1, ry = 1) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const noiseOver = (g, w, h, base, n, alpha) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const v = Math.random();
      g.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 244 : 8},${v > 0.5 ? 230 : 12},${Math.random() * alpha})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  };
  const glowTex = (inner, outer) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.3, outer); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };

  // ---------- floor ----------
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    noiseOver(g, w, h, TH.floor, 3200, 0.07);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 10; i++) g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 80, 24 + Math.random() * 40);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    if (TH.id === 'sakura') { // fallen petals baked in
      g.fillStyle = 'rgba(125,249,197,0.22)';
      for (let i = 0; i < 120; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 0, 7); g.fill(); }
    }
    if (TH.id === 'lunar') { // craters
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 4;
      for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 12 + Math.random() * 26, 0, 7); g.stroke(); }
    }
  }, 8, 10);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(84, 100), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -30); add(occ(floor));
  const laneMat = new THREE.MeshBasicMaterial({ color: TH.lane });
  [-5, 5].forEach(x => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 60), laneMat);
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.015, -28); add(s);
  });
  {
    const t = canvasTex(256, 256, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.strokeStyle = TH.accent; g.lineWidth = 10;
      g.beginPath(); g.arc(s / 2, s / 2, 100, 0, Math.PI * 2); g.stroke();
      g.fillStyle = TH.accent;
      g.beginPath(); g.moveTo(s / 2, 70); g.lineTo(s / 2 + 42, 140); g.lineTo(s / 2 - 42, 140); g.closePath(); g.fill();
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const em = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    em.rotation.x = -Math.PI / 2; em.position.set(0, 0.016, -6); add(em);
  }

  // ---------- walls (tall indoor / back wall + berms outdoor) ----------
  const wallTex = canvasTex(512, 256, (g, w, h) => {
    noiseOver(g, w, h, TH.wall, 1200, 0.05);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 3);
    g.fillStyle = TH.accent; g.fillRect(0, 96, w, 20);
    g.fillStyle = TH.glow; g.fillRect(0, 30, w, 3); g.fillRect(0, 200, w, 3);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, w, 24);
    if (TH.id === 'abyss') { // portholes baked into the wall
      for (let x = 32; x < w; x += 128) {
        g.fillStyle = '#05090e'; g.beginPath(); g.arc(x, 150, 30, 0, 7); g.fill();
        g.fillStyle = 'rgba(125,249,197,0.35)'; g.beginPath(); g.arc(x, 150, 22, 0, 7); g.fill();
        g.strokeStyle = '#3a4a58'; g.lineWidth = 5; g.beginPath(); g.arc(x, 150, 30, 0, 7); g.stroke();
      }
    }
  }, 6, 1);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const backH = TH.indoor ? 16 : 7;
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(78, backH, 1), wallMat);
  backWall.position.set(0, backH / 2, -70); add(occ(backWall));
  if (TH.indoor) {
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(78, 16, 1), wallMat);
    frontWall.position.set(0, 8, 16); frontWall.rotation.y = Math.PI; add(occ(frontWall));
    const sideMat = new THREE.MeshLambertMaterial({ color: TH.side });
    [[-38], [38]].forEach(([x]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 90), sideMat);
      m.position.set(x, 8, -27); add(occ(m));
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 92), new THREE.MeshLambertMaterial({ color: TH.ceil }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 15, -27); add(occ(ceil));
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(78, 0.8, 1.2),
      new THREE.MeshLambertMaterial({ color: TH.side }), 7);
    const M = new THREE.Matrix4();
    for (let i = 0; i < 7; i++) { M.makeTranslation(0, 14.4, 10 - i * 13); beams.setMatrixAt(i, M); }
    beams.instanceMatrix.needsUpdate = true; add(beams);
    const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(10, 0.1, 1.6),
      new THREE.MeshBasicMaterial({ color: TH.glow }), 6);
    for (let i = 0; i < 6; i++) { M.makeTranslation(i % 2 ? 12 : -12, 14.9, -8 - Math.floor(i / 2) * 22); strips.setMatrixAt(i, M); }
    strips.instanceMatrix.needsUpdate = true; add(strips);
  } else {
    const bermMat = new THREE.MeshLambertMaterial({ color: TH.side });
    [[-38, 90, -27, 0], [38, 90, -27, 0]].forEach(([x, len, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, len), bermMat);
      m.position.set(x, 1.75, z); add(occ(m));
    });
    const fb = new THREE.Mesh(new THREE.BoxGeometry(78, 3.5, 1.5), bermMat);
    fb.position.set(0, 1.75, 16); add(occ(fb));
  }

  // ---------- sky (outdoor only) ----------
  if (!TH.indoor) {
    const skies = {
      day: ['#182027', '#252f36', '#38423f', '#4a4939'],
      snow: ['#1d262d', '#2a353b', '#3d4748', '#50534b'],
      dusk: ['#171a22', '#29252c', '#4a4032', '#5a4d31'],
      garden: ['#15231f', '#24352d', '#35443a', '#46503a'],
      stars: ['#020306', '#05070e', '#0a0d18', '#141a2a'],
      pink: ['#1a2028', '#2b3038', '#403e3a', '#504a38'],
    };
    const sc = skies[TH.sky] || skies.day;
    const t = canvasTex(16, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, sc[0]); gr.addColorStop(0.45, sc[1]);
      gr.addColorStop(0.72, sc[2]); gr.addColorStop(0.8, sc[3]);
      gr.addColorStop(0.801, TH.fog[0]); gr.addColorStop(1, TH.fog[0]);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (TH.sky === 'stars') {
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 130; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.6, 1, 1);
      }
    });
    add(new THREE.Mesh(new THREE.SphereGeometry(160, 24, 12),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false })));
    if (TH.sky === 'stars') { // Earthrise over the lunar back wall
      const et = canvasTex(128, 128, (g) => {
        g.fillStyle = '#343a40'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
        g.fillStyle = '#7df9c5';
        g.beginPath(); g.ellipse(45, 50, 22, 14, 0.4, 0, 7); g.fill();
        g.beginPath(); g.ellipse(80, 80, 16, 10, -0.3, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath(); g.ellipse(60, 35, 26, 10, 0, 0, 7); g.fill();
      });
      et.wrapS = et.wrapT = THREE.ClampToEdgeWrapping;
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: et, transparent: true, fog: false, depthWrite: false }));
      e.position.set(28, 52, -120); e.scale.set(20, 20, 1); add(e);
    } else {
      const sunTex = glowTex('rgba(246,212,71,0.95)', 'rgba(246,212,71,0.34)');
      const big = TH.id === 'sunset';
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sp.position.set(big ? -30 : -46, big ? 16 : 34, -110); sp.scale.set(big ? 46 : 34, big ? 46 : 34, 1); add(sp);
      if (TH.sky !== 'pink') {
        const ct = glowTex('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.35)');
        [[-30, 44, -120, 40], [25, 50, -125, 52], [70, 38, -100, 30]].forEach(([x, y, z, s]) => {
          const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
          c.position.set(x, y, z); c.scale.set(s, s * 0.42, 1); add(c);
        });
      }
    }
    // distant ridges tinted from the wall color (fog melts them in)
    const ridgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(TH.wall).multiplyScalar(0.8) });
    const ridge = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5, 1), ridgeMat, 12);
    {
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
      for (let i = 0; i < 12; i++) {
        const w = 18 + Math.random() * 22, h = 10 + Math.random() * 15;
        const a = (-65 + i * 12 + Math.random() * 6) * Math.PI / 180;
        P.set(Math.sin(a) * 98, h / 2 - 2, -Math.cos(a) * 98 - 8);
        S.set(w, h, w * (0.5 + Math.random() * 0.4)); Q.identity();
        M.compose(P, Q, S); ridge.setMatrixAt(i, M);
      }
      ridge.instanceMatrix.needsUpdate = true; add(ridge);
    }
  }

  // ---------- shared extras ----------
  const M4 = new THREE.Matrix4();
  if (has('pillars')) { // glowing energy columns (tinted per theme)
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: TH.glow }), 6);
    const base = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1, 1.6),
      new THREE.MeshLambertMaterial({ color: TH.side }), 6);
    [[-34, -10], [34, -10], [-34, -32], [34, -32], [-34, -54], [34, -54]].forEach(([x, z], i) => {
      M4.makeTranslation(x, 7, z); pil.setMatrixAt(i, M4);
      M4.makeTranslation(x, 0.5, z); base.setMatrixAt(i, M4);
    });
    pil.instanceMatrix.needsUpdate = true; base.instanceMatrix.needsUpdate = true;
    add(pil); add(occ(base)); occluders.push(pil); // glowing columns stop bullets too
  }
  if (has('racks')) {
    const bench = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: TH.side }), 4);
    [[-36.5, -18], [-36.5, -40], [36.5, -18], [36.5, -40]].forEach(([x, z], i) => {
      M4.makeTranslation(x, 0.45, z); bench.setMatrixAt(i, M4);
    });
    bench.instanceMatrix.needsUpdate = true; add(bench);
    const railMat = new THREE.MeshBasicMaterial({ color: TH.accent });
    [[-37.3, -29], [37.3, -29]].forEach(([x, z]) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 30), railMat);
      r.position.set(x, 2.2, z); add(r);
    });
  }
  if (has('jumbo')) {
    const jc = document.createElement('canvas'); jc.width = 512; jc.height = 256;
    const jt = new THREE.CanvasTexture(jc); jt.colorSpace = THREE.SRGBColorSpace;
    const jumbo = new THREE.Mesh(new THREE.PlaneGeometry(19, 9.5),
      new THREE.MeshBasicMaterial({ map: jt }));
    jumbo.position.set(0, TH.indoor ? 9.5 : 11, -69.4); add(occ(jumbo));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(20, 10.5, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x0b0f14 }));
    frame.position.set(0, TH.indoor ? 9.5 : 11, -69.7); add(frame);
    let jumboKey = '';
    var drawJumbo = (d) => {
      const key = [d.mode || 'STANDBY', d.score ?? 0, d.kills ?? 0, d.acc ?? '—', d.time ?? ''].join('|');
      if (key === jumboKey) return;
      jumboKey = key;
      const g = jc.getContext('2d');
      g.fillStyle = '#0b1118'; g.fillRect(0, 0, 512, 256);
      g.fillStyle = TH.accent; g.fillRect(0, 0, 512, 10); g.fillRect(0, 246, 512, 10);
      g.textAlign = 'center';
      g.fillStyle = '#8b978f'; g.font = '700 26px Barlow, sans-serif';
      g.fillText('RANGE+  //  ' + (d.mode || 'STANDBY'), 256, 52);
      g.fillStyle = '#ece8e1'; g.font = '400 96px Anton, sans-serif';
      g.fillText(String(d.score ?? 0), 256, 160);
      g.fillStyle = TH.glow; g.font = '700 30px Barlow, sans-serif';
      g.fillText(`K ${d.kills ?? 0}   ACC ${d.acc ?? '—'}   ${d.time ?? ''}`, 256, 212);
      jt.needsUpdate = true;
    };
    drawJumbo({});
  }
  if (has('sign')) {
    const t = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#0d1319'; g.fillRect(0, 0, w, h);
      g.fillStyle = TH.accent; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      g.textAlign = 'center'; g.fillStyle = '#ece8e1'; g.font = '400 72px Anton, sans-serif';
      g.fillText(TH.id === 'abyss' ? 'ABYSS' : 'RANGE+', w / 2, 92);
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 0.4), new THREE.MeshBasicMaterial({ map: t }));
    sign.position.set(0, 10.5, -30); add(sign);
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    [-3.5, 3.5].forEach(x => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.4, 0.08), cableMat);
      c.position.set(x, 13.4, -30); add(c);
    });
  }
  if (has('shafts') || has('rays')) {
    const col = TH.glow;
    const shaftMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    [[-10, -22, 0.2], [9, -40, -0.15], [0, -58, 0.1]].forEach(([x, z, tilt]) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 15), shaftMat);
      s.position.set(x, 7.5, z); s.rotation.set(0.15, 0, tilt); add(s);
    });
  }
  // crates per theme family
  const crateKind = has('woodcrates') ? 'wood' : has('frostcrates') ? 'frost' : has('stonecrates') ? 'stone' : 'tech';
  {
    const cols = { tech: [0x3a434b, 0x22282d, true], wood: [0x7a5c3e, 0x54402a, false],
      frost: [0xcfd9e0, 0x9fb4c4, true], stone: [0x6a6f66, 0x4a4f48, false] }[crateKind];
    const bodyM = new THREE.MeshLambertMaterial({ color: cols[0] });
    const bandM = new THREE.MeshLambertMaterial({ color: cols[1] });
    const glowM = new THREE.MeshBasicMaterial({ color: TH.glow });
    const spots = [[-22, -22, 2.2, 0.3], [-19.5, -22.6, 1.4, -0.2], [22, -26, 2.0, -0.35],
      [24.3, -25.2, 1.2, 0.25], [-25, -48, 2.4, 0.15], [25, -50, 2.4, -0.1]];
    for (const [x, z, s, ry] of spots) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), bodyM); body.position.y = s / 2; g.add(body);
      const band = new THREE.Mesh(new THREE.BoxGeometry(s + 0.02, s * 0.18, s + 0.02), bandM);
      band.position.y = s * 0.72; g.add(band);
      if (cols[2]) {
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.5, 0.08), glowM);
        glow.position.set(0, s * 0.72, s / 2 + 0.011); g.add(glow);
      }
      g.position.set(x, 0, z); g.rotation.y = ry; add(g);
      occluders.push(body);
    }
  }
  // trees / plants per theme
  if (has('cypress') || has('snowpines') || has('blossom')) {
    const leaf = TH.glow;
    const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x343a40 }), 10);
    const topI = new THREE.InstancedMesh(
      has('blossom') ? new THREE.SphereGeometry(1.5, 10, 8) : new THREE.ConeGeometry(0.95, 3.6, 7),
      new THREE.MeshLambertMaterial({ color: leaf }), 10);
    const spots = [[-19, -8], [19.5, -10], [-21, -20], [21, -22], [-18.5, -32], [18.5, -33], [-24, -40], [24, -40], [-9, -42], [9, -42]];
    spots.forEach(([x, z], i) => {
      const s = 0.8 + ((i * 37) % 10) / 22;
      M4.makeTranslation(x, 0.6 * s, z); M4.scale(new THREE.Vector3(s, s, s)); trunkI.setMatrixAt(i, M4);
      M4.makeTranslation(x, (has('blossom') ? 2.6 : 3.0) * s, z); M4.scale(new THREE.Vector3(s, s, s)); topI.setMatrixAt(i, M4);
    });
    trunkI.instanceMatrix.needsUpdate = true; topI.instanceMatrix.needsUpdate = true;
    add(trunkI); add(topI);
  }
  if (has('bamboo')) { // dense green stalks along both walls
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.11, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x34453d }), 40);
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? -1 : 1;
      M4.makeTranslation(side * (30 + (i % 5)), 3.5, -5 - Math.floor(i / 2) * 3.1);
      inst.setMatrixAt(i, M4);
    }
    inst.instanceMatrix.needsUpdate = true; add(inst);
  }
  if (has('lanterns')) { // warm paper lanterns on posts
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 3, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x343a40 }), 8);
    const orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshBasicMaterial({ color: TH.accent }), 8);
    [[-30], [-18], [-6], [6], [18], [30], [-42], [42]].forEach(([z], i) => {
      const x = i % 2 ? 33 : -33;
      M4.makeTranslation(x, 1.5, z); posts.setMatrixAt(i, M4);
      M4.makeTranslation(x, 3.3, z); orbs.setMatrixAt(i, M4);
    });
    posts.instanceMatrix.needsUpdate = true; orbs.instanceMatrix.needsUpdate = true;
    add(posts); add(orbs);
  }
  if (has('fireflies')) { // static warm motes (1 point draw, no animation budget)
    const n = 26, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() * 2 - 1) * 28;
      arr[i * 3 + 1] = 0.5 + Math.random() * 3.5;
      arr[i * 3 + 2] = -5 - Math.random() * 55;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    add(new THREE.Points(g, new THREE.PointsMaterial({ color: TH.glow, size: 0.14, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })));
  }
  if (has('lights')) { // string lights across the courtyard
    const pts = [], bulbs = [];
    const addStrand = (a, b, sag, n) => {
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const p = new THREE.Vector3(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - Math.sin(k * Math.PI) * sag, a[2] + (b[2] - a[2]) * k);
        if (prev) pts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
        if (i > 0 && i < n && i % 2 === 0) bulbs.push(p.y - 0.12, p);
        prev = p;
      }
    };
    addStrand([-13, 5.5, -6], [-13, 5.5, -24], 0.7, 24);
    addStrand([13, 5.5, -6], [13, 5.5, -24], 0.7, 24);
    addStrand([-13, 5.9, -24], [13, 5.9, -24], 1.0, 30);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x3a332a })));
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5),
      new THREE.MeshBasicMaterial({ color: TH.glow }), 36);
    for (let i = 0; i < bulbs.length; i += 2) { M4.makeTranslation(bulbs[i + 1].x, bulbs[i], bulbs[i + 1].z); inst.setMatrixAt(i / 2, M4); }
    inst.instanceMatrix.needsUpdate = true; add(inst);
  }
  if (has('torii')) { // vermilion gate at the far end
    const red = new THREE.MeshLambertMaterial({ color: TH.accent });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
    [[-4], [4]].forEach(([x]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 9, 10), red);
      p.position.set(x, 4.5, -58); add(occ(p));
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(12, 0.9, 1.2), dark);
    top.position.set(0, 9.3, -58); add(top);
    const second = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 0.9), red);
    second.position.set(0, 7.9, -58); add(second);
  }
  if (has('icespikes')) {
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1, 0.4),
      new THREE.MeshBasicMaterial({ color: TH.glow }), 8);
    const Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
    const spots = [[-14, -60, 3.4], [-11, -60, 2.2], [12, -60, 4.1], [15, -60, 2.6], [0, -62, 1.8], [-4, -60, 2.9], [7, -60, 2.3], [20, -55, 3.0]];
    spots.forEach(([x, z, h], i) => {
      P.set(x, h / 2, z); S.set(1, h, 1); E.set(0, 0, (i % 2 ? -1 : 1) * 0.06); Q.setFromEuler(E);
      M4.compose(P, Q, S); inst.setMatrixAt(i, M4);
    });
    inst.instanceMatrix.needsUpdate = true; add(inst);
  }
  // lane furniture shared by all themes
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x343a40 });
  [[-6, -20], [6, -21], [0, -25]].forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), woodMat);
    post.position.set(x, 0.8, z); add(post);
  });
  const barMat = new THREE.MeshLambertMaterial({ map: canvasTex(128, 32, (g, w, h) => {
    noiseOver(g, w, h, '#b8ab8e', 200, 0.08);
    g.fillStyle = TH.accent; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 16, h);
  }, 3, 1) });
  [[-11, -18], [11, -19]].forEach(([x, z]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.25), barMat);
    b.position.set(x, 0.45, z); b.rotation.y = (x > 0 ? -1 : 1) * 0.15; add(b);
    occluders.push(b);
  });

  return {
    group, occluders,
    updateJumbo: has('jumbo') ? drawJumbo : () => {},
    pulseKill() {},
    tick() {},
  };
}

export function disposeWorld(scene, W) {
  if (!W) return;
  scene.remove(W.group);
  W.group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) m[k].dispose();
      m.dispose();
    });
  });
}
