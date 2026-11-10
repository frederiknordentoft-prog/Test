/**
 * The cut-stone shader. One program serves the four gems, the wild star and
 * the comet's nucleus; everything that differs is a uniform.
 *
 * What it fakes, per fragment, in the stone's own space:
 *  1. a mirror reflection of the studio off the flat facet (Fresnel);
 *  2. refraction into the stone, one or two bounces off a virtual pavilion
 *     (facets quantised by sector and tier, so each crown facet shows a mosaic
 *     of the lights above), once per colour channel for a little fire;
 *  3. absorption: the body colour deepens with the length of that path;
 *  4. a light at the heart of the stone, seen through the refracting facets;
 *  5. scintillation: whole facets flash as the reflection sweeps past a
 *     lattice of virtual pin lights that drifts slowly, so stones twinkle at
 *     rest and glitter when the ring or the camera moves.
 */
import * as THREE from 'three';
import type { Stage } from '../stage';
import { GLSL_HEAD, GLSL_NOISE, GLSL_STATE } from './glsl';

export interface GemLook {
  color: number;
  accent: number;
  /** Half extents of the girdle along x and z, for the virtual pavilion. */
  halfX: number;
  halfZ: number;
  centreZ?: number;
  girdleY: number;
  /** Depth of the virtual pavilion. Deeper = longer paths = darker, richer colour. */
  depth: number;
  ior: number;
  dispersion: number;
  /** Pavilion facets around the stone, the angular offset of the first, tiers from culet to girdle, and whether the outer tier splits in two. */
  sectors: number;
  phase: number;
  tiers: number;
  split: boolean;
  f0: number;
  /** 0 = clear crystal, 1 = the reflection takes the body colour (gold). */
  metal: number;
  /** Gain on the refracted studio. */
  interior: number;
  /** How fast colour deepens with path length. */
  density: number;
  /** Luminance of the inner light at the very heart, at rest. */
  core: number;
  coreRadius: number;
  /** White-hot spot on the surface at the centre (wild only). */
  hot: number;
  hotRadius: number;
  sparkle: number;
  edge: number;
}

const VERT = /* glsl */ `${GLSL_HEAD}
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
in vec3 position;
in vec3 normal;
in vec3 aEdge;
out vec3 vPosL;
out vec3 vNrmL;
out vec3 vViewL;
out vec3 vEdge;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 camL = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vPosL = position;
  vNrmL = normal;
  vViewL = camL - position;
  vEdge = aEdge;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `${GLSL_HEAD}
uniform samplerCube uEnv;
uniform mat4 modelMatrix;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uShape;   // halfX, halfZ, girdleY, pavilion depth
uniform vec4 uOptics;  // ior, dispersion, F0, metal
uniform vec4 uCut;     // sectors, phase, tiers, split
uniform vec4 uLight;   // core gain, core radius, hot gain, hot radius
uniform vec4 uGain;    // interior, density, sparkle, edge
uniform vec4 uState;   // glow, dim, sparkle clock, idle clock
uniform vec2 uSeed;    // per-instance random, centreZ
in vec3 vPosL;
in vec3 vNrmL;
in vec3 vViewL;
in vec3 vEdge;
out vec4 fragColor;

const float TAU = 6.28318530718;
${GLSL_NOISE}
${GLSL_STATE}

// Inward normal of the virtual pavilion facet under a point (q = xz in girdle units).
vec3 pavNormal(vec2 q) {
  float d = TAU / uCut.x;
  float phi = atan(q.y, q.x);
  float pq = (floor(phi / d + uCut.y) + 0.5 - uCut.y) * d;
  vec2 rd = vec2(cos(pq), sin(pq));
  float rho = clamp(dot(q, rd), 0.0, 0.999);
  if (uCut.w > 0.5 && rho > 0.6) {
    // Lower-girdle halves: the outer part of each main splits left and right.
    pq += sign(sin(phi - pq)) * d * 0.21;
    rd = vec2(cos(pq), sin(pq));
  }
  float tier = floor(rho * uCut.z) / max(uCut.z - 1.0, 1.0);
  float ta = tan(mix(0.6, 0.9, tier));
  vec2 k = min(uShape.x, uShape.y) / uShape.xy;
  return normalize(vec3(-rd.x * k.x * ta, 1.0, -rd.y * k.y * ta));
}

// Follow a refracted ray down to the pavilion and back. xyz = direction it leaves in, w = how much of it comes back up.
vec4 trace(vec3 P, vec3 T, vec3 N, out float path) {
  vec2 sc = uShape.xy;
  float depth = uShape.w;
  float down = max(-T.y, 0.25);
  vec2 q = P.xz / sc;
  float h = (P.y - uShape.z) + depth * (1.0 - min(length(q), 1.0));
  float t1 = h / down;
  vec3 P1 = P + T * t1;
  q = P1.xz / sc;
  h = (P1.y - uShape.z) + depth * (1.0 - min(length(q), 1.0));
  t1 = max(t1 + 0.7 * h / down, 0.0);
  P1 = P + T * t1;
  vec3 R = reflect(T, pavNormal(P1.xz / sc));
  path = t1;
  float back = 1.0;
  if (R.y < 0.35) {
    float span = 1.1 * min(sc.x, sc.y);
    vec3 n2 = pavNormal((P1 + R * span).xz / sc);
    if (dot(R, n2) < 0.0) R = reflect(R, n2);
    path += span + t1;
    back = smoothstep(-0.2, 0.3, R.y);
  } else {
    path += t1;
  }
  // Leaving through the crown bends the ray toward the facet it exits by.
  return vec4(normalize(R + N * 0.3 + vec3(0.0, 0.12, 0.0)), back);
}

