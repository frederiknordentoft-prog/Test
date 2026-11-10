/**
 * GLSL shared by the symbol shaders.
 *
 * Every symbol material is a RawShaderMaterial (GLSL ES 3.00): its program key
 * is then only the shader source, so adding a light, a shadow or fog anywhere
 * else in the scene can never force a recompile in the middle of a spin.
 */

export const GLSL_HEAD = /* glsl */ `
precision highp float;
precision highp int;
precision highp samplerCube;
precision highp sampler2D;
`;

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
float hash31(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
float fbm2(vec3 p) {
  return 0.6 * vnoise(p) + 0.4 * vnoise(p * 2.07 + 9.3);
}
`;

/** Win highlight and push-back, identical for every symbol so a line reads as one thing. */
export const GLSL_STATE = /* glsl */ `
// uState: x = glow 0..1, y = dim 0..1, z = sparkle clock, w = idle clock
vec3 applyDim(vec3 col, float dim) {
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l) * vec3(0.82, 0.9, 1.12), dim * 0.8);
  col *= 1.0 - 0.74 * dim;
  // A glint on a pushed-back symbol would pull the eye off the winning line: roll highlights off as well.
  return mix(col, col / (1.0 + 2.0 * col), dim);
}
`;

/**
 * Camera-facing quad. The depth is taken from a point nearer the camera so the
 * enamel under the symbol does not cut through the glow.
 * Needs: uniform float uHalf (half size in the symbol's unit space).
 */
export const GLSL_BILLBOARD_VS = /* glsl */ `
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uHalf;
in vec3 position;
out vec2 vUv;
void main() {
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(modelViewMatrix[0].xyz);
  vec4 mv = c + vec4(position.xy * s * uHalf, 0.0, 0.0);
  gl_Position = projectionMatrix * mv;
  vec4 lifted = projectionMatrix * (mv + vec4(0.0, 0.0, s * 0.6, 0.0));
  gl_Position.z = lifted.z / lifted.w * gl_Position.w;
  vUv = position.xy;
}
`;
