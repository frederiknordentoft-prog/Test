// Faceted gem shader for the four low crystals (L1 trillion, L2 princess, L3 hex brilliant, L4 pear).
// Brilliant-cut crown topology generated from ANY convex outline polygon:
//   per outline edge k (cone between rays to V_k and V_k+1):  star facet (T_k,T_k+1,M_k),
//   two upper-girdle facets (V_k,G_k,M_k) (G_k,V_k+1,M_k) and halves of the kite (bezel) facets at V_k / V_k+1.
//   T = table vertex (outline × uTable), M = star apex (edge midpoint × uMid), G = girdle midpoint.
// The table shows a mirrored "pavilion" reflection of the same facet structure (hearts & arrows feel).
import { ART_HEAD } from './glsl.ts';

export const MAX_POLY = 16;

export const GEM_FRAG = ART_HEAD + /* glsl */ `
uniform vec2 uPoly[${MAX_POLY}];
uniform int uN;
uniform vec2 uCenter;
uniform float uTable;
uniform float uMid;
uniform float uCrownH;
uniform float uRound;
uniform float uScale;      // overall size multiplier (polygon units → p units)
uniform vec3 uHue;
uniform vec3 uDeep;
uniform vec3 uVein;
uniform vec3 uVeinCore;
uniform vec4 uSpark;       // xy pos (p space), z size, w strength  (main sparkle)
uniform vec4 uSpark2;

vec2 PV(int i) { return uPoly[(i + uN) % uN]; }

float sdPoly(vec2 p) {
  vec2 v0 = uPoly[0];
  float d = dot(p - v0, p - v0);
  float s = 1.0;
  for (int i = 0; i < ${MAX_POLY}; i++) {
    if (i >= uN) break;
    int jj = (i + uN - 1) % uN;
    vec2 vi = uPoly[i], vj = uPoly[jj];
    vec2 e = vj - vi, w = p - vi;
    vec2 b = w - e * sat(dot(w, e) / dot(e, e));
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s *= -1.0;
  }
  return s * sqrt(d);
}

// Facet lookup. q: polygon space (fan centre at origin).
// n: facet normal, fid: facet id (-1 = table), ed: distance to nearest facet edge, g: gauge (1 = girdle)
void facet(vec2 q, out vec3 n, out float fid, out float ed, out float g, out vec2 fc, out float kk) {
  int k = 0; float best = -1e9;
  for (int i = 0; i < ${MAX_POLY}; i++) {
    if (i >= uN) break;
    vec2 a = uPoly[i], b = PV(i + 1);
    vec2 e = b - a;
    vec2 nn = normalize(vec2(e.y, -e.x));
    float gg = dot(q, nn) / dot(a, nn);
    if (gg > best) { best = gg; k = i; }
  }
  g = best; kk = float(k);
  float s = uTable;
  vec2 a = PV(k), b = PV(k + 1), ap = PV(k - 1), bn = PV(k + 2);
  vec2 Ta = a * s, Tb = b * s, Tp = ap * s, Tn = bn * s;
  vec2 G = (a + b) * 0.5;
  vec2 M = G * uMid;
  vec2 Mp = (ap + a) * 0.5 * uMid;
  vec2 Mn = (b + bn) * 0.5 * uMid;
  float hT = uCrownH;
  float hM = hT * (1.0 - (uMid - s) / (1.0 - s)) * 1.22;
  if (g < s) {
    n = vec3(0.0, 0.0, 1.0); fid = -1.0; fc = vec2(0.0);
    ed = min(sdSeg(q, Ta, Tb), min(sdSeg(q, Tp, Ta), sdSeg(q, Tb, Tn)));
    return;
  }
  vec2 m = q - M;
  float c0 = cross2(Ta - M, m), c1 = cross2(a - M, m), c2 = cross2(G - M, m), c3 = cross2(b - M, m), c4 = cross2(Tb - M, m);
  int j = 4;
  if (c0 >= 0.0 && c1 < 0.0) j = 0;
  else if (c1 >= 0.0 && c2 < 0.0) j = 1;
  else if (c2 >= 0.0 && c3 < 0.0) j = 2;
  else if (c3 >= 0.0 && c4 < 0.0) j = 3;
  vec3 Ta3 = vec3(Ta, hT), Tb3 = vec3(Tb, hT), a3 = vec3(a, 0.0), b3 = vec3(b, 0.0), G3 = vec3(G, 0.0), M3 = vec3(M, hM);
  vec3 nr;
  if (j == 0) { nr = cross(M3 - vec3(Mp, hM), Ta3 - a3); fid = float(k) * 4.0 + 3.0; fc = (Ta + a + M + Mp) * 0.25; }
  else if (j == 3) { nr = cross(vec3(Mn, hM) - M3, Tb3 - b3); fid = float((k + 1) % uN) * 4.0 + 3.0; fc = (Tb + b + M + Mn) * 0.25; }
  else if (j == 1) { nr = cross(G3 - a3, M3 - a3); fid = float(k) * 4.0 + 1.0; fc = (a + G + M) / 3.0; }
  else if (j == 2) { nr = cross(b3 - G3, M3 - G3); fid = float(k) * 4.0 + 2.0; fc = (G + b + M) / 3.0; }
  else { nr = cross(Ta3 - Tb3, M3 - Tb3); fid = float(k) * 4.0; fc = (Ta + Tb + M) / 3.0; }
  if (nr.z < 0.0) nr = -nr;
  n = normalize(nr);
  float e1 = min(min(sdSeg(q, M, Ta), sdSeg(q, M, a)), min(sdSeg(q, M, G), sdSeg(q, M, b)));
  float e2 = min(sdSeg(q, M, Tb), sdSeg(q, Ta, Tb));
  float e3 = min(min(sdSeg(q, Mp, Ta), sdSeg(q, Mp, a)), min(sdSeg(q, Mn, Tb), sdSeg(q, Mn, b)));
  ed = min(min(e1, e2), e3);
}

vec3 gemRamp(float x) {
  // deep → hue → pale hue → white. Most of the stone lives in the saturated middle.
  vec3 c = mix(uDeep * 0.45, uDeep, smoothstep(0.0, 0.18, x));
  c = mix(c, uHue, smoothstep(0.14, 0.62, x));
  c = mix(c, mix(uHue, vec3(1.0), 0.5), smoothstep(0.62, 0.98, x));
  return mix(c, vec3(1.0), smoothstep(0.98, 1.35, x));
}
vec3 obsRamp(float x) {
  // black volcanic glass, faintly tinted by the gem's own (hot) vein colour so each stone keeps its family
  vec3 mid = mix(vec3(0.075, 0.024, 0.034), uVein * 0.09, 0.45);
  vec3 c = mix(vec3(0.012, 0.004, 0.008), mid, smoothstep(0.0, 0.55, x));
  return mix(c, mix(vec3(0.34, 0.22, 0.24), uVein * 0.5, 0.3), smoothstep(0.65, 1.3, x));
}

// full shading of one sample (no alpha). q: polygon space.
vec3 shadeGem(vec2 q, out float edOut, out vec3 nOut, out float gOut) {
  vec3 n; float fid; float ed; float g; vec2 fc; float kk;
  facet(q, n, fid, ed, g, fc, kk);
  edOut = ed; gOut = g;
  bool storm = uStorm > 0.5;
  vec3 H = normalize(KEY + vec3(0.0, 0.0, 1.0));
  float side = sat(dot(q, vec2(-0.6, 0.8)) * 0.8 + 0.5);   // 1 = top-left (lit) → 0 = bottom-right
  vec3 col;
  if (fid < 0.0) {
    // TABLE — "hearts & arrows": 2N wedges seen through the flat table, alternating value
    int k = int(kk);
    vec2 a = PV(k), b = PV(k + 1);
    vec2 G = (a + b) * 0.5;
    float hf = cross2(G, q) > 0.0 ? 1.0 : 0.0;
    float wid = kk * 2.0 + hf;
    float alt = mod(wid + (storm ? 1.0 : 0.0), 2.0);
    float rr = g / uTable;                      // 0 centre → 1 table border
    float wr = hash11(wid * 2.31 + uSeed * 5.0);
    float lum = 0.20 + 0.36 * alt + 0.20 * wr + 0.30 * (side - 0.5);
    lum *= 0.62 + 0.55 * smoothstep(0.05, 1.0, rr);          // light returns along the arrows
    lum = mix(lum, 0.95, exp(-rr * rr * 38.0) * 0.55);       // small bright culet star
    col = storm ? obsRamp(lum * 0.8) : gemRamp(lum);
    // arrow lines (fine, low contrast)
    float wl = min(min(sdSeg(q, vec2(0.0), a * uTable), sdSeg(q, vec2(0.0), b * uTable)), sdSeg(q, vec2(0.0), G * uTable * 0.96));
    float wline = 1.0 - smoothstep(0.3 * uPx, 1.2 * uPx, wl * uScale);
    col = mix(col, storm ? uVein * 0.5 : mix(uHue, vec3(1.0), 0.45), wline * 0.28 * smoothstep(0.1, 0.5, rr));
    // glassy table surface: soft diagonal reflection + faint env
    float tq = dot(q / uTable, vec2(0.62, -0.78));
    float sheen = smoothstep(0.25, -0.35, tq) * (0.55 + 0.45 * smoothstep(0.9, 0.2, rr));
    col += vec3(1.0) * sheen * (storm ? 0.035 : 0.10);
    col += envRefl(vec3(-q / uTable * 0.6, 0.8)) * (storm ? 0.05 : 0.14) * smoothstep(0.2, 1.0, rr);
    nOut = vec3(0.0, 0.0, 1.0);
  } else {
    // CROWN facet
    n = normalize(n + (hash31(fid * 1.731 + uSeed * 7.0) - 0.5) * vec3(0.22, 0.22, 0.0));
    vec3 nb = normalize(n + vec3((q - fc) * 0.40, 0.0));    // slight convexity → gradient across a facet
    nOut = n;
    float ndl = dot(nb, KEY);
    float fr = hash11(fid * 1.37 + uSeed);
    float lum = 0.04 + 0.92 * pow(sat(ndl * 1.25 - 0.05), 1.7);
    lum += (fr - 0.5) * 0.42;
    // light return: bottom-right facets carry the saturated inner bounce, not black
    float back = sat(dot(n.xy, vec2(0.6, -0.8)) * 3.0);
    lum = max(lum, back * (0.30 + 0.32 * fr));
    lum -= smoothstep(0.85, 1.0, g) * 0.10;                  // thick glass at the girdle
    lum += 0.10 * (side - 0.5);
    col = storm ? obsRamp(lum) : gemRamp(lum);
    vec3 R = reflect(vec3(0.0, 0.0, -1.0), nb);
    float fres = 0.18 + 2.2 * (1.0 - n.z);
    vec3 env = envRefl(R);
    env = mix(env, luma(env) * (uHue * 0.8 + 0.2), storm ? 0.0 : 0.35);   // keep the stone saturated under any sky
    col += env * fres * (storm ? 0.30 : 0.52) * (storm ? (0.35 + 0.9 * (1.0 - side)) : 1.0);
    float sp = pow(max(dot(nb, H), 0.0), 80.0);
    col += (storm ? vec3(1.0, 0.80, 0.74) : vec3(1.0, 0.99, 0.96)) * sp * (storm ? 0.9 : 1.15);
  }
  return col;
}

void main() {
  vec2 p = cellP();
  vec2 q = (p - uCenter) / uScale;
  float pxq = uPx / uScale;
  bool storm = uStorm > 0.5;

  // silhouette
  float d = (sdPoly(q) - uRound) * uScale;
  float cov = cover(d);

  vec3 inside = vec3(0.0);
  if (d < 2.0 * uPx) {
    // 3-tap radial dispersion (fringes at facet seams, stronger toward the girdle)
    vec2 dir = normalize(q + vec2(1e-4));
    vec2 dq = dir * pxq * 1.1;
    float edR, edG, edB, gR, gG, gB; vec3 nR, nG, nB;
    vec3 cR = shadeGem(q + dq, edR, nR, gR);
    vec3 cG = shadeGem(q, edG, nG, gG);
    vec3 cB = shadeGem(q - dq, edB, nB, gB);
    vec3 col = vec3(cR.r, cG.g, cB.b);

    // facet edge highlights: bright on the lit side, hue-tinted in the shade
    float edPx = edG * uScale;
    float line = 1.0 - smoothstep(0.2 * uPx, 1.25 * uPx, edPx);
    float facing = sat(dot(nG, KEY) * 1.6 - 0.25);
    float sd = sat(dot(q, vec2(-0.6, 0.8)) * 0.8 + 0.5);
    vec3 edgeCol = storm ? mix(uVein, uVeinCore, 0.3) * (0.45 + 0.7 * facing)
                         : mix(uHue, vec3(1.0), 0.35 + 0.5 * facing) * (0.55 + 0.6 * max(facing, sd));
    col = mix(col, edgeCol, line * (storm ? 0.60 : 0.58));

    // storm: magma veins seen through the faceted glass (offset per facet normal = refraction).
    // Veins = zero-crossings of two warped fbm fields → thin, continuous, branching cracks.
    if (storm) {
      vec2 vp = q * 1.25 + nG.xy * 0.22 + uSeed * 3.7;
      vp += (vec2(fbm3(vp * 0.9), fbm3(vp * 0.9 + 7.3)) - 0.5) * 1.1;
      float l1 = abs(fbm4(vp * 1.1) - 0.5);
      float l2 = abs(fbm3(vp * 1.9 + 3.3) - 0.5);
      float pulse = 0.60 + 0.65 * fbm3(q * 1.4 + 11.0);
      float vein = (exp(-l1 / 0.020) + exp(-l2 / 0.011) * 0.35) * pulse;
      float core = (exp(-l1 / 0.006) + exp(-l2 / 0.0035) * 0.3) * pulse;
      float halo = (exp(-l1 / 0.08) + exp(-l2 / 0.05) * 0.25) * pulse;
      float inner = (1.0 - smoothstep(0.0, 0.95, gG)) * 0.16;
      col += uVein * (vein * 1.15 + halo * 0.24 + inner * 1.4) + uVeinCore * core * 1.05;
    }

    // girdle rim: thin bright lip, lit from top-left, hue rim light bottom-right
    float rim = 1.0 - smoothstep(0.35 * uPx, 2.2 * uPx, -d);
    float rimL = sat(dot(normalize(q), KEY.xy) * 0.9 + 0.35);
    vec3 rimCol = storm ? mix(uVein, uVeinCore, 0.45) * (0.55 + rimL)
                        : mix(mix(uHue, vec3(1.0), 0.25) * 0.9, vec3(1.0), rimL * 0.8) * (0.6 + 0.7 * rimL);
    col = mix(col, rimCol, rim * 0.8);

    // overall value structure: lit top-left, weight bottom-right
    col *= 0.86 + 0.26 * sd;
    inside = col;
  }

  // soft drop glow + shadow
  float od = max(d, 0.0);
  vec3 gc = storm ? uVein : uHue;
  float glow = (exp(-od / 0.035) * 0.55 + exp(-od / 0.12) * 0.26) * cellFade(p);
  float dsh = (sdPoly((p - uCenter - vec2(0.0, -0.045)) / uScale) - uRound) * uScale;
  float shadow = exp(-max(dsh, 0.0) / 0.045) * 0.5 * cellFade(p);

  vec4 outc = vec4(0.0, 0.0, 0.0, shadow);                          // dark drop
  outc = vec4(gc * glow, glow * 0.45) + outc * (1.0 - glow * 0.45);  // coloured glow over it
  outc = vec4(inside * cov, cov) + outc * (1.0 - cov);               // stone over

  // inner sparkles (star glints on facet junctions)
  float sk = sparkle(p - uSpark.xy, uSpark.z) * uSpark.w + sparkle(p - uSpark2.xy, uSpark2.z) * uSpark2.w;
  sk *= cellFade(p);
  vec3 skc = storm ? mix(vec3(1.0, 0.92, 0.8), uVeinCore, 0.3) : mix(vec3(1.0), uHue, 0.12);
  outc.rgb += skc * sk;
  outc.a = sat(outc.a + sk * 0.5);
  finalColor = outc;
}
`;

