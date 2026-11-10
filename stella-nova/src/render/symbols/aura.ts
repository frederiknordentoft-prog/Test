/**
 * Light that is not a surface: the wild's rays, and the comet's coma and tail.
 *
 * Both write premultiplied colour with zero alpha, so they only ever add to
 * the picture and never need sorting against each other or the board.
 */
import * as THREE from 'three';
import type { BodyMaterial } from './bodies';
import { GLSL_BILLBOARD_VS, GLSL_HEAD, GLSL_NOISE, GLSL_STATE } from './glsl';

/** Half size of the rays quad, unit space. Everything fades out before it. */
export const RAYS_HALF = 0.64;

const RAYS_FRAG = /* glsl */ `${GLSL_HEAD}
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uState;   // glow, dim, sparkle clock, idle clock
uniform float uHalf;
uniform float uSeed;
in vec2 vUv;
out vec4 fragColor;
const float TAU = 6.28318530718;
${GLSL_STATE}

// A four-armed glint: hairline arms of the given reach.
float cross4(vec2 q, float reach, float thin) {
  vec2 a = abs(q);
  return exp(-a.y / thin - a.x / reach) + exp(-a.x / thin - a.y / reach);
}
mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 p = vUv * uHalf;
  float r = length(p);
  float glow = uState.x;
  float t = uState.w;
  float ph = uSeed * TAU;

  // The long glint turns very slowly; the short one turns against it.
  float thin = 0.011 + 0.006 * glow;
  float c1 = cross4(rot(t * 0.06 + ph) * p, 0.3 + 0.045 * sin(t * 0.9 + ph) + 0.1 * glow, thin);
  float c2 = cross4(rot(0.785398 - t * 0.04 + ph) * p, 0.16 + 0.03 * sin(t * 1.3 + ph * 2.0) + 0.06 * glow, thin * 0.8);

  // Eight broad, soft rays under the glints.
  float th = atan(p.y, p.x);
  float soft = pow(abs(cos(4.0 * th + t * 0.11 + ph)), 10.0) * exp(-r / 0.17);
  float halo = 0.22 * exp(-r * r / 0.02) + 0.07 * exp(-r / 0.15);

  // Restraint: one short flare every eight seconds or so, not a strobe.
  float flare = pow(max(sin(uState.z * 0.8 + ph), 0.0), 24.0);

  vec3 col = uColor * (halo + soft * 0.3);
  // The arms thin out toward the middle, where the star's own boss is already white-hot.
  col += mix(uColor, uAccent, 0.65) * (c1 * 0.5 + c2 * 0.28) * (1.0 - 0.55 * exp(-r * r / 0.006)) * (1.0 + 1.5 * flare);
  col *= (1.0 + 0.45 * glow) * smoothstep(uHalf, uHalf * 0.5, r);
  fragColor = vec4(applyDim(col, uState.y), 0.0);
}
`;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
} as const;

export function createRaysMaterial(color: number, accent: number, seed: number): BodyMaterial {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `${GLSL_HEAD}${GLSL_BILLBOARD_VS}`,
    fragmentShader: RAYS_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAccent: { value: new THREE.Color(accent) },
      uHalf: { value: RAYS_HALF },
      uState: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSeed: { value: seed },
    },
    ...additive,
  }) as BodyMaterial;
}

/** Half size of the comet's plane, unit space. */
export const COMET_HALF = 0.66;
/**
 * The comet in unit space (x = clockwise tangent, y here = z, −z outward):
 * the head leads clockwise, the tail trails back along the tangent and bends
 * outward, away from the star, as a real dust tail does.
 */
export const COMET_HEAD = new THREE.Vector2(0.25, 0.1);
const COMET_BEND = 0.82;
const COMET_LENGTH = 0.74;

