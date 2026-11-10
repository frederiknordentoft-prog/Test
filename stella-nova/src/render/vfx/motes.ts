/**
 * Ambient dust motes drifting through the star's light. A static point cloud:
 * every mote loops on the shared clock in the vertex shader and is lit by its
 * distance to the star, so the air above the instrument has depth for free.
 */
import * as THREE from 'three';
import { PALETTE, STAR_Y } from '../../core/config';
import type { Stage } from '../stage';
import { additive, light, VFX_RENDER_ORDER } from './common';

const COUNT = 220;

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uDensity;
uniform vec2 uView;
varying float vLit;
varying float vSeed;

void main() {
  if (aSeed.x >= uDensity) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  // Each mote lives one slow loop, fading in and out so the wrap is never seen.
  float period = mix(9.0, 19.0, aSeed.y);
  float ph = fract(uTime / period + aSeed.z);
  float da = aSeed.w * 6.2831;
  vec3 P = position;
  P += vec3(cos(da), 0.35, sin(da)) * (ph - 0.5) * 1.3;
  P.x += sin(uTime * 0.31 + aSeed.w * 40.0) * 0.12;
  P.y += sin(uTime * 0.23 + aSeed.z * 31.0) * 0.1;
  P.z += cos(uTime * 0.27 + aSeed.y * 23.0) * 0.12;

  vec3 d = P - vec3(0.0, ${STAR_Y.toFixed(3)}, 0.0);
  float lit = 1.0 / (1.0 + dot(d, d) * 0.16);
  float loop = smoothstep(0.0, 0.18, ph) * smoothstep(1.0, 0.82, ph);
  // A slow turn in the light: most motes are dim, a few catch it.
  float turn = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (0.6 + aSeed.y) + aSeed.x * 70.0), 3.0);
  vLit = (0.12 + 0.88 * lit) * loop * turn;
  vSeed = aSeed.w;

  vec4 mv = viewMatrix * vec4(P, 1.0);
  float px = projectionMatrix[1][1] * uView.y * 0.5 / max(0.1, -mv.z);
  float s = mix(0.035, 0.085, aSeed.z * aSeed.z) * px;
  vLit *= clamp(s / 2.0, 0.35, 1.0);
  gl_PointSize = clamp(s * 2.0, 2.0, 22.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vLit;
varying float vSeed;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  float I = exp(-d2 * 3.2) * 0.55 + exp(-d2 * 14.0) * 0.6;
  I *= smoothstep(1.0, 0.6, sqrt(d2));
  gl_FragColor = vec4(mix(uColor, vec3(1.0), vSeed * 0.5) * I * vLit, 0.0);
}
`;

export class Motes {
  readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly density = { value: 0 };
  private readonly view = new THREE.Vector2(1, 1);

  constructor(private readonly stage: Stage) {
    const rng = stage.rng;
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++) {
      // A low dome over the instrument, denser toward the star where the light is.
      const r = Math.pow(rng.next(), 0.7) * 6.4;
      const a = rng.range(0, Math.PI * 2);
      pos[i * 3] = Math.sin(a) * r;
      pos[i * 3 + 1] = 0.45 + Math.pow(rng.next(), 1.4) * 3.4;
      pos[i * 3 + 2] = Math.cos(a) * r;
      // x is the density rank: ambient = 0.5 shows the motes ranked below 0.5.
      seed[i * 4] = (i + 0.5) / COUNT;
      seed[i * 4 + 1] = rng.next();
      seed[i * 4 + 2] = rng.next();
      seed[i * 4 + 3] = rng.next();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const c = light(PALETTE.starWarm, 0.9, 0.25);
    this.material = additive({
      uniforms: {
        uTime: stage.uTime,
        uDensity: this.density,
        uView: { value: this.view },
        uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = VFX_RENDER_ORDER;
    this.points.visible = false;
  }

  set amount(v: number) {
    const k = v < 0 ? 0 : v > 1 ? 1 : v;
    // Fewer, not fainter, when motion is reduced or the device is weak.
    const scale = (this.stage.reducedMotion ? 0.5 : 1) * (this.stage.quality === 'low' ? 0.6 : 1);
    this.density.value = k * scale;
    this.points.visible = k > 0.001;
  }

  update(): void {
    if (this.points.visible) this.stage.renderer.getDrawingBufferSize(this.view);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
