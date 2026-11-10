/**
 * Shooting-star tails: tapering ribbons that follow a bezier path into a cell.
 *
 * Instanced, one draw call for every star in flight. The head position uses
 * the same path, clock and ease as the particle pool's P_HEAD sprite, so the
 * bright head always sits exactly on the ribbon's leading end. After impact
 * the tail keeps arriving for a moment instead of vanishing.
 */
import * as THREE from 'three';
import type { Stage } from '../stage';
import { additive, VFX_RENDER_ORDER } from './common';

/** Ease power of the fall: slightly accelerating. Shared with the head sprite. */
export const STREAK_EASE = 1.4;
/** Extra time, as a fraction of the flight, the tail takes to pour into the impact point. */
export const STREAK_SETTLE = 0.32;

const MAX_STREAKS = 40;
const SEGMENTS = 18;
const STRIDE = 16;

const VERT = /* glsl */ `
attribute vec3 iP0;
attribute vec3 iP1;
attribute vec3 iP2;
attribute vec2 iT;
attribute vec4 iColor;
attribute float iSeed;
uniform float uTime;
uniform vec2 uView;
varying vec2 vUv;
varying vec3 vColor;
varying float vGain;

vec3 bez(float s) {
  float i = 1.0 - s;
  return iP0 * (i * i) + iP1 * (2.0 * i * s) + iP2 * (s * s);
}

void main() {
  float age = uTime - iT.x;
  float t = age / iT.y;
  if (age < 0.0 || t > 1.0 + ${STREAK_SETTLE.toFixed(2)}) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float u = position.x;
  float sHead = pow(min(t, 1.0), ${STREAK_EASE.toFixed(2)});
  float len = 0.3 * smoothstep(0.0, 0.3, t);
  float sTail = t <= 1.0 ? sHead - len : mix(1.0 - len, 1.0, (t - 1.0) / ${STREAK_SETTLE.toFixed(2)});
  float s = mix(sHead, max(sTail, 0.0), u);
  vec3 P = bez(s);
  vec3 tn = normalize(mix(iP1 - iP0, iP2 - iP1, s) + vec3(1e-5));
  vec3 side = normalize(cross(tn, normalize(cameraPosition - P)));
  vec4 mv = viewMatrix * vec4(P, 1.0);
  float px = projectionMatrix[1][1] * uView.y * 0.5 / max(0.1, -mv.z);
  float w = iColor.w * pow(1.0 - u, 0.7);
  float wMin = 1.3 / px;
  vGain = min(1.0, w / wMin + 0.2);
  P += side * position.y * max(w, wMin);
  vUv = vec2(u, position.y);
  vColor = iColor.rgb;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vGain;
void main() {
  float u = vUv.x;
  float v = vUv.y;
  float k = 1.0 - u;
  float body = exp(-v * v * 3.6) * k * k;
  float core = exp(-v * v * 30.0) * k * k * k;
  // White-hot where it meets the head, the gem's colour down the tail.
  vec3 col = vColor * body * 1.7 + mix(vec3(1.0), vColor, smoothstep(0.0, 0.5, u)) * core * 2.2;
  col *= vGain * smoothstep(1.0, 0.8, abs(v));
  gl_FragColor = vec4(col, 0.0);
}
`;

export class StarStreaks {
  readonly mesh: THREE.Mesh;
  private readonly data = new Float32Array(MAX_STREAKS * STRIDE);
  private readonly buffer: THREE.InstancedInterleavedBuffer;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly view = new THREE.Vector2(1, 1);
  private head = 0;
  private latestEnd = -1;

  constructor(private readonly stage: Stage) {
    for (let i = 0; i < MAX_STREAKS; i++) {
      this.data[i * STRIDE + 9] = -1e6;
      this.data[i * STRIDE + 10] = 1;
    }
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);

    const g = new THREE.InstancedBufferGeometry();
    const pos = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      // Denser near the head, where the ribbon bends and tapers fastest.
      const u = Math.pow(i / SEGMENTS, 1.4);
      pos.set([u, -1, 0, u, 1, 0], i * 6);
      if (i < SEGMENTS) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.setAttribute('iP0', new THREE.InterleavedBufferAttribute(this.buffer, 3, 0));
    g.setAttribute('iP1', new THREE.InterleavedBufferAttribute(this.buffer, 3, 3));
    g.setAttribute('iP2', new THREE.InterleavedBufferAttribute(this.buffer, 3, 6));
    g.setAttribute('iT', new THREE.InterleavedBufferAttribute(this.buffer, 2, 9));
    g.setAttribute('iColor', new THREE.InterleavedBufferAttribute(this.buffer, 4, 11));
    g.setAttribute('iSeed', new THREE.InterleavedBufferAttribute(this.buffer, 1, 15));
    g.instanceCount = MAX_STREAKS;
    this.geometry = g;

    this.material = additive({
      uniforms: { uTime: stage.uTime, uView: { value: this.view } },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = VFX_RENDER_ORDER + 1;
    this.mesh.visible = false;
  }

  launch(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    birth: number, duration: number,
    r: number, g: number, b: number,
    width: number, seed: number,
  ): void {
    const d = this.data;
    const o = this.head * STRIDE;
    this.head = (this.head + 1) % MAX_STREAKS;
    d[o] = x0; d[o + 1] = y0; d[o + 2] = z0;
    d[o + 3] = x1; d[o + 4] = y1; d[o + 5] = z1;
    d[o + 6] = x2; d[o + 7] = y2; d[o + 8] = z2;
    d[o + 9] = birth; d[o + 10] = duration;
    d[o + 11] = r; d[o + 12] = g; d[o + 13] = b; d[o + 14] = width;
    d[o + 15] = seed;
    // 640 floats: cheaper to resend whole than to track ranges.
    this.buffer.needsUpdate = true;
    this.latestEnd = Math.max(this.latestEnd, birth + duration * (1 + STREAK_SETTLE));
    this.mesh.visible = true;
  }

  update(): void {
    if (!this.mesh.visible) return;
    this.stage.renderer.getDrawingBufferSize(this.view);
    if (this.stage.uTime.value > this.latestEnd) this.mesh.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
