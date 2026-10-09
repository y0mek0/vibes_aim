// VALOTRAINER game — modes, VALORANT-accurate gunplay, HUD, loop.
// Conventions: rpm = rounds per SECOND. Angles: input math in radians, data in degrees.

import * as THREE from 'three';
import { GUNS, gunById, GUN_CLASSES, resolveGunId } from './data/guns.js?v=20261009-2';
import { slotForClass, cycleSlot } from './core/gunplay.js?v=20261009-2';
import { BUILD } from './build.js?v=20261009-2';
import { STAT_TICK_MS, SENS_YAW, HFOV, scopedDPC, ZERO_MATCH } from './data/mechanics.js?v=20261009-2';
// Inline constant for the flat 100 HP model. Imported separately so the
// game boots even if the mechanics.js export changes name. We never use
// shields or armor in aim2stock.
const PLAYER_HP = 100;
import { damageAtRange, spreadDeg, movePenalty, effectiveRpm, zoomOf, lethalOnHit } from './core/ballistics.js?v=20261009-2';
import { createStalker } from './core/stalker.js?v=20261009-2';
import { deadzone, stanceSpeed, moveForSpeed, frictionSpeed, bloomDecay,
  shotReady, burstTiming, jumpAirTime, JUMP_V0, GRAV, CAM_STAND, CAM_CROUCH, ACCEL, AIR_ACCEL_FRAC,
  spawnDist, orbScale } from './core/gunplay.js?v=20261009-2';
import { createStats, createKillfeed } from './core/stats.js?v=20261009-2';
import { enhanceCombos, syncCombos } from './ui/combo.js?v=20261009-2';
import { freshCrosshair, migrateCrosshair, buildCode, parseCode, PRESET_COLORS } from './core/crosshair.js?v=20261009-2';
import { audio } from './fx/audio.js?v=20261009-2';
import { buildWorld, disposeWorld } from './three/world.js?v=20261009-2';
import { THEMES } from './data/themes.js?v=20261009-2';
import { createTargets } from './three/targets.js?v=20261009-2';
import { createEffects } from './three/effects.js?v=20261009-2';
import { getActiveTicker } from './aim-bridge.js?v=20261009-2';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEG = Math.PI / 180;
const STORE_S = 'vlt_settings_v1', STORE_H = 'vlt_history_v1';

// Flat 100 HP for player and bots. No shields, no armor tiers. Kept as a
// function so legacy armorHp() calls still resolve without an import.
const armorHp = () => PLAYER_HP;

// Default loadout: sidearm in slot 2 (free USP), slot 1 empty until the
// player buys something. Legacy settings (slot1: 'vandal' / slot2:
// 'classic') get remapped through resolveGunId on first read.
const DEFAULTS = { sens: 0.4, scope: 1.0, volume: 0.5, scale: '1', slot1: null, slot2: 'usp',
  // Default to infinite mag so the player never has to think about
  // reloading mid-session. They can switch to manual in Display.
  reload: 'off', trackDiff: 'medium', dist: 'standard', orbMove: 'drift', orbSize: 'm', theme: 'protocol',
  ch: freshCrosshair() };
let settings = (() => { try { const s = JSON.parse(localStorage.getItem(STORE_S)) || {};
  return { ...DEFAULTS, ...s, slot1: s.slot1 ? resolveGunId(s.slot1) : null, slot2: resolveGunId(s.slot2 || 'usp'), ch: migrateCrosshair(s.ch) }; } catch (e) { return { ...DEFAULTS, slot2: 'usp', ch: freshCrosshair() }; } })();
// preserved non-primary segments (ADS/scope) + unknown tokens from the last import
let chExtra = { segments: { A: null, S: null }, unknown: [] };
const saveSettings = () => localStorage.setItem(STORE_S, JSON.stringify(settings));
let history = (() => { try { return JSON.parse(localStorage.getItem(STORE_H)) || []; } catch (e) { return []; } })();
const saveHistory = () => localStorage.setItem(STORE_H, JSON.stringify(history));

const MODE_DEFS = {
  gridshot: { name: 'GRIDSHOT', time: 60, desc: 'Three bots live at all times. Kill fast, keep the streak — pure speed & precision.' },
  flick:    { name: 'FLICK SHOT', time: null, targets: 30, desc: 'One target at a time, random position. 30 targets — true flick reaction time.' },
  tracking: { name: 'TRACKING', time: 45, desc: 'A bot strafes, jukes, pauses and crouches like a duelist. Stay glued — time-on-target + consistency. Difficulty in Settings.' },
  bots:     { name: 'RANGE BOTS', time: 60, desc: 'VALORANT Range, hard mode. Real per-gun damage: tap heads, manage your mag, R to reload.' },
};
const MENU = 0, COUNT = 1, PLAYING = 2, PAUSED = 3, RESULTS = 4;

