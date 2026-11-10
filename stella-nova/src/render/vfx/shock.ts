/**
 * The nova's shockwave: a ring of light racing across the instrument in world
 * space, paired with the final pass's screen-space refraction so the picture
 * itself bends where the front passes.
 */
import * as THREE from 'three';
import { anim } from '../../core/anim';
import { PALETTE } from '../../core/config';
import type { Stage } from '../stage';
import { additive, GLSL_NOISE, light, VFX_RENDER_ORDER } from './common';

export interface ShockOptions {
  duration?: number;
  maxRadius?: number;
  color?: THREE.ColorRepresentation;
}

const VERT = /* glsl */ `
uniform float uExtent;
varying vec2 vP;
void main() {
  vP = position.xz * uExtent;
  vec4 world = modelMatrix * vec4(position.x * uExtent, 0.0, position.z * uExtent, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
uniform float uRadius;
uniform float uWidth;
uniform float uGain;
uniform float uTime;
uniform float uSeed;
uniform vec3 uColor;
varying vec2 vP;
${GLSL_NOISE}

// A wave front: razor edge outside, long glowing wake inside.
float front(float x, float w) {
  return x > 0.0 ? exp(-pow(x / (w * 0.22), 2.0)) : exp(-pow(x / (w * 1.25), 2.0));
}

void main() {
  float r = length(vP);
  float a = atan(vP.y, vP.x);
  float x = r - uRadius;
  // Torn, not drawn with a compass: the front is brighter in streaks.
  float n = vnoise2(vec2(a * 9.0 + uSeed, r * 0.7 - uTime * 1.5));
  float n2 = vnoise2(vec2(a * 31.0 - uSeed, r * 2.0 - uTime * 4.0));
  float torn = 0.55 + 0.6 * n + 0.35 * n2;

  float band = front(x, uWidth);
  float core = exp(-pow(x / (uWidth * 0.11), 2.0));
  float echo = front(r - uRadius * 0.74, uWidth * 0.7) * 0.28;
  // Rays combed outward in the wake.
  float rays = pow(vnoise1(a * 26.0 + uSeed * 3.0), 3.0) * exp(-pow(min(x, 0.0) / (uWidth * 3.2), 2.0)) * step(x, 0.0) * 0.4;

  // Only the hairline core is hot enough to bloom; the wake stays a coloured wash the board reads through.
  vec3 col = uColor * (band * 0.8 * torn + echo * torn + rays) + vec3(1.0, 0.97, 0.9) * core * 1.9 * (0.75 + 0.5 * n2);
  gl_FragColor = vec4(col * uGain, 0.0);
}
`;

export class ShockRing {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms = {
    uRadius: { value: 0 },
    uWidth: { value: 0.5 },
    uGain: { value: 0 },
    uExtent: { value: 1 },
    uSeed: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: new THREE.Vector3(1, 1, 1) },
  };
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private running = 0;

  constructor(private readonly stage: Stage) {
    this.uniforms.uTime = stage.uTime;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    this.material = additive({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      // The wave washes over the symbols rather than being cut by them.
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = VFX_RENDER_ORDER + 3;
    this.mesh.visible = false;
  }

  /** World radius → the final pass's units (fractions of the screen height), as seen from the camera now. */
  private screenRadius(center: THREE.Vector3, radius: number): number {
    const cam = this.stage.camera;
    const a = this.a.copy(center).project(cam);
    const b = this.b.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(radius).add(center).project(cam);
    const dx = (b.x - a.x) * 0.5 * cam.aspect;
    const dy = (b.y - a.y) * 0.5;
    // The ring is a slightly squashed ellipse on screen; 0.94 splits the difference.
    return Math.sqrt(dx * dx + dy * dy) * 0.94;
  }

  fire(center: THREE.Vector3, opts: ShockOptions = {}): Promise<void> {
    const stage = this.stage;
    const duration = opts.duration ?? 1.1;
    const maxRadius = opts.maxRadius ?? 13;
    const u = this.uniforms;
    const c = light(opts.color ?? PALETTE.starWarm, 1, 0.1);
    u.uColor.value.set(c.r, c.g, c.b);
    u.uSeed.value = stage.rng.range(0, 40);
    u.uExtent.value = maxRadius * 1.25;
    this.mesh.position.copy(center);
    this.mesh.visible = true;
    const refract = !stage.reducedMotion;
    const fx = stage.fx;
    if (refract) fx.shockCenter.copy(center);
    const token = ++this.running;

    return anim.tween({
      duration,
      onUpdate: (_k, t) => {
        if (token !== this.running) return;
        // Explosive start, long glide: most of the board is crossed in the first third.
        const radius = maxRadius * (1 - Math.pow(1 - t, 2.4));
        const attack = Math.min(1, t / 0.05);
        u.uRadius.value = radius;
        u.uWidth.value = 0.35 + 1.5 * t;
        u.uGain.value = attack * Math.pow(1 - t, 1.25) * (stage.reducedMotion ? 0.7 : 1);
        if (refract) {
          fx.shockRadius = this.screenRadius(center, radius);
          fx.shockWidth = 0.03 + 0.075 * t;
          fx.shockStrength = 0.05 * attack * Math.pow(1 - t, 1.5);
        }
      },
      onComplete: () => {
        if (token !== this.running) return;
        this.mesh.visible = false;
        u.uGain.value = 0;
        // Unconditional: whatever happened to the motion setting mid-flight, the picture ends unbent.
        fx.shockStrength = 0;
        fx.shockRadius = 0;
      },
    });
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
