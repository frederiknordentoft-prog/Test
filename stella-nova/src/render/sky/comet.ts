/**
 * The great comet of Kometnat (Tycho measured the one of 1577).
 *
 * It is composed for the frame, not for the sky: the head hangs beside the
 * instrument and the tail sweeps around it like a wreath, on the side of the
 * screen that has room (left on a wide screen, above on a tall one). To still
 * behave like something far away, its position is a world direction that only
 * drifts lazily toward that composed spot: shakes, dollies and the idle sway
 * move the camera across it, a resize lets it glide to its new place.
 */
import * as THREE from 'three';
import { FIT_RADIUS, PALETTE } from '../../core/config';
import { FAR_Z_GLSL, ORDER } from './shared';
import { displayColor, emissive } from './tone';

/** Local frame: x runs along the tail (0 = nucleus, 1 = tip), y across it, in tail lengths. */
const BEND = 0.4;
const WIDTH0 = 0.012;
const WIDTH1 = 0.165;
const ION_SLOPE = 0.11;

const VERT = /* glsl */ `
  uniform vec3 uHead;
  uniform vec2 uAxis;
  uniform float uLength;
  varying vec2 vP;

  void main() {
    vec3 hv = mat3(viewMatrix) * uHead;
    if (hv.z > -0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec2 head = hv.xy / -hv.z;
    vec2 across = vec2(-uAxis.y, uAxis.x);
    vec2 t = head + (uAxis * position.x + across * position.y) * uLength;
    vP = position.xy;
    gl_Position = projectionMatrix * vec4(t, -1.0, 1.0);
    ${FAR_Z_GLSL}
  }
`;

const FRAG = /* glsl */ `
  uniform float uPresence;
  uniform float uStream;
  uniform vec3 uCore;
  uniform vec3 uIce;
  uniform vec3 uViolet;
  uniform vec3 uRose;
  varying vec2 vP;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float u = vP.x;
    float us = max(u, 0.0);
    float r = length(vP);

    // The tail unfurls from the nucleus as the night arrives.
    float reach = uPresence * 1.2;
    float grown = 1.0 - smoothstep(reach - 0.3, reach, us);

    // Dust tail: curls toward the instrument, fans out, crisp on its leading
    // edge and feathered on the inside.
    float w = ${WIDTH0.toFixed(4)} + ${WIDTH1.toFixed(4)} * pow(us, 0.85);
    float d = (vP.y + ${BEND.toFixed(3)} * us * us) / w;
    float profile = exp(-d * d * (d > 0.0 ? 3.4 : 1.15));
    float along = pow(max(0.0, 1.0 - us), 1.5) * smoothstep(-0.015, 0.05, u);
    // Striae: streaks that fan out with the tail and stream slowly down it.
    float striae = 0.6 * vnoise(vec2(d * 4.5 + 3.0, us * 1.6 - uStream))
                 + 0.4 * vnoise(vec2(d * 12.0 - 7.0, us * 4.5 - uStream * 1.7));
    float dust = profile * along * (0.35 + 1.05 * striae) * grown;

    // Ion tail: thin, straight, leaning away from the dust.
    float wi = 0.005 + 0.024 * us;
    float di = (vP.y - ${ION_SLOPE.toFixed(3)} * us) / wi;
    float ion = exp(-di * di) * pow(max(0.0, 1.0 - us), 2.2) * smoothstep(0.0, 0.04, u)
              * (0.65 + 0.35 * vnoise(vec2(us * 14.0 - uStream * 3.0, 1.5))) * grown;

    // Coma and nucleus. Only the nucleus is allowed above 1.0, so only it blooms.
    float coma = 0.50 * exp(-r / 0.036) + 0.22 * exp(-r * r / (2.0 * 0.07 * 0.07));
    float nucleus = exp(-r * r / (2.0 * 0.0075 * 0.0075));

    vec3 dustCol = mix(uCore, uIce, smoothstep(0.0, 0.22, us));
    dustCol = mix(dustCol, mix(uViolet, uRose, 0.5 + 0.5 * sin(d * 1.3)), smoothstep(0.30, 0.95, us) * 0.8);
    vec3 col = dustCol * dust * 0.62
             + uIce * ion * 0.55
             + mix(uIce, uCore, 0.35) * coma
             + uCore * nucleus * 3.6;

    gl_FragColor = vec4(col * uPresence, 1.0);
  }
`;

