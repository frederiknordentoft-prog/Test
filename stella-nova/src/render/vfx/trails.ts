/**
 * The whirl: star-trail arcs behind a spinning ring's symbols.
 *
 * One flat annulus per ring. The fragment shader works in polar coordinates:
 * every pixel knows which symbol is ahead of it and how far behind it sits,
 * so eight tapering arcs and a scatter of hairline "long exposure" trails
 * cost no geometry and no per-frame uploads beyond a few uniforms.
 */
import * as THREE from 'three';
import { cellY, RING_RADII, RINGS, SPOKES } from '../../core/config';
import type { Stage } from '../stage';
import { additive, GLSL_NOISE, light, VFX_RENDER_ORDER } from './common';

const HALF_BAND = 0.44;
const ARC_SEGMENTS = 144;

const VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uAngle;
uniform float uSpeed;
uniform float uDir;
uniform float uRadius;
uniform float uSeed;
uniform float uTime;
uniform vec3 uColors[8];
varying vec2 vP;
${GLSL_NOISE}

const float STEP = 0.78539816339;
/** Longest arc, as a fraction of the gap between two symbols (40 of 45 degrees). */
const float MAX_ARC = 0.8889;

// Distance behind the nearest symbol ahead (0 at the symbol, 1 one socket back) and that symbol's index.
vec2 behind(float u) {
  float lead = uDir > 0.0 ? ceil(u) : floor(u);
  return vec2(abs(lead - u), mod(lead, 8.0));
}

void main() {
  float r = length(vP);
  float dr = r - uRadius;
  float aw = fwidth(r);
  float u = (atan(vP.x, -vP.y) - uAngle) / STEP;
  float L = max(uSpeed, 0.02) * MAX_ARC;
  vec3 col = vec3(0.0);

  // The symbol's own arc: fat and hot at the head, a thread at the tail.
  vec2 m = behind(u);
  float s = m.x / L;
  if (s < 1.0) {
    float k = 1.0 - s;
    float head = smoothstep(0.0, 0.035, m.x);
    float w = mix(0.03, 0.13, k * k);
    float prof = exp(-pow(dr / w, 2.0));
    float shimmer = 0.85 + 0.3 * vnoise1(m.x * 40.0 + m.y * 9.0 + uTime * 3.0);
    vec3 tint = uColors[int(m.y)];
    col += tint * prof * k * k * 1.35 * shimmer * head;
    col += mix(tint, vec3(1.0), 0.6) * exp(-pow(dr / (w * 0.3), 2.0)) * pow(max(0.0, 1.0 - s * 1.8), 2.0) * 0.9 * head;
  }

  // Hairlines: fainter companions at other radii, each its own length, so the
  // band reads like a long exposure of a star field.
  float wl = max(0.011, aw * 1.05);
  float thin = min(1.0, 0.011 / wl + 0.4);
  for (int j = 0; j < 6; j++) {
    float fj = float(j);
    float off = (hash11(fj * 7.31 + uSeed) - 0.5) * 0.74;
    vec2 h = behind(u - hash11(fj * 3.17 + uSeed + 5.0));
    float b = 0.3 + 0.7 * hash11(fj * 13.1 + h.y * 5.7 + uSeed);
    float sj = h.x / (L * (0.55 + 0.45 * b));
    float kj = max(0.0, 1.0 - sj);
    float prof = exp(-pow((dr - off) / wl, 2.0)) * thin;
    col += mix(uColors[int(h.y)], vec3(1.0), 0.3) * prof * kj * kj * b * 1.3 * smoothstep(0.0, 0.03, h.x);
  }

  col *= smoothstep(0.0, 0.14, uSpeed);
  gl_FragColor = vec4(col, 0.0);
}
`;

interface TrailUniforms {
  [key: string]: THREE.IUniform;
  uAngle: { value: number };
  uSpeed: { value: number };
  uDir: { value: number };
  uRadius: { value: number };
  uSeed: { value: number };
  uTime: { value: number };
  uColors: { value: THREE.Vector3[] };
}

export class RingTrails {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly uniforms: TrailUniforms[] = [];

  constructor(stage: Stage) {
    for (let ring = 0; ring < RINGS; ring++) {
      const radius = RING_RADII[ring];
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array((ARC_SEGMENTS + 1) * 2 * 3);
      const idx: number[] = [];
      for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const a = (i / ARC_SEGMENTS) * Math.PI * 2;
        const sx = Math.sin(a);
        const cz = -Math.cos(a);
        pos.set([sx * (radius - HALF_BAND), 0, cz * (radius - HALF_BAND), sx * (radius + HALF_BAND), 0, cz * (radius + HALF_BAND)], i * 6);
        if (i < ARC_SEGMENTS) {
          const k = i * 2;
          idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(idx);

      const uniforms: TrailUniforms = {
        uAngle: { value: 0 },
        uSpeed: { value: 0 },
        uDir: { value: 1 },
        uRadius: { value: radius },
        uSeed: { value: ring * 17.7 + 3.1 },
        uTime: stage.uTime,
        uColors: { value: Array.from({ length: SPOKES }, () => new THREE.Vector3(1, 1, 1)) },
      };
      const mesh = new THREE.Mesh(g, additive({ uniforms, vertexShader: VERT, fragmentShader: FRAG }));
      mesh.position.y = cellY(ring);
      mesh.frustumCulled = false;
      mesh.renderOrder = VFX_RENDER_ORDER;
      mesh.visible = false;
      this.meshes.push(mesh);
      this.uniforms.push(uniforms);
      this.group.add(mesh);
    }
  }

  set(ring: number, speed01: number, colors: THREE.ColorRepresentation[], angle: number, dir: 1 | -1): void {
    const mesh = this.meshes[ring];
    if (!mesh) return;
    const speed = speed01 < 0 ? 0 : speed01 > 1 ? 1 : speed01;
    if (speed <= 0.001) {
      mesh.visible = false;
      return;
    }
    const u = this.uniforms[ring];
    mesh.visible = true;
    u.uSpeed.value = speed;
    u.uDir.value = dir;
    // Wrapped so atan() - angle keeps full float precision however long the ring has spun.
    u.uAngle.value = angle - Math.PI * 2 * Math.floor(angle / (Math.PI * 2));
    const out = u.uColors.value;
    for (let i = 0; i < SPOKES; i++) {
      const c = light(colors[i] ?? 0xffffff, 1, 0.08);
      out[i].set(c.r, c.g, c.b);
    }
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
