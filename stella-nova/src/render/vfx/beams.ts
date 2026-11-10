/**
 * Win beams and their ghost previews: light from the star out along a spoke.
 *
 * All beams share one instanced ribbon (one draw call). The ribbon is
 * billboarded around the beam axis, the grow-out runs on the shared clock in
 * the shader, and a handle only ever touches its own instance's intensity.
 */
import * as THREE from 'three';
import { anim } from '../../core/anim';
import { RING_RADII, STAR_Y, STEP_ANGLE } from '../../core/config';
import type { Stage } from '../stage';
import { additive, GLSL_NOISE, light, VFX_RENDER_ORDER } from './common';

export interface BeamHandle {
  /** 0..1 */
  intensity: number;
  fadeOut(seconds: number): Promise<void>;
  dispose(): void;
}

const MAX_BEAMS = 24;
const SEGMENTS = 44;
/** How far past the last cell centre the tip reaches. */
const OVERSHOOT = 0.6;

const VERT = /* glsl */ `
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
uniform float uTime;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vInfo;
varying float vHalf;
varying float vLen;

float beamY(float r) {
  // Leaves the star's centre and settles to run through the symbols.
  float cells = 0.34 - 0.04 * (r - 1.25);
  return mix(${STAR_Y.toFixed(3)}, cells, smoothstep(0.0, 1.15, r));
}

void main() {
  if (iB.w <= 0.0005) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float len = iA.y;
  float g = clamp((uTime - iA.z) / iA.w, 0.0, 1.0);
  g = 1.0 - pow(1.0 - g, 3.0);
  float r = position.x * len;
  float sa = sin(iA.x);
  float ca = cos(iA.x);
  vec3 P = vec3(sa * r, beamY(r), -ca * r);
  float dy = (beamY(r + 0.02) - beamY(r - 0.02)) / 0.04;
  vec3 tn = normalize(vec3(sa, dy, -ca));
  vec3 side = normalize(cross(tn, normalize(cameraPosition - P)));
  float hw = mix(0.52, 0.26, iC.x);
  P += side * position.y * hw;
  vUv = vec2(r, position.y);
  vColor = iB;
  vInfo = vec4(iC.x, iC.y, iC.z, g * len);
  vHalf = hw;
  vLen = len;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uCrowd;
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vInfo;
varying float vHalf;
varying float vLen;
${GLSL_NOISE}

const float RADII[4] = float[4](${RING_RADII.map((r) => r.toFixed(2)).join(', ')});

void main() {
  float r = vUv.x;
  float v = vUv.y;
  float ghost = vInfo.x;
  float seed = vInfo.y;
  float count = vInfo.z;
  float tipR = vInfo.w;
  float aw = fwidth(v);

  // Spear tip: the head of the beam narrows to a point as it grows out.
  float tipK = clamp((tipR - r) / 0.75, 0.0, 1.0);
  float tip = tipK * tipK * (3.0 - 2.0 * tipK);
  float av = abs(v) / mix(0.3, 1.0, tip);
  float rise = smoothstep(0.1, 0.75, r);

  vec3 tint = vColor.rgb;
  vec3 col;

  if (ghost > 0.5) {
    // "Would be": a hairline with slow beads, never hot enough to bloom.
    float line = exp(-pow(av / max(0.07, aw * 1.3), 2.0));
    float mist = exp(-pow(av / 0.5, 2.0)) * 0.1;
    float beads = 0.45 + 0.55 * smoothstep(-0.2, 0.9, sin(r * 10.0 - uTime * 2.4 + seed * 6.28));
    float pulse = 0.72 + 0.28 * sin(uTime * 2.7 + seed * 6.28);
    float nodes = 0.0;
    for (int i = 0; i < 4; i++) {
      if (float(i) < count - 0.5) {
        vec2 q = vec2(r - RADII[i], v * vHalf);
        nodes += exp(-dot(q, q) / 0.02);
      }
    }
    col = tint * ((line * beads + mist) * 0.85 + nodes * 0.6) * pulse * tip * rise;
  } else {
    // Energy racing outward: slow swells plus fast grain.
    float n1 = vnoise1(r * 2.6 - uTime * 8.5 + seed * 17.0);
    float n2 = vnoise1(r * 8.0 - uTime * 17.0 + seed * 31.0);
    float energy = 0.72 + 0.4 * n1 + 0.22 * n2;
    float surge = pow(n1, 5.0) * 1.1;
    float flick = 0.93 + 0.07 * sin(uTime * 47.0 + seed * 20.0) * sin(uTime * 19.3 + seed * 5.0);

    float wCore = max(0.055, aw * 1.25);
    // Keep the energy when the core is thinner than a pixel can show.
    float thin = min(1.0, 0.055 / wCore + 0.3);
    float core = exp(-pow(av / wCore, 2.0)) * thin;
    float sheath = exp(-pow(av / 0.23, 2.0));
    float fil = 0.5 + 1.0 * vnoise2(vec2(r * 2.2 - uTime * 6.0, v * 2.6 + seed * 9.0));
    float halo = exp(-pow(av / 0.5, 2.0)) * fil;

    float flare = 0.0;
    float spark = 0.0;
    for (int i = 0; i < 4; i++) {
      if (float(i) < count - 0.5) {
        vec2 q = vec2(r - RADII[i], v * vHalf);
        float d2 = dot(q, q);
        flare += exp(-d2 / 0.06);
        spark += exp(-d2 / 0.007);
      }
    }
    // The halo is held back near the hub so eight beams stay a star burst.
    float open = smoothstep(0.35, 1.5, r);
    col = vec3(1.0) * (core * (1.3 + surge) * energy + spark * 0.7) * mix(1.0, uCrowd, 0.5)
        + tint * (sheath * 0.9 * energy + halo * 0.16 * open * uCrowd + flare * 0.5 * uCrowd);
    col *= tip * rise * flick;
    // A brighter bead rides the tip while the beam is still growing.
    vec2 th = vec2(r - (tipR - 0.4), v * vHalf);
    float growing = 1.0 - smoothstep(vLen * 0.8, vLen * 0.995, tipR);
    col += mix(vec3(1.0), tint, 0.5) * exp(-dot(th, th) / 0.02) * 1.5 * growing;
  }
  col *= vColor.a;
  col *= smoothstep(1.0, 0.8, abs(v));
  gl_FragColor = vec4(col, 0.0);
}
`;

