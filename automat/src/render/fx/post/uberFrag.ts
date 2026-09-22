// UberPost fragment shader. One source, two compiled variants via `#define CINEMATIC 0|1`.
//
//  base      : radial spectral CA (5 taps) → lift/gamma/gain grade (cool ↔ crimson by storm) → exposure flash → vignette → grain
//  cinematic : + shock rings (refraction + prismatic rim), heat haze (top 25 %), glitch bands,
//              and an 8-tap *spectral* gather that does radial zoom blur, CA and glitch RGB split in one loop.
//
// Input is premultiplied alpha; grading happens on straight colour and is re-premultiplied at the end.
import { POST_COMMON } from './glsl.ts';

export function uberFrag(cinematic: boolean): string {
  return /* glsl */ `#version 300 es
precision highp float;
#define CINEMATIC ${cinematic ? 1 : 0}
in vec2 vTextureCoord;
in vec2 vScreen;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;   // input source size (css px), 1/size
uniform vec4 uInputClamp;  // valid uv rect of the pooled input
uniform vec4 uMap;         // screen = uv * xy + zw
uniform vec4 uScreen;      // screen w, h (css px), 1/w, 1/h
uniform vec4 uFx;          // ca (css px at corners), vignette (effective), grain amplitude (effective), exposure
uniform vec4 uFx2;         // time (wrapped s), storm, grain frame seed, root resolution
uniform vec3 uLift;
uniform vec3 uInvGamma;
uniform vec3 uGain;
uniform vec3 uTone;        // saturation, contrast, pivot
uniform vec3 uVigTint;
uniform vec3 uFlash;
#if CINEMATIC
uniform vec4 uCine;        // zoom, glitch, heat, -
uniform vec2 uZoomCenter;  // screen uv
uniform vec4 uRings[3];    // x, y (screen uv), radius (short-side units), strength
#endif
${POST_COMMON}

vec4 tap(vec2 uv) { return texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw)); }

// symmetric power S-curve around a pivot: 0→0, 1→1, keeps shadow detail (no linear black crush)
vec3 sCurve(vec3 x, float c, float p) {
  vec3 lo = p * pow(x / p, vec3(c));
  vec3 hi = 1.0 - (1.0 - p) * pow((1.0 - x) / (1.0 - p), vec3(c));
  return mix(lo, hi, step(vec3(p), x));
}

vec3 grade(vec3 x) {
  x = clamp(x, 0.0, 1.0);
  x = uGain * (x + uLift * (1.0 - x));
  x = pow(clamp(x, 0.0, 1.0), uInvGamma);
  x = sCurve(x, uTone.y, uTone.z);
  float l = dot(x, LUMA);
  return max(mix(vec3(l), x, uTone.x), 0.0);
}

void main() {
  vec2 sp = vScreen;
  vec2 uv = vTextureCoord;
  float halfDiag = 0.5 * length(uScreen.xy);
  vec2 dir = (sp - 0.5) * uScreen.xy / halfDiag;   // |dir| = 1 at the corners (aspect-true)
  float r = length(dir);
  // Radial CA: exactly zero in the central 20 % so type / symbols stay pixel-crisp; 'ca' css px at corners.
  float caK = max(r - 0.2, 0.0) * 1.25;
  vec2 caOff = dir * (uFx.x * caK * caK / max(r, 1e-4)) * uInputSize.zw;

  vec4 c;
#if CINEMATIC
  float t = uFx2.x;
  vec2 asp = uScreen.xy / min(uScreen.x, uScreen.y);  // screen uv → short-side units
  vec2 ds = vec2(0.0);                                // displacement in screen uv
  vec3 rim = vec3(0.0);
  float shock = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 R = uRings[i];
    if (R.w <= 0.0) continue;
    vec2 d = (sp - R.xy) * asp;
    float dist = max(length(d), 1e-4);
    float w = 0.02 + 0.06 * R.z;                     // the front thickens as it travels
    float x = (dist - R.z) / w;
    float g = exp(-x * x);
    // refraction: derivative-of-gaussian lens, samples are pulled toward the front (a pressure wave in glass)
    ds -= (d / dist) * (x * g * R.w * w * 0.9) / asp;
    // plasma front: thin white-hot leading edge, molten body, crimson wake (palette: whiteHot / molten / crimson)
    float core = exp(-(x - 0.45) * (x - 0.45) * 10.0);
    float body = exp(-(x + 0.15) * (x + 0.15) * 1.6);
    float wake = exp(-(x + 1.3) * (x + 1.3) * 0.9);
    rim += (vec3(1.0, 0.957, 0.878) * core * 1.05 + vec3(1.0, 0.416, 0.0) * body * 0.34 + vec3(1.0, 0.118, 0.235) * wake * 0.16) * R.w;
    shock += g * R.w;
  }
  float heatM = 0.0;
  if (uCine.z > 0.0) {
    float m = 1.0 - smoothstep(0.0, 0.27, sp.y);
    m *= m;
    heatM = uCine.z * m;
    vec2 hp = sp * uScreen.xy * 0.05;                // ~20 css px wavelength
    float n1 = sin(hp.y * 1.7 + t * 7.5 + sin(hp.x * 0.83 + t * 1.3) * 2.2);
    float n2 = sin(hp.x * 1.25 - t * 2.3 + sin(hp.y * 1.05 + t * 5.1) * 1.7);
    ds += vec2(n2 * 0.55, n1) * (heatM * 6.0) * uScreen.zw;   // ≈ 3.6 css px at heat 0.6
  }
  float split = 0.0;
  float gBand = 0.0;
  float gTint = 0.0;
  if (uCine.y > 0.0) {
    float gA = uCine.y;
    float seed = floor(t * 20.0);
    float rows = 9.0 + floor(hash11(seed + 0.37) * 15.0);
    float bA = floor(sp.y * rows + hash11(seed + 4.1) * 3.0);
    float onA = step(1.0 - 0.5 * gA, hash12(vec2(bA, seed)));
    float bB = floor(sp.y * 150.0 + hash11(seed) * 9.0);
    float onB = step(1.0 - 0.3 * gA, hash12(vec2(bB, seed + 5.0)));
    ds.x += ((hash12(vec2(bA, seed + 9.0)) - 0.5) * 0.2 * onA + (hash12(vec2(bB, seed + 3.0)) - 0.5) * 0.05 * onB) * gA;
    split = (onA * 0.016 + onB * 0.007 + 0.003) * gA;
    gBand = onA * gA;
    gTint = hash12(vec2(bA, seed + 1.0));
  }
  uv += ds / uMap.xy;
  vec2 zc = (uZoomCenter - uMap.zw) / uMap.xy;
  float zoom = uCine.x * 0.6;                        // calibration: zoom 0.3 → streaks 18 % of the way to the centre
  float hot = clamp(uCine.x * 10.0, 0.0, 1.0);        // highlight emphasis only while zooming (stars streak, UI doesn't smear)
  float neutral = smoothstep(0.02, 0.14, uCine.x);    // strong zoom: all channels share the streak (no RGB ghost copies)
  // One gather does CA, glitch split and radial zoom. Tap i has a fixed *spectral* slot k (red → blue, sets the CA /
  // split offset and the channel weights) and a *zoom* slot z = stride-3 permutation of i plus per-pixel jitter, so
  // every channel sees the whole streak → neutral streaks (no rainbow), smooth dispersive fringes.
  vec2 spread = caOff * 1.5 + vec2(split / uMap.x, 0.0);
  // jitter is constant along each radial ray (random per ~1.5 css px of arc): leftover sampling noise becomes
  // radial streak texture that reads as speed, instead of isotropic sand
  vec2 dz = (sp - uZoomCenter) * uScreen.xy;
  float ray = floor((atan(dz.y, dz.x) * 0.15915 + 0.5) * 1700.0);
  float j = hash12(vec2(ray, floor(t * 30.0)));
  vec3 acc = vec3(0.0);
  vec3 wsum = vec3(0.0);
  float aacc = 0.0;
  for (int i = 0; i < 8; i++) {
    float k = (float(i) + 0.5) * 0.125;
    float z = (mod(float(i) * 3.0, 8.0) + j) * 0.125;
    z = pow(z, 1.4);                                   // denser near the pixel, sparse (and faint) in the tail
    vec4 s = tap(mix(uv, zc, z * zoom) + spread * (1.0 - 2.0 * k));
    vec3 w = mix(clamp(vec3(1.0 - 2.0 * k, 1.0 - abs(2.0 * k - 1.0), 2.0 * k - 1.0), 0.0, 1.0), vec3(0.5), neutral);
    w *= (1.0 + hot * 1.6 * dot(s.rgb, LUMA)) * (1.0 - 0.7 * z * hot);   // decaying motion-trail tail
    acc += s.rgb * w;
    wsum += w;
    aacc += s.a;
  }
  c = vec4(acc / wsum, aacc * 0.125);
#else
  // 5-tap spectral CA: smooth red→blue dispersion instead of discrete ghost copies at storm strength (2.5 px).
  // At the centre caOff = 0 → every tap hits the same texel centre → bit-exact, no softening.
  vec4 g = tap(uv);
  vec4 p1 = tap(uv + caOff), p2 = tap(uv + caOff * 0.5), m2 = tap(uv - caOff * 0.5), m1 = tap(uv - caOff);
  c = vec4(p1.r * 0.5 + p2.r * 0.35 + g.r * 0.15,
           g.g * 0.5 + (p2.g + m2.g) * 0.25,
           m1.b * 0.5 + m2.b * 0.35 + g.b * 0.15,
           g.a);
#endif

  float a = c.a;
  vec3 col = grade(c.rgb / max(a, 1e-5));

#if CINEMATIC
  // shock rim: white-hot core, red outer / blue inner fringe; added after the grade so it stays hot
  col += rim * vec3(1.0, 0.93, 0.84) * 1.15 + shock * vec3(1.0, 0.42, 0.08) * 0.07;
  col += heatM * vec3(1.0, 0.42, 0.0) * 0.045;
  if (gBand > 0.0) {
    vec3 gt = mix(vec3(0.23, 0.95, 1.0), vec3(1.0, 0.17, 0.84), step(0.5, gTint));
    col = mix(col, col * 0.7 + gt * 0.2, gBand * step(0.62, gTint) * 0.5);   // only some bands get a tint
    col *= 1.0 - 0.22 * gBand * mod(floor(gl_FragCoord.y / max(uFx2.w, 1.0)), 2.0);
  }
#endif

  // tinted vignette (aspect-true: corners most, long edges least). Highlights are protected so emitters near the
  // edge (sun, glowing gems) keep their hue instead of being dragged into the tint.
  float v = smoothstep(0.3, 1.1, r);
  float lv = dot(col, LUMA);
  col *= mix(vec3(1.0), uVigTint, clamp(uFx.y * v * (1.0 - 0.65 * smoothstep(0.45, 1.0, lv)), 0.0, 1.0));

  // exposure flash toward white-hot #FFF4E0 (after the vignette: the flash is light, not tinted by the grade);
  // a slight falloff to the corners keeps it from reading as a flat white card
  col = mix(col, uFlash, uFx.w * (1.0 - 0.22 * r * r));

  // film grain: TPDF, luminance-weighted (lives in the mids), plus ±1 LSB dither that kills 8-bit banding
  vec2 fc = gl_FragCoord.xy;
  float n = hash12(fc + uFx2.z * vec2(37.17, 17.31)) + hash12(fc.yx + uFx2.z * vec2(11.73, 53.19)) - 1.0;
  float l = dot(col, LUMA);
  col += n * (uFx.z * (0.3 + 2.8 * l * (1.0 - l)) + 1.0 / 255.0);

  finalColor = vec4(clamp(col, 0.0, 1.0) * a, a);
}
`;
}