/** The quad lies in the ring plane; its depth is pulled toward the camera so the coma also veils the nucleus. */
const COMET_VERT = /* glsl */ `${GLSL_HEAD}
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uHalf;
in vec3 position;
out vec2 vP;
void main() {
  vP = vec2(position.x, -position.y) * uHalf;
  vec4 mv = modelViewMatrix * vec4(vP.x, 0.0, vP.y, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = length(modelViewMatrix[0].xyz);
  vec4 lifted = projectionMatrix * (mv + vec4(0.0, 0.0, s * 0.3, 0.0));
  gl_Position.z = lifted.z / lifted.w * gl_Position.w;
}
`;

const COMET_FRAG = /* glsl */ `${GLSL_HEAD}
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uState;   // glow, dim, sparkle clock, idle clock
uniform vec4 uTail;    // head x, head z, bend radius, length
uniform float uHalf;
uniform float uSeed;
in vec2 vP;
out vec4 fragColor;
const float TAU = 6.28318530718;
${GLSL_NOISE}
${GLSL_STATE}

void main() {
  float glow = uState.x;
  float t = uState.w;
  vec2 H = uTail.xy;
  float kc = uTail.z;
  float L = uTail.w;

  // Tail coordinates: s runs down the spine (an arc that leaves the head along the tangent), x across it.
  vec2 d = vP - (H + vec2(0.0, -kc));
  float s = atan(-d.x, d.y) * kc;
  float u = clamp(s / L, 0.0, 1.0);
  float w = mix(0.05, 0.17, pow(u, 0.75));
  float x = (length(d) - kc) / w;
  float inTail = smoothstep(-0.02, 0.07, s) * step(s, L);
  float across = exp(-x * x);

  // Streamers flow down the tail.
  float streak = vnoise(vec3(x * 2.6, s * 2.2 - t * 0.35, uSeed * 7.0));
  float fine = vnoise(vec3(x * 7.0, s * 3.0 - t * 0.6, uSeed * 3.0 + 4.0));
  float body = across * inTail * pow(1.0 - u, 0.9) * (0.3 + 1.05 * streak * streak + 0.45 * fine);

  // Ice grains that catch the light, each on its own clock.
  vec2 gc = vec2(s * 30.0, x * 2.6);
  vec2 gi = floor(gc);
  float gr = hash21(gi + uSeed * 91.0);
  vec2 gf = fract(gc) - 0.5 - (vec2(hash21(gi + 3.1), hash21(gi + 7.7)) - 0.5) * 0.5;
  float tw = pow(max(sin(uState.z * (1.2 + 2.6 * gr) + gr * TAU), 0.0), 6.0);
  float glit = exp(-dot(gf, gf) * 34.0) * tw * step(0.45, gr) * exp(-x * x * 0.55) * inTail * pow(1.0 - u, 0.6);

  float rh = length(vP - H);
  float coma = 0.95 * exp(-rh * rh / 0.014) + 0.4 * exp(-rh / 0.08);

  // A bright spine keeps the tail a tail at thirty pixels.
  float spine = exp(-x * x * 7.0) * inTail * pow(1.0 - u, 1.6);
  vec3 col = uColor * (body * 1.6 + spine * 0.6 + coma) + uAccent * (glit * 3.2 + spine * 0.3 + 0.5 * exp(-rh * rh / 0.005));
  col *= (1.0 + 0.4 * glow) * smoothstep(uHalf, uHalf * 0.8, length(vP));
  fragColor = vec4(applyDim(col, uState.y), 0.0);
}
`;

export function createCometMaterial(color: number, accent: number, seed: number): BodyMaterial {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: COMET_VERT,
    fragmentShader: COMET_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAccent: { value: new THREE.Color(accent) },
      uTail: { value: new THREE.Vector4(COMET_HEAD.x, COMET_HEAD.y, COMET_BEND, COMET_LENGTH) },
      uHalf: { value: COMET_HALF },
      uState: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSeed: { value: seed },
    },
    side: THREE.DoubleSide,
    ...additive,
  }) as BodyMaterial;
}