/** A strip that hugs the tail instead of a quad around it: about a third of the fill. */
function buildGeometry(): THREE.BufferGeometry {
  const segments = 28;
  const pos = new Float32Array((segments + 1) * 2 * 3);
  const index: number[] = [];
  const headRadius = 0.2;
  for (let i = 0; i <= segments; i++) {
    const u = -headRadius + (i / segments) * (1.04 + headRadius);
    const us = Math.max(u, 0);
    const w = WIDTH0 + WIDTH1 * Math.pow(us, 0.85);
    const centre = -BEND * us * us;
    // Room for the coma around the nucleus, tapering away along the tail.
    const coma = Math.abs(u) < headRadius ? Math.sqrt(headRadius * headRadius - u * u) : 0;
    const outer = Math.max(centre + 1.35 * w, ION_SLOPE * us + 2.4 * (0.005 + 0.024 * us), coma);
    const inner = Math.min(centre - 2.15 * w, -coma);
    pos.set([u, outer, 0, u, inner, 0], i * 6);
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

const DEG = Math.PI / 180;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class SkyComet {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uHead: { value: new THREE.Vector3(0, -1, 0) },
    uAxis: { value: new THREE.Vector2(1, 0) },
    uLength: { value: 0.4 },
    uPresence: { value: 0 },
    uStream: { value: 0 },
    uCore: { value: emissive(PALETTE.starCore) },
    uIce: { value: emissive(PALETTE.comet) },
    uViolet: { value: displayColor(PALETTE.nebulaViolet, 1.6) },
    uRose: { value: displayColor(PALETTE.nebulaRose, 1.3) },
  };
  private anchored = false;
  private stream = 0;
  private readonly v = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  constructor() {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(buildGeometry(), material);
    this.mesh.name = 'sky.comet';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = ORDER.comet;
    this.mesh.visible = false;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, mode: number, reducedMotion: boolean): void {
    const u = this.uniforms;
    u.uPresence.value = smooth(0.05, 1, mode);
    this.mesh.visible = mode > 0.05;
    this.stream = (this.stream + dt * (reducedMotion ? 0.03 : 0.085)) % 512;
    u.uStream.value = this.stream;

    // The frame and the instrument in tangent-plane units (view x/y at depth 1).
    const pe = camera.projectionMatrix.elements;
    const v = this.v.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(0.001, -v.z);
    const cx = v.x / depth;
    const cy = v.y / depth;
    const rb = FIT_RADIUS / depth;
    const left = (-1 + pe[8]) / pe[0];
    const top = (1 + pe[9]) / pe[5];

    // Wide screen: the head hangs lower left, the tail climbs the left edge.
    // Tall screen: the head hangs upper left, the tail arcs across the top.
    const wide = smooth(0.85, 1.35, pe[5] / pe[0]);
    const azimuth = (122 + (203 - 122) * wide) * DEG;
    const room = wide * (cx - left) + (1 - wide) * (top - cy);
    const orbit = Math.min(1.45 * rb, Math.max(1.12 * rb, (rb + room) * 0.5));
    u.uLength.value = rb * 1.5;

    const target = this.target.set(cx + Math.cos(azimuth) * orbit, cy + Math.sin(azimuth) * orbit, -1).normalize().transformDirection(camera.matrixWorld);
    const head = u.uHead.value;
    if (!this.anchored || !this.mesh.visible) {
      head.copy(target);
      this.anchored = true;
    } else {
      // Lazy once it is there: a 5 s half-life is far slower than any camera move.
      // While it is still fading in it settles quickly instead, so it never
      // appears wherever a passing camera move (a pull-out, a push-in) put it.
      const p = u.uPresence.value;
      head.lerp(target, 1 - Math.pow(0.5, dt / (0.15 + 4.85 * p * p * p))).normalize();
    }

    // The tail leaves the head clockwise around the instrument, leaning a
    // little outward. Derived from where the head is on screen right now, so
    // it keeps wrapping the board while the camera moves.
    v.copy(head).transformDirection(camera.matrixWorldInverse);
    const vz = Math.min(-0.05, v.z);
    let rx = v.x / -vz - cx;
    let ry = v.y / -vz - cy;
    const rl = Math.hypot(rx, ry) || 1;
    rx /= rl;
    ry /= rl;
    const lean = 13 * DEG;
    u.uAxis.value.set(ry * Math.cos(lean) + rx * Math.sin(lean), -rx * Math.cos(lean) + ry * Math.sin(lean)).normalize();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
