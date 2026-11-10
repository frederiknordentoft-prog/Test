/**
 * The great comet of the Kometnat: one mesh, four parts, all placed in the
 * vertex shader from a bezier path and the head's parameter on it.
 *
 *   dust tail  broad and warm, lags along the orbit and fans out
 *   ion tail   thin, cyan and dead straight behind the motion
 *   head       white nucleus, cyan coma, diffraction spikes
 *   pool       the light it throws on the instrument as it passes over
 *
 * The path is solved from the camera, so the comet crosses the whole frame
 * whatever the aspect ratio.
 */
import * as THREE from 'three';
import { anim } from '../../core/anim';
import { PALETTE } from '../../core/config';
import type { Stage } from '../stage';
import { additive, GLSL_NOISE, light, VFX_RENDER_ORDER } from './common';

const DUST_SEGMENTS = 56;
const ION_SEGMENTS = 28;
/** Height of the comet's track above the board. */
const TRACK_Y = 2.7;

const VERT = /* glsl */ `
attribute vec3 aInfo;
uniform vec3 uP0;
uniform vec3 uP1;
uniform vec3 uP2;
uniform float uS;
varying vec3 vInfo;

vec3 bez(float s) {
  float i = 1.0 - s;
  return uP0 * (i * i) + uP1 * (2.0 * i * s) + uP2 * (s * s);
}
vec3 bezTan(float s) {
  return normalize(mix(uP1 - uP0, uP2 - uP1, s));
}

void main() {
  float u = aInfo.x;
  float v = aInfo.y;
  float part = aInfo.z;
  vec3 head = bez(uS);
  vec3 tanH = bezTan(uS);
  vInfo = aInfo;
  vec3 P;
  if (part < 0.5) {
    float s = uS - u * 0.58;
    P = bez(s);
    vec3 side = normalize(cross(bezTan(s), normalize(cameraPosition - P)));
    // Dust drifts off the orbit, so the two tails part company.
    P += side * (u * u * 2.6 + v * (0.1 + 1.45 * pow(u, 0.85)));
  } else if (part < 1.5) {
    P = head - tanH * (u * 14.0);
    vec3 side = normalize(cross(tanH, normalize(cameraPosition - P)));
    P += side * v * (0.07 + 0.5 * u);
  } else if (part < 2.5) {
    vec4 mv = viewMatrix * vec4(head, 1.0);
    mv.xy += vec2(u, v) * 2.8;
    gl_Position = projectionMatrix * mv;
    return;
  } else {
    P = vec3(head.x + u * 4.6, 0.34, head.z + v * 4.6);
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uGain;
uniform vec3 uColor;
uniform vec3 uDust;
varying vec3 vInfo;
${GLSL_NOISE}

void main() {
  float u = vInfo.x;
  float v = vInfo.y;
  float part = vInfo.z;
  vec3 col;
  if (part < 0.5) {
    float k = 1.0 - u;
    float prof = exp(-v * v * 2.8);
    // Striae: fine bands streaming back through the dust.
    float striae = 0.55 + 0.55 * vnoise2(vec2(u * 7.0 - uTime * 0.8, v * 7.0)) + 0.4 * vnoise2(vec2(u * 30.0 - uTime * 2.5, v * 2.5));
    float along = pow(k, 1.9) * smoothstep(0.0, 0.04, u);
    col = mix(uDust, uColor, smoothstep(0.05, 0.6, u)) * prof * along * striae * 1.5;
    col *= smoothstep(1.0, 0.7, abs(v));
  } else if (part < 1.5) {
    float k = 1.0 - u;
    float core = exp(-v * v * 26.0);
    float sheath = exp(-v * v * 3.2) * 0.3;
    float fil = 0.5 + 1.0 * vnoise2(vec2(v * 6.0, u * 6.0 - uTime * 3.5));
    col = uColor * (core * 2.6 + sheath * fil) * pow(k, 1.4) * (0.8 + 0.4 * fil);
    col *= smoothstep(1.0, 0.7, abs(v));
  } else if (part < 2.5) {
    float d2 = u * u + v * v;
    float nucleus = exp(-d2 * 520.0) * 14.0;
    float coma = exp(-d2 * 46.0) * 2.8;
    float halo = exp(-d2 * 5.5) * 0.36;
    float spikes = (exp(-abs(v) * 110.0 - abs(u) * 4.5) + exp(-abs(u) * 110.0 - abs(v) * 4.5)) * 1.5;
    col = vec3(1.0) * nucleus + uColor * (coma + halo) + mix(vec3(1.0), uColor, 0.45) * spikes;
    col *= smoothstep(1.0, 0.7, sqrt(d2));
  } else {
    float d2 = u * u + v * v;
    col = uColor * exp(-d2 * 3.4) * 0.2;
  }
  gl_FragColor = vec4(col * uGain, 0.0);
}
`;