export interface GemDef {
  poly: [number, number][]; // CCW, polygon space (fan centre at origin)
  center: [number, number]; // p-space position of fan centre
  scale: number;
  table: number;
  mid: number;
  crownH: number;
  round: number;
  hue: number;
  deep: number;
  vein: number; // storm vein colour (hue family shifted hot)
  veinCore: number;
  seed: number;
}

const polar = (deg: number, r: number): [number, number] => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];

function ensureCCW(pts: [number, number][]): [number, number][] {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a < 0 ? pts.slice().reverse() : pts;
}

// L1 trillion: triangle, point up, gently convex sides
function trillion(): [number, number][] {
  const R = 1;
  const pts: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const a = 90 + i * 120;
    pts.push(polar(a, R));
    pts.push(polar(a + 60, R * 0.575));
  }
  return ensureCCW(pts);
}
// L2 princess: square rotated 45° (diamond), edges subdivided for a richer crown
function princess(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 4; i++) pts.push(polar(i * 90, 1));
  return ensureCCW(pts);
}
// L3 hexagonal brilliant: pointy-top hexagon, subdivided edges
function hexBrilliant(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) pts.push(polar(90 + i * 60, 1));
  return ensureCCW(pts);
}
// L4 pear / teardrop: point up, round belly
function pear(): [number, number][] {
  const pts: [number, number][] = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    // denser sampling around the belly
    const u = i / N;
    const t = u * Math.PI * 2;
    const x = -Math.sin(t) * Math.pow(Math.sin(t / 2), 1.15) * 0.92;
    const y = Math.cos(t) * 1.0;
    pts.push([x, y]);
  }
  // shift so the fan centre sits at the visual mass centre
  const cy = -0.2;
  return ensureCCW(pts.map(([x, y]) => [x, y - cy] as [number, number]));
}

