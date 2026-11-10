/**
 * The four celestial bodies. Moon, Jupiter and Saturn are real spheres with
 * procedural surfaces; the Sun is a camera-facing impostor so its disc and
 * corona are one seamless draw.
 *
 * All lighting here is authored in the symbol's own "upright" frame (the
 * factory keeps that frame facing the camera), with fixed light directions:
 * these are icons first, and an icon must look the same in every cell.
 */
import * as THREE from 'three';
import type { Stage } from '../stage';
import { GLSL_BILLBOARD_VS, GLSL_HEAD, GLSL_NOISE, GLSL_STATE } from './glsl';

/**
 * Saturn's ring plane (unit normal, upright frame). Seen from the play
 * camera this opens the ring about 25° and rolls it a little to the right.
 */
export const SATURN_RING_NORMAL = new THREE.Vector3(0.3, 0.66, -0.69).normalize();
export const SATURN_RADIUS = 0.25;
export const SATURN_RING_INNER = 0.31;
export const SATURN_RING_OUTER = 0.5;

const SPHERE_VERT = /* glsl */ `${GLSL_HEAD}
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
in vec3 position;
in vec3 normal;
out vec3 vN;
out vec3 vPosL;
out vec3 vViewL;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 camL = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vN = normal;
  vPosL = position;
  vViewL = camL - position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SPHERE_FRAG_HEAD = /* glsl */ `${GLSL_HEAD}
uniform samplerCube uEnv;
uniform mat4 modelMatrix;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uState;   // glow, dim, sparkle clock, idle clock
uniform float uSeed;
in vec3 vN;
in vec3 vPosL;
in vec3 vViewL;
out vec4 fragColor;
const float TAU = 6.28318530718;
${GLSL_NOISE}
${GLSL_STATE}
`;

const MOON_FRAG = /* glsl */ `${SPHERE_FRAG_HEAD}
// Light from the upper left and a little behind: a crescent from the play camera.
const vec3 L = vec3(-0.865, -0.12, -0.487);
// Tycho, the rayed crater: of course.
const vec3 TYCHO = vec3(-0.515, 0.807, 0.289);

