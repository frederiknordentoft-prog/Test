/* LYSBRUD — effektlag: partikler, energikæder, flyvende tal, rystelser og bloom.
   Alt genbruges fra forudallokerede puljer; ingen allokering i den varme løkke. */

import { withAlpha } from './wheel.js';
import { SYMBOL_BY_ID } from './config.js';

const TAU = Math.PI * 2;
const MAX_PARTICLES = 1100;
const MAX_CHAINS = 40;
const MAX_LABELS = 24;

function makeParticle() {
  return {
    on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1,
    size: 4, rot: 0, vrot: 0, grav: 0, drag: 0.99, r: 255, g: 255, b: 255, sides: 4,
  };
}

function rgbOf(hex) {
  if (hex[0] !== '#') return [255, 255, 255];
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createFx() {
  const pool = Array.from({ length: MAX_PARTICLES }, makeParticle);
  let cursor = 0;

  const chains = Array.from({ length: MAX_CHAINS }, () => ({ on: false, segs: null, t: 0, dur: 1, color: '#fff', width: 3, hold: 0 }));
  const labels = Array.from({ length: MAX_LABELS }, () => ({ on: false, x: 0, y: 0, text: '', color: '#fff', t: 0, dur: 1, size: 22 }));

  let shakeAmp = 0, shakeT = 0;
  const shakeVec = { x: 0, y: 0 };
  let calm = false;

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
      p.on = true; p.kind = 0;
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
      p.on = true; p.kind = 1;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.max = 260 + Math.random() * 240; p.life = p.max;
      p.size = size * 0.06; p.grav = 0.0002 * size; p.drag = 0.94;
      p.r = er; p.g = eg; p.b = eb;
    }
    const ring = alloc();
    ring.on = true; ring.kind = 2;
    ring.x = x; ring.y = y; ring.vx = 0; ring.vy = 0;
    ring.max = 340; ring.life = ring.max; ring.size = size * 0.34;
    ring.r = er; ring.g = eg; ring.b = eb;
  }

  /** Generisk farvet udbrud (reaktor, prisme, bonus). */
  function emitBurst(x, y, color, count = 24, power = 1) {
    const [r, g, b] = rgbOf(color);
    const n = calm ? Math.round(count * 0.4) : count;
    for (let k = 0; k < n; k++) {
      const p = alloc();
      const a = Math.random() * TAU;
      const sp = (0.6 + Math.random() * 2.6) * power;
      p.on = true; p.kind = 1;
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
      p.on = true; p.kind = 0;
      p.x = Math.random() * w; p.y = -20 - Math.random() * h * 0.5;
      p.vx = (Math.random() - 0.5) * 0.12; p.vy = 0.12 + Math.random() * 0.22;
      p.max = 2600 + Math.random() * 1800; p.life = p.max;
      p.size = 5 + Math.random() * 12;
      p.rot = Math.random() * TAU; p.vrot = (Math.random() - 0.5) * 0.004;
      p.grav = 0.00006; p.drag = 1; p.sides = 4;
      p.r = r; p.g = g; p.b = b;
    }
  }

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
    shakeAmp = Math.min(26, shakeAmp + power);
  }

  function clear() {
    for (const p of pool) p.on = false;
    for (const c of chains) c.on = false;
    for (const l of labels) l.on = false;
    shakeAmp = 0; shakeVec.x = 0; shakeVec.y = 0;
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
    if (shakeAmp > 0.05) {
      shakeT += d;
      shakeAmp *= Math.pow(0.86, d / 16.67);
      shakeVec.x = Math.sin(shakeT * 0.09) * shakeAmp;
      shakeVec.y = Math.cos(shakeT * 0.121) * shakeAmp * 0.7;
    } else {
      shakeAmp = 0; shakeVec.x = 0; shakeVec.y = 0;
    }
  }

  /* -------------------------------------------------------------- tegning */

  function drawParticles(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const p of pool) {
      if (!p.on) continue;
      const k = p.life / p.max;
      const a = k > 0.75 ? (1 - k) / 0.25 : k / 0.75;
      const alpha = Math.max(0, Math.min(1, a));
      if (p.kind === 0) {
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
      } else if (p.kind === 1) {
        const len = Math.hypot(p.vx, p.vy) * 3.4;
        const nx = len > 0.01 ? p.vx / Math.hypot(p.vx, p.vy) : 0;
        const ny = len > 0.01 ? p.vy / Math.hypot(p.vx, p.vy) : 0;
        g.beginPath();
        g.moveTo(p.x - nx * len, p.y - ny * len);
        g.lineTo(p.x, p.y);
        g.strokeStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        g.lineWidth = p.size * 0.9;
        g.lineCap = 'round';
        g.stroke();
      } else {
        const rr = p.size * (1 + (1 - p.life / p.max) * 2.6);
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

/** Endepunkt for et segment ved fremdrift k — bruges til knuderne. */
function segEnd(s, k) {
  if (s.kind === 'arc') {
    const a = s.a0 + (s.a1 - s.a0) * k - Math.PI / 2;
    return [s.cx + s.rad * Math.cos(a), s.cy + s.rad * Math.sin(a)];
  }
  return [s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k];
}

/** Energikæden tegnes i fire lag, så den læses som lys og ikke som en streg:
 *  bredt farvet skær → farvet krop → hvid kerne → lysende knuder. */
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

    // Knuder: en lysende prik hvor kæden rammer hver celle.
    for (let i = 0; i < total; i++) {
      const k = Math.min(1, shown - i);
      if (k <= 0) break;
      const [x, y] = segEnd(c.segs[i], k);
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

  function draw(g) {
    drawChains(g);
    drawParticles(g);
    drawLabels(g);
  }

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
      // Slør i lav opløsning; opskaleringen bagefter blødgør yderligere.
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
    resize, setCalm, update, draw,
    emitShatter, emitBurst, emitRain,
    addChain, addLabel, shake, clear,
    beginGlow, endGlow,
    get shakeVec() { return shakeVec; },
    get activeChains() { return chains.filter(c => c.on).map(c => ({ segs: c.segs ? c.segs.length : 0, t: c.t, dur: c.dur, color: c.color })); },
  };
}
