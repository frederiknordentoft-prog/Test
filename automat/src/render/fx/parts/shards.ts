// Textured shard batch: one dynamic mesh per texture source, pieces written as centroid fans on the CPU.
// Shared by CellShatter (symbol pieces / RETURN dissolve) and ScreenShatter (captured-frame shards).
//
// Vertex (15 floats): aPosition(2) aUV(2) aLocal(2: offset from piece centroid / piece radius)
//                     aEdge(1: 0 centroid → 1 border) aA(4: alpha, rim, shade, spec) aB(4: specPhase, ca, dissolve, cold)
// Fragment: 3-tap radial chromatic split near edges (ca), cold desaturate/dim, noise dissolve with a faint
// ash edge (no glow), crisp 1.5 px rim line (fwidth) + soft inner band, sweeping specular stripe. Rim/spec are
// written as premultiplied "over-bright" rgb → additive light on top of the piece with normal blending.
import { GlProgram, Mesh, Shader, UniformGroup, type Geometry, type TextureSource } from 'pixi.js';
import { DynGeometry, MESH_VERT_HEAD } from './gl.ts';

const VERT = MESH_VERT_HEAD + /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec2 aLocal;
in float aEdge;
in vec4 aA;
in vec4 aB;
out vec2 vUV;
out vec2 vLocal;
out float vEdge;
out vec4 vA;
out vec4 vB;
void main() {
  gl_Position = fxPosition(aPosition);
  vUV = aUV; vLocal = aLocal; vEdge = aEdge; vA = aA; vB = aB;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vLocal;
in float vEdge;
in vec4 vA;
in vec4 vB;
uniform sampler2D uTexture;
uniform vec4 uColor;
uniform vec3 uRimCold;
uniform vec3 uRimHot;
uniform float uRimTex;
out vec4 finalColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float alpha = vA.x, rim = vA.y, shade = vA.z, spec = vA.w;
  float ca = vB.y, dissolve = vB.z, cold = vB.w;
  // radial chromatic split, strongest at the piece border
  vec4 c = texture(uTexture, vUV);
  if (ca > 0.0) {
    vec2 o = vLocal * ca * vEdge * vEdge;
    c.r = texture(uTexture, vUV + o).r;
    c.b = texture(uTexture, vUV - o).b;
  }
  // RETURN profile: desaturated, dim, cool slate
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  c.rgb = mix(c.rgb, vec3(lum) * vec3(0.70, 0.78, 0.92), cold * 0.88);
  c.rgb *= shade;
  // noise dissolve, eroding from the outside in (no glow: a faint ash rim only)
  if (dissolve > 0.0) {
    float n = vnoise(vLocal * 9.0 + vB.x * 7.0) * 0.6 + vnoise(vLocal * 23.0 + 3.1) * 0.4;
    float radial = 1.0 - clamp(length(vLocal) * 1.25, 0.0, 1.0);   // 1 at the centre, 0 at the rim
    float e = (n * 0.5 + radial * 0.5) - dissolve * 1.04 + 0.04;
    float keep = smoothstep(0.0, 0.045, e);
    float front = (1.0 - smoothstep(0.0, 0.07, e)) * keep;
    c.rgb = mix(c.rgb, vec3(0.46, 0.53, 0.64) * c.a, front * 0.5);
    c *= keep;
  }
  // rim: crisp line on the fracture border + soft inner band
  float fw = max(fwidth(vEdge), 1e-4);
  float line = 1.0 - smoothstep(0.0, fw * 1.6, 1.0 - vEdge);
  float band = pow(vEdge, 8.0);
  vec3 tone = c.rgb / max(c.a, 1e-3);
  vec3 rc = mix(mix(uRimCold, uRimHot, clamp(rim - 0.7, 0.0, 1.0)), tone * 1.1 + vec3(0.10, 0.11, 0.13), uRimTex);
  float cover = mix(1.0, smoothstep(0.05, 0.6, c.a), uRimTex);
  vec3 add = rc * (line + band * mix(0.12, 0.3, uRimTex)) * rim * cover;
  // narrow specular stripe sweeping across the piece as it tumbles
  float s = dot(vLocal, vec2(0.7071, 0.7071)) - vB.x;
  add += vec3(1.0, 0.97, 0.93) * exp(-s * s * 30.0) * spec * cover;
  c.rgb += add;
  finalColor = c * (alpha * uColor.a);
}
`;

let program: GlProgram | null = null;
const shardProgram = () => (program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'nordlys-fx-shards' }));

export const SHARD_ATTRS = [
  { name: 'aPosition', size: 2 }, { name: 'aUV', size: 2 }, { name: 'aLocal', size: 2 }, { name: 'aEdge', size: 1 },
  { name: 'aA', size: 4 }, { name: 'aB', size: 4 },
] as const;
export const SHARD_STRIDE = 15;

export interface RimStyle { cold: number; hot: number; fromTexture: number }

export class ShardBatch {
  readonly mesh: Mesh<Geometry, Shader>;
  readonly geo: DynGeometry;
  readonly uniforms: UniformGroup;
  source: TextureSource;
  nv = 0;
  ni = 0;
  /** Seconds this batch has had nothing to draw (owners prune long-idle batches). */
  idle = 0;
  /** Owner hook (e.g. the source 'destroy' listener) so it can be detached on prune. */
  release: (() => void) | null = null;

  constructor(source: TextureSource, verts: number, indices: number, rim: RimStyle) {
    this.source = source;
    this.geo = new DynGeometry(SHARD_ATTRS as unknown as { name: string; size: 1 | 2 | 3 | 4 }[], verts, indices);
    const c = (h: number) => new Float32Array([((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]);
    this.uniforms = new UniformGroup({
      uRimCold: { value: c(rim.cold), type: 'vec3<f32>' },
      uRimHot: { value: c(rim.hot), type: 'vec3<f32>' },
      uRimTex: { value: rim.fromTexture, type: 'f32' },
    });
    const shader = new Shader({
      glProgram: shardProgram(),
      resources: { uTexture: source, uSampler: source.style, shardUniforms: this.uniforms },
    });
    this.mesh = new Mesh<Geometry, Shader>({ geometry: this.geo.geometry, shader });
    this.mesh.visible = false;
  }

  setSource(source: TextureSource): void {
    if (source === this.source) return;
    this.source = source;
    this.mesh.shader!.resources.uTexture = source;
    this.mesh.shader!.resources.uSampler = source.style;
  }

  begin(): void { this.nv = 0; this.ni = 0; }

  /** Reserve room for `v` more vertices and `i` more indices. */
  reserve(v: number, i: number): void { this.geo.ensure(this.nv + v, this.ni + i); }

  vert(x: number, y: number, u: number, v: number, lx: number, ly: number, edge: number,
    alpha: number, rim: number, shade: number, spec: number,
    phase: number, ca: number, dissolve: number, cold: number): number {
    const f = this.geo.f32;
    let o = this.nv * SHARD_STRIDE;
    f[o++] = x; f[o++] = y; f[o++] = u; f[o++] = v; f[o++] = lx; f[o++] = ly; f[o++] = edge;
    f[o++] = alpha; f[o++] = rim; f[o++] = shade; f[o++] = spec;
    f[o++] = phase; f[o++] = ca; f[o++] = dissolve; f[o] = cold;
    return this.nv++;
  }

  tri(a: number, b: number, c: number): void {
    const ix = this.geo.idx;
    ix[this.ni++] = a; ix[this.ni++] = b; ix[this.ni++] = c;
  }

  end(): void {
    if (this.ni === 0) { this.mesh.visible = false; return; }
    this.geo.commit(this.nv, this.ni);
    this.mesh.visible = true;
  }

  destroy(): void {
    this.mesh.destroy();
    this.geo.destroy();
  }
}