export type GlitterFn = (x: number, y: number, z: number, tx: number, ty: number, tz: number, dt: number) => void;

export class Comet {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms = {
    uP0: { value: new THREE.Vector3() },
    uP1: { value: new THREE.Vector3() },
    uP2: { value: new THREE.Vector3() },
    uS: { value: 0 },
    uGain: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: new THREE.Vector3() },
    uDust: { value: new THREE.Vector3() },
  };
  private readonly ray = new THREE.Vector3();
  private readonly headPos = new THREE.Vector3();
  private readonly headTan = new THREE.Vector3();
  private running = 0;

  /** @param glitter called every frame of a pass with the head position, its direction and the step, to shed sparkle. */
  constructor(private readonly stage: Stage, private readonly glitter: GlitterFn) {
    this.uniforms.uTime = stage.uTime;
    let c = light(PALETTE.comet, 1, 0.04);
    this.uniforms.uColor.value.set(c.r, c.g, c.b);
    c = light(PALETTE.starCore, 1, 0);
    this.uniforms.uDust.value.set(c.r, c.g, c.b);

    const info: number[] = [];
    const idx: number[] = [];
    const strip = (part: number, segments: number) => {
      const base = info.length / 3;
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        info.push(u, -1, part, u, 1, part);
        if (i < segments) {
          const k = base + i * 2;
          idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
    };
    const quad = (part: number) => {
      const k = info.length / 3;
      info.push(-1, -1, part, 1, -1, part, 1, 1, part, -1, 1, part);
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    quad(3);
    strip(0, DUST_SEGMENTS);
    strip(1, ION_SEGMENTS);
    quad(2);
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(info);
    g.setAttribute('aInfo', new THREE.BufferAttribute(arr, 3));
    // three wants a position attribute to size draw ranges; the shader ignores it.
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.setIndex(idx);

    this.material = additive({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = VFX_RENDER_ORDER + 4;
    this.mesh.visible = false;
  }

  /** Where the view ray through an NDC point meets the comet's track plane. */
  private onTrack(nx: number, ny: number, out: THREE.Vector3): THREE.Vector3 {
    const cam = this.stage.camera;
    const dir = this.ray.set(nx, ny, 0.5).unproject(cam).sub(cam.position);
    // The camera always looks down on the board; the guard is for a degenerate rig only.
    const k = dir.y < -1e-4 ? (TRACK_Y - cam.position.y) / dir.y : 20;
    return out.copy(cam.position).addScaledVector(dir, k);
  }

  pass(duration: number): Promise<void> {
    const stage = this.stage;
    const u = this.uniforms;
    const rng = stage.rng;
    // Upper right to lower left, bowed upward, entering and leaving off-screen.
    const flip = rng.next() < 0.5 ? 1 : -1;
    this.onTrack(1.75 * flip, 0.98 + rng.range(-0.08, 0.08), u.uP0.value);
    this.onTrack(0.1 * flip, 0.72 + rng.range(-0.1, 0.1), u.uP1.value);
    this.onTrack(-1.85 * flip, -0.62 + rng.range(-0.12, 0.1), u.uP2.value);
    this.mesh.visible = true;
    const token = ++this.running;
    let last = 0;

    return anim.tween({
      duration,
      onUpdate: (_k, t) => {
        if (token !== this.running) return;
        // Starts before the path and ends past it so the tails clear the frame too.
        const s = -0.06 + t * 1.5;
        u.uS.value = s;
        u.uGain.value = Math.min(1, t / 0.06) * Math.min(1, (1 - t) / 0.08);
        if (s < 1.05) {
          const i = 1 - s;
          const p0 = u.uP0.value;
          const p1 = u.uP1.value;
          const p2 = u.uP2.value;
          this.headPos.set(
            p0.x * i * i + p1.x * 2 * i * s + p2.x * s * s,
            p0.y * i * i + p1.y * 2 * i * s + p2.y * s * s,
            p0.z * i * i + p1.z * 2 * i * s + p2.z * s * s,
          );
          this.headTan.set(
            (p1.x - p0.x) * i + (p2.x - p1.x) * s,
            (p1.y - p0.y) * i + (p2.y - p1.y) * s,
            (p1.z - p0.z) * i + (p2.z - p1.z) * s,
          ).normalize();
          this.glitter(this.headPos.x, this.headPos.y, this.headPos.z, this.headTan.x, this.headTan.y, this.headTan.z, (t - last) * duration);
        }
        last = t;
      },
      onComplete: () => {
        if (token !== this.running) return;
        this.mesh.visible = false;
        u.uGain.value = 0;
      },
    });
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
