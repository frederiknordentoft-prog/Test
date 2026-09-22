// Shared GLSL for the symbol bakers. All programs render a single quad into one atlas slot.
// Coordinate convention inside every fragment shader: p ∈ [-1,1]², y UP, (0,0) = cell centre.
// Output is PREMULTIPLIED alpha. rgb may exceed a (additive glow) — Pixi's normal blend is (ONE, 1-SRC_ALPHA).

export const ART_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

/** Header + helpers. Every art fragment starts with this. */
export const ART_HEAD = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform float uPx;     // one texel in p units (2 / cellPx)
uniform float uStorm;  // 0 = base edition, 1 = storm edition
uniform float uSeed;
uniform vec3 uEnv0;    // aurora env colours (0..1)
uniform vec3 uEnv1;
uniform vec3 uEnv2;

#define PI 3.14159265
#define TAU 6.28318531

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash31(float p) { vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// periodic in x with integer period 'per' (for polar noise without a seam)
float pnoise(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float i0 = mod(i.x, per), i1 = mod(i.x + 1.0, per);
  float a = hash12(vec2(i0, i.y)), b = hash12(vec2(i1, i.y)), c = hash12(vec2(i0, i.y + 1.0)), d = hash12(vec2(i1, i.y + 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm3(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = OCT * p; a *= 0.5; } return s / 0.875; }
float fbm4(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = OCT * p; a *= 0.5; } return s / 0.9375; }
float fbm5(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = OCT * p; a *= 0.5; } return s / 0.96875; }
// ridged multifractal, 0..1, sharp crests
float ridge4(vec2 p) {
  float s = 0.0, a = 0.5, w = 1.0;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    n *= n; n *= w; w = sat(n * 1.6);
    s += a * n; p = OCT * p; a *= 0.5;
  }
  return s / 0.9375;
}
// Worley: x = F1, y = F2, zw = id hash / vector to nearest feature packed separately
vec3 worley(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + hash22(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hash12(i + g + 17.0); } else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h); }
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// flat-top/bottom hexagon (vertices at 0° and 180°), r = apothem
float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p.yx);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
// coverage of an SDF (negative inside), 1px analytic AA
float cover(float d) { return sat(0.5 - d / uPx); }
// fade additive glows to zero before the cell border (mip/atlas safe)
float cellFade(vec2 p) { float m = max(abs(p.x), abs(p.y)); return 1.0 - smoothstep(0.84, 0.985, m); }
// 4-point sparkle; returns intensity
float sparkle(vec2 q, float size) {
  vec2 a = abs(q) / size;
  float arms = exp(-a.y * 38.0) * exp(-a.x * 3.2) + exp(-a.x * 38.0) * exp(-a.y * 3.2);
  vec2 d = abs(rot2(0.785398) * q) / size;
  float diag = (exp(-d.y * 50.0) * exp(-d.x * 7.0) + exp(-d.x * 50.0) * exp(-d.y * 7.0)) * 0.45;
  float core = exp(-dot(q, q) / (size * size * 0.012));
  return arms + diag + core * 1.4;
}
// aurora environment seen by reflection direction R (z towards the viewer)
vec3 envRefl(vec3 R) {
  float a = atan(R.y, R.x);
  float w0 = pow(0.5 + 0.5 * cos(a - 1.5708), 3.0);
  float w1 = pow(0.5 + 0.5 * cos(a - 3.6652), 3.0);
  float w2 = pow(0.5 + 0.5 * cos(a + 0.5236), 3.0);
  float tilt = sat(length(R.xy) * 1.25);
  return (uEnv0 * w0 + uEnv1 * w1 + uEnv2 * w2) * tilt;
}
vec3 envAvg() { return (uEnv0 + uEnv1 + uEnv2) / 3.0; }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// cell-local position, y up
vec2 cellP() { return vec2(vUV.x * 2.0 - 1.0, 1.0 - vUV.y * 2.0); }
// key light: top-left
const vec3 KEY = vec3(-0.5199, 0.6399, 0.5657);
`;