export const GEM_DEFS: GemDef[] = [
  { poly: trillion(), center: [0, -0.13], scale: 0.99, table: 0.5, mid: 0.8, crownH: 0.3, round: 0.035, hue: 0x5ce1ff, deep: 0x06265a, vein: 0x2fd8ff, veinCore: 0xeaffff, seed: 1.3 },
  { poly: princess(), center: [0, 0], scale: 0.9, table: 0.52, mid: 0.8, crownH: 0.3, round: 0.02, hue: 0x3dffb0, deep: 0x02402e, vein: 0xc8ff2e, veinCore: 0xfbffd8, seed: 2.7 },
  { poly: hexBrilliant(), center: [0, 0], scale: 0.9, table: 0.52, mid: 0.8, crownH: 0.3, round: 0.015, hue: 0x8a5cff, deep: 0x1c0a58, vein: 0xff2bd6, veinCore: 0xffd6f6, seed: 3.1 },
  { poly: pear(), center: [0, -0.165], scale: 0.86, table: 0.52, mid: 0.8, crownH: 0.3, round: 0.02, hue: 0xff5c9a, deep: 0x4a0726, vein: 0xff5a1e, veinCore: 0xffe2b0, seed: 4.9 },
];

/** Sparkle positions: brightest table vertex toward the key light + a small one on the far crown. */
export function gemSparkles(def: GemDef): { a: [number, number, number, number]; b: [number, number, number, number] } {
  let best = -1e9, bi = 0, worst = 1e9, wi = 0;
  def.poly.forEach(([x, y], i) => {
    const s = -0.6 * x + 0.8 * y;
    if (s > best) { best = s; bi = i; }
    const t = 0.8 * x - 0.35 * y;
    if (-t < worst) { worst = -t; wi = i; }
  });
  const [ax, ay] = def.poly[bi];
  const n = def.poly.length;
  const [bx0, by0] = def.poly[wi];
  const [bx1, by1] = def.poly[(wi + 1) % n];
  const mx = ((bx0 + bx1) / 2) * def.mid, my = ((by0 + by1) / 2) * def.mid;
  return {
    a: [def.center[0] + ax * def.table * def.scale, def.center[1] + ay * def.table * def.scale, 0.5, 0.85],
    b: [def.center[0] + mx * def.scale, def.center[1] + my * def.scale, 0.24, 0.55],
  };
}
