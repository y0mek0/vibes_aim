// Onimaru Kunitsuna rig + director. Owns the saya/blade/trail meshes and the
// swing/inspect/equip choreography. Pure viewmodel work: no game state, no
// allocations per frame. buildKatana(parent) returns the api.

import * as THREE from 'three';

function arcTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,60,70,0.9)'; g.lineWidth = 14; g.lineCap = 'round';
  g.shadowColor = 'rgba(255,42,60,0.9)'; g.shadowBlur = 18;
  g.beginPath(); g.arc(128, 150, 105, -Math.PI * 0.78, -Math.PI * 0.22); g.stroke();
  g.strokeStyle = 'rgba(255,240,240,0.95)'; g.lineWidth = 5; g.shadowBlur = 6;
  g.beginPath(); g.arc(128, 150, 105, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildKatana(g) {
  const root = new THREE.Group(); root.position.set(0.22, -0.24, -0.45); g.add(root);
  const saya = new THREE.Group();
  saya.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.62), new THREE.MeshLambertMaterial({ color: 0x141114 })));
  const cord = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.014, 0.30), new THREE.MeshBasicMaterial({ color: 0xa31226 }));
  cord.position.set(0, 0.02, 0.1); saya.add(cord);
  root.add(saya);
  const pivot = new THREE.Group(); pivot.position.set(0, 0.01, 0.14); root.add(pivot);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.24), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
  grip.position.set(0, 0, -0.02); pivot.add(grip);
  for (let i = -1; i <= 1; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.047, 0.052, 0.025), new THREE.MeshBasicMaterial({ color: 0x7a1020 }));
    w.position.set(0, 0, i * 0.08 - 0.02); pivot.add(w);
  }
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 18), new THREE.MeshLambertMaterial({ color: 0x5a0f1c }));
  tsuba.rotation.x = Math.PI / 2; tsuba.position.set(0, 0, -0.15); pivot.add(tsuba);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xd7dee2, emissive: 0x1c2126 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.055, 0.60), bladeMat);
  blade.position.set(0, 0.005, -0.46); pivot.add(blade);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.58), new THREE.MeshBasicMaterial({ color: 0xff2a3c }));
  edge.position.set(0, -0.02, -0.46); pivot.add(edge);
  // twin slash trails ride the blade (horizontal + overhead), opacity follows strike speed
  const trailMat = () => new THREE.MeshBasicMaterial({ map: arcTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const trailH = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.6), trailMat());
  trailH.position.set(0, 0, -0.5); trailH.visible = false; pivot.add(trailH);
  const trailV = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), trailMat());
  trailV.rotation.y = Math.PI / 2; trailV.position.set(0, 0, -0.5); trailV.visible = false; pivot.add(trailV);
  let trailT = 1, trailDur = 0.22, trailHold = false, trailMesh = trailH, flashT = 99;
  // choreography curves: anticipate slow, strike explosive, settle with spring overshoot
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeIn = k => k * k;
  const easeBack = k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const spring = k => k >= 1 ? 1 : 1 - Math.exp(-7 * k) * Math.cos(11 * k); // overshoot settle
  const lerp = (a, b, k) => a + (b - a) * k;
  const api = {
    sheath(t, moveFrac) { // breathing idle: sway grows with movement, blade stays home
      trailHold = false;
      saya.visible = true; pivot.visible = false; trailH.visible = trailV.visible = false;
      const tt = t || 0, mf = moveFrac || 0;
      root.position.set(0.22 + Math.sin(tt * 1.1) * 0.002 * (1 + mf * 2), -0.24 + Math.sin(tt * 1.8) * 0.003 * (1 + mf), -0.45);
      root.rotation.set(Math.sin(tt * 1.5) * 0.006 * (1 + mf), 0, Math.sin(tt * 1.3) * 0.012 * (1 + mf));
      pivot.rotation.set(0, 0, 0);
    },
    draw(k) { // equip: drops in from below with an overshoot snap
      saya.visible = true; pivot.visible = true;
      const e = easeBack(Math.min(1, k));
      pivot.position.z = 0.14 - 0.30 * (1 - k);
      pivot.rotation.set(0.55 * (1 - e), 0, 0.3 * (1 - e));
      root.position.set(0.22, -0.24 - 0.10 * (1 - k) * (1 - k), -0.45); root.rotation.set(0, 0, 0);
    },
    // swing(t, cycle, variant, heavy): anticipate -> explosive strike (damage at
    // dmgAt) -> follow-through -> spring settle. variant: 1 R-to-L, -1 L-to-R, 2 rising diagonal
    swing(t, cycle, variant, heavy, dmgAt) {
      saya.visible = false; pivot.visible = true; pivot.position.z = 0.14;
      const A = heavy ? 0.10 : 0.08;                    // anticipate window
      const S = Math.max(dmgAt, A + 0.02);              // strike lands the damage
      const F = S + (heavy ? 0.16 : 0.11);              // follow-through
      let rx = 0.15, ry = 0, rz = 0.25 * (variant === 2 ? 1 : variant);
      if (t < A) { // wind-up: coil the opposite way, slow
        const k = easeIn(t / A);
        if (heavy) { rx = lerp(0.15, 0.95, k); }
        else if (variant === 2) { rx = lerp(0.15, 0.55, k); rz = lerp(0.25, 1.0, k); }
        else { rz = variant * lerp(0.25, -0.95, k); }
      } else if (t < S) { // STRIKE: accelerate through contact
        const k = (t - A) / (S - A), e = k * k;
        if (heavy) rx = lerp(0.95, -1.0, e);
        else if (variant === 2) { rx = lerp(0.55, -0.75, e); rz = lerp(1.0, -0.9, e); }
        else rz = variant * lerp(-0.95, 1.15, e);
      } else if (t < F) { // follow-through: carry past contact, decelerating
        const k = easeOut((t - S) / (F - S));
        if (heavy) rx = lerp(-1.0, -1.25, k);
        else if (variant === 2) { rx = lerp(-0.75, -0.95, k); rz = lerp(-0.9, -1.1, k); }
        else rz = variant * lerp(1.15, 1.35, k);
      } else { // recover: spring back to rest with overshoot
        const k = spring(Math.min(1, (t - F) / Math.max(0.05, cycle - F)));
        if (heavy) rx = lerp(-1.25, 0.15, k);
        else if (variant === 2) { rx = lerp(-0.95, 0.15, k); rz = lerp(-1.1, 0.25, k); }
        else rz = variant * lerp(1.35, 0.25, k);
      }
      pivot.rotation.x = rx; pivot.rotation.y = ry; pivot.rotation.z = rz;
      // whole-arm punch: root dips with the strike
      const punch = t < S ? 0 : Math.exp(-(t - S) * 14) * (heavy ? 0.035 : 0.02);
      root.position.set(0.22, -0.24 - punch, -0.45 - punch * 0.6); root.rotation.set(0, 0, 0);
    },
    inspect(k) { // Y: draw -> raise -> full spin+flip with trail -> flourish -> sheath
      saya.visible = false; pivot.visible = true; pivot.position.z = 0.14;
      if (k < 0.18) { // draw
        const e = easeOut(k / 0.18);
        pivot.rotation.set(0.5 * (1 - e), 0, 0.3 * (1 - e));
        root.position.y = -0.24 - 0.06 * (1 - e);
      } else if (k < 0.38) { // raise to show-off
        const e = easeOut((k - 0.18) / 0.20);
        pivot.rotation.set(lerp(0, -0.35, e), 0, lerp(0, -0.5, e));
        root.position.y = lerp(-0.24, -0.14, e);
      } else if (k < 0.78) { // the twirl: full spin + flip, red trail
        const e = (k - 0.38) / 0.40;
        pivot.rotation.y = e * Math.PI * 2;
        pivot.rotation.z = -0.5 + Math.sin(e * Math.PI) * 1.1;
        pivot.rotation.x = -0.35 - Math.sin(e * Math.PI) * 0.25;
        root.position.y = -0.14 + Math.sin(e * Math.PI) * 0.05;
        trailHold = true; trailH.visible = true;
        trailH.material.opacity = 0.55 * Math.sin(e * Math.PI);
        trailH.rotation.z = e * 5;
      } else if (k < 0.90) { // flourish hold: blade high, catching light
        trailHold = false; trailH.visible = false;
        pivot.rotation.set(-0.55, 0, -0.75);
        root.position.y = -0.14;
      } else { // snap home
        const e = easeOut((k - 0.90) / 0.10);
        pivot.rotation.set(lerp(-0.55, 0, e), lerp(0, 0, e), lerp(-0.75, 0, e));
        root.position.y = lerp(-0.14, -0.24, e);
        if (e >= 1) saya.visible = true;
      }
    },
    trailPop(heavy, dir) {
      trailHold = false;
      trailMesh = (dir === 0 || heavy) ? trailV : trailH;
      if (heavy) { trailV.rotation.y = Math.PI / 2; }
      trailMesh.visible = true; trailT = 0; trailDur = heavy ? 0.30 : 0.22;
      trailMesh.rotation.z = dir === 0 ? 0 : dir > 0 ? -0.55 : 0.55;
      trailMesh.scale.setScalar(heavy ? 1.25 : 1);
      trailMesh.material.opacity = 0.9;
    },
    flash() { flashT = 0; }, // white-hot blade on connect, decays in tick
    tick(dt) {
      if (flashT < 0.12) {
        flashT += dt;
        const f = Math.max(0, 1 - flashT / 0.12);
        bladeMat.emissive.setRGB(0.11 + 0.89 * f, 0.13 + 0.87 * f, 0.15 + 0.85 * f);
      }
      if (!trailMesh.visible || trailHold) return;
      trailT += dt;
      if (trailT >= trailDur) trailMesh.visible = false;
      else trailMesh.material.opacity = 0.9 * (1 - trailT / trailDur);
    },
  };
  api.sheath(0, 0);
  return api;
}
