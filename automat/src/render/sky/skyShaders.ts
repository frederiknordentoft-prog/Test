// GLSL for the sky / world. Four programs, all drawn as one screen-covering quad:
//   STATIC_FRAG  (baked once per resize, full res)  → R stars · G twinkle phase · B Milky Way · A MW warmth
//   LAND_FRAG    (baked once per resize, full res)  → R coverage · G chalk albedo×facing · B depth · A rim light
//   AURORA_FRAG  (live, 0.5× res)                   → emissive: 3 curtains + plasma sun + CME front, sqrt-encoded
//   COMP_FRAG    (live, full res, cheap)            → gradient + stars + MW + aurora + land + mirrored sea + haze + dither
// Coordinates: every program reconstructs CSS-px screen position p = uOrigin + vUV * uExt (y down).

export const SKY_VERT = /* glsl */ `#version 300 es
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

const HEAD = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
#define PI 3.14159265
#define TAU 6.28318531
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(hash11(i), hash11(i + 1.0), f * f * (3.0 - 2.0 * f)); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm3(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = OCT * p; a *= 0.5; } return s / 0.875; }
float fbm5(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = OCT * p; a *= 0.5; } return s / 0.96875; }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
uniform vec2 uOrigin;   // CSS px of the quad's top-left (negative: overscan margin for camera shake)
uniform vec2 uExt;      // CSS size of the quad
uniform vec4 uScr;      // screen w, screen h, horizonY, device px per CSS px of THIS target
`;

// ───────────────────────────────────────── static sky bake ─────────────────────────────────────────
export const STATIC_FRAG = HEAD + /* glsl */ `
// one star layer: cells of cs CSS px, one candidate star per cell
void starLayer(vec2 p, float cs, float prob, float seed, float sMin, float sMax, float gamma, inout float acc, inout float best, inout float phase) {
  vec2 g = p / cs;
  vec2 id = floor(g);
  vec2 f = fract(g);
  vec2 h = hash22(id + seed);
  float r = hash12(id + seed + 17.3);
  if (r > prob) return;
  vec2 pos = 0.18 + 0.64 * h;
  float d = length((f - pos) * cs);                   // CSS px
  float mag = pow(hash12(id + seed + 5.1), gamma);    // 0..1, most stars faint
  float px = 1.0 / uScr.w;
  float sig = max(mix(sMin, sMax, mag), 0.62 * px);   // never thinner than ~1 device px
  float v = exp(-d * d / (2.0 * sig * sig)) * (0.18 + 0.82 * mag);
  // brightest stars: soft halo + a faint 4-point diffraction cross
  if (mag > 0.82) {
    vec2 o = abs((f - pos) * cs);
    float k = (mag - 0.82) / 0.18;
    v += k * (exp(-d / 2.2) * 0.12 + (exp(-o.y / (0.5 * px + 0.3)) * exp(-o.x / 5.0) + exp(-o.x / (0.5 * px + 0.3)) * exp(-o.y / 5.0)) * 0.22);
  }
  acc += v;
  if (v > best) { best = v; phase = hash12(id + seed + 9.7); }
}

void main() {
  vec2 p = uOrigin + vUV * uExt;
  float W = uScr.x, H = uScr.y;
  float S = max(W, H);
  // ---- Milky Way: tilted band, fbm clouds, dark dust rift ----
  vec2 c0 = vec2(W * 0.66, H * 0.02);
  vec2 dir = normalize(vec2(-0.62, 1.0));
  vec2 nrm = vec2(dir.y, -dir.x);
  vec2 d = p - c0;
  float along = dot(d, dir) / S;
  float across = dot(d, nrm) / S;
  across += (fbm3(vec2(along * 2.6, 1.7)) - 0.5) * 0.09;
  float wid = 0.10 + 0.05 * fbm3(vec2(along * 2.0, 4.2));
  float core = exp(-across * across / (wid * wid));
  float inner = exp(-across * across / (wid * wid * 0.16));
  vec2 q = vec2(along, across);
  float cl = fbm5(q * vec2(6.0, 11.0) + 3.0);
  float cl2 = fbm3(q * vec2(22.0, 30.0) + 11.0);
  float rift = exp(-pow((across - 0.012 - 0.02 * sin(along * 6.0)) / (wid * 0.22), 2.0));
  rift *= smoothstep(0.3, 0.7, fbm3(q * vec2(4.0, 16.0) + 9.0));
  float mw = core * (0.18 + 0.85 * cl * cl) + inner * 0.45 * cl * cl2;
  mw *= 1.0 - 0.75 * rift;
  mw *= smoothstep(-0.6, 0.1, along) * (1.0 - smoothstep(0.55, 1.1, along));
  float warm = sat(inner * 1.2) * smoothstep(-0.1, 0.45, along);
  // ---- stars (denser inside the band) ----
  float acc = 0.0, best = 0.0, phase = 0.5;
  float dens = 1.0 + 1.8 * core;
  starLayer(p, 4.5, 0.13 * dens, 1.0, 0.28, 0.42, 6.0, acc, best, phase);
  starLayer(p, 11.0, 0.30 * min(dens, 1.8), 31.0, 0.35, 0.65, 4.0, acc, best, phase);
  starLayer(p, 36.0, 0.34, 71.0, 0.45, 1.0, 2.8, acc, best, phase);
  // faint unresolved star dust in the band
  acc += core * 0.05 * smoothstep(0.55, 0.95, vnoise(p * 0.9)) ;
  finalColor = vec4(sat(acc), phase, sat(mw), warm);
}
`;

