/** Shared pieces for the VFX meshes: additive material factory, colour prep, GLSL noise. */
import * as THREE from 'three';

/** Draw after everything else that blends, so glass and coronas never cover an effect. */
export const VFX_RENDER_ORDER = 60;

export const GLSL_NOISE = /* glsl */ `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), f);
}
float vnoise2(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y);
}
`;

/**
 * Additive light. Premultiplied so the blend is plain ONE + ONE and the HDR
 * values written by the shader reach the bloom threshold untouched.
 */
export function additive(params: THREE.ShaderMaterialParameters): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
    ...params,
  });
}

const scratch = new THREE.Color();

/** Result of the last `light()` call. Read it straight away; it is reused. */
export const RGB = { r: 1, g: 1, b: 1 };

/**
 * Turn a symbol or palette colour into light: linear, peak-normalised (so a
 * dark sapphire carries as much energy as a pale moon), lifted `whiten` of the
 * way to white, then scaled to an HDR intensity. Writes into RGB.
 */
export function light(color: THREE.ColorRepresentation, intensity = 1, whiten = 0): typeof RGB {
  scratch.set(color);
  const peak = Math.max(scratch.r, scratch.g, scratch.b, 1e-4);
  const k = (1 - whiten) / peak;
  RGB.r = (scratch.r * k + whiten) * intensity;
  RGB.g = (scratch.g * k + whiten) * intensity;
  RGB.b = (scratch.b * k + whiten) * intensity;
  return RGB;
}
