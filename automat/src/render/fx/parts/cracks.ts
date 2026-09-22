// Glowing fracture lines for the screen shatter: one additive mitered strip per crack chain.
// Vertex: aPosition(2) aAcross(1: −1..1) aArrive(1: crack arrival 0..1) aSeed(1)
// Reveal is a uniform (no geometry churn while the game tweens crackReveal): a segment point lights up once
// uReveal passes its arrival; freshly reached crack is white-hot (#FFFFFF), cooling to magenta (#FF2BD6).
import { GlProgram, Mesh, Shader, UniformGroup, type Geometry } from 'pixi.js';
import { DynGeometry, MESH_VERT_HEAD } from './gl.ts';

const VERT = MESH_VERT_HEAD + /* glsl */ `
in vec2 aPosition;
in float aAcross;
in float aArrive;
in float aSeed;
out float vAcross;
out float vArrive;
out float vSeed;
void main() {
  gl_Position = fxPosition(aPosition);
  vAcross = aAcross; vArrive = aArrive; vSeed = aSeed;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in float vAcross;
in float vArrive;
in float vSeed;
uniform vec4 uColor;
uniform float uReveal;
uniform float uFade;
uniform float uTime;
uniform vec3 uCool;
uniform vec3 uHot;
out vec4 finalColor;
void main() {
  float f = uReveal - vArrive;                 // > 0 : crack already reached this point
  float vis = smoothstep(-0.006, 0.01, f);
  float hot = exp(-max(f, 0.0) * 7.0);          // fresh crack is white-hot
  float x = vAcross;
  float core = exp(-x * x * 42.0);
  float glow = exp(-x * x * 5.0);
  vec3 col = mix(uCool, uHot, hot * 0.9);
  float flick = 0.86 + 0.14 * sin(uTime * 47.0 + vSeed * 61.0);
  float nearI = mix(1.25, 0.55, vArrive);       // cracks thin out and dim away from the impact
  vec3 c = (col * glow * (0.42 + 0.5 * hot) + mix(col, uHot, 0.65) * core * (1.1 + 1.2 * hot)) * nearI;
  // travelling spark at the crack front
  float tip = exp(-f * f * 9000.0) * step(-0.002, f);
  c += uHot * tip * (core * 2.4 + glow * 0.6);
  finalColor = vec4(c * vis * flick * uFade * uColor.a, 0.0);
}
`;

let program: GlProgram | null = null;

export class CrackMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  readonly geo: DynGeometry;
  readonly u: { uReveal: number; uFade: number; uTime: number; uCool: Float32Array; uHot: Float32Array };
  nv = 0;
  ni = 0;

  constructor(maxSegs: number) {
    this.geo = new DynGeometry([
      { name: 'aPosition', size: 2 }, { name: 'aAcross', size: 1 }, { name: 'aArrive', size: 1 }, { name: 'aSeed', size: 1 },
    ], maxSegs * 4, maxSegs * 6);
    const group = new UniformGroup({
      uReveal: { value: 0, type: 'f32' },
      uFade: { value: 1, type: 'f32' },
      uTime: { value: 0, type: 'f32' },
      uCool: { value: new Float32Array([1, 0.169, 0.839]), type: 'vec3<f32>' },
      uHot: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    });
    this.u = group.uniforms as CrackMesh['u'];
    program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'nordlys-fx-cracks' });
    const shader = new Shader({ glProgram: program, resources: { crackUniforms: group } });
    this.mesh = new Mesh<Geometry, Shader>({ geometry: this.geo.geometry, shader });
    this.mesh.blendMode = 'add';
    this.mesh.visible = false;
  }

  begin(): void { this.nv = 0; this.ni = 0; }

  /**
   * One crack polyline as a mitered strip (no overlap inside the chain → no bright beads at the jag nodes).
   * xs/ys/arr: scratch arrays holding `n` points (px) and their arrival; hw = half-width (px); cap = end overlap.
   */
  chain(xs: Float32Array, ys: Float32Array, arr: Float32Array, n: number, hw: number, cap: number, seed: number): void {
    if (n < 2) return;
    this.geo.ensure(this.nv + n * 2, this.ni + (n - 1) * 6);
    const f = this.geo.f32;
    const ix = this.geo.idx;
    const v0 = this.nv;
    for (let i = 0; i < n; i++) {
      // segment directions around node i
      const ia = i > 0 ? i - 1 : i, ib = i < n - 1 ? i + 1 : i;
      let d0x = xs[i] - xs[ia], d0y = ys[i] - ys[ia];
      let d1x = xs[ib] - xs[i], d1y = ys[ib] - ys[i];
      const l0 = Math.sqrt(d0x * d0x + d0y * d0y), l1 = Math.sqrt(d1x * d1x + d1y * d1y);
      if (l0 > 1e-6) { d0x /= l0; d0y /= l0; } else { d0x = d1x / (l1 || 1); d0y = d1y / (l1 || 1); }
      if (l1 > 1e-6) { d1x /= l1; d1y /= l1; } else { d1x = d0x; d1y = d0y; }
      let tx = d0x + d1x, ty = d0y + d1y;
      const tl = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= tl; ty /= tl;
      // miter length, clamped so sharp jags never spike
      const cosH = Math.max(0.5, tx * d1x + ty * d1y);
      const m = hw / cosH;
      let px = xs[i], py = ys[i];
      if (i === 0) { px -= tx * cap; py -= ty * cap; }
      else if (i === n - 1) { px += tx * cap; py += ty * cap; }
      const nx = -ty * m, ny = tx * m;
      let o = this.nv * 5;
      f[o++] = px + nx; f[o++] = py + ny; f[o++] = 1; f[o++] = arr[i]; f[o++] = seed;
      f[o++] = px - nx; f[o++] = py - ny; f[o++] = -1; f[o++] = arr[i]; f[o] = seed;
      this.nv += 2;
    }
    for (let i = 0; i < n - 1; i++) {
      const a = v0 + i * 2;
      ix[this.ni++] = a; ix[this.ni++] = a + 1; ix[this.ni++] = a + 2;
      ix[this.ni++] = a + 1; ix[this.ni++] = a + 3; ix[this.ni++] = a + 2;
    }
  }

  end(): void {
    if (this.ni === 0) { this.mesh.visible = false; return; }
    this.geo.commit(this.nv, this.ni);
    this.mesh.visible = true;
  }

  destroy(): void { this.mesh.destroy(); this.geo.destroy(); }
}