class Beam implements BeamHandle {
  alive = true;
  private level = 1;
  private fade = 1;
  constructor(private readonly field: BeamField, readonly slot: number, private readonly gain: number) {
    this.push();
  }
  get intensity(): number {
    return this.level;
  }
  set intensity(v: number) {
    this.level = v < 0 ? 0 : v > 1 ? 1 : v;
    this.push();
  }
  private push(): void {
    // A live beam never writes exactly 0: that value marks a free slot.
    if (this.alive) this.field.write(this.slot, Math.max(0.001, this.level * this.fade * this.gain));
  }
  fadeOut(seconds: number): Promise<void> {
    if (!this.alive) return Promise.resolve();
    const from = this.fade;
    return anim
      .tween({
        duration: Math.max(0, seconds),
        onUpdate: (k) => {
          this.fade = from * (1 - k);
          this.push();
        },
      })
      .then(() => this.dispose());
  }
  dispose(): void {
    if (!this.alive) return;
    this.alive = false;
    this.field.release(this);
  }
}

export class BeamField {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly a: THREE.InstancedBufferAttribute;
  private readonly b: THREE.InstancedBufferAttribute;
  private readonly c: THREE.InstancedBufferAttribute;
  private readonly slots: (Beam | null)[] = new Array(MAX_BEAMS).fill(null);
  private readonly crowd = { value: 1 };
  private live = 0;
  private solid = 0;

  constructor(private readonly stage: Stage) {
    const g = new THREE.InstancedBufferGeometry();
    const pos = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      pos.set([u, -1, 0, u, 1, 0], i * 6);
      if (i < SEGMENTS) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BEAMS * 4), 4);
    this.b = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BEAMS * 4), 4);
    this.c = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BEAMS * 4), 4);
    this.a.setUsage(THREE.DynamicDrawUsage);
    this.b.setUsage(THREE.DynamicDrawUsage);
    this.c.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.a);
    g.setAttribute('iB', this.b);
    g.setAttribute('iC', this.c);
    g.instanceCount = MAX_BEAMS;
    this.geometry = g;

    this.material = additive({
      uniforms: { uTime: stage.uTime, uCrowd: this.crowd },
      vertexShader: VERT,
      fragmentShader: FRAG,
      // Light passes through the gems instead of being cut by them.
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = VFX_RENDER_ORDER + 1;
    this.mesh.visible = false;
  }

  create(spoke: number, count: 3 | 4, color: THREE.ColorRepresentation, ghost: boolean): BeamHandle {
    let slot = this.slots.indexOf(null);
    if (slot < 0) {
      // Out of slots: recycle the oldest ghost, else slot 0.
      slot = Math.max(0, this.slots.findIndex((s) => s && this.c.array[s.slot * 4] > 0.5));
      this.slots[slot]?.dispose();
    }
    const rng = this.stage.rng;
    const o = slot * 4;
    const speed = anim.speed > 0 ? anim.speed : 1;
    this.a.array[o] = spoke * STEP_ANGLE;
    this.a.array[o + 1] = RING_RADII[count - 1] + OVERSHOOT;
    this.a.array[o + 2] = this.stage.uTime.value;
    this.a.array[o + 3] = (ghost ? 0.28 : 0.18) / speed;
    const c = light(color, 1, ghost ? 0.1 : 0.02);
    this.b.array[o] = c.r;
    this.b.array[o + 1] = c.g;
    this.b.array[o + 2] = c.b;
    this.c.array[o] = ghost ? 1 : 0;
    this.c.array[o + 1] = rng.next();
    this.c.array[o + 2] = count;
    this.a.needsUpdate = true;
    this.c.needsUpdate = true;
    const beam = new Beam(this, slot, 1);
    this.slots[slot] = beam;
    this.live++;
    if (!ghost) this.solid++;
    this.refresh();
    return beam;
  }

  write(slot: number, value: number): void {
    this.b.array[slot * 4 + 3] = value;
    this.b.needsUpdate = true;
  }

  release(beam: Beam): void {
    if (this.slots[beam.slot] !== beam) return;
    this.slots[beam.slot] = null;
    this.live--;
    if (this.c.array[beam.slot * 4] < 0.5) this.solid--;
    this.write(beam.slot, 0);
    this.refresh();
  }

  private refresh(): void {
    this.mesh.visible = this.live > 0;
    // Each extra beam gives up a little halo, so a full fan does not wash the board out.
    this.crowd.value = 1 / (1 + 0.1 * Math.max(0, this.solid - 1));
  }

  dispose(): void {
    for (const s of this.slots) s?.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
