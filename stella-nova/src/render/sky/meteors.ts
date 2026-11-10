/**
 * Shooting stars: a small pool of streaks in one draw call. A meteor is two
 * directions on the sky (start, end) and a start time; the vertex shader
 * slides a thin quad along the arc, so nothing is updated per frame. Spawns
 * are timed on accumulated dt and placed in the margins of the current view.
 */
import * as THREE from 'three';
import { FIT_RADIUS, PALETTE } from '../../core/config';
import type { Rng } from '../../core/rng';
import { FAR_Z_GLSL, ORDER, type SkyShared } from './shared';
import { emissive } from './tone';

const POOL = 8;

const VERT = /* glsl */ `
  attribute vec2 aCorner;
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute vec4 aLife;
  uniform float uTime;
  uniform float uPxTan;
  varying vec3 vS;
  varying float vGain;

  void main() {
    float k = (uTime - aLife.x) / aLife.y;
    vGain = 0.0;
    vS = vec3(0.0);
    if (k <= 0.0 || k >= 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    // The head eases out; the trail is longest mid-flight and closes up at the end.
    float kh = 1.0 - (1.0 - k) * (1.0 - k);
    float kt = max(0.0, kh - 0.05 - 0.40 * sin(3.14159 * k));
    vec3 hv = mat3(viewMatrix) * normalize(mix(aStart, aEnd, kh));
    vec3 tv = mat3(viewMatrix) * normalize(mix(aStart, aEnd, kt));
    if (hv.z > -0.05 || tv.z > -0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec2 h = hv.xy / -hv.z;
    vec2 t = tv.xy / -tv.z;
    vec2 along = h - t;
    float len = max(length(along), 0.00001);
    along /= len;
    // Never thinner than about a pixel and a half, or it would crawl.
    float w = max(aLife.w, uPxTan * 1.6);
    float pad = w * 3.0;
    float s = mix(-pad, len + pad, aCorner.x);
    vec2 p = t + along * s + vec2(-along.y, along.x) * (aCorner.y * w * 3.0);
    // x: distance behind the head in widths, y: across in widths, z: length in widths.
    vS = vec3((len - s) / w, aCorner.y * 3.0, len / w);
    vGain = aLife.z * sin(3.14159 * k);
    gl_Position = projectionMatrix * vec4(p, -1.0, 1.0);
    ${FAR_Z_GLSL}
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uWarm;
  uniform vec3 uIce;
  uniform float uMode;
  varying vec3 vS;
  varying float vGain;

  void main() {
    float behind = vS.x;
    float trail = behind > 0.0 ? pow(max(0.0, 1.0 - behind / max(vS.z, 0.001)), 2.2) : 0.0;
    float body = exp(-vS.y * vS.y * 1.6) * trail;
    float head = exp(-(behind * behind * 0.5 + vS.y * vS.y) * 0.9);
    vec3 tint = mix(uWarm, uIce, uMode);
    gl_FragColor = vec4((tint * body * 0.55 + mix(tint, vec3(1.0), 0.6) * head) * vGain, 1.0);
  }
`;

export class SkyMeteors {
  readonly mesh: THREE.Mesh;
  private readonly start: THREE.BufferAttribute;
  private readonly end: THREE.BufferAttribute;
  private readonly life: THREE.BufferAttribute;
  private readonly until = new Float32Array(POOL);
  private wait = 4;
  private next = 0;
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();

  constructor(
    shared: SkyShared,
    private readonly uTime: { value: number },
    private readonly rng: Rng,
  ) {
    const corner = new Float32Array(POOL * 4 * 2);
    const index: number[] = [];
    for (let i = 0; i < POOL; i++) {
      corner.set([0, -1, 1, -1, 1, 1, 0, 1], i * 8);
      const v = i * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    const g = new THREE.BufferGeometry();
    // `position` only tells three how many vertices there are; the shader places them.
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POOL * 4 * 3), 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    this.start = new THREE.BufferAttribute(new Float32Array(POOL * 4 * 3), 3);
    this.end = new THREE.BufferAttribute(new Float32Array(POOL * 4 * 3), 3);
    this.life = new THREE.BufferAttribute(new Float32Array(POOL * 4 * 4).fill(-1000), 4);
    for (const attr of [this.start, this.end, this.life]) attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aStart', this.start);
    g.setAttribute('aEnd', this.end);
    g.setAttribute('aLife', this.life);
    g.setIndex(index);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime,
        uPxTan: shared.uPxTan,
        uMode: shared.uMode,
        uWarm: { value: emissive(PALETTE.starCore) },
        uIce: { value: emissive(PALETTE.comet) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.name = 'sky.meteors';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = ORDER.meteors;
    this.mesh.visible = false;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, mode: number, reducedMotion: boolean): void {
    this.wait -= dt;
    if (this.wait <= 0) {
      this.spawn(camera, mode);
      // Rare and far apart on an ordinary night, a steady shower in Kometnat.
      const calm = this.rng.range(9, 22);
      const shower = this.rng.range(1.3, 3.6);
      this.wait = (calm + (shower - calm) * mode) * (reducedMotion ? 3 : 1);
    }
    let alive = false;
    const now = this.uTime.value;
    for (let i = 0; i < POOL; i++) if (this.until[i] > now) alive = true;
    this.mesh.visible = alive;
  }

  /** Launch one meteor in the margins of the current view. */
  spawn(camera: THREE.PerspectiveCamera, mode: number): void {
    const rng = this.rng;
    const pe = camera.projectionMatrix.elements;
    const o = this.a.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(0.001, -o.z);
    const cx = o.x / depth;
    const cy = o.y / depth;
    const rb = FIT_RADIUS / depth;

    // A start point inside the frame but clear of the instrument.
    let sx = 0;
    let sy = 0;
    for (let guard = 0; guard < 12; guard++) {
      sx = (rng.range(-0.95, 0.95) + pe[8]) / pe[0];
      sy = (rng.range(-0.2, 0.98) + pe[9]) / pe[5];
      if (Math.hypot(sx - cx, sy - cy) > rb * 1.12) break;
    }
    // Kometnat's meteors share a radiant and fall the same way; on an ordinary
    // night a lone one may cross in either direction, always downward.
    const side = rng.next() < 0.5 ? -1 : 1;
    const base = mode > 0.5 ? -0.62 : -Math.PI / 2 + side * rng.range(0.35, 1.0);
    const heading = base + rng.range(-0.16, 0.16);
    const reach = rb * rng.range(0.45, 0.95) * (1 + 0.35 * mode);
    const ex = sx + Math.cos(heading) * reach;
    const ey = sy + Math.sin(heading) * reach;

    const start = this.a.set(sx, sy, -1).normalize().transformDirection(camera.matrixWorld);
    const end = this.b.set(ex, ey, -1).normalize().transformDirection(camera.matrixWorld);
    const duration = rng.range(0.55, 1.0);
    const gain = rng.range(0.45, 0.85) + mode * rng.range(0.25, 0.9);
    const width = rb * rng.range(0.0035, 0.0055);

    const slot = this.next;
    this.next = (this.next + 1) % POOL;
    const t0 = this.uTime.value;
    for (let v = slot * 4; v < slot * 4 + 4; v++) {
      this.start.setXYZ(v, start.x, start.y, start.z);
      this.end.setXYZ(v, end.x, end.y, end.z);
      this.life.setXYZW(v, t0, duration, gain, width);
    }
    this.start.needsUpdate = true;
    this.end.needsUpdate = true;
    this.life.needsUpdate = true;
    this.until[slot] = t0 + duration;
    this.mesh.visible = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