// ───────────────────────────────────────── land (Møns Klint) bake ─────────────────────────────────────────
export const LAND_FRAG = HEAD + /* glsl */ `
uniform vec4 uL;    // near coast: vanish x fraction, near waterline drop (px), cliff height at x=0 (px), zMax
uniform vec4 uL2;   // far coast: start x fraction, height (px), far strip end x fraction, far strip height (px)

// near coast: chalk cliffs receding from the left edge toward a vanishing point on the horizon
float ridgeN(float x) { return 1.0 - abs(2.0 * n1(x) - 1.0); }
vec4 nearCoast(vec2 p) {
  float W = uScr.x, HY = uScr.z, px = 1.0 / uScr.w;
  float s = p.x / (uL.x * W);
  if (s > 1.02) return vec4(0.0);
  s = max(s, -0.1);
  float izM = 1.0 / uL.w;
  float iz = 1.0 - s * (1.0 - izM);                 // 1/z, linear in screen x (straight coast in perspective)
  float z = 1.0 / max(iz, 1e-3);
  float yb = HY + uL.y * (iz - izM);                // waterline
  float hg = uL.z * iz;                             // cliff height (px)
  // buttresses (spurs of the klint) repeat along the coast in world z → compressed toward the vanishing point.
  // f = 0 at a buttress' lit leading edge → 1 deep in the shadowed recess before the next one.
  float q = z * 1.55 + 0.55;
  float qi = floor(q);
  float f = fract(q);
  float fj = sat(f + 0.07 * (n1(q * 3.0 + p.y / max(hg, 1.0) * 3.0) - 0.5) + 0.03 * (n1(p.y / max(hg * 0.03, 1.0)) - 0.5));
  float lead = smoothstep(0.0, 0.035, fj) * (1.0 - smoothstep(0.975, 1.0, fj));  // soft occlusion edge
  float head = pow(1.0 - fj, 0.7);
  float hasRav = step(0.62, hash11(qi * 7.31 + 2.0));                            // only some recesses are ravines
  float ravine = hasRav * smoothstep(0.7, 0.78, fj) * (1.0 - smoothstep(0.93, 1.0, fj));
  float bump = hash11(qi * 3.7 + 1.0);
  hg *= 0.88 + 0.12 * head * (0.6 + 0.4 * bump) - 0.22 * ravine + 0.08 * (n1(z * 2.3 + 4.0) - 0.5);
  hg *= 1.0 - 0.8 * smoothstep(0.82, 1.0, s);      // the coast sinks into the distance
  yb += hg * 0.03 * head * head;                   // buttress feet reach further into the sea
  yb += (n1(p.x / max(hg * 0.1, 2.0) + 3.0) - 0.5) * hg * 0.02;
  float yChalk = yb - hg * (0.8 + 0.06 * (n1(p.x / max(hg * 0.09, 2.0)) - 0.5));
  // tree line on top (beech forest): bumpy canopy
  float tree = hg * 0.19;
  float cf = p.x / max(hg * 0.035, 1.3);
  float canopy = n1(cf) * 0.5 + n1(cf * 2.7 + 5.0) * 0.3 + n1(cf * 7.1 + 9.0) * 0.2;
  float yTop = yChalk - tree * (0.55 + 0.6 * canopy);
  float aa = 0.8 * px;
  float cov = smoothstep(yTop - aa, yTop + aa, p.y) * (1.0 - smoothstep(yb - aa, yb + aa, p.y));
  cov *= 1.0 - smoothstep(1.0, 1.02, s);
  float yy = sat((yb - p.y) / max(hg, 1.0));       // 0 at the waterline → 1 at the top
  // vegetation spills down the gullies and fills the ravines
  float sx = p.x / max(hg * 0.11, 2.2);
  float gulN = ridgeN(sx + yy * 0.4 + qi * 0.37);
  float yVeg = yChalk + hg * (0.08 * pow(1.0 - gulN, 3.0) + 0.7 * ravine);
  float inChalk = smoothstep(yVeg - aa, yVeg + 2.0 * px, p.y);
  // rock: anisotropic fbm (vertical fissures + rough patches), lit ribs
  vec2 rq = vec2(p.x / max(hg * 0.03, 1.0), (yb - p.y) / max(hg * 0.055, 1.0) + qi * 3.1);
  float rock = fbm3(rq) * 0.7 + vnoise(rq * vec2(3.0, 0.8) + 5.0) * 0.3;
  float rib = ridgeN(p.x / max(hg * 0.05, 1.3) + yy * 1.2 + qi);
  float alb = mix(0.45, 1.0, smoothstep(0.15, 0.85, rock)) * (0.74 + 0.26 * rib);
  alb *= 1.0 - 0.07 * smoothstep(0.85, 1.0, sin(yy * 40.0 + rock * 4.0));        // flint bands
  // buttress shading: bright leading edge, rolling into the recess, crevice shadow before the next edge
  float shade = mix(0.16, 1.0, pow(head, 1.3)) * lead + (1.0 - lead) * 0.1;
  shade *= 1.0 - 0.55 * smoothstep(0.82, 0.97, fj);
  alb *= shade * (1.0 - ravine);
  alb *= 0.72 + 0.28 * smoothstep(0.0, 0.85, yy);                                  // lit from above
  // talus fans at the foot (grey debris cones) + dark shingle strip
  float fan = smoothstep(0.14, 0.0, yy + 0.06 * (gulN - 0.5));
  alb = mix(alb, (0.2 + 0.12 * rock) * (0.5 + 0.5 * head), fan);
  alb *= 1.0 - 0.75 * smoothstep(0.025, 0.0, yy);
  alb *= 0.45 + 0.55 * smoothstep(0.0, 0.06, (p.y - yVeg) / max(hg, 1.0));       // AO below the canopy
  float chalk = inChalk * alb;
  // surf line where the sea meets the cliff foot
  chalk += exp(-abs(p.y - (yb - 1.0 * px)) / (0.8 * px)) * 0.45 * (0.4 + 0.6 * n1(p.x * 0.35));
  float depth = sat((z - 1.0) / (uL.w - 1.0));
  float rim = exp(-max(p.y - yTop, 0.0) / max(1.4 * px, hg * 0.01)) * (1.0 - inChalk);
  rim += exp(-max(p.y - yVeg, 0.0) / max(1.2 * px, hg * 0.012)) * inChalk * 0.5;   // chalk crest catches the sky
  return vec4(cov, sat(chalk), depth, sat(rim));
}

// far coast on the right + a thin distant strip on the horizon
vec4 farCoast(vec2 p) {
  float W = uScr.x, HY = uScr.z, px = 1.0 / uScr.w;
  float x0 = uL2.x * W;
  float aa = 0.8 * px;
  vec4 o = vec4(0.0);
  if (p.x > x0 - 4.0) {
    float u = (p.x - x0) / max(W - x0, 1.0);
    float rise = smoothstep(0.0, 0.35, u);
    float hn = n1(p.x / 55.0 + 2.0) * 0.6 + n1(p.x / 17.0 + 8.0) * 0.4;
    float hg = uL2.y * (0.2 + 0.8 * rise) * (0.75 + 0.5 * hn);
    float yb = HY + 0.6;
    float yChalk = yb - hg * 0.78;
    float cf = p.x / 3.0;
    float yTop = yChalk - hg * 0.2 * (0.5 + 0.7 * (n1(cf) * 0.7 + n1(cf * 2.3) * 0.3));
    float cov = smoothstep(yTop - aa, yTop + aa, p.y) * (1.0 - smoothstep(yb - aa, yb + aa, p.y));
    float inChalk = smoothstep(yChalk - aa, yChalk + 2.0 * px, p.y);
    float gully = 1.0 - abs(2.0 * n1(p.x / 2.2 + (yb - p.y) * 0.08) - 1.0);
    float headF = smoothstep(0.35, 0.8, n1(p.x / 70.0 + 1.0));
    float chalk = inChalk * (0.35 + 0.5 * gully) * (0.3 + 0.7 * headF) * (1.0 - smoothstep(yb - hg * 0.15, yb, p.y) * 0.5);
    float rim = exp(-max(p.y - yTop, 0.0) / max(1.2 * px, 0.8)) * (1.0 - inChalk);
    o = vec4(cov, chalk * 0.8, 0.82, rim);
  }
  // distant strip left of centre (other shore), very low and hazy
  float x1 = uL.x * W * 0.9, x2 = uL2.z * W;
  if (p.x > x1 && p.x < x2 && o.x < 0.99) {
    float u = (p.x - x1) / max(x2 - x1, 1.0);
    float env = smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.7, 1.0, u));
    float hg = uL2.w * env * (0.5 + 0.5 * n1(p.x / 23.0 + 5.0));
    float yTop = HY - hg;
    float cov = smoothstep(yTop - aa, yTop + aa, p.y) * (1.0 - smoothstep(HY + 0.6 - aa, HY + 0.6 + aa, p.y));
    cov *= step(0.3, hg);
    vec4 s = vec4(cov, 0.0, 1.0, 0.0);
    o = vec4(1.0 - (1.0 - o.x) * (1.0 - s.x), o.yzw * o.x + s.yzw * s.x * (1.0 - o.x));
    o.yzw /= max(o.x, 1e-4);
  }
  return o;
}

void main() {
  vec2 p = uOrigin + vUV * uExt;
  vec4 f = farCoast(p);
  vec4 n = nearCoast(p);
  float a = n.x + f.x * (1.0 - n.x);
  vec3 rest = (n.yzw * n.x + f.yzw * f.x * (1.0 - n.x)) / max(a, 1e-4);
  finalColor = vec4(a, rest);
}
`;

