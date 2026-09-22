// Shared GL plumbing for the fx meshes: an interleaved, growable, partially-uploaded dynamic geometry,
// and the mesh vertex-shader preamble (Pixi v8 mesh uniforms).
//
// Pattern: CPU writes the live vertices/indices from 0 each frame, then `commit(nv, ni)` uploads only the
// used byte range (bufferSubData) and sets geometry.indexCount so only live primitives are drawn.
// Growth (rare, never in steady state) reallocates ×2 and is the only allocation.
import { Buffer, BufferUsage, Geometry, type VertexFormat } from 'pixi.js';

export interface AttrSpec { name: string; size: 1 | 2 | 3 | 4 }

const FMT: Record<number, VertexFormat> = { 1: 'float32', 2: 'float32x2', 3: 'float32x3', 4: 'float32x4' };

export class DynGeometry {
  readonly geometry: Geometry;
  readonly stride: number; // floats per vertex
  f32: Float32Array;
  idx: Uint32Array;
  private vbuf: Buffer;
  private ibuf: Buffer;

  constructor(attrs: AttrSpec[], verts: number, indices: number) {
    let s = 0;
    for (const a of attrs) s += a.size;
    this.stride = s;
    this.f32 = new Float32Array(Math.max(4, verts) * s);
    this.idx = new Uint32Array(Math.max(6, indices));
    this.vbuf = new Buffer({ data: this.f32, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, shrinkToFit: false, label: 'fx-dyn-vbuf' });
    this.ibuf = new Buffer({ data: this.idx, usage: BufferUsage.INDEX | BufferUsage.COPY_DST, shrinkToFit: false, label: 'fx-dyn-ibuf' });
    const attributes: Record<string, { buffer: Buffer; format: VertexFormat; stride: number; offset: number }> = {};
    let off = 0;
    for (const a of attrs) {
      attributes[a.name] = { buffer: this.vbuf, format: FMT[a.size], stride: s * 4, offset: off * 4 };
      off += a.size;
    }
    this.geometry = new Geometry({ attributes, indexBuffer: this.ibuf, topology: 'triangle-list' });
  }

  /** Make sure `verts` vertices and `indices` indices fit (grows ×2, keeps content). */
  ensure(verts: number, indices: number): void {
    if (verts * this.stride > this.f32.length) {
      let n = this.f32.length;
      while (n < verts * this.stride) n *= 2;
      const next = new Float32Array(n);
      next.set(this.f32);
      this.f32 = next;
      this.vbuf.setDataWithSize(next, next.length, true);
    }
    if (indices > this.idx.length) {
      let n = this.idx.length;
      while (n < indices) n *= 2;
      const next = new Uint32Array(n);
      next.set(this.idx);
      this.idx = next;
      this.ibuf.setDataWithSize(next, next.length, true);
    }
  }

  /** Upload the first nv vertices / ni indices and draw exactly ni indices. */
  commit(nv: number, ni: number, indicesChanged = true): void {
    this.vbuf.update(Math.max(1, nv) * this.stride * 4);
    if (indicesChanged) this.ibuf.update(Math.max(1, ni) * 4);
    this.geometry.indexCount = ni;
  }

  destroy(): void {
    this.geometry.destroy(true);
  }
}

/** Mesh vertex-shader uniforms (Pixi v8 global + local groups). */
export const MESH_VERT_HEAD = /* glsl */ `#version 300 es
precision highp float;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uColor;
vec4 fxPosition(vec2 p) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  return vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
}
`;

/** Pack 0..1 floats into Pixi's unorm8x4 particle colour (bytes r,g,b,a little-endian). */
export function packRGBA(r: number, g: number, b: number, a: number): number {
  const R = r <= 0 ? 0 : r >= 1 ? 255 : (r * 255 + 0.5) | 0;
  const G = g <= 0 ? 0 : g >= 1 ? 255 : (g * 255 + 0.5) | 0;
  const B = b <= 0 ? 0 : b >= 1 ? 255 : (b * 255 + 0.5) | 0;
  const A = a <= 0 ? 0 : a >= 1 ? 255 : (a * 255 + 0.5) | 0;
  return ((A << 24) | (B << 16) | (G << 8) | R) >>> 0;
}

export const hexR = (c: number) => ((c >> 16) & 255) / 255;
export const hexG = (c: number) => ((c >> 8) & 255) / 255;
export const hexB = (c: number) => (c & 255) / 255;
