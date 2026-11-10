/**
 * The central star: a turbulent shader sphere, an additive corona billboard
 * and a warm point light. charge sets its temper (amber ember → white-gold),
 * energy is a transient surge that decays here.
 */
import * as THREE from 'three';
import { PALETTE, STAR_RADIUS, STAR_Y } from '../../core/config';
import type { Stage } from '../stage';

/** Half extent of the corona quad in world units. */
const CORONA_HALF = 2.3;

const NOISE = /* glsl */ `
float h3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vn(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < OCTAVES; i++) {
    s += a * vn(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}`;

export class Star {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;
  /** World position of the star's centre (kept current by the orrery). */
  readonly position = new THREE.Vector3(0, STAR_Y, 0);
  charge = 0;
  energy = 0;

  private readonly uniforms = {
    uCharge: { value: 0 },
    uEnergy: { value: 0 },
    uFlow: { value: 0 },
    uRs: { value: STAR_RADIUS },
    uSize: { value: CORONA_HALF },
    uDeep: { value: new THREE.Color(0.85, 0.2, 0.025) },
    uHot: { value: new THREE.Color(PALETTE.starHot) },
    uWarm: { value: new THREE.Color(PALETTE.starWarm) },
    uCore: { value: new THREE.Color(PALETTE.starCore) },
  };
  private readonly body: THREE.Mesh;
  private readonly corona: THREE.Mesh;
  private readonly lightA = new THREE.Color(PALETTE.starWarm);
  private readonly lightB = new THREE.Color(PALETTE.starCore);
  private flow = 0;

  constructor(private readonly stage: Stage) {
    const low = stage.quality === 'low';
    this.group.position.set(0, STAR_Y, 0);

    this.body = new THREE.Mesh(
      new THREE.SphereGeometry(STAR_RADIUS, low ? 32 : 48, low ? 16 : 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        defines: { OCTAVES: low ? 3 : 4 },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          varying vec3 vNv;
          varying vec3 vVv;
          void main() {
            vDir = normalize(position);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNv = normalize(normalMatrix * normal);
            vVv = -mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uCharge, uEnergy, uFlow;
          uniform vec3 uDeep, uHot, uWarm, uCore;
          varying vec3 vDir;
          varying vec3 vNv;
          varying vec3 vVv;
          ${NOISE}
          void main() {
            vec3 p = normalize(vDir) * 2.3;
            float t = uFlow;
            vec3 w = vec3(fbm(p + vec3(0.0, t * 0.6, 0.0)), fbm(p + vec3(5.2, -t * 0.5, 1.3)), fbm(p + vec3(-3.1, 2.7, t * 0.55)));
            float n = fbm(p * 1.9 + (w - 0.5) * 2.4 + vec3(0.0, 0.0, t * 0.25));
            float cells = smoothstep(0.22, 0.72, n);
            float mu = clamp(dot(normalize(vNv), normalize(vVv)), 0.0, 1.0);
            float heat = cells * 0.72 + 0.08 + uCharge * 0.16 + uEnergy * 0.14 + mu * mu * (0.08 + 0.2 * uCharge);
            vec3 c = mix(uDeep, uHot, smoothstep(0.15, 0.5, heat));
            c = mix(c, uWarm, smoothstep(0.45, 0.8, heat));
            c = mix(c, uCore, smoothstep(0.8, 1.15, heat));
            // Limb: darker and warmer toward the edge, like a real photosphere.
            c *= mix(0.4, 1.0, pow(mu, 0.55));
            c = mix(c * vec3(1.0, 0.55, 0.25), c, smoothstep(0.0, 0.55, mu));
            gl_FragColor = vec4(c * (mix(1.15, 1.75, uCharge) + uEnergy * 1.4), 1.0);
          }`,
      }),
    );
    this.group.add(this.body);

    // Screen-aligned glow. No depth test: the tilted quad would otherwise cut into the rings.
    this.corona = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uSize;
          varying vec2 vP;
          void main() {
            vP = position.xy;
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * uSize;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uCharge, uEnergy, uFlow, uRs, uSize;
          uniform vec3 uHot, uCore;
          varying vec2 vP;
          void main() {
            float r = length(vP) * uSize;
            float a = atan(vP.y, vP.x);
            float d = max(r - uRs, 0.0);
            float k = clamp(uCharge + 0.5 * uEnergy, 0.0, 1.3);
            // Tight halo plus a faint wide veil. Kept short so ring 0 stays readable.
            float halo = exp(-d * mix(8.5, 5.5, uCharge)) * mix(0.2, 0.3, uCharge) + exp(-d * 2.4) * (0.012 + 0.03 * k);
            // The eight main rays point between the spokes, so they never lie across a symbol.
            float rays = pow(0.5 - 0.5 * cos(a * 8.0 + 0.2 * sin(uFlow * 0.7)), 12.0) * 0.8
              + pow(0.5 + 0.5 * sin(a * 13.0 - uFlow * 0.6 + 2.0 * sin(a * 3.0 + uFlow * 0.4)), 6.0) * 0.4;
            float ray = rays * exp(-d * mix(5.0, 2.6, k)) * mix(0.1, 0.2, uCharge);
            // Nothing is added over the disc itself: every unit above 1.0 there feeds the bloom and veils ring 0.
            float inner = smoothstep(uRs * 0.75, uRs * 1.05, r);
            float edge = 1.0 - smoothstep(0.7, 1.0, length(vP));
            vec3 col = mix(uHot, mix(uHot, uCore, 0.7), clamp(uCharge + 0.3 * uEnergy, 0.0, 1.0));
            gl_FragColor = vec4(col * (halo + ray) * (1.0 + 0.5 * uEnergy) * inner * edge, 1.0);
          }`,
      }),
    );
    this.corona.renderOrder = 10;
    this.corona.frustumCulled = false;
    this.group.add(this.corona);

    this.light = new THREE.PointLight(PALETTE.starWarm, 2, 9, 2);
    this.group.add(this.light);
  }

  update(dt: number): void {
    const rm = this.stage.reducedMotion;
    const c = Math.min(1, Math.max(0, this.charge));
    const e = Math.min(2, Math.max(0, this.energy));
    const u = this.uniforms;
    this.flow += dt * (0.22 + 0.75 * c + 0.5 * e) * (rm ? 0.3 : 1);
    const t = this.stage.time;
    const s = 1 + 0.16 * c + 0.06 * e + (rm ? 0 : Math.sin(t * 1.7) * 0.012);
    this.body.scale.setScalar(s);
    u.uCharge.value = c;
    u.uEnergy.value = e;
    u.uFlow.value = this.flow;
    u.uRs.value = STAR_RADIUS * s;
    this.light.intensity = 0.6 + 1.3 * c + 1.2 * e;
    this.light.color.lerpColors(this.lightA, this.lightB, Math.min(1, c * 0.8 + e * 0.2));

    // At full charge the star can barely hold itself: a fine tremor.
    const x = (c - 0.9) / 0.1;
    const k = rm || x <= 0 ? 0 : Math.min(1, x) * 0.011;
    this.group.position.set(
      Math.sin(t * 47.0) * Math.cos(t * 31.3) * k,
      STAR_Y + Math.sin(t * 53.1 + 1.7) * k * 0.6,
      Math.cos(t * 43.7) * Math.sin(t * 29.1) * k,
    );

    this.energy = e < 0.002 ? 0 : e * Math.exp(-dt * 2.4);
  }

  dispose(): void {
    for (const m of [this.body, this.corona]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.light.dispose();
  }
}