// ───────────────────────────────────────── live emissive pass (half res) ─────────────────────────────────────────
export const AURORA_FRAG = HEAD + /* glsl */ `
uniform vec4 uP;        // x: integrated curtain phase, y: fast phase (flicker), z: time (wrapped), w: storm
uniform vec4 uA;        // intensity, fold, topMix (red), violet
uniform vec4 uB;        // crackle, ray sharpness, brightness mul (glow), turbulence
uniform vec4 uC;        // red (630 nm) layer amount, 0, 0, 0
uniform vec3 uCSeam;     // base (tier) colours
uniform vec3 uCBody;
uniform vec3 uCTop;
uniform vec3 uCFringe;
uniform vec3 uSSeam;     // Solstorm colours
uniform vec3 uSBody;
uniform vec3 uSTop;
uniform vec3 uSFringe;
vec3 cSeam, cBody, cTop, cFringe;
uniform vec4 uSun;      // cx, cy, R (CSS px), amount
uniform vec4 uCme;      // progress 0..1, fade, 0, 0

const vec3 C_WHITEHOT = vec3(1.0, 0.957, 0.878);
const vec3 C_GOLD = vec3(1.0, 0.76, 0.24);
const vec3 C_MOLTEN = vec3(1.0, 0.416, 0.0);
const vec3 C_CRIMSON = vec3(1.0, 0.118, 0.235);
const vec3 C_MAGENTA = vec3(1.0, 0.169, 0.839);
const vec3 C_DEEP = vec3(0.35, 0.0, 0.06);

// One aurora curtain: a domain-warped ribbon hanging from a sharp lower seam.
//   vS: seam height as fraction of the horizon height, amp: seam wave amplitude, hF: curtain height fraction,
//   br: brightness, sc: horizontal scale (depth: far curtains are smaller), arc: perspective sag at the sides.
// fold warp of the sheet: x = offset, y = derivative
vec2 warp(float X, float ph, float seed) {
  float a1 = 1.05 * X + ph * 0.10 + seed * 3.1;
  float a2 = 2.3 * X - ph * 0.16 + seed * 5.7;
  float a3 = 4.7 * X + ph * 0.27 + seed * 1.3;
  return vec2(0.42 * sin(a1) + 0.22 * sin(a2) + 0.08 * sin(a3), 0.441 * cos(a1) + 0.506 * cos(a2) + 0.376 * cos(a3));
}
vec3 curtain(vec2 p, float seed, float vS, float amp, float hF, float br, float sc, float arc, float tilt) {
  float HY = uScr.z;
  float ph = uP.x;
  float storm = uP.w;
  float xw = (p.x - uScr.x * 0.5) / max(uScr.x, 640.0);
  float X = (p.x - uScr.x * 0.5) / (270.0 * sc) + seed * 7.13;
  // folds: the along-curtain coordinate s is warped; where ds/dx → 0 the sheet is seen edge-on → brighter
  float F = (0.25 + 0.95 * uA.y) * (1.0 + 0.45 * storm);
  vec2 wd = warp(X, ph, seed);
  float wv = wd.x;
  float turb = uB.w * (n1(X * 2.6 + uP.y * 0.45 + seed) - 0.5);
  float s = X + F * wv + turb * 0.22;
  float ds = 1.0 + F * wd.y;
  float edge = min(1.0 / max(abs(ds), 0.3), 2.6);
  edge = mix(1.0, edge, 0.7);
  // seam follows the folded sheet (so folds kink the lower border) + slow drift + perspective sag
  float lg = n1(s * 0.62 + ph * 0.022 + seed * 11.0) - 0.5;
  float lg2 = n1(X * 0.21 - ph * 0.012 + seed * 5.0) - 0.5;
  float seamY = HY * (1.0 - vS - amp * (lg * 2.0 + lg2 * 1.8 + 0.7 * wv) + arc * xw * xw + tilt * xw);
  seamY += (n1(s * 5.0 + ph * 0.35 + seed * 2.0) - 0.5) * 6.0 * sc + turb * 22.0 * sc;
  float h = seamY - p.y;                        // px above the seam
  // rays follow magnetic field lines that converge toward the magnetic zenith (above the screen):
  // shift the ray lookup to the ray's foot on the seam
  float vy = -HY * 2.0;
  float foot = uScr.x * 0.5 + (p.x - uScr.x * 0.5) * (seamY - vy) / max(p.y - vy, 1.0);
  float Xf = (foot - uScr.x * 0.5) / (270.0 * sc) + seed * 7.13;
  float sr = Xf + F * warp(Xf, ph, seed).x + turb * 0.22;
  // the sheet breaks into pieces: brightness envelope along s
  float env = smoothstep(0.18 + 0.2 * storm, 0.72, n1(s * 0.65 - ph * 0.035 + seed * 9.0));
  env = 0.1 + 0.9 * env * (0.75 + 0.25 * n1(s * 2.1 + seed));
  // extent varies along the sheet
  float Hs = HY * hF * (0.55 + 0.9 * n1(s * 1.4 - ph * 0.08 + seed * 3.0));
  // vertical ray striations scrolling along the curtain
  float r1 = n1(sr * 21.0 * (1.0 + 0.3 * storm) + ph * 0.7 + seed * 20.0);
  float r2 = n1(sr * 53.0 - ph * 1.2 + seed * 40.0);
  float r3 = n1(sr * 6.0 + ph * 0.22 + seed * 60.0);
  float rays = smoothstep(0.15, 0.88, r1 * 0.5 + r2 * 0.3 + r3 * 0.2);
  rays = pow(rays, uB.y);
  float Hr = Hs * (0.3 + 1.1 * rays);
  float hp = max(h, 0.0);
  float body = exp(-hp / Hr);
  float seamLn = exp(-hp / (2.0 * sc + 0.018 * Hs));
  float below = exp(min(h, 0.0) / (1.3 * (2.0 / uScr.w)));     // razor lower edge (≈1.3 texels)
  float rayK = smoothstep(0.0, 0.35, hp / Hs);                 // striations strongest higher up
  float I = (body * mix(0.75 + 0.3 * rays, 0.25 + 0.9 * rays, rayK) + seamLn * (0.45 + 0.6 * rays)) * below;
  // brightness surges travelling along the curtain + crackle flicker
  float pulse = 0.7 + 0.3 * sin(s * 1.9 - ph * 0.55 + seed * 2.0);
  float flick = 1.0 + uB.x * 0.6 * (n1(s * 4.0 + uP.y * 5.0 + seed) - 0.5) * 2.0;
  float k = pulse * flick * edge * br * env;
  I *= k;
  // colour by height: bright 557.7 nm seam → green body → teal/violet/red higher up
  float hn = hp / Hs;
  vec3 col = mix(cSeam, cBody, sat(hn * 6.0 + (1.0 - seamLn) * 0.35));
  col = mix(col, cFringe, smoothstep(0.05, 0.4, hn) * (1.0 - smoothstep(0.5, 0.95, hn)) * uA.w * 0.45);
  col = mix(col, cTop, smoothstep(0.1, 0.9, hn) * uA.z);
  vec3 e = col * I;
  // 630 nm red layer: higher, taller and more diffuse than the green, faint ray structure
  float Hred = Hs * (1.3 + 0.8 * rays);
  float red = smoothstep(-0.02 * Hs, 0.45 * Hs, h) * exp(-max(h - 0.4 * Hs, 0.0) / Hred);
  e += cTop * red * (0.35 + 0.65 * r3) * (0.55 + 0.45 * rays) * uC.x * k * 0.55;
  // violet/magenta fringe just under the seam (N2+ lower border)
  float fr = exp(min(h, 0.0) / (11.0 * sc)) * (1.0 - below);
  e += cFringe * fr * uA.w * 0.9 * k;
  e += cFringe * seamLn * uA.w * 0.25 * k * below;
  // diffuse atmospheric glow around the sheet
  e += mix(cBody, cTop, 0.5 * uC.x) * exp(-abs(h - Hs * 0.3) / (Hs * 0.8 + 1.0)) * 0.05 * br * env * pulse;
  return e;
}

vec3 sunColor(float heat) {
  vec3 c = mix(C_DEEP, C_CRIMSON, smoothstep(0.0, 0.35, heat));
  c = mix(c, C_MOLTEN, smoothstep(0.35, 0.68, heat));
  c = mix(c, C_GOLD, smoothstep(0.68, 0.86, heat));
  return mix(c, C_WHITEHOT, smoothstep(0.86, 1.0, heat));
}

vec3 sunLayer(vec2 p, vec3 bg) {
  float R = uSun.z, amt = uSun.w;
  vec2 q = (p - uSun.xy) / R;
  float d = length(q);
  vec2 dir = q / max(d, 1e-4);
  float t = uP.z;
  float od = max(d - 1.0, 0.0);
  vec3 col = bg;
  // corona with streamers + cheap in-shader rays
  float streamer = 0.5 + 0.5 * vnoise(dir * 2.6 + vec2(t * 0.04, 1.0));
  float corona = exp(-od * 3.4) * (0.35 + 0.5 * streamer) + exp(-od * 1.1) * 0.18 * streamer + exp(-od * 0.35) * 0.05;
  float rn = vnoise(dir * 16.0 + vec2(0.0, t * 0.06));
  float rn2 = vnoise(dir * 43.0 - vec2(t * 0.05, 0.0));
  float rays = pow(rn * 0.6 + rn2 * 0.4, 3.0) * 1.3 * exp(-od * 0.9) * smoothstep(0.02, 0.25, od);
  vec3 cor = mix(C_CRIMSON, C_MOLTEN, exp(-od * 2.5) * 0.8);
  col += cor * (corona + rays * 0.55) * amt;
  // prominences: polar-fbm flame tongues at the limb
  if (d > 0.9 && d < 1.9) {
    float nt = vnoise(dir * 3.5 + vec2(3.1, t * 0.025));
    float htop = 0.05 + 0.42 * pow(nt, 2.2);
    float tb = vnoise(dir * 13.0 + vec2(od * 7.0 - t * 0.35, t * 0.08));
    float tb2 = vnoise(dir * 29.0 + vec2(od * 13.0 - t * 0.6, 3.0));
    float tongue = exp(-od / htop) * smoothstep(0.35, 0.75, tb * 0.7 + tb2 * 0.3 + 0.3 - od / htop * 0.2);
    float heat = exp(-od / (htop * 0.35));
    vec3 pc = mix(mix(C_MAGENTA, C_CRIMSON, 0.4), C_MOLTEN, heat * 0.8);
    col += pc * tongue * 1.8 * amt * smoothstep(0.9, 1.0, d);
  }
  // photosphere: limb darkening + fine granulation + faculae + a few umbrae
  float aa = 1.4 * (2.0 / uScr.w) / R;
  if (d < 1.0 + aa) {
    float mu = sqrt(max(1.0 - d * d, 0.0));
    vec2 sp = q / (0.3 + 0.7 * mu);                       // foreshortened toward the limb
    float g1 = vnoise(sp * 15.0 + vec2(t * 0.16, 0.0));
    float g2 = vnoise(sp * 33.0 - vec2(0.0, t * 0.23));
    float gran = g1 * 0.6 + g2 * 0.4;
    float big = vnoise(sp * 3.2 + vec2(t * 0.02, 7.0));
    float fac = smoothstep(0.55, 0.8, big) * (1.0 - mu);
    float limb = pow(mu, 0.45);
    float heat = limb * (0.84 + 0.2 * (gran - 0.5) + 0.12 * (big - 0.5)) + fac * 0.22;
    vec3 dc = sunColor(sat(heat * 0.94));
    dc += C_MAGENTA * exp(-(1.0 - d) * R / 2.0) * 0.45;   // chromosphere
    float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
    col = mix(col, dc, cover * sat(amt * 1.3));
  }
  return col;
}

// CME: a curved, billowing plasma front (polar fbm) rolling from above the screen to below it.
vec3 cmeLayer(vec2 p) {
  float k = uCme.x;
  float H = uScr.y;
  float t = uP.z;
  vec2 C = vec2(uScr.x * 0.5, -H * 1.1);
  vec2 v = p - C;
  float rho = length(v);
  float ang = atan(v.x, v.y);
  vec2 fq = vec2(ang * rho / H * 3.2, rho / H * 3.0 - k * 2.5);       // polar: arc length × radius
  float b1 = fbm3(fq + vec2(0.0, -t * 0.7));
  float b2 = vnoise(fq * 3.4 + vec2(t * 1.1, -t * 0.6));
  float rf = mix(H * 0.95, H * 2.45, k);
  float e = rho - rf - (b1 - 0.5) * H * 0.2 - (b2 - 0.5) * H * 0.045;  // > 0: ahead of the front
  float turb = fbm3(fq * vec2(2.2, 4.5) + vec2(t * 0.4, -t * 1.8));
  // thick hot band right behind the edge, very short falloff ahead of it
  float heat = e < 0.0 ? exp(e / (0.085 * H)) : exp(-e / (0.01 * H));
  heat *= 0.55 + 0.75 * turb;
  vec3 c = sunColor(sat(heat * 1.15)) * smoothstep(0.02, 0.3, heat) * (0.4 + 1.1 * heat);
  // swept region: streaming crimson/magenta plasma with dark lanes
  float bk = 1.0 - smoothstep(-0.01 * H, 0.0, e);
  float lanes = smoothstep(0.25, 0.75, fbm3(vec2(fq.x * 1.4, fq.y * 0.8 - t * 1.3)));
  c += mix(C_CRIMSON, C_MAGENTA, turb * 0.5) * bk * (0.12 + 0.3 * lanes) * (0.6 + 0.4 * exp(e / (0.4 * H)));
  // faint pre-glow ahead
  c += C_CRIMSON * exp(-max(e, 0.0) / (0.1 * H)) * (1.0 - bk) * 0.12;
  return c * uCme.y;
}

void main() {
  vec2 p = uOrigin + vUV * uExt;
  vec3 c = vec3(0.0);
  if (p.y < uScr.z + 1.0) {
    if (uA.x > 0.001) {
      // the storm colours the aurora crimson from the top down
      float st = sat((uP.w * 1.9 * uScr.z - p.y) / (0.45 * uScr.z) + uP.w * 0.3) * sat(uP.w * 3.0);
      cSeam = mix(uCSeam, uSSeam, st); cBody = mix(uCBody, uSBody, st);
      cTop = mix(uCTop, uSTop, st); cFringe = mix(uCFringe, uSFringe, st);
      c += curtain(p, 0.0, 0.11, 0.04, 0.30, 0.75, 0.55, 0.10, 0.02);    // far: low arc on the horizon
      c += curtain(p, 1.73, 0.37, 0.11, 0.55, 0.95, 0.80, 0.35, -0.16);  // mid: descends to the right
      c += curtain(p, 3.91, 0.64, 0.10, 0.85, 1.10, 1.05, 0.55, 0.12);   // near: tall, brightest, rises right
      c *= uA.x * uB.z;
    }
    if (uSun.w > 0.001) c = sunLayer(p, c);
  }
  if (uCme.x > 0.0) c += cmeLayer(p);
  c = mix(c, 0.72 + 0.28 * (1.0 - exp(-(c - 0.72) / 0.28)), step(0.72, c));   // soft shoulder, keeps hue
  c = sqrt(sat3(c));                                     // sqrt encode → more precision in the darks
  c += (hash12(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0);
  finalColor = vec4(c, 1.0);
}
`;