void main() {
  vec3 N = normalize(vNrmL);
  vec3 V = normalize(vViewL);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  mat3 L2W = mat3(modelMatrix);
  float glow = uState.x;
  float rnd = hash31(N * 41.7 + uSeed.x * 13.0);
  vec3 P = vPosL - vec3(0.0, 0.0, uSeed.y);

  // 1. mirror reflection of the studio
  vec3 Rw = normalize(L2W * reflect(-V, N));
  float fres = uOptics.z + (1.0 - uOptics.z) * pow(1.0 - ndv, 5.0);
  vec3 spec = textureLod(uEnv, Rw, 0.0).rgb;
  spec = mix(spec, spec * uColor * 1.6, uOptics.w);

  // 2. refraction, a channel at a time
  vec3 interior = vec3(0.0);
  float path = 0.0;
  for (int i = 0; i < 3; i++) {
    float ior = uOptics.x + (float(i) - 1.0) * uOptics.y;
    vec3 T = refract(-V, N, 1.0 / ior);
    float p;
    vec4 e = trace(P, T, N, p);
    vec3 s = textureLod(uEnv, normalize(L2W * e.xyz), 1.2).rgb;
    interior[i] = s[i] * e.w;
    path += p;
  }
  path /= 3.0;

  // 3. absorption
  vec3 body = pow(uColor, vec3(0.5 + uGain.y * path));
  vec3 col = interior * body * uGain.x;
  col += body * uColor * 0.05;

  // 4. the light at the heart, seen along the refracted ray
  vec3 Tm = refract(-V, N, 1.0 / uOptics.x);
  vec3 pc = vec3(0.0, uShape.z - uShape.w * 0.4, 0.0) - P;
  vec3 dv = pc - Tm * dot(pc, Tm);
  vec2 dq = dv.xz / uShape.xy;
  float d2 = dot(dq, dq) + dv.y * dv.y / (uShape.w * uShape.w);
  float r2 = uLight.y * uLight.y;
  float core = exp(-d2 / r2);
  float halo = exp(-d2 / (r2 * 6.0));
  float breathe = 0.9 + 0.1 * sin(uState.w * 1.3 + uSeed.x * TAU);
  vec3 coreCol = mix(uColor, uAccent, core * 0.75);
  col += coreCol * (core + halo * 0.2) * uLight.x * breathe * (1.0 + 1.5 * glow);

  col = col * (1.0 - fres) + spec * fres;

  // White-hot centre (wild).
  float hr = length(P.xz) / max(uLight.w, 1e-3);
  col += vec3(1.0, 0.95, 0.84) * uLight.z * exp(-hr * hr) * (1.0 + 0.6 * glow) * breathe;

  // 5. scintillation
  float ph = uState.z;
  vec3 g = sin(Rw * vec3(7.0, 9.0, 8.0) + rnd * TAU + vec3(ph, ph * 0.77, ph * 1.31));
  float inFacet = smoothstep(0.0, 0.45, min(vEdge.x, min(vEdge.y, vEdge.z)));
  float sp = smoothstep(0.62 - 0.2 * glow, 0.95, g.x * g.y * g.z) * (0.35 + 0.65 * inFacet);
  col += mix(uAccent, vec3(1.0), 0.55) * sp * uGain.z * (1.0 + 1.2 * glow);

  // Facet junctions catch a hairline of light.
  vec3 ew = fwidth(vEdge) * 1.1;
  vec3 es = smoothstep(vec3(0.0), ew, vEdge);
  float edge = 1.0 - min(es.x, min(es.y, es.z));
  col += (spec * 0.25 + body * 0.35 + uAccent * 0.08) * edge * uGain.w;

  // Win highlight: the rim lights up so bloom wraps the whole stone.
  col += uColor * pow(1.0 - ndv, 2.0) * glow * 0.9;

  fragColor = vec4(applyDim(col, uState.y), 1.0);
}
`;

const LUMA = new THREE.Vector3(0.2126, 0.7152, 0.0722);

export interface GemMaterial extends THREE.RawShaderMaterial {
  uniforms: {
    uState: { value: THREE.Vector4 };
    [k: string]: THREE.IUniform;
  };
}

export function createGemMaterial(stage: Stage, look: GemLook, seed: number): GemMaterial {
  const color = new THREE.Color(look.color);
  const accent = new THREE.Color(look.accent);
  // The heart is specified by luminance so a blue stone blooms as readily as a green one.
  const heart = color.clone().lerp(accent, 0.75);
  const heartLuma = heart.r * LUMA.x + heart.g * LUMA.y + heart.b * LUMA.z;
  const coreGain = look.core / Math.max(heartLuma, 0.05);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uEnv: { value: stage.env.cube },
      uColor: { value: color },
      uAccent: { value: accent },
      uShape: { value: new THREE.Vector4(look.halfX, look.halfZ, look.girdleY, look.depth) },
      uOptics: { value: new THREE.Vector4(look.ior, look.dispersion, look.f0, look.metal) },
      uCut: { value: new THREE.Vector4(look.sectors, look.phase, look.tiers, look.split ? 1 : 0) },
      uLight: { value: new THREE.Vector4(coreGain, look.coreRadius, look.hot, look.hotRadius) },
      uGain: { value: new THREE.Vector4(look.interior, look.density, look.sparkle, look.edge) },
      uState: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSeed: { value: new THREE.Vector2(seed, look.centreZ ?? 0) },
    },
  });
  return mat as GemMaterial;
}
