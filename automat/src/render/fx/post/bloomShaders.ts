// Bloom chain shaders (all WebGL2).
//
//   prefilter  full res → ¼ res : 4 bilinear taps (= 4×4 box), soft-knee threshold per tap, Karis-weighted
//                                 (kills sparkle flicker from 1–2 px particles / stars)
//   down       dual-filter (Bjørge) 5-tap downsample, ½ per level
//   up         dual-filter 8-tap tent upsample of the coarser level, blended with a 3×3 tent of the current level
//              by `scatter` (energy-normalised mix of radii → tight core + wide halo)
//   composite  full res: scene + (a − scene)·(1 − e^(−bloom·k))·spill — additive for dark pixels, soft shoulder for
//              bright ones (never hard-clips), emitter-protected (spill), untouched pixels are bit-exact
import { POST_COMMON } from './glsl.ts';

const HEAD = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
vec3 tap(vec2 uv) { return texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw)).rgb; }
${POST_COMMON}
`;

export const PREFILTER_FRAG = /* glsl */ `${HEAD}
uniform vec4 uThreshold; // threshold, knee, 1/(4·knee), -
vec3 knee(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold.x + uThreshold.y, 0.0, 2.0 * uThreshold.y);
  rq = rq * rq * uThreshold.z;
  return c * (max(rq, br - uThreshold.x) / max(br, 1e-4));
}
void main() {
  vec2 o = uInputPixel.zw;
  vec3 a = knee(tap(vTextureCoord + vec2(-o.x, -o.y)));
  vec3 b = knee(tap(vTextureCoord + vec2( o.x, -o.y)));
  vec3 c = knee(tap(vTextureCoord + vec2(-o.x,  o.y)));
  vec3 d = knee(tap(vTextureCoord + vec2( o.x,  o.y)));
  float wa = 1.0 / (1.0 + dot(a, LUMA));
  float wb = 1.0 / (1.0 + dot(b, LUMA));
  float wc = 1.0 / (1.0 + dot(c, LUMA));
  float wd = 1.0 / (1.0 + dot(d, LUMA));
  finalColor = vec4((a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd), 1.0);
}
`;

export const DOWN_FRAG = /* glsl */ `${HEAD}
void main() {
  vec2 o = uInputPixel.zw;
  vec3 s = tap(vTextureCoord) * 4.0;
  s += tap(vTextureCoord + vec2(-o.x, -o.y));
  s += tap(vTextureCoord + vec2( o.x, -o.y));
  s += tap(vTextureCoord + vec2(-o.x,  o.y));
  s += tap(vTextureCoord + vec2( o.x,  o.y));
  finalColor = vec4(s * 0.125, 1.0);
}
`;

export const UP_FRAG = /* glsl */ `${HEAD}
uniform sampler2D uCurr;
uniform vec4 uCurrMap;   // xy: input uv → current-level uv; zw: ½ texel of the current level
uniform vec4 uCurrClamp; // valid uv rect of the current level
uniform float uScatter;
vec3 ctap(vec2 uv) { return texture(uCurr, clamp(uv, uCurrClamp.xy, uCurrClamp.zw)).rgb; }
void main() {
  vec2 uv = vTextureCoord;
  vec2 o = uInputPixel.zw;
  vec3 s = tap(uv + vec2(-o.x, 0.0)) + tap(uv + vec2(o.x, 0.0)) + tap(uv + vec2(0.0, -o.y)) + tap(uv + vec2(0.0, o.y));
  vec2 h = o * 0.5;
  s += (tap(uv + vec2(-h.x, -h.y)) + tap(uv + vec2(h.x, -h.y)) + tap(uv + vec2(-h.x, h.y)) + tap(uv + h)) * 2.0;
  s *= 1.0 / 12.0;
  vec2 cuv = uv * uCurrMap.xy;
  vec2 co = uCurrMap.zw;
  vec3 cur = (ctap(cuv + vec2(-co.x, -co.y)) + ctap(cuv + vec2(co.x, -co.y)) + ctap(cuv + vec2(-co.x, co.y)) + ctap(cuv + co)) * 0.25;
  finalColor = vec4(mix(cur, s, uScatter), 1.0);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uBloomTex;
uniform vec4 uBloomMap;   // xy: input uv → bloom uv; zw: unused
uniform vec4 uBloomClamp;
uniform vec4 uBloomMix;   // intensity, emitter protection, -, -
vec3 btap(vec2 uv) { return texture(uBloomTex, clamp(uv, uBloomClamp.xy, uBloomClamp.zw)).rgb; }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  // One bilinear tap is enough: the finest pyramid level was already tent-filtered in the last up pass, so ×4
  // magnification shows no texel grid (A/B'd against a 4-tap tent at 3.5× zoom: indistinguishable).
  vec3 b = btap(vTextureCoord * uBloomMap.xy);
  // Emitter protection: light spills onto the dark surroundings, but already-bright pixels (gem bodies, type)
  // receive little of it, so saturated emitters keep their colour and facet detail instead of washing to pastel.
  float L = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float spill = mix(1.0, (1.0 - L) * (1.0 - L), uBloomMix.y);
  c.rgb += max(vec3(c.a) - c.rgb, 0.0) * (1.0 - exp(-b * uBloomMix.x)) * spill;
  finalColor = c;
}
`;