float craterShape(float d) {
  float bowl = -(1.0 - smoothstep(0.0, 0.85, d));
  float rim = 0.55 * exp(-pow((d - 0.98) / 0.2, 2.0));
  return bowl + rim;
}
// One crater per lattice cell. xyz = height gradient, w = height.
vec4 craterLayer(vec3 p, float scale, float seed) {
  vec3 g = p * scale;
  vec3 id = floor(g);
  vec3 h = hash33(id + seed);
  vec3 c = 0.3 + 0.4 * h;
  float rad = 0.17 + 0.15 * hash31(id * 1.7 + seed + 4.0);
  vec3 dv = (g - id) - c;
  float dl = length(dv);
  float d = dl / rad;
  if (d > 1.6) return vec4(0.0);
  float e = 0.04;
  float slope = (craterShape(d + e) - craterShape(d - e)) / (2.0 * e);
  return vec4(dv / max(dl, 1e-4) * slope * (scale / rad) * 0.01, craterShape(d));
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vViewL);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float glow = uState.x;

  // A slow libration keeps the face alive without ever turning it away.
  float lib = sin(uState.w * 0.31 + uSeed * TAU) * 0.07;
  vec3 p = vec3(N.x * cos(lib) - N.z * sin(lib), N.y, N.x * sin(lib) + N.z * cos(lib));

  float mare = smoothstep(0.47, 0.6, fbm(p * 1.9 + 3.7));
  float albedo = mix(0.86, 0.34, mare);
  albedo *= 0.86 + 0.28 * fbm2(p * 8.0 + 1.3);

  vec4 c1 = craterLayer(p, 3.1, 11.0);
  vec4 c2 = craterLayer(p, 5.7, 23.0);
  vec4 c3 = craterLayer(p, 10.3, 37.0);
  vec3 grad = c1.xyz * 1.3 + c2.xyz + c3.xyz * 0.7;
  albedo *= 1.0 + 0.16 * (c1.w + c2.w) + 0.1 * c3.w;

  // Tycho and its rays.
  vec3 tv = p - TYCHO;
  float td = length(tv);
  vec3 tu = normalize(cross(TYCHO, vec3(0.0, 0.0, 1.0)));
  vec3 tw = cross(TYCHO, tu);
  float ta = atan(dot(tv, tw), dot(tv, tu));
  float rays = pow(vnoise(vec3(cos(ta), sin(ta), 0.0) * 5.5 + 2.0), 3.0) * exp(-td * 2.6) * smoothstep(0.05, 0.11, td);
  albedo += rays * 1.1 + 0.5 * exp(-pow(td / 0.05, 2.0));
  float tyc = td / 0.075;
  grad += tv / max(td, 1e-4) * (craterShape(tyc + 0.04) - craterShape(tyc - 0.04)) * 1.6 * step(tyc, 1.6);

  vec3 Nb = normalize(N - (grad - N * dot(grad, N)) * 6.0);
  float ndl = dot(Nb, L);
  float geo = dot(N, L);
  float lit = smoothstep(-0.04, 0.2, ndl) * smoothstep(-0.12, 0.1, geo);
  vec3 col = uColor * albedo * lit * (0.62 + 0.95 * pow(max(ndl, 0.0), 0.7)) * (1.0 + 0.55 * glow);

  // Earthshine: the night side is a dim silver-blue disc, never a hole.
  col += uAccent * albedo * (0.085 + 0.2 * glow) * (0.55 + 0.45 * ndv);
  // Polished silver: a soft studio reflection.
  vec3 R = normalize(mat3(modelMatrix) * reflect(-V, Nb));
  col += textureLod(uEnv, R, 5.0).rgb * albedo * 0.16;
  // Cool glow along the limb.
  float rim = pow(1.0 - ndv, 2.6);
  col += mix(uAccent, uColor, 0.4) * rim * (0.34 + 0.75 * lit + 0.9 * glow);

  fragColor = vec4(applyDim(col, uState.y), 1.0);
}
`;

/** Shared by Jupiter and Saturn: coordinates on a banded giant. */
const GIANT_COMMON = /* glsl */ `
uniform vec3 uAxis;    // the pole, upright frame
uniform vec4 uRing;    // Saturn only: ring inner radius, outer radius, planet radius, unused
// Key light: high, from the left, toward the viewer.
const vec3 L = vec3(-0.42, 0.74, 0.525);
`;

const JUPITER_FRAG = /* glsl */ `${SPHERE_FRAG_HEAD}
${GIANT_COMMON}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vViewL);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float glow = uState.x;
  float t = uState.w;

  vec3 A = normalize(uAxis);
  vec3 E1 = normalize(cross(vec3(1.0, 0.0, 0.0), A));   // faces the viewer
  vec3 E2 = cross(A, E1);                               // screen right
  float sl = clamp(dot(N, A), -1.0, 1.0);
  float la = asin(sl);
  float cl = sqrt(1.0 - sl * sl);
  float lon = atan(dot(N, E2), dot(N, E1));

  // Zonal jets: neighbouring bands drift opposite ways, so the planet turns without the spot ever leaving.
  float jet = sin(la * 9.5);
  float l = lon + t * (0.05 + 0.045 * jet);
  vec3 np = vec3(cos(l) * cl, sl, sin(l) * cl);

  // The great red spot, in the south, librating slowly about the middle of the disc.
  float spotLon = 0.42 + 0.3 * sin(t * 0.06 + uSeed * TAU);
  float spotLat = -0.37;
  vec2 sd = vec2(atan(sin(lon - spotLon), cos(lon - spotLon)) * cl / 0.3, (la - spotLat) / 0.15);
  float sr = length(sd);
  float spot = smoothstep(1.0, 0.62, sr);
  float collar = smoothstep(1.9, 1.0, sr) * (1.0 - spot);

  float turb = fbm(np * vec3(3.2, 8.0, 3.2) + uSeed * 9.0) - 0.5;
  // Bands bend around the spot.
  float la2 = la + turb * 0.085 + collar * 0.07 * sign(la - spotLat);
  float bands = cos(la2 * 9.5) * (0.84 + 0.16 * cos(la2 * 3.1 + 1.0));
  float streak = fbm(np * vec3(4.5, 30.0, 4.5) + 4.0) - 0.5;
  float v = clamp(0.5 + 0.5 * bands + streak * 0.42 + turb * 0.25, 0.0, 1.0);

  vec3 belt = uColor * vec3(0.52, 0.34, 0.24);
  vec3 zone = uAccent;
  vec3 col = v < 0.5 ? mix(belt, uColor, v * 2.0) : mix(uColor, zone, v * 2.0 - 1.0);
  // Dusky poles.
  col = mix(col, uColor * vec3(0.5, 0.42, 0.4), smoothstep(0.95, 1.35, abs(la)));
  col = mix(col, zone * 0.96, collar * 0.45);
  float swirl = vnoise(vec3(sd * mat2(cos(sr * 3.0 - t * 0.4), -sin(sr * 3.0 - t * 0.4), sin(sr * 3.0 - t * 0.4), cos(sr * 3.0 - t * 0.4)) * 2.6, uSeed));
  col = mix(col, uColor * vec3(1.02, 0.34, 0.2) * (0.82 + 0.3 * swirl), spot);

  float ndl = dot(N, L);
  float diff = 0.2 + 0.8 * smoothstep(-0.32, 0.8, ndl);
  col *= diff * mix(0.5, 1.0, pow(ndv, 0.55)) * (1.0 + 0.75 * glow);
  // A thin warm atmosphere on the limb.
  col += uAccent * pow(1.0 - ndv, 3.0) * (0.22 + 0.9 * glow) * (0.4 + 0.6 * diff);
  col += uColor * glow * 0.12;

  fragColor = vec4(applyDim(col, uState.y), 1.0);
}
`;

const SATURN_FRAG = /* glsl */ `${SPHERE_FRAG_HEAD}
${GIANT_COMMON}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vViewL);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float glow = uState.x;
  float t = uState.w;

  vec3 A = normalize(uAxis);
  float sl = clamp(dot(N, A), -1.0, 1.0);
  float la = asin(sl);
  vec3 E1 = normalize(cross(vec3(1.0, 0.0, 0.0), A));
  vec3 E2 = cross(A, E1);
  float lon = atan(dot(N, E2), dot(N, E1)) + t * 0.05;
  vec3 np = vec3(cos(lon), sl * 1.0, sin(lon)) * vec3(sqrt(1.0 - sl * sl), 1.0, sqrt(1.0 - sl * sl));

  float turb = fbm2(np * vec3(2.5, 7.0, 2.5) + uSeed * 9.0) - 0.5;
  float bands = cos((la + turb * 0.05) * 11.0);
  float v = 0.5 + 0.5 * bands + (fbm2(np * vec3(4.0, 26.0, 4.0)) - 0.5) * 0.35;
  vec3 col = mix(uColor * vec3(0.72, 0.58, 0.42), uColor * vec3(1.06, 1.0, 0.88), clamp(v, 0.0, 1.0));
  col = mix(col, uColor * vec3(0.62, 0.58, 0.5), smoothstep(0.9, 1.4, abs(la)));

  float ndl = dot(N, L);
  float diff = 0.2 + 0.8 * smoothstep(-0.3, 0.8, ndl);

  // The ring's shadow: a band across the globe.
  vec3 P = N * uRing.z;
  float denom = dot(L, A);
  float tt = -dot(P, A) / (abs(denom) < 1e-3 ? 1e-3 : denom);
  float rho = length(P + L * tt);
  float sh = step(0.0, tt) * smoothstep(uRing.x - 0.012, uRing.x + 0.012, rho) * smoothstep(uRing.y + 0.012, uRing.y - 0.012, rho);
  diff *= 1.0 - 0.62 * sh;

  col *= diff * mix(0.5, 1.0, pow(ndv, 0.55)) * (1.0 + 0.75 * glow);
  // The ring lights the limb with its lilac.
  col += uAccent * pow(1.0 - ndv, 3.0) * (0.3 + 0.9 * glow);
  col += uColor * glow * 0.12;

  fragColor = vec4(applyDim(col, uState.y), 1.0);
}
`;

const RING_VERT = /* glsl */ `${GLSL_HEAD}
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
out vec3 vPosL;
void main() {
  vPosL = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

/** The ring mesh lies in its own XZ plane; uToBody rotates that plane into the planet's upright frame. */
const RING_FRAG = /* glsl */ `${GLSL_HEAD}
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uState;
uniform vec4 uRing;     // inner, outer, planet radius
uniform mat3 uToBody;
uniform float uSeed;
in vec3 vPosL;
out vec4 fragColor;
const float TAU = 6.28318530718;
const vec3 L = vec3(-0.42, 0.74, 0.525);
${GLSL_NOISE}
${GLSL_STATE}

float band(float x, float a, float b, float w) {
  return smoothstep(a - w, a + w, x) * smoothstep(b + w, b - w, x);
}

void main() {
  float rho = length(vPosL.xz);
  float u = (rho - uRing.x) / (uRing.y - uRing.x);
  float w = fwidth(u) * 1.2 + 0.006;
  float glow = uState.x;

  // C ring (faint), B ring (dense), the Cassini division, A ring with the Encke gap.
  float cR = band(u, 0.0, 0.2, w) * 0.3;
  float bR = band(u, 0.2, 0.58, w);
  float aR = band(u, 0.675, 1.0, w) * (1.0 - 0.75 * band(u, 0.865, 0.895, w));
  float fine = 0.84 + 0.16 * sin(u * 150.0 + sin(u * 37.0) * 2.0);
  float density = (cR + bR * 0.97 + aR * 0.8) * fine;
  if (density < 0.004) discard;

  vec3 col = uColor * vec3(1.08, 1.02, 0.92) * bR + uAccent * (aR * 1.05 + cR * 2.2);
  col *= fine;

  // The planet's shadow falls across the far side of the ring.
  vec3 P = uToBody * vPosL;
  float b = dot(P, L);
  float miss = length(P - L * b);
  float shadow = step(b, 0.0) * smoothstep(uRing.z + 0.012, uRing.z - 0.012, miss);
  float lightK = (0.92 + 0.5 * glow) * (1.0 - 0.8 * shadow);

  // Ice: a few grains glint as they pass.
  float ang = atan(vPosL.z, vPosL.x);
  vec2 cell = vec2(floor(u * 26.0), floor(ang * 34.0 / TAU * 6.0));
  float tw = hash21(cell + uSeed * 31.0);
  float glint = smoothstep(0.93, 1.0, sin(uState.z * (0.6 + tw) + tw * TAU) * step(0.6, tw));
  col = col * lightK + mix(uAccent, vec3(1.0), 0.5) * glint * (1.4 + 2.0 * glow) * density * (1.0 - shadow);
  col += uAccent * glow * 0.3 * density;

  float alpha = clamp(density, 0.0, 1.0);
  fragColor = vec4(applyDim(col, uState.y) * alpha, alpha);
}
`;

const SUN_FRAG = /* glsl */ `${GLSL_HEAD}
uniform mat4 viewMatrix;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uState;
uniform float uHalf;
uniform float uRadius;
uniform float uSeed;
in vec2 vUv;
out vec4 fragColor;
const float TAU = 6.28318530718;
${GLSL_NOISE}
${GLSL_STATE}

void main() {
  vec2 p = vUv * uHalf / uRadius;
  float r = length(p);
  float edge = uHalf / uRadius;
  float glow = uState.x;
  float t = uState.w * 0.22 + uSeed * 40.0;
  float aa = fwidth(r) * 1.2;
  float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);

  vec3 col = vec3(0.0);
  if (r < 1.0 + aa) {
    // Sphere normal, taken back to world space so the plasma has parallax under a moving camera.
    float mu = sqrt(max(1.0 - r * r, 0.0));
    vec3 n = transpose(mat3(viewMatrix)) * vec3(p, mu);
    vec3 q = n * 2.6 + vec3(0.0, t * 0.35, 0.0);
    q += (vec3(vnoise(q * 1.7 + t), vnoise(q * 1.7 + 5.2 - t), vnoise(q * 1.7 + 9.1)) - 0.5) * 0.9;
    float cells = fbm(q * 1.5 + vec3(t * 0.5, 0.0, -t * 0.3));
    // Granulation: bright cells with dark lanes between them.
    float gran = 1.0 - abs(2.0 * vnoise(q * 4.3 + vec3(0.0, -t * 1.3, t)) - 1.0);
    float heat = clamp(0.2 + 0.95 * cells + 0.32 * gran - 0.35 * (1.0 - mu), 0.0, 1.0);
    vec3 cool = uAccent * 1.25;
    vec3 warm = uColor * 2.3;
    vec3 hot = vec3(1.0, 0.94, 0.78) * 3.5;
    col = heat < 0.55 ? mix(cool, warm, heat / 0.55) : mix(warm, hot, (heat - 0.55) / 0.45);
    // Chromosphere: a thin hot rim.
    col += uAccent * 1.6 * smoothstep(0.8, 1.0, r);
    col *= 1.0 + 0.7 * glow;
  }

  // Corona: short flame tongues that lick outward and die inside the cell.
  float ang = atan(p.y, p.x);
  vec3 ad = vec3(cos(ang), sin(ang), 0.0);
  float reach = 0.1 + 0.52 * pow(vnoise(ad * 2.6 + vec3(0.0, 0.0, t * 1.5)), 1.5) + 0.2 * glow;
  float lick = vnoise(ad * 7.0 + vec3(0.0, 0.0, r * 3.0 - t * 5.0));
  float fall = exp(-max(r - 1.0, 0.0) / (reach * (0.4 + 0.5 * lick)));
  float spikes = pow(0.5 + 0.5 * cos(ang * 12.0 + sin(ang * 5.0 + t * 2.0) * 1.5 + uSeed * TAU), 3.0);
  float corona = fall * (0.55 + 0.75 * spikes) * smoothstep(edge, edge * 0.62, r);
  vec3 cc = mix(uAccent * 1.5, uColor * 2.2, fall) * corona * (1.0 + 0.8 * glow);

  vec3 outC = col * disc + cc * (1.0 - disc);
  // Premultiplied: the disc covers, the corona only adds.
  fragColor = vec4(applyDim(outC, uState.y), disc);
}
`;

function stateUniforms(seed: number) {
  return {
    uState: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSeed: { value: seed },
  };
}

export interface BodyMaterial extends THREE.RawShaderMaterial {
  uniforms: { uState: { value: THREE.Vector4 }; [k: string]: THREE.IUniform };
}

function sphereMaterial(stage: Stage, frag: string, color: number, accent: number, seed: number, extra: Record<string, THREE.IUniform> = {}): BodyMaterial {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: SPHERE_VERT,
    fragmentShader: frag,
    uniforms: {
      uEnv: { value: stage.env.cube },
      uColor: { value: new THREE.Color(color) },
      uAccent: { value: new THREE.Color(accent) },
      ...stateUniforms(seed),
      ...extra,
    },
  }) as BodyMaterial;
}