// ───────────────────────────────────────── full-res composite ─────────────────────────────────────────
export const COMP_FRAG = HEAD + /* glsl */ `
uniform sampler2D uStatic;
uniform sampler2D uLand;
uniform sampler2D uAur;
uniform vec4 uK;        // star brightness, Milky Way brightness, storm, time
uniform vec4 uK2;       // aurora intensity, glow, sea reflectivity, sun amount
uniform vec3 uLight;    // light falling on the land (aurora ambient [+ sun]), linear-ish
uniform vec3 uHaze;     // horizon haze colour
uniform vec3 uGlowC;    // sky ambient tint from the aurora
uniform vec4 uSun;      // cx, cy, R, amount (for the glitter path)
uniform vec4 uCme;      // progress, fade

vec3 skyGrad(float y) {
  float HY = uScr.z;
  float v = sat((HY - y) / max(HY, 1.0));
  vec3 base = mix(vec3(0.043, 0.106, 0.227), vec3(0.020, 0.043, 0.102), smoothstep(0.0, 0.85, v));
  base = mix(base, vec3(0.059, 0.231, 0.180), exp(-v * 11.0) * 0.55);         // airglow #0F3B2E
  vec3 storm = mix(vec3(0.227, 0.0, 0.063), vec3(0.039, 0.008, 0.016), pow(v, 0.55));
  storm += vec3(0.30, 0.05, 0.0) * exp(-v * 9.0) * uK2.w;                      // molten horizon under the sun
  vec3 c = mix(base, storm, uK.z);
  c += uGlowC * (0.25 + 0.75 * (1.0 - v) * (1.0 - v));
  return c;
}

vec3 skyAt(vec2 uv, vec2 p, float starK) {
  vec3 c = skyGrad(p.y);
  vec4 st = texture(uStatic, uv);
  float v = sat((uScr.z - p.y) / max(uScr.z, 1.0));
  float ext = smoothstep(0.0, 0.22, v);                                        // atmospheric extinction
  vec3 mwc = mix(vec3(0.50, 0.60, 0.86), vec3(1.0, 0.84, 0.66), st.a);
  c += mwc * st.b * uK.y * ext;
  float ph = st.g;
  float tw = 0.62 + 0.38 * sin(uK.w * (1.1 + 3.2 * ph) + ph * 43.0);
  vec3 sc = ph < 0.16 ? vec3(1.0, 0.80, 0.62) : (ph > 0.8 ? vec3(0.72, 0.84, 1.0) : vec3(0.95, 0.97, 1.0));
  c += sc * st.r * tw * uK.x * starK * ext;
  vec3 a = texture(uAur, uv).rgb;
  c += a * a;
  return c;
}

vec3 shadeLand(vec4 L) {
  vec3 c = vec3(0.012, 0.018, 0.040) * (1.0 - 0.3 * L.b);
  vec3 chalkC = vec3(0.79, 0.83, 0.90);
  c += chalkC * L.g * (vec3(0.10, 0.11, 0.14) + uLight * 2.0);
  c += uLight * L.a * 0.55;
  return mix(c, uHaze * 0.9, L.b * 0.5);
}

float ign(vec2 f) { return fract(52.9829189 * fract(dot(f, vec2(0.06711056, 0.00583715)))); }

void main() {
  vec2 uv = vUV;
  vec2 p = uOrigin + uv * uExt;
  float HY = uScr.z;
  vec3 col;
  if (p.y < HY) {
    col = skyAt(uv, p, 1.0);
  } else {
    // ---- sea: mirrored sky + land, perspective ripples, streak highlights ----
    float dy = p.y - HY;
    float seaH = max(uOrigin.y + uExt.y - HY, 1.0);
    float dn = sat(dy / seaH);
    float t = uK.w;
    float z = 1.0 / (dy + 6.0);
    vec2 wp = vec2((p.x - uScr.x * 0.5) * z * 1.6, z * 900.0);        // water-plane coords (perspective)
    float fade = smoothstep(6.0, 70.0, dy);                              // no sub-pixel waves at the horizon
    float w1 = vnoise(vec2(wp.x * 0.7, wp.y * 1.0 - t * 0.45));
    float w2 = vnoise(vec2(wp.x * 1.9 + 7.0, wp.y * 2.6 + t * 0.7));
    float wave = mix(0.5, w1 * 0.6 + w2 * 0.4, fade);
    vec2 rp = vec2(p.x + (w2 - 0.5) * min(dy, 120.0) * 0.05 * fade, HY - dy + (wave - 0.5) * min(dy, 180.0) * 0.4);
    rp.y = min(rp.y, HY - 0.5);
    vec2 ruv = (rp - uOrigin) / uExt;
    vec3 refl = skyAt(ruv, rp, 0.35);
    if (uSun.w > 0.001) {                    // a wavy sea breaks the mirrored disk into the glitter path
      float sd = length(rp - uSun.xy) / uSun.z;
      refl *= mix(0.3, 1.0, smoothstep(0.7, 1.6, sd));
    }
    vec4 RL = texture(uLand, ruv);
    refl = mix(refl, shadeLand(RL), RL.r);
    // second tap: vertical smear (long reflections of the curtains)
    vec2 rp2 = vec2(rp.x, min(rp.y + (0.5 + 0.5 * w1) * min(dy, 160.0) * 0.18, HY - 0.5));
    vec3 a2 = texture(uAur, (rp2 - uOrigin) / uExt).rgb;
    refl = refl * 0.7 + a2 * a2 * 0.3;
    float fres = mix(0.46, 0.24, sqrt(dn));
    vec3 water = mix(vec3(0.004, 0.010, 0.024), vec3(0.020, 0.003, 0.006), uK.z) + skyGrad(HY - 2.0) * 0.18;
    col = water + refl * fres * uK2.z;
    // crest glints: horizontal streaks catching the aurora
    float crest = pow(sat((w2 - 0.6) * 3.2), 2.5) * fade;
    vec3 aur = texture(uAur, ruv).rgb;
    col += aur * aur * crest * 0.9 + uGlowC * crest * 0.6;
    // the CME front sweeps over the sea as well (aurora RT holds only CME below the horizon)
    if (uCme.x > 0.0) { vec3 cm = texture(uAur, uv).rgb; col += cm * cm; }
    // plasma-sun glitter path
    if (uSun.w > 0.001) {
      float gw = uSun.z * 0.35 + dy * 0.22;
      float gx = (p.x - uSun.x) / gw;
      float path = exp(-gx * gx * 1.8);
      float sp = pow(sat((w2 * 0.5 + w1 * 0.5 - 0.45) * 2.2), 3.0);
      vec3 sunC = mix(vec3(1.0, 0.25, 0.1), vec3(1.0, 0.62, 0.25), exp(-dy / 60.0));
      col += sunC * path * (0.12 + 1.1 * sp) * uSun.w * (1.0 - dn * 0.5);
    }
  }
  vec4 L = texture(uLand, uv);
  vec3 land = shadeLand(L);
  if (uCme.x > 0.0) {                        // cheap analytic wash over the land as the front passes
    float rho = length(p - vec2(uScr.x * 0.5, -uScr.y * 1.1));
    float e = rho - mix(uScr.y * 0.95, uScr.y * 2.45, uCme.x);
    land += vec3(1.0, 0.2, 0.12) * (exp(-abs(e) / (0.06 * uScr.y)) * 0.5 + (1.0 - step(0.0, e)) * 0.12) * uCme.y;
  }
  col = mix(col, land, L.r);
  // horizon haze / sea mist
  float hz = exp(-abs(p.y - HY) / (0.028 * uScr.y + 2.0));
  float mist = exp(-max(p.y - HY, 0.0) / (0.06 * uScr.y)) * step(HY, p.y);
  col += uHaze * (hz * 0.55 + mist * 0.12) * (1.0 - L.r * (1.0 - L.b * L.b));
  // triangular-ish dither against banding
  float n = ign(gl_FragCoord.xy) + ign(gl_FragCoord.xy + 17.3) - 1.0;
  col += n * (1.2 / 255.0);
  finalColor = vec4(col, 1.0);
}
`;
