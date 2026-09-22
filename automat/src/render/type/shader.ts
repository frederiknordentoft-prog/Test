// Isfont — shared glyph shader (one GlProgram for every IsText) and style palettes.
import { GlProgram } from 'pixi.js';
import { PPU, MARGIN, SD_MIN, SD_RANGE } from './atlas.ts';

export type IsStyle = 'ice' | 'gold' | 'molten' | 'plasma' | 'muted';

/** Packed style + runtime uniforms: vec4 uS[N_VEC]. */
export const N_VEC = 14;
export const U_GLOW = 9 * 4, U_SWEEP = 9 * 4 + 1, U_REVEAL = 9 * 4 + 2, U_TIME = 9 * 4 + 3;
export const U_TEXTW = 10 * 4, U_SHIMMER = 10 * 4 + 1, U_AURORA = 10 * 4 + 2, U_REVK = 10 * 4 + 3;
export const U_SHADOW = 11 * 4, U_SLITY = 11 * 4 + 1, U_SLITW = 11 * 4 + 2, U_REFLECT = 11 * 4 + 3;
export const U_EXTRUDE = 12 * 4 + 3, U_SPREAD = 13 * 4, U_HORIZON = 13 * 4 + 1;

interface StyleDef {
  face0: number; face1: number; face2: number;   // bottom, middle, top of the cap height
  horizon: number;                               // metal "horizon" darkening below the middle
  core: number; coreAmt: number;                 // hot/bright stroke centre
  edge: number; edgeAmt: number;                 // inner-edge tint (refraction / heat rim)
  emissive: number;                              // 0 = lit metal, 1 = self-lit
  spec: number; specAmt: number;
  rim: number; rimA: number;                     // outline colour / opacity
  glow: number; glowFall: number; glowAmt: number;
  shadow: number;                                // offset soft shadow opacity
  bevelW: number; bevelStr: number;              // bevel width (fraction of half-width), strength
  weight: number; outline: number;               // stroke weight offset, outline width (units)
  shimmer: number; aurora: number;
  extrude: number; extrudeC: number;             // display-size 3D depth (units) and side colour
  spread: number;                                // shadow softness (units)
}

const STYLES: Record<IsStyle, StyleDef> = {
  ice: {
    face0: 0xa9d8ff, face1: 0xeaf8ff, face2: 0xffffff, horizon: 0.3,
    core: 0xffffff, coreAmt: 0.2, edge: 0x5fd0ff, edgeAmt: 0.55, emissive: 0.35,
    spec: 0xffffff, specAmt: 0.9, rim: 0x04102a, rimA: 0.92,
    glow: 0x5cc8ff, glowFall: 1.05, glowAmt: 0.85, shadow: 0.5,
    bevelW: 0.5, bevelStr: 1.4, weight: 0, outline: 0.34, shimmer: 0, aurora: 1,
    extrude: 0.9, extrudeC: 0x1d4f7a, spread: 1.4,
  },
  gold: {
    face0: 0xffc25a, face1: 0xffd36b, face2: 0xfff4c8, horizon: 0.55,
    core: 0xfff0b8, coreAmt: 0.0, edge: 0xfff2c0, edgeAmt: 0.25, emissive: 0.2,
    spec: 0xffffff, specAmt: 1.1, rim: 0x2a1300, rimA: 0.95,
    glow: 0xffa83a, glowFall: 1.15, glowAmt: 0.9, shadow: 0.55,
    bevelW: 1.0, bevelStr: 0.9, weight: 0.08, outline: 0.36, shimmer: 0, aurora: 0,
    extrude: 1.0, extrudeC: 0x7a3c06, spread: 1.4,
  },
  molten: {
    face0: 0xff5a00, face1: 0xffa21e, face2: 0xfff4e0, horizon: 0,
    core: 0xfffbf0, coreAmt: 0.55, edge: 0xc81800, edgeAmt: 0.6, emissive: 0.85,
    spec: 0xfff4e0, specAmt: 0.7, rim: 0x160100, rimA: 1,
    glow: 0xff4a0a, glowFall: 1.25, glowAmt: 1.0, shadow: 0.8,
    bevelW: 0.6, bevelStr: 1.0, weight: 0.06, outline: 0.46, shimmer: 0.12, aurora: 0,
    extrude: 1.0, extrudeC: 0x5a0a00, spread: 1.7,
  },
  plasma: {
    face0: 0xff2a6a, face1: 0xff5ae0, face2: 0xfff0fb, horizon: 0,
    core: 0xffffff, coreAmt: 0.5, edge: 0xd0003c, edgeAmt: 0.55, emissive: 0.85,
    spec: 0xffe8fa, specAmt: 0.6, rim: 0x14000c, rimA: 1,
    glow: 0xff2bd6, glowFall: 1.25, glowAmt: 1.0, shadow: 0.8,
    bevelW: 0.6, bevelStr: 1.0, weight: 0.06, outline: 0.46, shimmer: 0.08, aurora: 0,
    extrude: 0.9, extrudeC: 0x4a0030, spread: 1.7,
  },
  muted: {
    face0: 0x7f93b2, face1: 0x93a6c4, face2: 0xc3d0e4, horizon: 0.1,
    core: 0xffffff, coreAmt: 0, edge: 0xffffff, edgeAmt: 0, emissive: 0.3,
    spec: 0xffffff, specAmt: 0.3, rim: 0x050b1a, rimA: 0.75,
    glow: 0x2a4a7a, glowFall: 1.0, glowAmt: 0.45, shadow: 0.45,
    bevelW: 0.45, bevelStr: 0.9, weight: 0.05, outline: 0.3, shimmer: 0, aurora: 0,
    extrude: 0, extrudeC: 0x0a1428, spread: 1.3,
  },
};

