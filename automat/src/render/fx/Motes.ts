// NORDLYS · charge motes (CONTRACTS.md §7): glowing #CFEFFF motes that ride a curved "field line"
// (cubic Bézier: burst up out of the cell, arc over, home in) with a helical offset (sin across the line, cos → depth: size/brightness),
// a short tapered comet trail and an arrival spark at the Kp-arc head.
//
// Rendering: ONE additive mesh with a procedural shader (no textures): trail ribbons, heads and arrival
// flashes/rings are all quads in one dynamic buffer → 1 draw call for any number of motes.
// The trail is not a history buffer: the path is analytic, so trail samples are the same curve evaluated
// slightly back in time (length follows speed, zero bookkeeping, perfectly smooth).
//
// Guarantees: onArrive fires exactly once per launched mote (on arrival; or immediately if the pool has
// to recycle it; or from flush()). update(0) (hit-stop) freezes. update() is allocation-free.
import { Container, GlProgram, Mesh, RenderTexture, Shader, type Geometry, type Renderer } from 'pixi.js';
import { crand } from '../../core/cosmeticRng.ts';
import { PAL } from '../../core/palette.ts';
import { DynGeometry, MESH_VERT_HEAD } from './parts/gl.ts';

const VERT = MESH_VERT_HEAD + /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec4 aColor;
in float aMode;
out vec2 vUV;
out vec4 vColor;
out float vMode;
void main() {
  gl_Position = fxPosition(aPosition);
  vUV = aUV; vColor = aColor * uColor.a; vMode = aMode;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vColor;
in float vMode;
out vec4 finalColor;
void main() {
  vec3 c;
  if (vMode < 0.5) {
    // trail ribbon: x across (−1..1), soft halo + thin white filament
    float x = vUV.x;
    c = vColor.rgb * exp(-x * x * 3.4) + vec3(exp(-x * x * 30.0) * vColor.a);
  } else if (vMode < 1.5) {
    // head: halo + white core + faint 4-point sparkle
    vec2 p = vUV;
    float r2 = dot(p, p);
    float spk = exp(-abs(p.x) * 30.0) * exp(-p.y * p.y * 2.6) + exp(-abs(p.y) * 30.0) * exp(-p.x * p.x * 2.6);
    c = vColor.rgb * (exp(-r2 * 4.2) + exp(-r2 * 16.0) * 0.6) + vec3(exp(-r2 * 55.0) + spk * 0.32) * vColor.a;
  } else {
    // arrival ring
    float r = length(vUV);
    float d = (r - 0.72);
    c = vColor.rgb * exp(-d * d / 0.012) + vec3(exp(-d * d / 0.0012) * vColor.a);
  }
  finalColor = vec4(c, 0.0);
}
`;

let program: GlProgram | null = null;
const moteProgram = () => (program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'nordlys-fx-motes' }));

const STRIDE = 9;
const K = 12;                 // trail samples (segments)
const TRAIL_T = 0.15;         // trail length in seconds of travel
const FLASH_T = 0.26;         // arrival flash duration
const MAX = 192;

class Mote {
  active = false;
  t = 0; dur = 0.65;
  x0 = 0; y0 = 0; x1 = 0; y1 = 0; x2 = 0; y2 = 0; x3 = 0; y3 = 0;
  amp = 8; turns = 2; phase = 0; size = 1;
  r = 1; g = 1; b = 1;
  cb: (() => void) | null = null;
  /** Live target (the caller's point object): the path end + approach tangent follow it every frame. */
  target: { x: number; y: number } | null = null;
  ox2 = 0; oy2 = 0;
  arrived = false;
  flash = -1;
  order = 0;
}

// path scratch (no allocation)
let PX = 0, PY = 0, PD = 0;
function evalPath(m: Mote, tt: number): void {
  const tau = Math.min(1, Math.max(0, tt / m.dur));
  const u = tau * tau * (2.2 - 1.2 * tau);
  const iu = 1 - u;
  const b0 = iu * iu * iu, b1 = 3 * iu * iu * u, b2 = 3 * iu * u * u, b3 = u * u * u;
  const x = b0 * m.x0 + b1 * m.x1 + b2 * m.x2 + b3 * m.x3;
  const y = b0 * m.y0 + b1 * m.y1 + b2 * m.y2 + b3 * m.y3;
  // tangent
  const d0 = iu * iu, d1 = 2 * iu * u, d2 = u * u;
  let tx = d0 * (m.x1 - m.x0) + d1 * (m.x2 - m.x1) + d2 * (m.x3 - m.x2);
  let ty = d0 * (m.y1 - m.y0) + d1 * (m.y2 - m.y1) + d2 * (m.y3 - m.y2);
  const tl = Math.sqrt(tx * tx + ty * ty) || 1;
  tx /= tl; ty /= tl;
  const env = Math.sin(Math.PI * u);
  const ang = Math.PI * 2 * m.turns * u + m.phase;
  const off = m.amp * Math.sin(ang) * env;
  PX = x - ty * off;
  PY = y + tx * off;
  PD = Math.cos(ang) * env;
}

export interface MoteOptions { color?: number; dur?: number; onArrive?: () => void }

export class Motes extends Container {
  private pool: Mote[] = [];
  private mesh: Mesh<Geometry, Shader>;
  private geo: DynGeometry;
  private live = 0;
  private orderSeq = 0;
  private dirty = false;
  /** Recent-arrival energy (decays ~0.25 s) → arrival flashes dim when motes land in quick succession. */
  private energy = 0;
  private damp = 1;

  constructor() {
    super();
    this.label = 'fx-motes';
    for (let i = 0; i < MAX; i++) this.pool.push(new Mote());
    this.geo = new DynGeometry([
      { name: 'aPosition', size: 2 }, { name: 'aUV', size: 2 }, { name: 'aColor', size: 4 }, { name: 'aMode', size: 1 },
    ], 64 * 40, 64 * 96);
    this.mesh = new Mesh<Geometry, Shader>({ geometry: this.geo.geometry, shader: new Shader({ glProgram: moteProgram(), resources: {} }) });
    this.mesh.blendMode = 'add';
    this.mesh.visible = false;
    this.addChild(this.mesh);
  }

  /** @internal Render one deterministic mote into `target` so the program links before the first win. */
  static prewarm(renderer: Renderer, target: RenderTexture): void {
    const ms = new Motes();
    const m = ms.pool[0];
    m.x0 = 0; m.y0 = 2; m.x1 = 0; m.y1 = 1; m.x2 = 2; m.y2 = 1; m.x3 = 2; m.y3 = 0;
    m.amp = 0; m.turns = 1; m.phase = 0; m.size = 0.2; m.dur = 0.2; m.t = 0;
    m.r = m.g = m.b = 1; m.cb = null; m.target = null; m.arrived = false; m.flash = -1; m.active = true;
    ms.live = 1; ms.dirty = true;
    ms.update(0.05);
    renderer.render({ container: ms, target, clear: false });
    ms.destroy();
  }

  /** Teardown: frees the mesh + buffers. Pending onArrive callbacks are NOT fired (call flush() first if needed). */
  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.removeChild(this.mesh);
    this.mesh.destroy();
    this.geo.destroy();
    super.destroy(options);
  }

  /** Motes in flight (not counting arrival flashes). */
  get inFlight(): number { let n = 0; for (let i = 0; i < MAX; i++) if (this.pool[i].active && !this.pool[i].arrived) n++; return n; }

  launch(from: { x: number; y: number }, to: { x: number; y: number }, n: number, o?: MoteOptions): void {
    const cnt = Math.max(0, Math.floor(n));
    const col = o?.color ?? PAL.mote;
    const dur = Math.max(0.12, o?.dur ?? 0.65);
    const cb = o?.onArrive ?? null;
    for (let j = 0; j < cnt; j++) {
      const m = this.alloc();
      const fx = from.x + (crand() - 0.5) * 10, fy = from.y + (crand() - 0.5) * 10;
      const dx = to.x - fx, dy = to.y - fy;
      const L = Math.sqrt(dx * dx + dy * dy) || 1;
      // Field line: burst up out of the cell (leaning toward the target so edge cells never leave the screen),
      // arc over, and home into the target from the outside. Each mote gets its own "L-shell".
      const lean = Math.max(-1, Math.min(1, dx / (L * 0.6)));
      const a1 = -Math.PI / 2 + lean * 0.55 + (crand() - 0.5) * 1.0;
      const r1 = L * (0.32 + 0.22 * crand());
      const back = Math.atan2(fy - to.y, fx - to.x) + (crand() - 0.5) * 0.9;
      const r2 = L * (0.22 + 0.18 * crand());
      m.x0 = fx; m.y0 = fy;
      m.x1 = fx + Math.cos(a1) * r1; m.y1 = fy + Math.sin(a1) * r1;
      m.ox2 = Math.cos(back) * r2; m.oy2 = Math.sin(back) * r2;
      m.x2 = to.x + m.ox2; m.y2 = to.y + m.oy2;
      m.x3 = to.x; m.y3 = to.y;
      m.target = to;
      m.amp = Math.min(12, Math.max(4, L * 0.028)) * (0.7 + 0.6 * crand());
      m.turns = 1.2 + crand() * 1.1;
      m.phase = crand() * Math.PI * 2;
      m.size = 0.85 + 0.3 * crand();
      m.dur = dur * (j === 0 ? 1 : 0.94 + 0.12 * crand());
      m.t = -j * 0.045;
      m.r = ((col >> 16) & 255) / 255; m.g = ((col >> 8) & 255) / 255; m.b = (col & 255) / 255;
      m.cb = cb;
      m.arrived = false;
      m.flash = -1;
      m.active = true;
      m.order = this.orderSeq++;
      this.live++;
    }
    this.dirty = true;
  }

  /** Fire every pending onArrive now and clear (skip / reset paths). */
  flush(): void {
    for (let i = 0; i < MAX; i++) {
      const m = this.pool[i];
      if (!m.active) continue;
      const cb = m.arrived ? null : m.cb;
      m.active = false; m.cb = null; m.arrived = true; m.target = null;
      if (cb) this.fire(cb);
    }
    this.live = 0;
    this.mesh.visible = false;
  }

  private alloc(): Mote {
    let oldest: Mote | null = null;
    for (let i = 0; i < MAX; i++) {
      const m = this.pool[i];
      if (!m.active) return m;
      if (!oldest || m.order < oldest.order) oldest = m;
    }
    // pool exhausted: recycle the oldest; its arrival still fires exactly once
    const m = oldest!;
    if (!m.arrived && m.cb) { const cb = m.cb; m.cb = null; m.arrived = true; this.fire(cb); }
    m.active = false; m.target = null;
    this.live--;
    return m;
  }

  private fire(cb: () => void): void {
    try { cb(); } catch (e) { console.error('[motes] onArrive threw', e); }
  }

  update(dt: number): void {
    if (this.live === 0) { if (this.mesh.visible) this.mesh.visible = false; return; }
    if (dt <= 0 && !this.dirty) return; // hit-stop: last frame's geometry stays valid
    this.dirty = false;
    if (dt > 0) {
      this.energy *= Math.exp(-dt / 0.25);
      for (let i = 0; i < MAX; i++) {
        const m = this.pool[i];
        if (!m.active) continue;
        if (!m.arrived) {
          const tg = m.target;
          if (tg) { m.x3 = tg.x; m.y3 = tg.y; m.x2 = tg.x + m.ox2; m.y2 = tg.y + m.oy2; }
          m.t += dt;
          if (m.t >= m.dur) {
            m.arrived = true;
            m.flash = 0;
            m.target = null;
            this.energy += 1;
            const cb = m.cb; m.cb = null;
            if (cb) this.fire(cb);
          }
        } else {
          m.t += dt;
          m.flash += dt;
          if (m.flash >= FLASH_T && m.t - m.dur >= TRAIL_T) { m.active = false; this.live--; }
        }
      }
    }
    this.build();
  }

  private build(): void {
    this.damp = 1 / (1 + Math.max(0, this.energy - 1) * 0.45);
    const g = this.geo;
    let nv = 0, ni = 0;
    for (let i = 0; i < MAX; i++) {
      const m = this.pool[i];
      if (!m.active || m.t <= 0) continue;
      g.ensure(nv + (K + 1) * 2 + 12, ni + K * 6 + 18);
      const f = g.f32, ix = g.idx;
      const fadeIn = Math.min(1, m.t / 0.08);
      // ── trail ribbon (head → tail), clipped to the arrival point after landing ──
      const tHead = Math.min(m.t, m.dur);
      const tail0 = m.arrived ? Math.max(0, 1 - (m.t - m.dur) / TRAIL_T) : 1; // trail retracts into the arc
      const base = nv;
      let pxPrev = 0, pyPrev = 0;
      for (let j = 0; j <= K; j++) {
        const q = j / K;
        const tt = Math.max(0, tHead - q * TRAIL_T * tail0);
        evalPath(m, tt);
        const x = PX, y = PY, depth = PD;
        // direction from neighbouring sample
        let dx: number, dy: number;
        if (j === 0) { evalPath(m, Math.max(0, tt - 0.004)); dx = x - PX; dy = y - PY; }
        else { dx = pxPrev - x; dy = pyPrev - y; }
        const dl = Math.sqrt(dx * dx + dy * dy);
        if (dl > 1e-4) { dx /= dl; dy /= dl; } else { dx = 1; dy = 0; }
        pxPrev = x; pyPrev = y;
        const k = 1 - q;
        const w = (1.6 + 5.4 * Math.pow(k, 0.8)) * m.size * (1 + 0.22 * depth);
        const inten = Math.pow(k, 1.5) * fadeIn * (0.62 + 0.2 * depth) * (m.arrived ? tail0 : 1);
        const core = Math.pow(k, 2.2) * fadeIn * 0.85 * (m.arrived ? tail0 : 1);
        const nx = -dy * w, ny = dx * w;
        let o = nv * STRIDE;
        f[o++] = x + nx; f[o++] = y + ny; f[o++] = 1; f[o++] = q; f[o++] = m.r * inten; f[o++] = m.g * inten; f[o++] = m.b * inten; f[o++] = core; f[o++] = 0;
        f[o++] = x - nx; f[o++] = y - ny; f[o++] = -1; f[o++] = q; f[o++] = m.r * inten; f[o++] = m.g * inten; f[o++] = m.b * inten; f[o++] = core; f[o] = 0;
        if (j > 0) {
          const a = nv - 2;
          ix[ni++] = a; ix[ni++] = a + 1; ix[ni++] = nv; ix[ni++] = a + 1; ix[ni++] = nv + 1; ix[ni++] = nv;
        }
        nv += 2;
      }
      void base;
      // ── head ──
      if (!m.arrived) {
        evalPath(m, m.t);
        const pop = Math.min(1, m.t / 0.1);
        const R = 17 * m.size * (1 + 0.28 * PD) * (0.55 + 0.45 * pop);
        const hi = (0.85 + 0.25 * PD) * fadeIn;
        nv = this.quad(nv, PX, PY, R, m.r * hi, m.g * hi, m.b * hi, hi, 1);
        ix[ni++] = nv - 4; ix[ni++] = nv - 3; ix[ni++] = nv - 2; ix[ni++] = nv - 4; ix[ni++] = nv - 2; ix[ni++] = nv - 1;
      } else if (m.flash < FLASH_T) {
        // ── arrival: small bright pop + expanding ring; dimmed when many land together (no white blob) ──
        const a = m.flash / FLASH_T;
        const damp = this.damp;
        const pf = Math.max(0, 1 - a * 2.4) * damp;
        if (pf > 0.01) {
          nv = this.quad(nv, m.x3, m.y3, 11 * m.size * (1 + 0.8 * a), m.r * pf, m.g * pf, m.b * pf, pf, 1);
          ix[ni++] = nv - 4; ix[ni++] = nv - 3; ix[ni++] = nv - 2; ix[ni++] = nv - 4; ix[ni++] = nv - 2; ix[ni++] = nv - 1;
        }
        const e = 1 - (1 - a) * (1 - a);
        const rf = (1 - a) * (1 - a) * 0.75 * damp;
        nv = this.quad(nv, m.x3, m.y3, (6 + 18 * e) * m.size, m.r * rf, m.g * rf, m.b * rf, rf * 0.5, 2);
        ix[ni++] = nv - 4; ix[ni++] = nv - 3; ix[ni++] = nv - 2; ix[ni++] = nv - 4; ix[ni++] = nv - 2; ix[ni++] = nv - 1;
      }
    }
    if (ni === 0) { this.mesh.visible = false; return; }
    g.commit(nv, ni);
    this.mesh.visible = true;
  }

  private quad(nv: number, x: number, y: number, R: number, r: number, g: number, b: number, core: number, mode: number): number {
    const f = this.geo.f32;
    let o = nv * STRIDE;
    f[o++] = x - R; f[o++] = y - R; f[o++] = -1; f[o++] = -1; f[o++] = r; f[o++] = g; f[o++] = b; f[o++] = core; f[o++] = mode;
    f[o++] = x + R; f[o++] = y - R; f[o++] = 1; f[o++] = -1; f[o++] = r; f[o++] = g; f[o++] = b; f[o++] = core; f[o++] = mode;
    f[o++] = x + R; f[o++] = y + R; f[o++] = 1; f[o++] = 1; f[o++] = r; f[o++] = g; f[o++] = b; f[o++] = core; f[o++] = mode;
    f[o++] = x - R; f[o++] = y + R; f[o++] = -1; f[o++] = 1; f[o++] = r; f[o++] = g; f[o++] = b; f[o++] = core; f[o] = mode;
    return nv + 4;
  }
}

/** Compile the mote program ahead of the first win (called by ScreenShatter's pre-warm). Uses no cosmetic RNG. */
export function prewarmMotes(renderer: Renderer, target: RenderTexture): void {
  Motes.prewarm(renderer, target);
}