export function boot() {
  // ---------- renderer / camera ----------
  const canvas = $('game');
  const glCtx = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance', alpha: false })
    || canvas.getContext('webgl', { antialias: true, powerPreference: 'high-performance', alpha: false });
  const renderer = new THREE.WebGLRenderer({ canvas, context: glCtx });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(71, 1, 0.05, 200);
  let W = buildWorld(scene, camera, settings.theme); // live handles: jumbotron, kill flash, occluders
  const T = createTargets(scene);
  const FX = createEffects(scene, camera, T.orbFlash, T.orbMat);
  const stats = createStats();
  const feed = createKillfeed();

  const pixelRatio = () => settings.scale === 'dpr' ? Math.min(devicePixelRatio, 2) : parseFloat(settings.scale);
  let baseFov = 71, fovKick = 0;
  const HFOVR = HFOV * DEG;
  function fovFor(zoom) {
    const h = HFOVR / zoom;
    return 2 * Math.atan(Math.tan(h / 2) / camera.aspect) / DEG;
  }
  function applySize() {
    renderer.setPixelRatio(pixelRatio()); renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; baseFov = fovFor(adsZoom); camera.fov = baseFov; camera.updateProjectionMatrix();
  }
  addEventListener('resize', applySize);

  // ---------- player / weapon state ----------
  let state = MENU, mode = 'gridshot';
  let yaw = 0, pitch = 0, recoil = 0, bloom = 0;
  const pos = new THREE.Vector3(0, 1.6, 2), vel = new THREE.Vector3();
  const keys = {};
  // Loadout read-through helpers. These pull the latest loadout from the
  // store if it's been wired up, otherwise fall back to "USP only" so the
  // buy menu still renders correctly before bootstrap finishes.
  function loadoutOwned() {
    const s = window.store?.state?.loadout;
    if (s && Array.isArray(s.owned)) return s.owned;
    // Starter kit fallback: USP. Anything else is "not owned" until the
    // store hydrates from the server.
    return ['usp'];
  }
  function loadoutStable() {
    return Number(window.store?.state?.player?.stable) || 0;
  }
  // gun defaults to USP (free sidearm) — the player has to BUY a primary.
  let gun = gunById(resolveGunId(settings.slot2 || 'usp') || 'usp');
  // loadout slots: 1 primary (player-chosen, starts null), 2 sidearm (USP)
  const slots = { 1: settings.slot1 || null, 2: settings.slot2 || 'usp' };
  let curSlot = 1, lastSlot = 2;
  let lastYaw = 0, lastPitch = 0, lagX = 0, lagY = 0;
  let ammo = gun.mag, reloading = false, reloadT = 0, reloadAmmo0 = 0, equipT = 0;
  let adsHeld = false, scoped = false, scopeIdx = 0; // adsHeld: RMB hold (ads kinds); scoped: toggle (scope kinds)
  let spoolT = 0, lastSpoolEnd = 0;
  let burstLeft = 0, burstT = 0, burstCool = 0;   // burst machine: intra-burst pops + inter-burst cooldown
  let adsZoom = 1;                                   // current zoom factor (1 = hip)
  let vy = 0, airH = 0, grounded = true, camH = CAM_STAND, stance = 'RUN';
  let mouseDown = false, lastShot = 0, lastBurstEnd = 0, shotStreak = 0;
  let timeLeft = 0, elapsed = 0, cdT = 0, hitStop = 0;
  let trackBot = null, stalker = null, pendingSpawn = 0;
  let pendingGrid = 0, gridT = 0; // opening cascade: orbs pop in one by one
  let trackSecs = [], secClock = 0, secOn = 0; // per-second on-target buckets -> consistency
  const raycaster = new THREE.Raycaster();
  const _dir = new THREE.Vector3(), _o = new THREE.Vector3(), _n = new THREE.Vector3(), _hit = new THREE.Vector3();
  const _want = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _E = new THREE.Euler(0, 0, 0, 'YXZ');
  adsZoom = 1;

  const armorHp = () => PLAYER_HP;
  const adsActive = () => adsHeld || scoped;
  const curZoom = () => {
    if (scoped && gun.alt?.kind === 'scope') return gun.alt.zooms[Math.min(scopeIdx, gun.alt.zooms.length - 1)];
    if (adsHeld && gun.alt && (gun.alt.zoom || gun.alt.kind === 'ads')) return gun.alt.zoom || 1;
    return 1;
  };
  const dpc = () => adsActive() ? scopedDPC(settings.sens, settings.scope, curZoom()) : SENS_YAW * settings.sens;

  function initLoadout() {
    const pick = id => (gunById(id) ? id : null);
    slots[1] = pick(settings.slot1 || settings.gun) || 'vandal';
    slots[2] = pick(settings.slot2) || 'classic';
    curSlot = 1; lastSlot = 2;
  }
  function renderSlots() {
    for (let i = 1; i <= 2; i++) {
      const el = $('slot' + i); if (!el) continue;
      const g = gunById(slots[i]);
      el.classList.toggle('active', i === curSlot);
      const sp = el.querySelector('span'); if (sp) sp.textContent = g ? g.name : '—';
    }
  }
  function applySlot(silent) { // make curSlot's gun live
    // Fall back to USP (free starter) if the slot is empty or the gun id
    // is unrecognised. This keeps the game playable even before the
    // player has bought a primary.
    const fallbackId = 'usp';
    const id = slots[curSlot] || fallbackId;
    const g = gunById(id) || gunById(fallbackId);
    gun = g;
    ammo = g.mag; reloading = false; burstLeft = 0; burstCool = 0; adsHeld = false; scoped = false; scopeIdx = 0;
    vy = 0; airH = 0; grounded = true;
    equipT = g.equip; adsZoom = 1; lastShot = 0; // fresh recovery (VALORANT switch-cancel tech)
    $('reloadbar').style.display = 'none';
    FX.setGunClass(g.cls); FX.setSniperScope(false); $('scope').classList.remove('on'); document.body.classList.toggle('scoped', scoped);
    $('st-gunname').textContent = `${g.name} · ${g.cls.toUpperCase()} · ${g.mag === Infinity ? '∞' : g.mag} MAG`;
    renderSlots(); renderLoadout();
    if (!silent) audio.reload();
  }
  function switchSlot(n, silent) {
    if (n === curSlot) { renderSlots(); return; }
    lastSlot = curSlot; curSlot = n;
    applySlot(silent);
  }
  function buyGun(id, silent) { // buy menu / loadout: sidearms -> slot 2, rest -> slot 1
    const g = gunById(id); if (!g) return;
    const slot = slotForClass(g.cls);
    slots[slot] = id;
    settings.slot1 = slots[1]; settings.slot2 = slots[2]; saveSettings();
    if (slot !== curSlot) switchSlot(slot, silent);
    else applySlot(silent);
  }
  function cancelInspect() {}

  // ---------- input ----------
  const locked = () => document.pointerLockElement === canvas;
  let lockFails = 0, fallbackAim = false;
  function requestLock() {
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(onLockFail); } catch (e) { onLockFail(); } });
    } catch (e) { try { canvas.requestPointerLock(); } catch (_) { onLockFail(); } }
  }
  function onLockFail() { lockFails++; if (lockFails >= 2) fallbackAim = true; lockHint(); }
  document.addEventListener('pointerlockerror', onLockFail);
  function lockHint() {
    const h = $('lockhint');
    if (state === PLAYING && !locked()) {
      h.style.display = 'block';
      h.textContent = fallbackAim ? 'POINTER LOCK BLOCKED — FALLBACK AIM. OPEN IN CHROME/EDGE FOR RAW INPUT' : 'MOUSE NOT CAPTURED — CLICK ONCE TO AIM';
    } else h.style.display = 'none';
  }
  addEventListener('mousemove', e => {
    if (state !== PLAYING) return;
    if (!locked() && !fallbackAim) return;
    const k = dpc() * DEG;
    yaw -= e.movementX * k; pitch = clamp(pitch - e.movementY * k, -85 * DEG, 85 * DEG);
  });
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyR' && state === PLAYING) startReload();
    if (e.code === 'KeyB' && !e.repeat && (state === PLAYING || state === COUNT || state === PAUSED))
      toggleBuy(!$('buy').classList.contains('open')); // B toggles, never one-way
    if (e.code === 'Escape' && $('buy').classList.contains('open')) { toggleBuy(false); return; }
    if (e.code === 'Space') { e.preventDefault(); if (state === PLAYING && grounded && !e.repeat) { vy = JUMP_V0; grounded = false; } }
    if (e.code === 'Escape' && state === PLAYING && !locked()) doPause();
    if ((e.code === 'Digit1' || e.code === 'Digit2') && (state === PLAYING || state === COUNT)) switchSlot(parseInt(e.code.slice(5)));
    if (e.code === 'KeyQ' && (state === PLAYING || state === COUNT) && !e.repeat) switchSlot(lastSlot);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('mousedown', e => {
    if ($('buy').classList.contains('open')) return; // clicks on the buy menu are UI, never shots
    if ((state === PLAYING || state === COUNT) && !locked() && e.button === 0) {
      requestLock(); if (!fallbackAim) return;
    }
    if (state !== PLAYING) return;
    if (e.button === 0) { mouseDown = true; pressTrigger(performance.now()); }
    if (e.button === 2) pressAlt(performance.now());
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2 && gun.alt && (gun.alt.kind === 'ads' || gun.alt.kind === 'adsburst')) { adsHeld = false; adsZoom = 1; }
  });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => {
    if (state === PLAYING && !$('buy').classList.contains('open')) switchSlot(cycleSlot(curSlot, e.deltaY > 0 ? 1 : -1));
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    lockHint();
    if ($('buy').classList.contains('open')) return; // buy menu intentionally releases the pointer
    if (!locked() && (state === PLAYING || state === COUNT)) doPause();
  });

  function pressAlt(now) {
    if (!gun.alt || reloading || equipT > 0) return;
    const k = gun.alt.kind;
    if (k === 'ads' || k === 'adsburst') { adsHeld = true; adsZoom = curZoom(); }
    else if (k === 'scope') { // cycle zooms then exit (Operator 2.5x -> 5x -> off)
      if (!scoped) { scoped = true; scopeIdx = 0; }
      else if (scopeIdx < gun.alt.zooms.length - 1) scopeIdx++;
      else { scoped = false; scopeIdx = 0; }
      adsZoom = curZoom();
      FX.setSniperScope(scoped); $('scope').classList.toggle('on', scoped); document.body.classList.toggle('scoped', scoped);
    }
    else if (k === 'shotgun' || k === 'slug') {
      if (ammo > 0) firePull(now, false, true); // instant multi-pellet pop; rate cap inside firePull
    }
  }
  function startBurst() {
    if (!gun.alt || gun.alt.kind !== 'adsburst' || burstLeft > 0 || burstCool > 0 || ammo <= 0) return;
    burstLeft = gun.alt.count; burstT = 0;
  }

  function pressTrigger(now) {
    if (reloading || equipT > 0) return;
    if (scoped && gun.alt?.kind === 'scope') { firePull(now, false); return; }
    if (adsHeld && gun.alt?.kind === 'adsburst') { startBurst(); return; }
    if (gun.mode === 'auto') return; // hold-to-fire handled in loop (all modes incl. tracking)
    firePull(now, false); // semi: one pull per click, any mode (rate cap inside firePull)
  }

  // ---------- firing ----------
  function startReload() {
    if (reloading || gun.mag === Infinity || settings.reload === 'off' || ammo === gun.mag) return;
    reloading = true; reloadT = 0; reloadAmmo0 = ammo; audio.reload();
    $('reloadbar').style.display = 'block';
  }
  function liveRps() {
    return effectiveRpm(gun, { ads: adsHeld, scoped, spool: spool01() });
  }
  function currentSpread() {
    const crouch = (keys.KeyC || keys.ControlLeft) && grounded;
    return spreadDeg(gun, { crouch, move: moveCat(), ads: adsHeld, scoped, bloom });
  }
  function altSpread() { // Classic shotgun pop / Bucky slug: alt base spread + same penalties
    const crouch = (keys.KeyC || keys.ControlLeft) && grounded;
    const base = crouch ? gun.alt.spread * 0.85 : gun.alt.spread;
    return Math.min(gun.alt.max ?? gun.spread.max ?? 10, base + movePenalty(gun, moveCat()) + bloom);
  }
  function muzzleWorld() { return _o.set(0.22, -0.18, -1.28).applyMatrix4(camera.matrixWorld); }
  function centerDist() { // crosshair-to-whatever-is-there, sampled by the 80 ms ticker
    _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, _dir); raycaster.far = 150;
    const hits = raycaster.intersectObjects(T.meshes(), false);
    const oh = raycaster.intersectObjects(W.occluders, false);
    const best = hits.length && oh.length ? Math.min(hits[0].distance, oh[0].distance)
      : hits.length ? hits[0].distance : oh.length ? oh[0].distance : -1;
    return best;
  }

  function spool01() { return gun.spool ? clamp(spoolT / gun.spool.time, 0, 1) : 1; }
  function moveCat() { return moveForSpeed(vel.length(), gun, !grounded); }
  function firePull(now, isBurst, useAlt) {
    // Marshal-style per-bullet reload can be interrupted by firing (keeps what's loaded)
    if (reloading) {
      if (gun.reloadPerBullet) { reloading = false; $('reloadbar').style.display = 'none'; }
      else return;
    }
    if (equipT > 0) return;
    if (ammo <= 0 && gun.mag !== Infinity) {
      audio.click();
      if (settings.reload === 'auto') startReload(); // manual: R only. off: infinite (never reaches here)
      return;
    }
    // Semi rate cap: no trigger pull may beat 1/rpm (clocks are MILLISECONDS)
    const capRpm = useAlt && gun.alt?.rpm ? gun.alt.rpm : effectiveRpm(gun, { ads: adsHeld, scoped, spool: spool01() });
    if (!isBurst && !shotReady(now, lastShot, capRpm)) return;
    if (gun.mag !== Infinity && settings.reload !== 'off') ammo--;
    lastShot = now;
    shotStreak = (now - lastBurstEnd > 250) ? 1 : shotStreak + 1; lastBurstEnd = now;
    const s = gun.snd;
    audio.shot(s.freq, s.dur);
    const running = moveCat() === 'run';
    const rMult = running && gun.runRecoilMult ? gun.runRecoilMult : 1; // patch 6.11: ×1.8 running recoil
    recoil += gun.recoil.pitch * rMult * DEG; yaw += (Math.random() - 0.5) * 2 * gun.recoil.yaw * DEG;
    bloom = Math.min(bloom + (gun.pellets > 1 ? 0.8 : gun.mode === 'semi' ? 0.35 : 0.25), 4);
    fovKick = Math.min(fovKick + 0.3, 1.1);
    FX.popMuzzle(gun.pellets > 1); FX.gun.position.z = 0.06;
    stats.raw.pulls++; stats.raw.shots++;

    const from = muzzleWorld().clone();
    const pellets = useAlt && gun.alt?.pellets ? gun.alt.pellets : gun.pellets;
    const spreadR = (useAlt && gun.alt?.spread !== undefined ? altSpread() : currentSpread()) * DEG;
    let totalDmg = 0, headDmg = 0, hitAny = false, killInfo = null, handled = false;
    for (let i = 0; i < pellets; i++) {
      _dir.set((Math.random() - 0.5) * 2 * spreadR, (Math.random() - 0.5) * 2 * spreadR, -1)
        .applyQuaternion(camera.quaternion).normalize();
      raycaster.set(camera.position, _dir); raycaster.far = 150;
      const hits = raycaster.intersectObjects(T.meshes(), false);
      const oh = raycaster.intersectObjects(W.occluders, false);
      const oHit = oh.length ? oh[0] : null;
      const tHit = hits.length ? hits[0] : null;
      if (!tHit || (oHit && oHit.distance < tHit.distance)) {
        // stopped by the room itself: impact the real surface, once per pull
        // (this replaces the old analytic planes that floated in mid-air)
        if (i === 0) {
          if (oHit) {
            FX.tracer(from, oHit.point);
            FX.spark(oHit.point, 0x7b8087);
            _n.copy(oHit.face.normal).transformDirection(oHit.object.matrixWorld);
            FX.decal(oHit.point, _n);
          } else FX.tracer(from, _hit.copy(camera.position).addScaledVector(_dir, 40));
        }
        continue;
      }
      const h = tHit, ud = h.object.userData;
      FX.tracer(from, h.point, gun.silenced ? 0xf6d447 : 0xf6d447);
      if (!ud || !ud.t) { FX.spark(h.point, 0x888888); continue; }
      _hit.copy(h.point);
      const t = ud.t, dist = camera.position.distanceTo(h.point);
      if (lethalOnHit(mode) && t.type === 'orb') {
        // one-shot modes: any valid hit kills the orb — no weapon damage math
        hitAny = true; stats.raw.pelletHits++; stats.raw.hits++;
        stats.raw.damage += 100;
        FX.spark(h.point, 0xf6d447);
        FX.dmgNum(h.point, '+100', false);
        markHit(false);
        killTarget(t, now, false, dist, 100);
        handled = true;
        break;
      }
      let part = ud.part, dmg;
      if (t.type === 'orb') { part = 'body'; dmg = damageAtRange(gun, dist, 'body'); }
      else dmg = damageAtRange(gun, dist, part);
      totalDmg += dmg; if (part === 'head') headDmg += dmg;
      hitAny = true; stats.raw.pelletHits++;
      FX.spark(h.point, part === 'head' ? 0xf6d447 : t.type === 'orb' ? 0xf6d447 : 0xf6d447);
      t.hp -= dmg;
      if (t.type === 'bot') T.setHpBar(t);
      if (t.hp <= 0 && t.alive) killInfo = { t, part, dist, dmg: totalDmg };
    }
    if (hitAny && !handled) {
      stats.raw.hits++;
      const head = headDmg >= totalDmg * 0.5 && headDmg > 0;
      if (head) stats.raw.head++; else stats.raw.body++;
      stats.raw.damage += Math.min(totalDmg, killInfo ? killInfo.t.maxHp : totalDmg);
      markHit(head);
      if (head) { audio.ding(); showBanner('HEADSHOT'); hitStop = 0.028; }
      else audio.body();
      FX.dmgNum(killInfo ? killInfo.t.group.position : _hit, Math.round(totalDmg), head);
    } else if (mode === 'gridshot') stats.raw.score = Math.max(0, stats.raw.score - 20);
    if (killInfo) killTarget(killInfo.t, now, killInfo.part === 'head', killInfo.dist, totalDmg);
    else if (!hitAny) stats.raw.streak = 0;
  }

  function onMiss() { if (mode === 'gridshot') stats.raw.score = Math.max(0, stats.raw.score - 20); stats.raw.streak = 0; }
  function killTarget(t, now, wasHead, dist, dmg) {
    const r = stats.raw;
    r.kills++; r.streak++; r.bestStreak = Math.max(r.bestStreak, r.streak);
    if (wasHead) r.headKills++;
    audio.kill();
    W.pulseKill(); // jumbotron kill flash
    feed.push(gun.name, dmg, wasHead, dist || 0);
    if (t.type === 'orb') FX.flash(t.meshes[0]);
    const ttkMs = now - t.spawnT;
    T.remove(t);
    if (mode === 'gridshot') { r.score += 100; spawnGridOrb(); }
    else if (mode === 'flick') { r.ttks.push(ttkMs); r.score += Math.round(clamp(1200 - ttkMs, 100, 1200));
      if (r.kills >= MODE_DEFS.flick.targets) { endGame(); return; } spawnFlickOrb(); }
    else if (mode === 'bots') { r.score += 100 + (wasHead ? 50 : 0); pendingSpawn = 0.15; }
  }

  // ---------- spawns (player-relative, distance band from Settings) ----------
  let trackAnchor = 0;
  const bandDist = () => spawnDist(settings.dist);
  function spawnGridOrb() {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    for (let i = 0; i < 40; i++) {
      const d = bandDist() * (0.85 + Math.random() * 0.3);
      // Keep targets in a narrow forward cone. The old 0.45d spread put
      // gridshot orbs far into the side vision, which looked like off-screen
      // spawns when the player turned.
      const lx = (Math.random() * 2 - 1) * Math.min(4.5, d * 0.24);
      const p = new THREE.Vector3(
        clamp(pos.x + fx * d + rx * lx, -32, 32),
        1.0 + Math.random() * 2.6,
        clamp(pos.z + fz * d + rz * lx, -63, 11));
      let ok = p.distanceTo(pos) > 2;
      if (ok) for (const t of T.targets) if (t.group.position.distanceTo(p) < 1.5) { ok = false; break; }
      if (ok) { const t = T.spawnOrb(p, armorHp(), orbScale(settings.orbSize)); FX.spark(p, 0xf6d447); return t; }
    }
    const d = bandDist();
    const fp = new THREE.Vector3(clamp(pos.x - Math.sin(yaw) * d, -32, 32), 2,
      clamp(pos.z - Math.cos(yaw) * d, -63, 11));
    FX.spark(fp, 0xf6d447);
    return T.spawnOrb(fp, armorHp(), orbScale(settings.orbSize));
  }
  function spawnFlickOrb() {
    const az = (Math.random() * 2 - 1) * 16 * DEG, el = (Math.random() * 14 - 2) * DEG, d = bandDist();
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const lx = Math.sin(az) * d, dd = Math.cos(az) * d;
    const p = new THREE.Vector3(
      clamp(pos.x + fx * dd + rx * lx, -32, 32),
      clamp(pos.y + Math.sin(el) * d, 0.6, 4.5),
      clamp(pos.z + fz * dd + rz * lx, -63, 11));
    FX.spark(p, 0xf6d447);
    return T.spawnOrb(p, armorHp(), orbScale(settings.orbSize));
  }
  function spawnRangeBot() {
    const d = bandDist();
    const lx = (Math.random() * 2 - 1) * Math.min(4.5, d * 0.24);
    return T.spawnBot(new THREE.Vector3(
      clamp(pos.x - Math.sin(yaw) * d + Math.cos(yaw) * lx, -32, 32), 0,
      clamp(pos.z - Math.cos(yaw) * d - Math.sin(yaw) * lx, -63, 11)), armorHp());
  }

  // ---------- flow ----------
  function startGame(m) {
    mode = m; T.clear(); stats.reset();
    yaw = 0; pitch = 0; recoil = 0; bloom = 0;
    pos.set(0, 1.6, 2); vel.set(0, 0, 0);
    ammo = gun.mag; reloading = false; pendingSpawn = 0; trackBot = null; stalker = null;
    pendingGrid = 0; gridT = 0;
    trackSecs = []; secClock = 0; secOn = 0;
    adsHeld = false; scoped = false; scopeIdx = 0; adsZoom = 1;
    FX.setSniperScope(false); $('scope').classList.remove('on'); document.body.classList.toggle('scoped', scoped);
    spoolT = 0; burstLeft = 0; burstCool = 0;
    vy = 0; airH = 0; grounded = true; camH = CAM_STAND;
    timeLeft = MODE_DEFS[m].time ?? 120; elapsed = 0;
    $('st-mode').textContent = MODE_DEFS[m].name;
    $('st-gunname').textContent = `${gun.name} · ${gun.cls.toUpperCase()} · ${gun.mag === Infinity ? '∞' : gun.mag} MAG`;
    $('menu').classList.remove('open'); $('results').classList.remove('open'); $('pause').classList.remove('open'); toggleBuy(false);
    document.body.classList.add('playing'); document.body.classList.remove('paused');
    $('countdown').style.display = 'flex'; cdT = 1.4; state = COUNT;
    const sf = $('startfade'); // smooth reveal: cover cut, fade out (also masks any first-frame hitch)
    if (sf) {
      sf.style.transition = 'none';
      sf.style.visibility = 'visible';
      sf.style.opacity = '1';
      void sf.offsetWidth;
      sf.style.transition = 'opacity .3s ease, visibility 0s linear .3s';
      sf.style.opacity = '0';
      sf.style.visibility = 'hidden';
    }
    audio.unlock(); requestLock();
    if (m === 'gridshot') { pendingGrid = 3; gridT = 0; } // opening cascade, pops in as the timer starts
    else if (m === 'flick') spawnFlickOrb();
    else if (m === 'tracking') {
      trackAnchor = clamp(pos.x, -26, 26);
      trackBot = T.spawnBot(new THREE.Vector3(trackAnchor, 0, clamp(pos.z - 10, -63, 11)), armorHp());
      stalker = createStalker({ difficulty: settings.trackDiff, bounds: 6, speed: 5.4, seed: (Math.random() * 2 ** 31) | 0 });
    }
    else if (m === 'bots') spawnRangeBot();
    stats.startLoop(m, { timeLeft: () => timeLeft, elapsed: () => elapsed,
      extra: () => ({ tracking: mode === 'tracking', ammo, reloading, equipping: equipT > 0,
        noReload: settings.reload === 'off', range: centerDist(),
        mag: gun.mag === Infinity ? 0 : gun.mag,
        hp: '100 HP' }) });
  }
  function modeHistory(m) { return history.filter(h => h.m === m); }
  function improvement(m) {
    const hs = modeHistory(m); if (hs.length < 4) return null;
    const base = hs.slice(0, 3).reduce((a, b) => a + b.score, 0) / 3;
    const n = Math.min(3, hs.length), cur = hs.slice(-n).reduce((a, b) => a + b.score, 0) / n;
    return base <= 0 ? null : (cur - base) / base * 100;
  }
  async function endGame() {
    state = RESULTS; mouseDown = false; stats.stopLoop();
    scoped = false; FX.setSniperScope(false); $('scope').classList.remove('on'); document.body.classList.toggle('scoped', scoped);
    if (locked()) document.exitPointerLock();
    document.body.classList.remove('playing', 'paused');
    const r = stats.raw;
    if (mode === 'tracking') r.score = Math.round(r.onT * 100);
    const acc = r.shots > 0 ? Math.round(100 * r.hits / r.shots) : 0;
    const accbar = $('res-accbar'); if (accbar) accbar.style.width = acc + '%';
    history.push({ m: mode, gun: gun.id, score: r.score, acc, d: Date.now() }); saveHistory();
    $('res-mode').textContent = MODE_DEFS[mode].name + ' · ' + gun.name;
    $('res-score').textContent = r.score;
    // --- Earned-this-run snapshot. Snapshot the store BEFORE we call
    // refresh() so we can diff "before" vs "after" reliably. ---
    const storeRef = window?.store;
    const beforeBalances = storeRef ? { ...(storeRef.state.balances || {}) } : null;
    const beforeStable = storeRef?.state?.player?.stable;
    const beforeAapl = beforeBalances?.AAPL ?? 0;
    const earnedAaplEl = $('res-earned-aapl');
    const earnedUsdEl = $('res-earned-usd');
    const streakEl = $('res-earned-streak');
    const missionEl = $('res-earned-missions');
    if (earnedAaplEl) earnedAaplEl.textContent = '…';
    if (earnedUsdEl) earnedUsdEl.textContent = '…';
    if (streakEl) streakEl.textContent = '…';
    if (missionEl) missionEl.textContent = '…';
    if (storeRef) {
      try {
        await storeRef.refresh();
      } catch (_) { /* server may be down; leave placeholders */ }
      const s = storeRef.state;
      const afterAapl = s.balances?.AAPL ?? 0;
      const aaplDelta = afterAapl - beforeAapl;
      const usdDelta = (s.player?.stable ?? 0) - (beforeStable ?? s.player?.stable ?? 0);
      if (earnedAaplEl) {
        earnedAaplEl.textContent = `${aaplDelta >= 0 ? '+' : '−'}${Math.abs(aaplDelta).toFixed(4)} ${getActiveTicker()}`;
        earnedAaplEl.classList.toggle('pos', aaplDelta > 0);
        earnedAaplEl.classList.toggle('neg', aaplDelta < 0);
      }
      if (earnedUsdEl) {
        earnedUsdEl.textContent = `${usdDelta >= 0 ? '+' : '−'}$${Math.abs(usdDelta).toFixed(2)}`;
        earnedUsdEl.classList.toggle('pos', usdDelta > 0);
        earnedUsdEl.classList.toggle('neg', usdDelta < 0);
      }
      if (streakEl) {
        const baseStreak = 5;
        const bonus = r.bestStreak > baseStreak
          ? Math.round(((r.bestStreak - baseStreak) / baseStreak) * 20)
          : 0;
        streakEl.textContent = bonus > 0 ? `+${bonus}%` : '—';
      }
      if (missionEl) {
        const claimed = (s.missions || []).filter(m => m.claimed).length;
        const totalM = (s.missions || []).length;
        missionEl.textContent = `${claimed} / ${totalM}`;
      }
    } else {
      // No store available (game launched before bootstrap finished):
      // fall back to the legacy HUD-chip read so the report never shows
      // just zeros if the user already had earn flow running.
      const bridgeChip = document.querySelector('#aim2stock-bridge');
      const earnedAaplText = (bridgeChip?.children?.[2]?.textContent || '0.0000').trim();
      const earnedAapl = Number(earnedAaplText) || 0;
      if (earnedAaplEl) earnedAaplEl.textContent = `+${earnedAapl.toFixed(4)} ${getActiveTicker()}`;
      if (streakEl) {
        const baseStreak = 5;
        const bonus = r.bestStreak > baseStreak
          ? Math.round(((r.bestStreak - baseStreak) / baseStreak) * 20)
          : 0;
        streakEl.textContent = bonus > 0 ? `+${bonus}%` : '—';
      }
    }
    const g = $('res-grid'); g.innerHTML = '';
    const hsp = r.hits ? Math.round(100 * r.head / r.hits) : 0;
    // Headline numbers live in #res-headline (single big token count);
    // the four small stat cards below it (kills / accuracy / score /
    // best-streak) share a single visual language — large number, tiny
    // label. No "improvement vs baseline" nag, no "more to unlock" copy.
    const tokenLine = $('res-earned-aapl');
    if (tokenLine) {
      const earned = (tokenLine.textContent || '+0.0000').trim();
      tokenLine.textContent = earned;
      tokenLine.classList.add('big');
    }
    // Strip the legacy earned-row label (the headline is self-explanatory)
    const earnedLabel = document.querySelector('.res-earned-row .k');
    if (earnedLabel) earnedLabel.style.display = 'none';
    const cell = (k, v) => { const d = document.createElement('div'); d.innerHTML = `<div class="v">${v}</div><div class="k">${k}</div>`; g.appendChild(d); };
    cell('kills', r.kills);
    cell('accuracy', acc + '%');
    cell('headshot', hsp + '%');
    cell('best streak', r.bestStreak);
    // Per-mode extra stat (kept compact, single line).
    if (mode === 'tracking') {
      const cons = trackSecs.length ? Math.round(100 * trackSecs.filter(b => b >= 0.5).length / trackSecs.length) : 0;
      cell('consistency', cons + '%');
    } else if (mode === 'flick' && r.ttks.length) {
      cell('avg flick', Math.round(r.ttks.reduce((a, b) => a + b, 0) / r.ttks.length) + 'ms');
    } else if (elapsed > 1) {
      cell('kills / sec', (r.kills / elapsed).toFixed(2));
    }
    // Clear the legacy improvement copy — the four numbers + headline
    // are the whole story. We keep the node around (empty) so existing
    // CSS hooks don't break.
    const ri = $('res-improve');
    if (ri) ri.textContent = '';
    T.clear(); $('results').classList.add('open'); renderMenuStats();
  }
  function quitToMenu() {
    state = MENU; mouseDown = false; stats.stopLoop();
    scoped = false; FX.setSniperScope(false); $('scope').classList.remove('on'); document.body.classList.toggle('scoped', scoped);
    if (locked()) document.exitPointerLock();
    T.clear(); toggleBuy(false);
    document.body.classList.remove('playing', 'paused');
    $('pause').classList.remove('open'); $('results').classList.remove('open'); $('countdown').style.display = 'none';
    $('menu').classList.add('open'); renderMenuStats();
  }
  function doPause() {
    state = PAUSED; document.body.classList.add('paused'); document.body.classList.remove('playing');
    $('countdown').style.display = 'none'; $('pause').classList.add('open'); lockHint();
  }

  // ---------- buy menu ----------
  function toggleBuy(open) {
    const b = $('buy');
    b.classList.toggle('open', open);
    if (open) renderBuy();
    if (state === PLAYING && open) { /* keep playing; menu is pointer-released */ if (locked()) document.exitPointerLock(); }
    else if (state === PLAYING && !open) requestLock();
  }
  function bar(pct) { return `<span class="bar"><i style="width:${Math.round(pct)}%"></i></span>`; }
  let buyCls = null;
  function renderBuy() {
    const grid = $('buy-grid'); grid.innerHTML = '';
    if (!GUN_CLASSES.includes(buyCls)) buyCls = gun.cls;
    const rail = document.createElement('div'); rail.className = 'buy-rail';
    GUN_CLASSES.forEach(cls => {
      const b = document.createElement('button');
      b.className = 'buy-railbtn' + (cls === buyCls ? ' on' : '');
      b.textContent = cls.toUpperCase();
      b.addEventListener('click', () => { buyCls = cls; renderBuy(); });
      rail.appendChild(b);
    });
    grid.appendChild(rail);
    const list = document.createElement('div'); list.className = 'buy-list';
    GUNS.filter(g => g.cls === buyCls).forEach(g => {
      const maxHead = Math.max(...g.bands.map(b => b[1]));
      const el = document.createElement('div');
      const ownedSet = new Set(loadoutOwned());
      const stable = Number(loadoutStable()) || 0;
      el.className = 'buy-item' + (g.id === gun.id ? ' cur' : '');
      const isOwned = ownedSet.has(g.id) || g.start === true;
      const priceStable = Number(g.priceStable) || 0;
      const canAfford = stable + 1e-9 >= priceStable;
      const status = isOwned
        ? '<span class="eq">OWNED</span>'
        : (priceStable === 0
            ? '<span class="eq">FREE</span>'
            : (canAfford
                ? `<span class="eq">BUY $${priceStable.toFixed(2)}</span>`
                : `<span class="locked">LOCKED $${priceStable.toFixed(2)}</span>`));
      el.innerHTML =
        `<svg class="gsil" viewBox="0 0 120 40"><use href="#sil-${g.cls.toLowerCase()}"/></svg>` +
        `<div class="buy-meta"><b>${g.name}</b><span class="price">${status}</span>${g.id === gun.id ? '<span class="eq">EQUIPPED</span>' : ''}</div>` +
        `<div class="buy-bars"><label>PWR ${maxHead}</label>${bar(maxHead / 255 * 100)}` +
        `<label>RPM ${g.rpm}</label>${bar(g.rpm / 16 * 100)}` +
        `<label>MAG ${g.mag === Infinity ? '∞' : g.mag}</label>${bar(g.mag === Infinity ? 100 : g.mag / 100 * 100)}</div>` +
        `<div class="buy-tag">${g.mode === 'auto' ? 'AUTO' : 'SEMI'} · ${g.pen} PEN${g.silenced ? ' · SUPPRESSED' : ''} · ${Number(g.earnMult || 1).toFixed(2)}x EARN</div>`;
      el.classList.toggle('not-owned', !isOwned);
      el.classList.toggle('locked', !isOwned && !canAfford);
      el.addEventListener('click', async () => {
        if (isOwned) {
          // Already owned: equip it directly.
          buyGun(g.id);
          toggleBuy(false);
          return;
        }
        // Not owned: try to buy. If the server says insufficient, surface
        // the error inline. We do not block the player from doing other
        // things while the buy is in flight.
        if (priceStable > 0 && !canAfford) return;
        try {
          const r = await window.store.buyGun(g.id);
          if (r && (r.ok || r.already_owned)) {
            buyGun(g.id);
            toggleBuy(false);
            if (window.renderMenuStats) window.renderMenuStats();
          }
        } catch (e) {
          // Best-effort: show a brief error on the buy card.
          el.title = e && e.message ? e.message : 'buy failed';
        }
      });
      list.appendChild(el);
    });
    grid.appendChild(list);
  }

  // ---------- HUD helpers ----------
  function replayAnim(el, cls) {
    el.classList.remove(cls);
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; el.classList.add(cls); });
  }
  function markHit(head) {
    const hm = $('hitmarker');
    hm.classList.toggle('head', !!head);
    replayAnim(hm, 'show');
    // aim2stock bridge: emit a window event the client-side aim-bridge.js
    // listens for. The bridge POSTs to /aim/hit. Server is authoritative.
    try {
      const acc = stats.raw.shots > 0 ? stats.raw.hits / stats.raw.shots : 0;
      const detail = { head: !!head, accuracy: acc, streak: shotStreak, ts: Date.now(),
        // Forward the active gunId so the server can apply the per-weapon
        // earn multiplier. aim-bridge falls back to 1.0x if this is null.
        gunId: gun && gun.id ? gun.id : null };
      window.dispatchEvent(new CustomEvent('vibes:hit', { detail }));
    } catch (_) { /* never let bridge failures affect the engine */ }
  }
  function showBanner(t) { const b = $('banner'); b.textContent = t; replayAnim(b, 'show'); }

  // ---------- menu / settings UI ----------
  function renderMenuStats() {
    const list = $('modelist'); list.innerHTML = '';
    let mi = 0;
    for (const id of Object.keys(MODE_DEFS)) {
      mi++;
      const d = MODE_DEFS[id], hs = modeHistory(id);
      const best = hs.length ? Math.max(...hs.map(h => h.score)) : null;
      const el = document.createElement('div'); el.className = 'mode mode-' + id;
      el.tabIndex = 0; el.setAttribute('role', 'button');
      el.innerHTML = `<div class="mode-idx">0${mi}</div><div class="mode-body"><h3>${d.name}</h3><p>${d.desc}</p></div><div class="mode-footer"><div class="stats">${best !== null ? `best ${best}` : 'click to start'}</div>${mi === 1 ? '<button type="button" class="mode-play">Play</button>' : ''}</div>`;
      el.addEventListener('click', () => startGame(id));
      const play = el.querySelector('.mode-play');
      if (play) play.addEventListener('click', e => { e.stopPropagation(); startGame(id); });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(id); } });
      list.appendChild(el);
    }
    const recent = history.slice().sort((a, b) => (b.d || 0) - (a.d || 0));
    const latest = recent[0];

    // Token balance cards (USD / AAPL / NVDA / ...). Reads straight from
    // the store which is kept in sync by /portfolio. Only renders tokens
    // that actually have a non-zero balance so the panel stays tidy.
    const tokensEl = document.querySelector('[data-dashboard-tokens]');
    if (tokensEl) {
      const s = window.store && window.store.state;
      const balances = (s && s.balances) || {};
      const stable = (s && s.player && Number(s.player.stable)) || 0;
      const cards = [];
      // Stable coin first so the user always sees their cash position.
      cards.push({ sym: 'USD', name: 'USD stable', qty: stable, kind: 'free' });
      // Then every held ticker (only if balance is non-zero).
      const tickers = Object.keys(balances)
        .filter((t) => t !== 'USD' && balances[t] > 0)
        .map((t) => ({ sym: t, qty: balances[t] }));
      const nameOf = (sym) => (sym === 'AAPL' ? 'Apple Inc.' : sym === 'NVDA' ? 'NVIDIA Corp.' : sym);
      for (const t of tickers) {
        cards.push({ sym: t.sym, name: nameOf(t.sym), qty: t.qty, kind: 'token' });
      }
      tokensEl.innerHTML = cards.map((c) => {
        const qtyText = c.sym === 'USD' ? c.qty.toFixed(2) : c.qty.toFixed(4);
        const kindClass = c.kind === 'free' ? 'tok-free' : 'tok-token';
        return `<div class="tok-card ${kindClass}" data-tok-symbol="${c.sym}">
          <div class="tok-symbol">${c.sym}</div>
          <div class="tok-name">${c.name}</div>
          <div class="tok-qty"><b>${qtyText}</b></div>
        </div>`;
      }).join('');
    }

    const put = (selector, value) => document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
    const records = document.querySelector('[data-mode-records]');
    if (records) {
      records.innerHTML = '';
      for (const id of Object.keys(MODE_DEFS)) {
        const d = MODE_DEFS[id], hs = modeHistory(id);
        const bestScore = hs.length ? Math.max(...hs.map(h => h.score || 0)) : '—';
        const bestAcc = hs.length ? Math.max(...hs.map(h => h.acc || 0)) + '%' : '—';
        const card = document.createElement('article');
        card.className = 'mode-record-card';
        card.innerHTML = `<div class="mode-record-head"><span>${d.name}</span></div><div class="mode-record-values"><div><strong>${bestScore}</strong><small>BEST SCORE</small></div><div><strong>${bestAcc}</strong><small>BEST ACCURACY</small></div></div>`;
        records.appendChild(card);
      }
    }
    const sessions = document.querySelector('[data-session-history]');
    if (sessions) {
      sessions.innerHTML = recent.length ? recent.slice(0, 6).map((h) => {
        const name = MODE_DEFS[h.m]?.name || h.m || 'SESSION';
                const stamp = h.d ? new Date(h.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
                // One row per past run: mode + date, big score. No accuracy
                // (already visible in /aim/hit HUD) and no loadout (the gun id
                // is irrelevant once the run is over; you can see current
                // loadout in Customize).
                return `<article class="session-window"><div class="session-window-head"><b>${name}</b><span>${stamp}</span></div><div class="session-window-score">${h.score || 0}</div></article>`;
      }).join('') : '<div class="stats-empty">No sessions yet. Finish a run to create the first record.</div>';
    }
    put('[data-dashboard-sessions]', String(recent.length));
        put('[data-dashboard-best]', recent.length ? String(Math.max(...recent.map(h => h.score || 0))) : '—');
        if (latest) {
          put('[data-recent-mode]', MODE_DEFS[latest.m]?.name || latest.m || 'SESSION');
          put('[data-recent-score]', String(latest.score || 0));
          put('[data-recent-accuracy]', (latest.acc ?? 0) + '%');
        }
        // Expose for non-module callers (the dashboard token-card subscription
        // in src/bootstrap.js calls window.renderMenuStats on every store
        // emit so balances refresh without reopening the menu).
        if (typeof window !== 'undefined') window.renderMenuStats = renderMenuStats;
      }
      function bandStr(g) {
        return g.bands.map(([r, h, b, l]) => `${r >= 999 ? '50m+' : '0–' + r + 'm'}: ${h}/${b}/${l}`).join(' · ');
      }
      function renderLoadout() {
    const clsSel = $('lo-class'), gunSel = $('lo-gun');
    if (!clsSel.options.length) {
      GUN_CLASSES.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; clsSel.appendChild(o); });
      clsSel.addEventListener('change', () => { renderLoadout(); });
      gunSel.addEventListener('change', () => buyGun(gunSel.value, true));
    }
    if (![...clsSel.options].some(o => o.value === gun.cls)) clsSel.value = gun.cls;
    else if (clsSel.value !== gun.cls && document.activeElement !== clsSel) clsSel.value = gun.cls;
    gunSel.innerHTML = '';
    GUNS.filter(g => g.cls === clsSel.value).forEach(g => {
      const o = document.createElement('option'); o.value = g.id; o.textContent = `${g.name} — ${g.price} cr`;
      o.dataset.ic = '#sil-' + g.cls.toLowerCase(); gunSel.appendChild(o);
    });
    gunSel.value = GUNS.some(g => g.id === gun.id && g.cls === clsSel.value) ? gun.id : gunSel.options[0].value;
    const g = gunById(gunSel.value) || gun;
    const conf = v => v === 'data' ? '<i class="tag ok">game data</i>' : '<i class="tag est">estimate</i>';
    $('gun-card').innerHTML =
      `<h3>${g.name} <span class="price">${g.price} credits</span></h3><p>${g.desc}</p>
       <div class="kv"><span>Damage H/B/L by range</span><b>${bandStr(g)}</b></div>
       <div class="kv"><span>Fire rate</span><b>${g.mode === 'auto' ? g.rpm + '/s' + (g.adsRpm ? ` (${g.adsRpm}/s ADS)` : '') + (g.spool ? `, spools ${g.spool.from}→${g.spool.to}` : '') : g.rpm + '/s semi'}</b></div>
       <div class="kv"><span>Mag / reload / equip</span><b>${g.mag === Infinity ? '∞' : g.mag} · ${g.reload}s · ${g.equip}s</b></div>
       <div class="kv"><span>1st-shot spread</span><b>${g.spread.hip}°${g.spread.ads !== undefined ? ` (${g.spread.ads}° ADS)` : ''} ${conf(g.spread.src)}</b></div>
       <div class="kv"><span>Zoom / pen / silenced</span><b>${g.alt?.zoom ? g.alt.zoom + 'x' : g.alt?.kind === 'scope' ? g.alt.zooms.join('/') + 'x' : '—'} · ${g.pen} · ${g.silenced ? 'yes' : 'no'}</b></div>
       <div class="kv"><span>Move speed</span><b>${g.run} m/s</b></div>`;
    if (gun.id !== g.id && document.activeElement === gunSel) buyGun(g.id, true);
    syncCombos();
  }
  // VALORANT-parity crosshair: grouped parts, gap via CSS vars (one style
  // write per change, zero DOM rebuilds), live movement/firing error expansion.
  let chRefs = {};
  function buildCrosshair(el, live) {
    const c = settings.ch; el.innerHTML = '';
    const sh = c.outline ? `0 0 0 ${c.outlineTh}px rgba(0,0,0,${c.outlineOp})` : 'none';
    const part = (parent, w, h, css) => { const d = document.createElement('div'); d.className = 'ch-part';
      d.style.cssText = `width:${w}px;height:${h}px;left:50%;top:50%;background:${c.color};box-shadow:${sh};${css}`; parent.appendChild(d); };
    const gi = document.createElement('div'); gi.className = 'ch-group';
    gi.style.opacity = c.op;
    part(gi, c.thick, c.len, 'transform:translate(-50%,calc(-100% - var(--gap)))');
    part(gi, c.thick, c.len, 'transform:translate(-50%,var(--gap))');
    part(gi, c.len, c.thick, 'transform:translate(calc(-100% - var(--gap)),-50%)');
    part(gi, c.len, c.thick, 'transform:translate(var(--gap),-50%)');
    if (!c.innerShow) gi.style.display = 'none';
    el.appendChild(gi);
    const go = document.createElement('div'); go.className = 'ch-group';
    go.style.opacity = c.oOp;
    part(go, c.oThick, c.oLen, 'transform:translate(-50%,calc(-100% - var(--ogap)))');
    part(go, c.oThick, c.oLen, 'transform:translate(-50%,var(--ogap))');
    part(go, c.oLen, c.oThick, 'transform:translate(calc(-100% - var(--ogap)),-50%)');
    part(go, c.oLen, c.oThick, 'transform:translate(var(--ogap),-50%)');
    if (!c.outer) go.style.display = 'none';
    el.appendChild(go);
    if (c.dot) {
      const gd = document.createElement('div'); gd.className = 'ch-group';
      gd.style.opacity = c.dotOp;
      part(gd, c.dotSize, c.dotSize, 'transform:translate(-50%,-50%)');
      el.appendChild(gd);
      if (live) chRefs.gdot = gd;
    }
    if (live) { chRefs.gin = gi; chRefs.gout = go; if (!c.dot) chRefs.gdot = null; }
    el.style.setProperty('--gap', c.gap + 'px');
    el.style.setProperty('--ogap', c.oGap + 'px');
  }
  function applyCrosshair() {
    buildCrosshair($('crosshair'), true);
    const pv = $('chpreview'); pv.innerHTML = '<div style="position:absolute;left:50%;top:50%"></div>';
    buildCrosshair(pv.firstElementChild, false);
    chGapCache = '';
    tickCrosshair();
    refreshExport();
  }
  function refreshCrosshairUI() {
    const c = settings.ch;
    $('x-color-preset').value = c.colorIdx;
    $('x-color-custom').value = c.color;
    $('x-color-custom').style.display = c.colorIdx === 8 ? '' : 'none';
    const set = (id, v) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; };
    set('x-outline', c.outline); set('x-outline-op', c.outlineOp); set('x-outline-th', c.outlineTh);
    set('x-dot', c.dot); set('x-dot-op', c.dotOp); set('x-dot-size', c.dotSize);
    set('x-inner', c.innerShow); set('x-len', c.len); set('x-thick', c.thick); set('x-gap', c.gap); set('x-op', c.op);
    set('x-moveerr', c.moveErr); set('x-move-mult', c.moveMult);
    set('x-fireerr', c.fireErr); set('x-fire-mult', c.fireMult); set('x-fade', c.fade);
    set('x-outer', c.outer); set('x-olen', c.oLen); set('x-othick', c.oThick); set('x-ogap', c.oGap); set('x-oop', c.oOp);
    refreshExport();
    syncCombos();
  }
  function refreshExport() {
    const el = $('x-export');
    if (el) el.value = buildCode(settings.ch, chExtra.segments.A || chExtra.segments.S ? chExtra.segments : null);
  }
  let chGapCache = '';
  function tickCrosshair() { // per-frame: real error expansion (degrees -> screen px)
    const c = settings.ch;
    let err = 0;
    if (c.moveErr) err += movePenalty(gun, moveCat()) * c.moveMult;
    if (c.fireErr) err += bloom * c.fireMult;
    const px = err > 0.001 ? Math.tan(err * DEG) / Math.tan(HFOVR / 2) * (innerWidth / 2) : 0;
    let fadeF = 1;
    if (c.fade && bloom > 0.01) fadeF = 1 / (1 + bloom * 0.8);
    const key = [c.gap, c.oGap, px.toFixed(1), fadeF.toFixed(2), c.op, c.oOp, c.dotOp,
      c.innerShow, c.outer, c.dot, scoped].join('|');
    if (key === chGapCache) return;
    chGapCache = key;
    const el = $('crosshair');
    el.style.setProperty('--gap', (c.gap + px) + 'px');
    el.style.setProperty('--ogap', (c.oGap + px) + 'px');
    const gi = chRefs.gin, go = chRefs.gout, gd = chRefs.gdot;
    if (gi) { gi.style.opacity = c.op * fadeF; gi.style.display = c.innerShow ? '' : 'none'; }
    if (go) { go.style.opacity = c.oOp * fadeF; go.style.display = c.outer ? '' : 'none'; }
    if (gd) gd.style.opacity = c.dotOp * fadeF;
  }
  function initUI() {
    $('s-sens').value = settings.sens; $('s-scope').value = settings.scope;
    $('s-vol').value = settings.volume; $('s-scale').value = settings.scale;
    $('s-reload').value = settings.reload; $('s-track').value = settings.trackDiff;
    $('s-dist').value = settings.dist;
    const themeSel = $('s-theme');
    themeSel.innerHTML = '';
    THEMES.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; o.title = t.desc; themeSel.appendChild(o); });
    themeSel.value = settings.theme;
    $('s-orbmove').value = settings.orbMove; $('s-orbsize').value = settings.orbSize;
    audio.vol = settings.volume;
    $('s-sens').addEventListener('change', e => { settings.sens = clamp(parseFloat(e.target.value) || 0.4, 0.01, 10); saveSettings(); });
    $('s-scope').addEventListener('change', e => { settings.scope = clamp(parseFloat(e.target.value) || 1, 0.1, 2); saveSettings(); });
    $('s-vol').addEventListener('input', e => { settings.volume = parseFloat(e.target.value); audio.vol = settings.volume; saveSettings(); });
    $('s-scale').addEventListener('change', e => { settings.scale = e.target.value; saveSettings(); applySize(); });
    $('s-reload').addEventListener('change', e => { settings.reload = e.target.value; saveSettings(); });
    $('s-track').addEventListener('change', e => { settings.trackDiff = e.target.value; saveSettings(); });
    $('s-dist').addEventListener('change', e => { settings.dist = e.target.value; saveSettings(); });
    $('s-theme').addEventListener('change', e => { switchTheme(e.target.value); });
    $('s-orbmove').addEventListener('change', e => { settings.orbMove = e.target.value; saveSettings(); });
    $('s-orbsize').addEventListener('change', e => {
      settings.orbSize = e.target.value; saveSettings();
      T.setOrbScaleAll(orbScale(settings.orbSize)); // live resize, no run restart
    });
    $('zero-ads').addEventListener('click', () => { settings.scope = 0.870; $('s-scope').value = 0.870; saveSettings(); });
    $('zero-scope').addEventListener('click', () => { settings.scope = 0.747; $('s-scope').value = 0.747; saveSettings(); });
    // ---- crosshair editor (VALORANT parity) + profile import/export ----
    const preset = $('x-color-preset');
    preset.innerHTML = '';
    PRESET_COLORS.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i} · ${p.name}`; o.dataset.swatch = p.hex; preset.appendChild(o); });
    { const o = document.createElement('option'); o.value = 8; o.textContent = '8 · Custom'; preset.appendChild(o); }
    const int = t => parseInt(t.value), num01 = t => clamp(parseFloat(t.value) || 0, 0, 1),
      num03 = t => clamp(parseFloat(t.value) || 0, 0, 3), bool = t => t.checked;
    const bindCh = (id, key, parse, after) => $(id).addEventListener('input', e => {
      settings.ch[key] = parse ? parse(e.target) : e.target.value;
      if (after) after();
      saveSettings(); applyCrosshair();
    });
    bindCh('x-color-preset', 'colorIdx', int, () => {
      const v = settings.ch.colorIdx;
      settings.ch.color = v === 8 ? $('x-color-custom').value.toUpperCase() : PRESET_COLORS[v].hex;
      $('x-color-custom').style.display = v === 8 ? '' : 'none';
    });
    bindCh('x-color-custom', 'color', t => t.value.toUpperCase(), () => {
      settings.ch.colorIdx = 8; $('x-color-preset').value = 8;
    });
    bindCh('x-outline', 'outline', bool); bindCh('x-outline-op', 'outlineOp', num01); bindCh('x-outline-th', 'outlineTh', int);
    bindCh('x-dot', 'dot', bool); bindCh('x-dot-op', 'dotOp', num01); bindCh('x-dot-size', 'dotSize', int);
    bindCh('x-inner', 'innerShow', bool); bindCh('x-len', 'len', int); bindCh('x-thick', 'thick', int);
    bindCh('x-gap', 'gap', int); bindCh('x-op', 'op', num01);
    bindCh('x-moveerr', 'moveErr', bool); bindCh('x-move-mult', 'moveMult', num03);
    bindCh('x-fireerr', 'fireErr', bool); bindCh('x-fire-mult', 'fireMult', num03); bindCh('x-fade', 'fade', bool);
    bindCh('x-outer', 'outer', bool); bindCh('x-olen', 'oLen', int); bindCh('x-othick', 'oThick', int);
    bindCh('x-ogap', 'oGap', int); bindCh('x-oop', 'oOp', num01);
    refreshCrosshairUI();
    $('x-doimport').addEventListener('click', () => {
      const r = parseCode($('x-import').value);
      const lab = $('x-implabel');
      if (!r.ok) { lab.textContent = 'Import failed: ' + r.errors.join('; '); lab.style.color = 'var(--red)'; return; }
      settings.ch = r.settings;
      chExtra = { segments: r.segments, unknown: r.unknown };
      saveSettings(); applyCrosshair(); refreshCrosshairUI();
      const notes = [];
      if (r.warnings.length) notes.push(r.warnings.length + ' note(s): ' + r.warnings.slice(0, 3).join('; '));
      if (r.unknown.length) notes.push('extra tokens preserved');
      if (r.segments.A || r.segments.S) notes.push('ADS/scope profile kept');
      lab.textContent = 'Imported ✓ ' + notes.join(' · ');
      lab.style.color = 'var(--teal)';
    });
    $('x-copy').addEventListener('click', async () => {
      const code = $('x-export').value, lab = $('x-implabel');
      try { await navigator.clipboard.writeText(code); }
      catch (e) { $('x-export').select(); document.execCommand('copy'); }
      lab.textContent = 'Copied — paste into VALORANT Settings → Crosshair → Import Profile Code';
      lab.style.color = 'var(--teal)';
    });
    $('resetprog').addEventListener('click', () => { if (confirm('Reset all training history?')) { history = []; saveHistory(); renderMenuStats(); } });
    $('p-resume').addEventListener('click', () => {
      $('pause').classList.remove('open'); toggleBuy(false);
      document.body.classList.add('playing'); document.body.classList.remove('paused');
      $('countdown').style.display = 'flex'; cdT = 1.0; state = COUNT; requestLock();
    });
    $('p-quit').addEventListener('click', quitToMenu);
    $('res-retry').addEventListener('click', () => startGame(mode));
    $('res-menu').addEventListener('click', quitToMenu);
    $('buy-close').addEventListener('click', () => toggleBuy(false));
    enhanceCombos(); // app-grade dropdowns over every native select
  }

  // ---------- main loop ----------
  let prev = performance.now(), fpsN = 0, fpsT = 0, fpsAvg = 60, lastAdapt = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min((now - prev) / 1000, 0.05); prev = now;
    if (hitStop > 0) { hitStop -= dt; dt *= 0.06; }
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) {
      const fps = Math.round(fpsN / fpsT); fpsAvg = fpsAvg * 0.5 + fps * 0.5;
      $('st-fps').textContent = fps + ' fps'; $('st-stance').textContent = stance;
      W.updateJumbo({ mode: state === PLAYING || state === COUNT ? MODE_DEFS[mode].name : 'STANDBY',
        score: stats.raw.score, kills: stats.raw.kills,
        acc: stats.raw.shots > 0 ? Math.round(100 * stats.raw.hits / stats.raw.shots) + '%' : '—',
        time: state === PLAYING || state === COUNT ? Math.max(0, timeLeft).toFixed(0) + 's' : '' });
      fpsN = 0; fpsT = 0; lockHint(); feed.tick();
      if (now - lastAdapt > 2500 && fpsAvg < 47) {
        lastAdapt = now;
        const pr = renderer.getPixelRatio(), next = pr > 1.2 ? 1 : pr > 0.85 ? 0.8 : pr > 0.65 ? 0.6 : 0;
        if (next) renderer.setPixelRatio(next);
      }
    }
    if (state === COUNT) { cdT -= dt; $('cdtext').textContent = cdT > 0.4 ? 'READY' : 'GO'; if (cdT <= 0) { state = PLAYING; $('countdown').style.display = 'none'; } T.idle(now, 'drift'); }
    if (state === PLAYING) {
      elapsed += dt;
      if (mode === 'gridshot' && pendingGrid > 0) { gridT -= dt; if (gridT <= 0) { spawnGridOrb(); pendingGrid--; gridT = 0.12; } }
      // ----- VALORANT movement: stance speeds, engine friction, jump -----
      const crouch = (keys.KeyC || keys.ControlLeft) && grounded;
      const walking = (keys.ShiftLeft || keys.ShiftRight) && !crouch;
      const stanceKey = !grounded ? 'air' : crouch ? 'crouch' : walking ? 'walk' : 'run';
      stance = stanceKey.toUpperCase();
      const scopeSlow = scoped && gun.alt?.scopeMove ? gun.alt.scopeMove : adsHeld ? 0.9 : 1;
      const targetSpeed = stanceSpeed(gun, stanceKey === 'air' ? 'run' : stanceKey, scopeSlow);
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      _want.set(s, 0, -f);
      const hasInput = _want.lengthSq() > 0;
      if (hasInput) _want.normalize().multiplyScalar(targetSpeed).applyAxisAngle(_Y, yaw);
      if (grounded) {
        if (hasInput) {
          _dir.copy(_want).sub(vel); // accelerate toward want at 18.75 m/s^2
          const maxD = ACCEL * dt;
          if (_dir.length() > maxD) _dir.setLength(maxD);
          vel.add(_dir);
        } else {
          const sp = vel.length(); // release friction: e^(-3.3t) + 28.6 m/s^2 flat
          if (sp > 0) {
            const ns = Math.max(0, sp * Math.exp(-3.3 * dt) - 28.6 * dt);
            if (ns <= 0.001) vel.set(0, 0, 0); else vel.multiplyScalar(ns / sp);
          }
        }
      } else {
        if (hasInput) { // weak air control
          _dir.copy(_want).sub(vel);
          const maxD = ACCEL * AIR_ACCEL_FRAC * dt;
          if (_dir.length() > maxD) _dir.setLength(maxD);
          vel.add(_dir);
        }
        vy -= GRAV * dt; airH += vy * dt;
        if (airH <= 0) { airH = 0; vy = 0; grounded = true; }
      }
      pos.addScaledVector(vel, dt);
      pos.x = clamp(pos.x, -33, 33); pos.z = clamp(pos.z, -64, 12); // free roam across the hall
      const camTarget = (crouch ? CAM_CROUCH : CAM_STAND) + airH;
      camH += (camTarget - camH) * Math.min(1, dt * 12);
      pos.y = camH;

      if (equipT > 0) equipT -= dt;
      if (reloading) {
        reloadT += dt;
        if (gun.reloadPerBullet) {
          // Marshal: one shell per 0.5 s, keeps partial progress, firing cancels
          ammo = Math.min(gun.mag, reloadAmmo0 + Math.floor(reloadT / gun.reloadPerBullet));
          $('reloadbar').firstElementChild.style.width = Math.min(100, ammo / gun.mag * 100) + '%';
          if (ammo >= gun.mag) { reloading = false; $('reloadbar').style.display = 'none'; }
        } else {
          $('reloadbar').firstElementChild.style.width = Math.min(100, reloadT / gun.reload * 100) + '%';
          if (reloadT >= gun.reload) { reloading = false; ammo = gun.mag; $('reloadbar').style.display = 'none'; }
        }
      }
      // burst machine: fast intra-burst pops, slow inter-burst cooldown
      if (burstCool > 0) burstCool -= dt;
      if (burstLeft > 0 && !reloading && equipT <= 0) {
        burstT -= dt;
        if (burstT <= 0) {
          firePull(now, true); burstLeft--;
          if (burstLeft > 0) burstT = burstTiming(gun.alt).intraGap;
          else burstCool = Math.max(0, burstTiming(gun.alt).interGap - (gun.alt.count - 1) * burstTiming(gun.alt).intraGap);
        }
      }
      // keep bursting while ADS trigger held (cooldown gates the next burst)
      if (adsHeld && gun.alt?.kind === 'adsburst' && mouseDown && burstLeft <= 0 && burstCool <= 0 && !reloading && equipT <= 0) startBurst();
      // hold-to-fire (auto): spool winds with trigger time, bloom recovers on its curve
      const firing = gun.mode === 'auto' && mouseDown && burstLeft <= 0 && !reloading && equipT <= 0
        && (ammo > 0 || gun.mag === Infinity);
      if (gun.mode === 'auto' && mouseDown && ammo <= 0 && gun.mag !== Infinity && settings.reload === 'auto' && !reloading && equipT <= 0) startReload();
      if (gun.spool && firing) spoolT += dt;
      if (firing && shotReady(now, lastShot, liveRps())) {
        if (adsHeld && gun.alt?.kind === 'adsburst') startBurst();
        else firePull(now, false);
      }
      if (gun.spool && now - lastShot > 500) spoolT = Math.max(0, spoolT - dt * 2);
      bloom = bloomDecay(bloom, gun.recovery, dt);

      T.idle(now, mode === 'gridshot' ? settings.orbMove : 'drift');
      tickCrosshair();
      if (mode === 'tracking' && trackBot && stalker) {
        const st = stalker.update(dt); // VALORANT-like strafe brain (accel/friction/deadzone)
        const p = trackBot.group.position;
        p.x = clamp(trackAnchor + st.x, -32, 32);
        p.y = -0.32 * st.crouchK; // crouch dip on hard
        trackBot.group.rotation.z = clamp(-st.vx * 0.06, -0.3, 0.3); // strafe lean
        trackBot.group.rotation.y = st.dir >= 0 ? 0.18 : -0.18; // face the strafe (player-like)
        let hitFrame = false;
        if (mouseDown && gun.mode === 'auto' && ammo > 0 && !reloading && equipT <= 0 && shotReady(now, lastShot, liveRps())) {
          lastShot = now; stats.raw.held += dt;
          if (gun.spool) spoolT += dt;
          if (gun.mag !== Infinity && settings.reload !== 'off') ammo--;
          audio.shot(gun.snd.freq, gun.snd.dur); stats.raw.shots++;
          FX.popMuzzle(false);
          _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
          raycaster.set(camera.position, _dir); raycaster.far = 150;
          const hits = raycaster.intersectObjects(T.meshes(), false);
          const oh = raycaster.intersectObjects(W.occluders, false);
          const oHit = oh.length ? oh[0] : null;
          const tHit = hits.length ? hits[0] : null;
          if (tHit && (!oHit || tHit.distance <= oHit.distance)) {
            stats.raw.onT += dt; stats.raw.hits++; stats.raw.damage += 1;
            trackBot.head.scale.setScalar(1.3);
            if (Math.random() < dt * 8) FX.spark(tHit.point, 0xf6d447);
          } else {
            trackBot.head.scale.setScalar(1);
            if (oHit && Math.random() < dt * 8) FX.spark(oHit.point, 0x7b8087);
          }
        } else if (trackBot.head && !mouseDown) trackBot.head.scale.setScalar(1);
        if (mouseDown && gun.mode === 'auto' && ammo <= 0 && gun.mag !== Infinity && !reloading && settings.reload === 'auto') startReload();
        secClock += dt; if (hitFrame) secOn += dt; // per-second consistency buckets
        if (secClock >= 1) { trackSecs.push(Math.min(1, secOn / secClock)); secClock = 0; secOn = 0; }
      }
      if (pendingSpawn > 0) { pendingSpawn -= dt; if (pendingSpawn <= 0 && mode === 'bots') spawnRangeBot(); }
      if (MODE_DEFS[mode].time !== null) { timeLeft -= dt; if (timeLeft <= 0) endGame(); }
      else { timeLeft -= dt; if (timeLeft <= -120) endGame(); }
    }
    recoil *= Math.pow(0.002, dt);
    fovKick *= Math.pow(0.002, dt);
    // viewmodel lag: weapon trails fast looks (smoothed, clamped)
    const yv = (yaw - lastYaw) / Math.max(dt, 1e-4), pv = (pitch - lastPitch) / Math.max(dt, 1e-4);
    lastYaw = yaw; lastPitch = pitch;
    lagY += (clamp(-yv * 0.00035, -0.05, 0.05) - lagY) * Math.min(1, dt * 9);
    lagX += (clamp(pv * 0.00035, -0.04, 0.04) - lagX) * Math.min(1, dt * 9);
    const wantFov = fovFor(adsZoom) + fovKick;
    if (Math.abs(camera.fov - wantFov) > 0.02) { camera.fov = wantFov; camera.updateProjectionMatrix(); }
    FX.recover(dt, elapsed, Math.min(vel.length() / 5.4, 1), recoil, lagY, lagX);
    W.tick(dt); // kill-flash decay (single opacity write)
    camera.position.copy(pos);
    camera.quaternion.setFromEuler(_E.set(pitch + recoil, yaw, 0));
    FX.update(dt, state === PLAYING);
    renderer.render(scene, camera);
  }

  // ---------- boot ----------
  adsZoom = 1;
  const bt = $('buildtag'); if (bt) bt.textContent = 'BUILD ' + BUILD;
  applySize(); initUI(); applyCrosshair(); renderLoadout(); renderMenuStats();
  initLoadout(); applySlot(true);
  function warmupAll() { // compile every shader behind the menu: first game never hitches
    FX.warmup(renderer, camera);
    const o = T.spawnOrb(new THREE.Vector3(0, -100, 0), 100);
    const b = T.spawnBot(new THREE.Vector3(2, -100, 0), 150);
    T.setHpBar(b);
    renderer.render(scene, camera);
    T.remove(o); T.remove(b);
  }
  function switchTheme(id) { // menu-only rebuild: new skin, same gameplay contract
    settings.theme = id; saveSettings();
    disposeWorld(scene, W);
    W = buildWorld(scene, camera, id);
    warmupAll();
  }
  warmupAll(); // boot-time compile, behind the menu
  try { // font prewarm: giant countdown text must never FOUT-flash mid-game
    if (document.fonts && document.fonts.load) { document.fonts.load('90px Anton'); document.fonts.load('700 40px Barlow'); }
  } catch (e) {}
  addEventListener('pointerdown', () => audio.unlock(), { once: true }); // menu click unlocks audio early
  requestAnimationFrame(loop);
  window.VLT = { start: startGame, gun: () => gun.id, setGun: id => buyGun(id), slot: n => switchSlot(n), state: () => state, stats: () => stats.raw, end: endGame };
}
