/* LYSBRUD — effektlag.
   Partikler (skår, gnister, krystaller, glimt, striber), energikæder,
   stråleudbrud, chokringe, lysende skinner, stråler til reaktoren, flyvende
   tal, rystelser, scenelys og bloom.
   Alt genbruges fra forudallokerede puljer; ingen allokering i den varme løkke. */

import { withAlpha } from './wheel.js';
import { SYMBOL_BY_ID, PALETTE } from './config.js';
import { drawGlint } from './art/badges.js';

const TAU = Math.PI * 2;
const MAX_PARTICLES = 1400;
const MAX_CHAINS = 40;
const MAX_LABELS = 24;
const MAX_BURSTS = 4;
const MAX_RINGS = 16;
const MAX_BEAMS = 4;

/* Partikeltyper */
const P_SHARD = 0, P_SPARK = 1, P_RING = 2, P_CRYSTAL = 3, P_GLINT = 4, P_STREAK = 5;

function makeParticle() {
  return {
    on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1,
    size: 4, rot: 0, vrot: 0, grav: 0, drag: 0.99, r: 255, g: 255, b: 255, sides: 4,
    grow: 0, seed: 0,
  };
}

function rgbOf(hex) {
  if (!hex || hex[0] !== '#') return [255, 255, 255];
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Krystalsilhuetter — aflange, spidse, som de store skår i mockuppen. */
const CRYSTAL_SHAPES = [
  [[0, -1], [0.34, -0.42], [0.30, 0.55], [0, 1], [-0.30, 0.55], [-0.34, -0.42]],
  [[0, -1], [0.42, -0.30], [0.26, 0.70], [-0.10, 1], [-0.40, 0.40], [-0.28, -0.55]],
  [[0.1, -1], [0.5, -0.1], [0.2, 0.9], [-0.35, 0.6], [-0.45, -0.3]],
  [[0, -1], [0.22, -0.6], [0.22, 0.6], [0, 1], [-0.22, 0.6], [-0.22, -0.6]],
];

export function createFx() {
  const pool = Array.from({ length: MAX_PARTICLES }, makeParticle);
  let cursor = 0;

  const chains = Array.from({ length: MAX_CHAINS }, () => ({ on: false, segs: null, t: 0, dur: 1, color: '#fff', width: 3, hold: 0 }));
  const labels = Array.from({ length: MAX_LABELS }, () => ({ on: false, x: 0, y: 0, text: '', color: '#fff', t: 0, dur: 1, size: 22 }));
  const bursts = Array.from({ length: MAX_BURSTS }, () => ({ on: false, x: 0, y: 0, t: 0, dur: 1, strength: 0, tint: '#fff', reach: 0, rays: [], spin: 1, hold: false }));
  const rings = Array.from({ length: MAX_RINGS }, () => ({ on: false, x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 1, color: '#fff', width: 3 }));
  const beams = Array.from({ length: MAX_BEAMS }, () => ({ on: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, dur: 1, color: '#fff' }));

  let shakeAmp = 0, shakeT = 0;
  const shakeVec = { x: 0, y: 0 };
  let calm = false;

  /* Scenelys: 0 = hvile, 1 = hele hulen oversvømmet af lys. */
  let light = 0, lightHold = 0;
  let flash = 0, flashTint = '#fff6d4';

  /* Skinneglød: lys der løber rundt om hjulets guldskinner. */
  const rail = { radii: [], cx: 0, cy: 0, R: 0, strength: 0, target: 0, hold: 0, tint: PALETTE.gold3, t: 0 };

  /* Anticipation: svage, flakkende stråler fra kernen mens sidste ring lander. */
  let anticipation = false;
  let anticipationT = 0;

  /* Bloom kører i lav opløsning. Et fuldskærms-blur i canvas koster over
     halvdelen af billedraten på en maskine uden GPU-acceleration; ved at
     sløre 0,36× og først derefter skalere op bliver det ~8× billigere og
     ser reelt blødere ud. */
  const GLOW_SCALE = 0.36;
  let glow = null, gctx = null, blurBuf = null, bctx = null;
  let gw = 0, gh = 0, cssW = 0, cssH = 0, dpr = 1;
  let blurOk = true;

  function resize(w, h, ratio) {
    cssW = w; cssH = h; dpr = ratio;
    gw = Math.max(2, Math.round(w * GLOW_SCALE));
    gh = Math.max(2, Math.round(h * GLOW_SCALE));
    if (!glow) glow = document.createElement('canvas');
    if (!blurBuf) blurBuf = document.createElement('canvas');
    glow.width = gw; glow.height = gh;
    blurBuf.width = gw; blurBuf.height = gh;
    gctx = glow.getContext('2d');
    bctx = blurBuf.getContext('2d');
    blurOk = typeof gctx.filter === 'string';
  }

  /** Hjulets geometri — skinneglød og anticipation skal kende radierne. */
  function setLayout(L) {
    rail.cx = L.cx; rail.cy = L.cy; rail.R = L.R;
    rail.radii = L.ringIn.concat([L.ringOut[L.ringOut.length - 1], L.rim]);
  }

  function setCalm(v) { calm = !!v; }

  function alloc() {
    for (let k = 0; k < MAX_PARTICLES; k++) {
      const p = pool[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      if (!p.on) return p;
    }
    return pool[cursor];
  }

  /* ------------------------------------------------------------ emittere */

  /** Symbolet splintres: skarpe skår + gnister + et kort chokring. */
  function emitShatter(x, y, id, size, power = 1) {
    const def = SYMBOL_BY_ID[id];
    const [r, g, b] = rgbOf(def ? def.base : '#ffffff');
    const [er, eg, eb] = rgbOf(def ? def.edge : '#ffffff');
    const n = calm ? 7 : Math.round(16 * power);
    for (let k = 0; k < n; k++) {
      const p = alloc();
      const a = (k / n) * TAU + Math.random() * 0.7;
      const sp = (0.9 + Math.random() * 2.4) * size * 0.055 * power;
      p.on = true; p.kind = P_SHARD;
      p.x = x + Math.cos(a) * size * 0.16;
      p.y = y + Math.sin(a) * size * 0.16;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - size * 0.012;
      p.max = 520 + Math.random() * 420; p.life = p.max;
      p.size = size * (0.11 + Math.random() * 0.17);
      p.rot = Math.random() * TAU; p.vrot = (Math.random() - 0.5) * 0.02;
      p.grav = 0.00042 * size; p.drag = 0.982;
      p.sides = 3 + (k % 3);
      const lite = Math.random() < 0.35;
      p.r = lite ? er : r; p.g = lite ? eg : g; p.b = lite ? eb : b;
    }
    const sparks = calm ? 3 : Math.round(9 * power);
    for (let k = 0; k < sparks; k++) {
      const p = alloc();
      const a = Math.random() * TAU;
      const sp = (1.6 + Math.random() * 3.2) * size * 0.05;
      p.on = true; p.kind = P_SPARK;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.max = 260 + Math.random() * 240; p.life = p.max;
      p.size = size * 0.06; p.grav = 0.0002 * size; p.drag = 0.94;
      p.r = er; p.g = eg; p.b = eb;
    }
    const ring = alloc();
    ring.on = true; ring.kind = P_RING;
    ring.x = x; ring.y = y; ring.vx = 0; ring.vy = 0;
    ring.max = 340; ring.life = ring.max; ring.size = size * 0.34;
    ring.r = er; ring.g = eg; ring.b = eb;
    // Ét glimt på hvert splintret symbol — dét der får splintringen til at "knitre".
    emitGlints(x, y, calm ? 1 : 2, size * 0.9, def ? def.edge : '#ffffff', size * 0.3);
  }

  /** Generisk farvet udbrud (reaktor, prisme, bonus). */
  function emitBurst(x, y, color, count = 24, power = 1) {
    const [r, g, b] = rgbOf(color);
    const n = calm ? Math.round(count * 0.4) : count;
    for (let k = 0; k < n; k++) {
      const p = alloc();
      const a = Math.random() * TAU;
      const sp = (0.6 + Math.random() * 2.6) * power;
      p.on = true; p.kind = P_SPARK;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.max = 420 + Math.random() * 520; p.life = p.max;
      p.size = 1.6 + Math.random() * 2.6; p.grav = 0.00012; p.drag = 0.975;
      p.r = r; p.g = g; p.b = b;
    }
  }

  /** Krystalregn ned over hele scenen — bruges ved store gevinster. */
  function emitRain(w, h, color, count = 60) {
    if (calm) count = Math.round(count * 0.35);
    const [r, g, b] = rgbOf(color);
    for (let k = 0; k < count; k++) {
      const p = alloc();
      p.on = true; p.kind = P_SHARD;
      p.x = Math.random() * w; p.y = -20 - Math.random() * h * 0.5;
      p.vx = (Math.random() - 0.5) * 0.12; p.vy = 0.12 + Math.random() * 0.22;
      p.max = 2600 + Math.random() * 1800; p.life = p.max;
      p.size = 5 + Math.random() * 12;
      p.rot = Math.random() * TAU; p.vrot = (Math.random() - 0.5) * 0.004;
      p.grav = 0.00006; p.drag = 1; p.sides = 4;
      p.r = r; p.g = g; p.b = b;
    }
  }

  /** Store krystalsplinter der flyver ud fra (x,y) og VOKSER — mod kameraet. */
  function emitCrystals(x, y, count, power = 1, tint = null) {
    const n = calm ? Math.round(count * 0.3) : count;
    const tints = tint ? [tint] : ['#dfe9ff', '#9cc3ff', '#b673ff', '#ffe2b0', '#59e0ff', '#ffffff'];
    for (let k = 0; k < n; k++) {
      const p = alloc();
      const a = Math.random() * TAU;
      const sp = (0.8 + Math.random() * 2.2) * (2.2 + power * 1.6);
      const [r, g, b] = rgbOf(tints[k % tints.length]);
      p.on = true; p.kind = P_CRYSTAL;
      p.x = x + Math.cos(a) * 30; p.y = y + Math.sin(a) * 30;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.85 - 0.6;
      p.max = 1500 + Math.random() * 1400; p.life = p.max;
      p.size = 10 + Math.random() * 22 * (0.6 + power * 0.5);
      p.rot = Math.random() * TAU; p.vrot = (Math.random() - 0.5) * 0.006;
      p.grav = 0.00035; p.drag = 0.992;
      p.grow = 0.8 + Math.random() * 2.4;          // hvor meget den vokser mod kameraet
      p.seed = k % CRYSTAL_SHAPES.length;
      p.r = r; p.g = g; p.b = b;
    }
  }

  /** Firetakkede glimt — popper op og dør hurtigt. */
  function emitGlints(x, y, count, size, color = '#ffffff', spread = 0) {
    const [r, g, b] = rgbOf(color);
    const n = calm ? Math.max(1, Math.round(count * 0.5)) : count;
    for (let k = 0; k < n; k++) {
      const p = alloc();
      const a = Math.random() * TAU, d = Math.random() * spread;
      p.on = true; p.kind = P_GLINT;
      p.x = x + Math.cos(a) * d; p.y = y + Math.sin(a) * d;
      p.vx = 0; p.vy = 0;
      p.max = 320 + Math.random() * 420; p.life = p.max;
      p.size = size * (0.5 + Math.random() * 0.7);
      p.rot = (Math.random() - 0.5) * 0.5; p.vrot = 0;
      p.grav = 0; p.drag = 1;
      p.r = r; p.g = g; p.b = b;
    }
  }

  /** Lysstriber: lange, hurtige linjer der skyder ud fra (x,y). */
  function emitStreaks(x, y, count, power = 1, color = PALETTE.gold3) {
    const [r, g, b] = rgbOf(color);
    const n = calm ? Math.round(count * 0.3) : count;
    for (let k = 0; k < n; k++) {
      const p = alloc();
      const a = Math.random() * TAU;
      const sp = (6 + Math.random() * 10) * (0.7 + power * 0.5);
      p.on = true; p.kind = P_STREAK;
      p.x = x + Math.cos(a) * 40; p.y = y + Math.sin(a) * 40;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.max = 360 + Math.random() * 380; p.life = p.max;
      p.size = 1.2 + Math.random() * 1.8; p.grav = 0; p.drag = 0.985;
      p.r = r; p.g = g; p.b = b;
    }
  }

  /* --------------------------------------------------------- lysbrud */

  /** Selve lysbruddet: stråler ud fra (x,y), chokringe og et lysglimt over scenen. */
  function burst(x, y, strength = 1, tint = PALETTE.gold3, dur = 1500) {
    let b = bursts.find(q => !q.on);
    if (!b) b = bursts[0];
    b.on = true; b.hold = false;
    b.x = x; b.y = y; b.t = 0; b.dur = dur;
    b.strength = strength; b.tint = tint;
    b.reach = Math.max(cssW, cssH) * (0.45 + 0.35 * Math.min(1.2, strength));
    b.spin = Math.random() < 0.5 ? 1 : -1;
    const n = calm ? 12 : 30;
    b.rays.length = 0;
    for (let k = 0; k < n; k++) {
      b.rays.push({
        angle: (k / n) * TAU + (Math.random() - 0.5) * 0.18,
        len: 0.55 + Math.random() * 0.85,
        width: 0.010 + Math.random() * 0.030,
        phase: Math.random() * TAU,
      });
    }
    if (!calm) {
      addRing(x, y, 20, b.reach * 0.75, 900, tint, 6 + strength * 4);
      addRing(x, y, 20, b.reach * 0.55, 700, '#ffffff', 2.5);
      addRing(x, y, 10, b.reach * 0.95, 1200, tint, 3);
    }
    // Glimtet skal varme guldet op, ikke blæse scenen hvid.
    flash = Math.max(flash, Math.min(0.55, 0.14 + strength * 0.24));
    flashTint = tint;
    flashLight(Math.min(1, strength * 0.9), 900 + strength * 600);
  }

  /** Chokring: en ring der vokser fra r0 til r1 og toner ud. */
  function addRing(x, y, r0, r1, dur, color, width = 3) {
    let q = rings.find(r => !r.on);
    if (!q) q = rings[0];
    q.on = true; q.x = x; q.y = y; q.r0 = r0; q.r1 = r1; q.t = 0; q.dur = dur; q.color = color; q.width = width;
  }

  /** Stråle fra (x0,y0) til (x1,y1) med et lysende hoved der løber langs den. */
  function beam(x0, y0, x1, y1, color = PALETTE.teal, dur = 520) {
    let q = beams.find(b => !b.on);
    if (!q) q = beams[0];
    q.on = true; q.x0 = x0; q.y0 = y0; q.x1 = x1; q.y1 = y1; q.t = 0; q.dur = dur; q.color = color;
  }

  /** Skinnerne lyser op og lyset løber rundt om dem. */
  function railGlow(strength, tint = PALETTE.gold3, holdMs = 1200) {
    rail.target = Math.max(rail.target, Math.min(1.3, strength));
    rail.tint = tint; rail.hold = Math.max(rail.hold, holdMs);
  }

  /** Scenelys — hulen lyser op fra hjulet og udefter. */
  function flashLight(strength, holdMs = 600) {
    light = Math.max(light, Math.min(1, strength));
    lightHold = Math.max(lightHold, holdMs);
  }

  function setAnticipation(on) { anticipation = !!on; }

  /* --------------------------------------------------------- energikæder */

  /** segs: [{kind:'arc', cx, cy, rad, a0, a1} | {kind:'line', x0,y0,x1,y1}] */
  function addChain(segs, color, dur = 520, width = 3, hold = 900) {
    for (const c of chains) {
      if (!c.on) {
        c.on = true; c.segs = segs; c.t = 0; c.dur = dur; c.color = color; c.width = width; c.hold = hold;
        return c;
      }
    }
    return null;
  }

  function addLabel(x, y, text, color, size = 22, dur = 1200) {
    for (const l of labels) {
      if (!l.on) {
        l.on = true; l.x = x; l.y = y; l.text = text; l.color = color; l.t = 0; l.dur = dur; l.size = size;
        return l;
      }
    }
    return null;
  }

  function shake(power) {
    if (calm) return;
    shakeAmp = Math.min(30, shakeAmp + power);
  }

  function clear() {
    for (const p of pool) p.on = false;
    for (const c of chains) c.on = false;
    for (const l of labels) l.on = false;
    for (const b of bursts) b.on = false;
    for (const r of rings) r.on = false;
    for (const b of beams) b.on = false;
    shakeAmp = 0; shakeVec.x = 0; shakeVec.y = 0;
    flash = 0; light = 0; lightHold = 0;
    rail.target = 0; rail.strength = 0; rail.hold = 0;
    anticipation = false;
  }

  /* ------------------------------------------------------------ opdatering */

  function update(dt) {
    const d = Math.min(dt, 48);
    for (const p of pool) {
      if (!p.on) continue;
      p.life -= d;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.grav * d;
      p.vx *= Math.pow(p.drag, d / 16.67);
      p.vy *= Math.pow(p.drag, d / 16.67);
      p.x += p.vx * d * 0.06;
      p.y += p.vy * d * 0.06;
      p.rot += p.vrot * d;
    }
    for (const c of chains) {
      if (!c.on) continue;
      c.t += d;
      if (c.t > c.dur + c.hold) c.on = false;
    }
    for (const l of labels) {
      if (!l.on) continue;
      l.t += d;
      if (l.t > l.dur) l.on = false;
    }
    for (const b of bursts) {
      if (!b.on) continue;
      b.t += d;
      if (!b.hold && b.t > b.dur) b.on = false;
    }
    for (const r of rings) {
      if (!r.on) continue;
      r.t += d;
      if (r.t > r.dur) r.on = false;
    }
    for (const b of beams) {
      if (!b.on) continue;
      b.t += d;
      if (b.t > b.dur) b.on = false;
    }
    if (shakeAmp > 0.05) {
      shakeT += d;
      shakeAmp *= Math.pow(0.86, d / 16.67);
      shakeVec.x = Math.sin(shakeT * 0.09) * shakeAmp;
      shakeVec.y = Math.cos(shakeT * 0.121) * shakeAmp * 0.7;
    } else {
      shakeAmp = 0; shakeVec.x = 0; shakeVec.y = 0;
    }
    // Lysglimt dør hurtigt, scenelys holder og toner så langsomt ud.
    flash *= Math.pow(0.5, d / 90);
    if (flash < 0.004) flash = 0;
    if (lightHold > 0) lightHold -= d;
    else light *= Math.pow(0.5, d / 420);
    if (light < 0.004) light = 0;
    // Skinneglød: hurtigt op, blødt ned.
    rail.t += d;
    if (rail.hold > 0) rail.hold -= d; else rail.target = 0;
    rail.strength += (rail.target - rail.strength) * (rail.target > rail.strength ? 1 - Math.pow(0.5, d / 70) : 1 - Math.pow(0.5, d / 380));
    if (rail.strength < 0.003 && rail.target === 0) rail.strength = 0;
    anticipationT += d;
  }

  /* -------------------------------------------------------------- tegning */

  function drawParticles(g, glowPass = false) {
    g.save();
    for (const p of pool) {
      if (!p.on) continue;
      const k = p.life / p.max;
      const a = k > 0.75 ? (1 - k) / 0.25 : k / 0.75;
      const alpha = Math.max(0, Math.min(1, a));

      if (p.kind === P_CRYSTAL) {
        if (glowPass) continue;   // krystallerne er ikke lys; de skal ikke bloome
        // Store, gennemsigtige krystaller — normal blanding, så de skjuler det bag sig.
        const age = 1 - k;
        const sc = p.size * (1 + age * p.grow);
        const shape = CRYSTAL_SHAPES[p.seed];
        g.save();
        g.globalCompositeOperation = 'source-over';
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath();
        for (let i = 0; i < shape.length; i++) {
          const v = shape[i];
          if (i === 0) g.moveTo(v[0] * sc, v[1] * sc); else g.lineTo(v[0] * sc, v[1] * sc);
        }
        g.closePath();
        // Flad krop — en gradient pr. krystal pr. frame kostede for meget.
        g.fillStyle = `rgba(${p.r},${p.g},${p.b},${0.34 * alpha})`; g.fill();
        // øverste facet lysere, så den stadig læses som slebet
        g.beginPath();
        g.moveTo(shape[0][0] * sc, shape[0][1] * sc);
        g.lineTo(shape[1][0] * sc, shape[1][1] * sc);
        g.lineTo(0, 0);
        g.closePath();
        g.fillStyle = `rgba(255,255,255,${0.30 * alpha})`; g.fill();
        g.beginPath();
        for (let i = 0; i < shape.length; i++) {
          const v = shape[i];
          if (i === 0) g.moveTo(v[0] * sc, v[1] * sc); else g.lineTo(v[0] * sc, v[1] * sc);
        }
        g.closePath();
        g.strokeStyle = `rgba(255,255,255,${0.85 * alpha})`;
        g.lineWidth = Math.max(1, sc * 0.05); g.lineJoin = 'round';
        g.stroke();
        // en indre facetlinje giver den dybde
        g.beginPath();
        g.moveTo(shape[0][0] * sc, shape[0][1] * sc);
        g.lineTo(shape[Math.floor(shape.length / 2)][0] * sc * 0.55, shape[Math.floor(shape.length / 2)][1] * sc * 0.55);
        g.strokeStyle = `rgba(255,255,255,${0.45 * alpha})`;
        g.lineWidth = Math.max(0.8, sc * 0.03);
        g.stroke();
        // additivt kantlys
        g.globalCompositeOperation = 'lighter';
        g.beginPath();
        g.moveTo(shape[shape.length - 1][0] * sc, shape[shape.length - 1][1] * sc);
        g.lineTo(shape[0][0] * sc, shape[0][1] * sc);
        g.lineTo(shape[1][0] * sc, shape[1][1] * sc);
        g.strokeStyle = `rgba(${p.r},${p.g},${p.b},${0.9 * alpha})`;
        g.lineWidth = Math.max(1.2, sc * 0.07);
        g.stroke();
        g.restore();
        continue;
      }

      g.globalCompositeOperation = 'lighter';
      if (p.kind === P_SHARD) {
        g.save();
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath();
        for (let s = 0; s < p.sides; s++) {
          const ang = (s / p.sides) * TAU;
          const rr = p.size * (s % 2 ? 0.55 : 1);
          const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
          if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.9})`;
        g.fill();
        g.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
        g.lineWidth = 0.8; g.stroke();
        g.restore();
      } else if (p.kind === P_SPARK) {
        const spd = Math.hypot(p.vx, p.vy);
        const len = spd * 3.4;
        const nx = spd > 0.01 ? p.vx / spd : 0;
        const ny = spd > 0.01 ? p.vy / spd : 0;
        g.beginPath();
        g.moveTo(p.x - nx * len, p.y - ny * len);
        g.lineTo(p.x, p.y);
        g.strokeStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        g.lineWidth = p.size * 0.9;
        g.lineCap = 'round';
        g.stroke();
      } else if (p.kind === P_STREAK) {
        const spd = Math.hypot(p.vx, p.vy);
        const len = Math.min(260, spd * 14);
        const nx = spd > 0.01 ? p.vx / spd : 0;
        const ny = spd > 0.01 ? p.vy / spd : 0;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x - nx * len, p.y - ny * len);
        g.lineTo(p.x, p.y);
        g.strokeStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.35})`;
        g.lineWidth = p.size * 3.2;
        g.stroke();
        g.beginPath();
        g.moveTo(p.x - nx * len * 0.7, p.y - ny * len * 0.7);
        g.lineTo(p.x, p.y);
        g.strokeStyle = `rgba(255,255,255,${alpha * 0.85})`;
        g.lineWidth = p.size;
        g.stroke();
      } else if (p.kind === P_GLINT) {
        const age = 1 - k;
        const pop = age < 0.18 ? age / 0.18 : 1 - (age - 0.18) / 0.82;
        drawGlint(g, p.x, p.y, p.size * (0.3 + 0.7 * pop), Math.max(0, pop), p.rot, `rgb(${p.r},${p.g},${p.b})`);
      } else {
        const rr = p.size * (1 + (1 - k) * 2.6);
        g.beginPath(); g.arc(p.x, p.y, rr, 0, TAU);
        g.strokeStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.6})`;
        g.lineWidth = 2.2 * alpha; g.stroke();
      }
    }
    g.restore();
  }

  function traceSeg(g, s, k) {
    if (s.kind === 'arc') {
      const a0 = s.a0 - Math.PI / 2;
      const a1 = s.a0 + (s.a1 - s.a0) * k - Math.PI / 2;
      // moveTo først: uden den trækker canvas en linje fra forrige delsti hertil.
      g.moveTo(s.cx + s.rad * Math.cos(a0), s.cy + s.rad * Math.sin(a0));
      g.arc(s.cx, s.cy, s.rad, a0, a1, s.a1 < s.a0);
    } else {
      g.moveTo(s.x0, s.y0);
      g.lineTo(s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k);
    }
  }

  /** Punkt på et segment ved fremdrift k — bruges til knuder og pulser. */
  function segPoint(s, k) {
    if (s.kind === 'arc') {
      const a = s.a0 + (s.a1 - s.a0) * k - Math.PI / 2;
      return [s.cx + s.rad * Math.cos(a), s.cy + s.rad * Math.sin(a)];
    }
    return [s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k];
  }

  /** Energikæden tegnes i lag, så den læses som lys og ikke som en streg:
   *  bredt farvet skær → farvet krop → hvid kerne → lysende knuder → løbende puls. */
  function drawChains(g) {
    for (const c of chains) {
      if (!c.on || !c.segs || !c.segs.length) continue;
      const grow = Math.min(1, c.t / c.dur);
      const fade = c.t > c.dur ? Math.max(0, 1 - (c.t - c.dur) / c.hold) : 1;
      const total = c.segs.length;
      const shown = grow * total;

      g.save();
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      g.lineJoin = 'round';

      const layers = [
        [c.width * 7.0, withAlpha(c.color, 0.22 * fade)],
        [c.width * 3.2, withAlpha(c.color, 0.55 * fade)],
        [c.width * 1.0, `rgba(255,255,255,${0.95 * fade})`],
      ];
      for (const [width, style] of layers) {
        g.beginPath();
        for (let i = 0; i < total; i++) {
          const k = Math.min(1, shown - i);
          if (k <= 0) break;
          traceSeg(g, c.segs[i], k);
        }
        g.lineWidth = width;
        g.strokeStyle = style;
        g.stroke();
      }

      for (let i = 0; i < total; i++) {
        const k = Math.min(1, shown - i);
        if (k <= 0) break;
        const [x, y] = segPoint(c.segs[i], k);
        const rr = c.width * 2.1;
        const dot = g.createRadialGradient(x, y, 0, x, y, rr * 2.4);
        dot.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
        dot.addColorStop(0.35, withAlpha(c.color, 0.65 * fade));
        dot.addColorStop(1, withAlpha(c.color, 0));
        g.beginPath();
        g.arc(x, y, rr * 2.4, 0, TAU);
        g.fillStyle = dot;
        g.fill();
      }

      // En lyspuls der løber gennem kæden, så energien ses bevæge sig.
      if (grow >= 1 && total > 0) {
        const pos = ((c.t - c.dur) / 260) % total;
        const idx = Math.floor(pos), frac = pos - idx;
        const [px, py] = segPoint(c.segs[idx], frac);
        const pr = c.width * 3.4;
        const pulse = g.createRadialGradient(px, py, 0, px, py, pr);
        pulse.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
        pulse.addColorStop(0.5, withAlpha(c.color, 0.5 * fade));
        pulse.addColorStop(1, withAlpha(c.color, 0));
        g.beginPath(); g.arc(px, py, pr, 0, TAU);
        g.fillStyle = pulse; g.fill();
      }
      g.restore();
    }
  }

  function drawLabels(g) {
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of labels) {
      if (!l.on) continue;
      const k = l.t / l.dur;
      const rise = -k * l.size * 2.1;
      const alpha = k < 0.14 ? k / 0.14 : (k > 0.7 ? (1 - k) / 0.3 : 1);
      const pop = k < 0.14 ? 0.6 + 0.4 * (k / 0.14) : 1;
      g.save();
      g.translate(l.x, l.y + rise);
      g.scale(pop, pop);
      g.font = `800 ${l.size}px "Inter Tight", Inter, system-ui, sans-serif`;
      g.lineWidth = Math.max(3, l.size * 0.19);
      g.strokeStyle = `rgba(3,2,12,${0.85 * alpha})`;
      g.strokeText(l.text, 0, 0);
      g.fillStyle = withAlpha(l.color, alpha);
      g.fillText(l.text, 0, 0);
      g.restore();
    }
    g.restore();
  }

  /** Stråler ud fra et punkt. Én gradient pr. kald; hver stråle er en
   *  enhedstrekant der skaleres — det holder 30 stråler billige. */
  function drawRays(g, x, y, rays, reach, strength, tint, rot, flickerT, lenK) {
    g.save();
    g.translate(x, y);
    g.globalCompositeOperation = 'lighter';
    const grad = g.createLinearGradient(0, 0, 0, -1);
    grad.addColorStop(0.00, `rgba(255,255,255,${Math.min(1, 0.75 * strength)})`);
    grad.addColorStop(0.10, withAlpha(tint, Math.min(1, 0.70 * strength)));
    grad.addColorStop(0.45, withAlpha(tint, Math.min(1, 0.30 * strength)));
    grad.addColorStop(1.00, withAlpha(tint, 0));
    g.fillStyle = grad;
    for (const r of rays) {
      const flick = 0.8 + 0.2 * Math.sin(flickerT * 0.011 + r.phase);
      const len = reach * r.len * lenK * flick;
      const w = reach * r.width * (0.7 + 0.3 * flick);
      g.save();
      g.rotate(r.angle + rot);
      g.scale(1, len);            // kun y skaleres: bredden angives i pixels, længden i enheder
      g.beginPath();
      g.moveTo(-w, 0); g.lineTo(0, -1); g.lineTo(w, 0);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.restore();
  }

  function drawBursts(g) {
    for (const b of bursts) {
      if (!b.on) continue;
      const k = Math.min(1, b.t / b.dur);
      const ease = 1 - Math.pow(1 - k, 2.2);
      const fade = k < 0.08 ? k / 0.08 : k < 0.38 ? 1 : Math.pow(1 - (k - 0.38) / 0.62, 1.4);
      const rot = b.t * 0.00016 * b.spin;
      drawRays(g, b.x, b.y, b.rays, b.reach, b.strength * fade, b.tint, rot, b.t, 0.35 + 0.65 * ease);
      // Kernen: en hvid skive der blænder helt i starten.
      g.save();
      g.globalCompositeOperation = 'lighter';
      const cr = b.reach * 0.12 * (0.5 + fade);
      const core = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, cr);
      core.addColorStop(0, `rgba(255,255,255,${0.95 * fade * Math.min(1, b.strength)})`);
      core.addColorStop(0.5, withAlpha(b.tint, 0.45 * fade));
      core.addColorStop(1, withAlpha(b.tint, 0));
      g.beginPath(); g.arc(b.x, b.y, cr, 0, TAU);
      g.fillStyle = core; g.fill();
      g.restore();
    }
    if (anticipation && rail.R > 0) {
      // Tydelige, langsomt roterende stråler + en pulserende ring om kernen.
      const s = 0.9 + 0.3 * Math.sin(anticipationT * 0.007);
      drawRays(g, rail.cx, rail.cy, ANTICIPATION_RAYS, rail.R * 1.15, s, '#c9d8ff', anticipationT * 0.00035, anticipationT, 1);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const pr = rail.R * (0.26 + 0.05 * Math.sin(anticipationT * 0.009));
      g.beginPath(); g.arc(rail.cx, rail.cy, pr, 0, TAU);
      g.strokeStyle = `rgba(201,216,255,${0.35 + 0.25 * Math.sin(anticipationT * 0.009)})`;
      g.lineWidth = 6; g.stroke();
      g.restore();
    }
  }

  function drawRings(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const r of rings) {
      if (!r.on) continue;
      const k = r.t / r.dur;
      const ease = 1 - Math.pow(1 - k, 2.6);
      const rad = r.r0 + (r.r1 - r.r0) * ease;
      const alpha = Math.pow(1 - k, 0.9);
      g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU);
      g.strokeStyle = withAlpha(r.color, 0.4 * alpha);
      g.lineWidth = r.width * 3.6; g.stroke();
      g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU);
      g.strokeStyle = `rgba(255,255,255,${0.9 * alpha})`;
      g.lineWidth = r.width * 1.3; g.stroke();
    }
    g.restore();
  }

  function drawBeams(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const b of beams) {
      if (!b.on) continue;
      const k = b.t / b.dur;
      const head = Math.min(1, k * 1.35);
      const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const hx = b.x0 + (b.x1 - b.x0) * head, hy = b.y0 + (b.y1 - b.y0) * head;
      g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(hx, hy);
      g.strokeStyle = withAlpha(b.color, 0.35 * fade); g.lineWidth = 12; g.stroke();
      g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(hx, hy);
      g.strokeStyle = `rgba(255,255,255,${0.8 * fade})`; g.lineWidth = 2.6; g.stroke();
      const hr = 18;
      const hg = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hg.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
      hg.addColorStop(0.4, withAlpha(b.color, 0.6 * fade));
      hg.addColorStop(1, withAlpha(b.color, 0));
      g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.fillStyle = hg; g.fill();
    }
    g.restore();
  }

  /** Skinnerne lyser, og et lysende stykke løber rundt om hver skinne. */
  function drawRailGlow(g) {
    if (rail.strength <= 0.003 || !rail.radii.length) return;
    const s = rail.strength;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 0; i < rail.radii.length; i++) {
      const rad = rail.radii[i];
      g.beginPath(); g.arc(rail.cx, rail.cy, rad, 0, TAU);
      g.strokeStyle = withAlpha(rail.tint, 0.16 * s);
      g.lineWidth = 14; g.stroke();
      g.beginPath(); g.arc(rail.cx, rail.cy, rad, 0, TAU);
      g.strokeStyle = `rgba(255,255,255,${0.30 * s})`;
      g.lineWidth = 3; g.stroke();
      // det løbende lys — skiftende retning pr. skinne, hurtigere yderst
      const dir = i % 2 ? -1 : 1;
      const a = dir * rail.t * (0.0016 + i * 0.00035) + i * 1.3;
      const span = 0.55;
      g.beginPath(); g.arc(rail.cx, rail.cy, rad, a - span, a + span);
      g.strokeStyle = withAlpha(rail.tint, 0.55 * s);
      g.lineWidth = 9; g.stroke();
      g.beginPath(); g.arc(rail.cx, rail.cy, rad, a - span * 0.5, a + span * 0.5);
      g.strokeStyle = `rgba(255,255,255,${0.95 * s})`;
      g.lineWidth = 3.5; g.stroke();
    }
    g.restore();
  }

  function drawFlash(g) {
    if (flash <= 0) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 1.6;   // kompenserer for at bloom-passet komposites med 0,55
    const grad = g.createRadialGradient(rail.cx || cssW / 2, rail.cy || cssH / 2, 0, rail.cx || cssW / 2, rail.cy || cssH / 2, Math.max(cssW, cssH) * 0.75);
    grad.addColorStop(0, withAlpha(flashTint, flash));
    grad.addColorStop(0.35, withAlpha(flashTint, flash * 0.45));
    grad.addColorStop(0.7, withAlpha(flashTint, flash * 0.10));
    grad.addColorStop(1, withAlpha(flashTint, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, cssW, cssH);
    g.restore();
  }

  /** Alt der ligger over hjulet. Rækkefølgen er lag-rækkefølgen.
   *  glowPass = true tegner kun det der skal bloome; lysglimtet tegnes KUN dér,
   *  fordi et fuldskærms-fyld i 0,36× opløsning er ~8× billigere og alligevel
   *  skal være blødt. */
  function draw(g, glowPass = false) {
    if (layers.rails) drawRailGlow(g);
    if (layers.bursts) drawBursts(g);
    if (layers.rings) drawRings(g);
    if (layers.chains) drawChains(g);
    if (layers.beams) drawBeams(g);
    if (layers.particles) drawParticles(g, glowPass);
    if (!glowPass) drawLabels(g);
    if (glowPass && layers.flash) drawFlash(g);
  }

  /* Tegnelag der kan slås fra under profilering (window.LYSBRUD.fx.layers). */
  const layers = { rails: true, bursts: true, rings: true, chains: true, beams: true, particles: true, flash: true };

  /* ----------------------------------------------------------------- bloom */

  function beginGlow() {
    if (!gctx) return null;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, gw, gh);
    gctx.save();
    gctx.scale(GLOW_SCALE, GLOW_SCALE);
    return gctx;
  }

  function endGlow(g, strength = 1) {
    if (!gctx) return;
    gctx.restore();

    let src = glow;
    if (blurOk && bctx) {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, gw, gh);
      bctx.filter = 'blur(4px)';
      bctx.drawImage(glow, 0, 0);
      bctx.filter = 'none';
      src = blurBuf;
    }

    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, strength);
    g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, cssW, cssH);
    g.restore();
  }

  return {
    resize, setLayout, setCalm, update, draw,
    emitShatter, emitBurst, emitRain, emitCrystals, emitGlints, emitStreaks,
    burst, addRing, beam, railGlow, flashLight, setAnticipation,
    addChain, addLabel, shake, clear,
    beginGlow, endGlow,
    get shakeVec() { return shakeVec; },
    get sceneLight() { return light; },
    layers,
    get activeChains() { return chains.filter(c => c.on).map(c => ({ segs: c.segs ? c.segs.length : 0, t: c.t, dur: c.dur, color: c.color })); },
  };
}

/* Faste stråler til anticipation — de skal ikke allokeres pr. frame. */
const ANTICIPATION_RAYS = Array.from({ length: 16 }, (_, k) => ({
  angle: (k / 16) * TAU,
  len: 0.55 + (k % 3) * 0.18,
  width: 0.012 + (k % 2) * 0.010,
  phase: k * 1.7,
}));