const put = (u: Float32Array, i: number, c: number, w: number) => {
  u[i] = ((c >> 16) & 255) / 255; u[i + 1] = ((c >> 8) & 255) / 255; u[i + 2] = (c & 255) / 255; u[i + 3] = w;
};

/** Write a style's constants into the packed uniform array (runtime slots untouched). */
export function writeStyle(u: Float32Array, name: IsStyle, size: number): void {
  const s = STYLES[name] ?? STYLES.ice;
  put(u, 0, s.face0, s.horizon);
  put(u, 4, s.face1, s.coreAmt);
  put(u, 8, s.face2, s.edgeAmt);
  put(u, 12, s.core, s.emissive);
  put(u, 16, s.edge, s.specAmt);
  put(u, 20, s.rim, s.rimA);
  put(u, 24, s.glow, s.glowFall);
  put(u, 28, s.spec, s.glowAmt);
  u[32] = s.bevelW; u[33] = s.bevelStr; u[34] = s.weight; u[35] = s.outline;
  // aurora reflection only on display sizes
  const big = Math.min(1, Math.max(0, (size - 18) / 22));
  u[U_AURORA] = s.aurora * big;
  u[U_SHIMMER] = s.shimmer;
  u[U_SHADOW] = s.shadow;
  put(u, 48, s.extrudeC, s.extrude * Math.min(1, Math.max(0, (size - 22) / 16)));
  u[U_SPREAD] = s.spread;
  if (!u[U_HORIZON]) u[U_HORIZON] = 0.5;
}