export function createMoonMaterial(stage: Stage, color: number, accent: number, seed: number): BodyMaterial {
  return sphereMaterial(stage, MOON_FRAG, color, accent, seed);
}

/** Jupiter's pole points up the screen and leans a little toward the viewer, so the bands curve like a smile. */
export const JUPITER_AXIS = new THREE.Vector3(0.1, 0.55, -0.83).normalize();

export function createJupiterMaterial(stage: Stage, color: number, accent: number, seed: number): BodyMaterial {
  return sphereMaterial(stage, JUPITER_FRAG, color, accent, seed, {
    uAxis: { value: JUPITER_AXIS },
    uRing: { value: new THREE.Vector4(0, 0, 0, 0) },
  });
}

const ringUniform = () => ({ value: new THREE.Vector4(SATURN_RING_INNER, SATURN_RING_OUTER, SATURN_RADIUS, 0) });

export function createSaturnMaterial(stage: Stage, color: number, accent: number, seed: number): BodyMaterial {
  return sphereMaterial(stage, SATURN_FRAG, color, accent, seed, {
    uAxis: { value: SATURN_RING_NORMAL },
    uRing: ringUniform(),
  });
}

export function createSaturnRingMaterial(color: number, accent: number, seed: number, toBody: THREE.Matrix3): BodyMaterial {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAccent: { value: new THREE.Color(accent) },
      uRing: ringUniform(),
      uToBody: { value: toBody },
      ...stateUniforms(seed),
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  }) as BodyMaterial;
}

export const SUN_RADIUS = 0.285;
export const SUN_HALF = 0.5;

export function createSunMaterial(color: number, accent: number, seed: number): BodyMaterial {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `${GLSL_HEAD}${GLSL_BILLBOARD_VS}`,
    fragmentShader: SUN_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAccent: { value: new THREE.Color(accent) },
      uHalf: { value: SUN_HALF },
      uRadius: { value: SUN_RADIUS },
      ...stateUniforms(seed),
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  }) as BodyMaterial;
}

/** A flat annulus in the XZ plane, radius in position. */
export function ringGeometry(): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(SATURN_RING_INNER - 0.004, SATURN_RING_OUTER + 0.004, 72, 1);
  g.rotateX(-Math.PI / 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  return g;
}

export function sphereGeometry(radius: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, 36, 22);
  g.deleteAttribute('uv');
  return g;
}

/** A unit quad in XY for the camera-facing shaders. */
export function quadGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  // The shader expands the quad in view space; culling must still see where it is.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.0);
  return g;
}