/** Glow base amount of a style (multiplies the runtime .glow). */
export function styleGlow(name: IsStyle): number { return (STYLES[name] ?? STYLES.ice).glowAmt; }

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
in vec2 aUV;
in vec2 aText;
in vec4 aMisc;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform mat3 uTransformMatrix;
uniform vec4 uColor;
out vec2 vUV;
out vec2 vText;
out vec4 vMisc;
out vec4 vColor;
void main() {
  mat3 m = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((m * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vText = aText;
  vMisc = aMisc;
  vColor = uWorldColorAlpha * uColor;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vText;
in vec4 vMisc;
in vec4 vColor;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uS[${N_VEC}];

const float SDMIN = ${SD_MIN.toFixed(3)};
const float SDRANGE = ${SD_RANGE.toFixed(3)};
const float PPU = ${PPU.toFixed(3)};
const float MARGIN = ${MARGIN.toFixed(3)};
const vec2 ATLAS = vec2(__AW__, __AH__);

vec3 auroraRamp(float x) {
  vec3 a = vec3(0.24, 1.0, 0.69), b = vec3(0.10, 0.89, 0.84), c = vec3(0.54, 0.36, 1.0);
  float t = fract(x) * 3.0;
  return t < 1.0 ? mix(a, b, t) : (t < 2.0 ? mix(b, c, t - 1.0) : mix(c, a, t - 2.0));
}

void main() {
  vec4 P8 = uS[8];
  vec4 P9 = uS[9];
  vec4 P10 = uS[10];
  float glowAmt = P9.x * uS[7].w;
  float time = P9.w;
  // units per device pixel (optical sizing + analytic AA)
  vec2 tp = vUV * ATLAS;
  float upp = max(length(fwidth(tp)) * 0.7071 / PPU, 1e-3);
  float weight = P8.z + clamp(0.85 * upp - 1.0, 0.0, 0.55);
  float halfW = 1.0 + weight;

  // reveal (per-letter stagger)
  float lr = 1.0;
  float vis = 1.0;
  float tip = 0.0;
  vec4 tx = texture(uTexture, vUV);
  if (P9.z < 0.999) {
    lr = clamp(P9.z * (1.0 + P10.w) - vMisc.y * P10.w, 0.0, 1.0);
    float lr2 = lr * 1.06 - 0.03;
    vis = smoothstep(lr2 + 0.025, lr2 - 0.025, tx.g);
    tip = step(0.001, lr) * (1.0 - step(0.999, lr)) * exp(-abs(tx.g - lr2) * 26.0);
  }

  if (vMisc.z > 0.5) {
    vec2 q = vText;
    float I;
    if (vMisc.z < 1.5) {
      // north-star glint: four-point star (quad-local coords in vText)
      float h = exp(-abs(q.y) * 34.0) * pow(max(1.0 - abs(q.x), 0.0), 2.2);
      float v = exp(-abs(q.x) * 34.0) * pow(max(1.0 - abs(q.y) * 1.6, 0.0), 2.2);
      float dg = exp(-length(q) * 9.0);
      float tw = 0.78 + 0.22 * sin(time * 2.3 + vMisc.w * 6.2831);
      I = ((h + v * 0.8) * 1.1 + dg * 1.6) * tw * smoothstep(0.85, 1.0, lr);
    } else {
      // horizon streak: grows out from the centre as the word is revealed
      float ax = abs(q.x);
      float grow = smoothstep(0.25, 1.0, P9.z);
      float reach = smoothstep(grow, grow * 0.6, ax);
      float core = exp(-abs(q.y) * 22.0) * pow(max(1.0 - ax, 0.0), 1.6);
      float halo = exp(-abs(q.y) * 5.0) * pow(max(1.0 - ax, 0.0), 3.0) * 0.22;
      I = (core + halo) * reach * (1.0 + 0.6 * exp(-pow((q.x * 0.5 + 0.5 - P9.y) * 6.0, 2.0)));
    }
    vec3 col = mix(uS[6].rgb, vec3(1.0), vMisc.z < 1.5 ? 0.6 : 0.35) * I * max(glowAmt, 0.3);
    finalColor = vec4(col, 0.0) * vColor * vMisc.x;
    return;
  }

  float sd = tx.r * SDRANGE + SDMIN - weight;
  vec2 g = tx.ba * 2.0 - 1.0;
  // horizon slit (display logos): a thin cut through every letter, faded out when sub-pixel
  vec4 P11 = uS[11];
  float below = 0.0;
  if (P11.z > 0.0) {
    float slw = P11.z * smoothstep(0.9, 1.8, P11.z / upp);
    float dy = abs(vText.y - P11.y) - slw * 0.5;
    if (slw > 0.0 && -dy > sd) { sd = -dy; g = vec2(0.0, vText.y > P11.y ? -1.0 : 1.0); }
    below = smoothstep(P11.y + 0.05, P11.y - 0.05, vText.y) * P11.w;
  }
  float face = clamp(0.5 - sd / upp, 0.0, 1.0);
  float ow = min(max(P8.w, upp * 0.85), 0.95);
  float rim = clamp(0.5 - (sd - ow) / upp, 0.0, 1.0);

  // bevel normal from the stored distance gradient
  float inset = max(-sd, 0.0);
  float bw = max(P8.x * halfW, upp * 1.1);
  float k = clamp(inset / bw, 0.0, 1.0);
  float slope = (1.0 - k) * (1.0 - k * 0.35);
  vec3 N = normalize(vec3(g * slope * P8.y, 1.0));
  const vec3 L = vec3(-0.3713, 0.7427, 0.5571);
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 16.0);

  // body gradient over the cap height, with a metal horizon
  float y = clamp(vText.y / 14.0, -0.3, 1.3);
  float e = clamp(upp / 14.0, 0.004, 0.08);
  float hy = uS[13].y;
  vec3 top = mix(uS[1].rgb, uS[2].rgb, smoothstep(hy, 1.0, y));
  vec3 bot = mix(uS[0].rgb, uS[1].rgb * (1.0 - 0.45 * uS[0].w), smoothstep(0.0, hy, y));
  vec3 fc = mix(bot, top, smoothstep(hy - e, hy + e, y));

  // aurora reflection (display-size ice)
  if (P10.z > 0.0) {
    vec3 ac = auroraRamp(vText.x * 0.021 - time * 0.035 + y * 0.12);
    fc = mix(fc, fc * ac * 1.35, P10.z * clamp(1.0 - y * 1.25, 0.0, 1.0) * 0.6);
  }
  // below the horizon: the word's reflection in the sea — deeper, aurora-tinted, rippled
  if (below > 0.0) {
    vec3 ac = P10.z > 0.0 ? auroraRamp(vText.x * 0.017 + 0.35 - time * 0.02) : uS[4].rgb;
    float rip = 0.5 + 0.5 * sin(vText.y * 5.5 + sin(vText.x * 0.9 + time * 1.3) * 1.2 - time * 2.0);
    vec3 deep = mix(uS[0].rgb * 0.6, ac, 0.55) * (0.8 + 0.25 * rip);
    fc = mix(fc, deep, below * 0.75);
  }
  // hot core / inner edge tint
  float core = smoothstep(0.2, 0.95, inset / halfW);
  fc = mix(fc, uS[3].rgb, core * uS[1].w);
  fc = mix(fc, uS[4].rgb, (1.0 - smoothstep(0.0, bw * 1.25, inset)) * uS[2].w);
  // heat shimmer (molten / plasma)
  if (P10.y > 0.0) {
    float f = sin(vText.x * 0.55 - time * 3.6 + vText.y * 0.4) * sin(vText.x * 0.21 + time * 2.1 - vText.y * 0.2);
    fc *= 1.0 + P10.y * f;
  }
  float emis = uS[3].w;
  vec3 lit = fc * mix(0.58 + 0.66 * diff, 0.9 + 0.24 * diff, emis) + uS[7].rgb * spec * uS[4].w;

  // light sweep (slanted band across the whole word)
  float span = P10.x + 20.0;
  float cxs = -10.0 + (P9.y + 0.0) * span;
  float ds = vText.x + (vText.y - 7.0) * 0.45 - cxs;
  float sw = exp(-ds * ds / 5.0) * smoothstep(-0.2, -0.1, P9.y) * smoothstep(1.2, 1.1, P9.y);

  // glow (two-lobe falloff, faded to zero at the cell margin)
  float go = max(sd, 0.0);
  float fall = uS[6].w;
  float gl = exp(-go / fall) * 0.7 + exp(-go / (fall * 2.7)) * 0.3;
  gl *= smoothstep(MARGIN - weight - 0.2, MARGIN - weight - 1.8, go);
  gl *= glowAmt * (1.0 + tip * 3.0 + sw * 0.8);

  // soft offset shadow + display-size extrusion (the word as a block of ice / metal)
  vec2 offUV = vec2(-0.3, -0.9) * PPU / ATLAS;
  float sdS = texture(uTexture, vUV + offUV * 1.25).r * SDRANGE + SDMIN - weight;
  float spread = uS[13].x;
  float shA = uS[11].x * exp(-max(sdS, 0.0) / spread) * smoothstep(MARGIN - 0.3, MARGIN - 2.2, max(sdS, 0.0));

  vec4 c = vec4(0.0, 0.0, 0.0, shA);
  c.rgb += uS[6].rgb * gl;
  float exd = uS[12].w;
  if (exd > 0.0) {
    vec2 st = offUV * exd;
    float s1 = texture(uTexture, vUV + st * 0.34).r;
    float s2 = texture(uTexture, vUV + st * 0.67).r;
    float s3 = texture(uTexture, vUV + st).r;
    float sdE = min(min(s1, s2), s3) * SDRANGE + SDMIN - weight;
    float exA = clamp(0.5 - sdE / upp, 0.0, 1.0);
    float exR = clamp(0.5 - (sdE - ow * 0.8) / upp, 0.0, 1.0);
    // side shading: darker towards the back copy, lit a little from above
    float back = step(s3, min(s1, s2) + 1e-4);
    vec3 side = uS[12].rgb * mix(1.35, 0.75, back) * (0.85 + 0.3 * y);
    c = mix(c, vec4(uS[5].rgb, 1.0), exR * uS[5].w);
    c = mix(c, vec4(side, 1.0), exA);
  }
  c = mix(c, vec4(uS[5].rgb, 1.0), rim * uS[5].w);
  c = mix(c, vec4(lit, 1.0), face);
  c.rgb += (vec3(0.95) * sw + (uS[6].rgb * 0.6 + 0.8) * tip * 1.4) * face;
  c *= vis;
  finalColor = c * vColor * vMisc.x;
}
`;

let program: GlProgram | null = null;
export function isProgram(aw: number, ah: number): GlProgram {
  if (!program) {
    program = GlProgram.from({
      name: 'isfont',
      vertex: VERT,
      fragment: FRAG.replace('__AW__', aw.toFixed(1)).replace('__AH__', ah.toFixed(1)),
    });
  }
  return program;
}
