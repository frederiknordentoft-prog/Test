// H1 Månen, H2 Polarstjernen and the SUN scatter — base + storm variants (uStorm switch).
import { ART_HEAD } from './glsl.ts';

// ───────────────────────────────────────────── H1 MÅNEN ─────────────────────────────────────────────
export const MOON_FRAG = ART_HEAD + /* glsl */ `
const float MR = 0.585;            // moon radius (p units)
const vec2 MC = vec2(0.0, 0.0);
const vec2 OFF = vec2(0.36, 0.20); // cut-circle offset (moon radii)
const float CR = 0.93;             // cut-circle radius (moon radii)
const float HALO_R = 0.875;        // 22° halo ring radius

// crater field: sums bowls from the 3x3 neighbourhood (no Voronoi clipping)
float craters(vec2 sq, float sc, vec2 Ld, float seed) {
  vec2 x = sq * sc + seed;
  vec2 i = floor(x), f = fract(x);
  float acc = 0.0;
  for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) {
    vec2 g = vec2(float(xx), float(yy));
    vec2 h = hash22(i + g + seed);
    float present = step(0.28, h.x);
    float cr = 0.16 + 0.26 * h.y;
    vec2 v = f - g - (0.2 + 0.6 * hash22(i + g + 31.7));
    float t = length(v) / cr;
    float bowl = t < 1.0 ? 2.0 * t : 0.0;
    float rimG = exp(-pow((t - 1.0) / 0.17, 2.0));
    float dh = bowl - 3.2 * (t - 1.0) * rimG;
    vec2 gdir = normalize(v + 1e-5) * dh;
    float floorDark = t < 1.0 ? (1.0 - t * t) * 0.06 : 0.0;
    acc += present * (-dot(gdir, Ld) * 0.075 - floorDark + rimG * 0.03);
  }
  return acc;
}

vec4 moonBase(vec2 p) {
  vec2 q = (p - MC) / MR;
  float r = length(q);
  float dDisk = (r - 1.0) * MR;
  float dCut = (length(q - OFF) - CR) * MR;   // > 0 → outside the shadow circle → lit
  float covDisk = cover(dDisk);
  float lit = smoothstep(-0.004, 0.028, dCut);
  vec2 Ld = normalize(-OFF);

  vec3 col = vec3(0.0);
  if (dDisk < 2.0 * uPx) {
    float nz = sqrt(max(0.0, 1.0 - r * r));
    vec2 sq = q * (1.0 + 0.5 * (1.0 - nz));
    float mar = fbm4(sq * 1.5 + 3.1);
    float maria = smoothstep(0.46, 0.68, mar);
    float alb = 0.93 - 0.34 * maria + 0.10 * (fbm4(sq * 7.0 + 1.7) - 0.5);
    float cs = craters(sq, 3.2, Ld, 1.0) + 0.6 * craters(sq, 7.5, Ld, 9.0) + 0.35 * craters(sq, 15.0, Ld, 4.0);
    // ray system around one bright young crater
    vec2 tyc = sq - vec2(-0.38, -0.45);
    float ray = pow(pnoise(vec2(atan(tyc.y, tyc.x) / TAU * 22.0, 0.0), 22.0), 4.0) * exp(-length(tyc) * 3.5);
    alb += ray * 0.35 + exp(-dot(tyc, tyc) * 180.0) * 0.4;
    vec3 base = mix(vec3(0.46, 0.50, 0.62), vec3(0.98, 0.98, 1.0), sat(alb));
    base *= vec3(1.0, 0.985, 0.955);
    float limb = 0.62 + 0.38 * pow(nz, 0.45);
    float sunTerm = 0.55 + 0.45 * sat(dCut / (0.42 * MR)); // brighter away from the terminator
    vec3 litCol = base * limb * sunTerm * (1.0 + cs * 2.2) * 1.08;
    vec3 earth = base * vec3(0.085, 0.115, 0.20) + vec3(0.012, 0.018, 0.04);
    earth *= 1.0 + cs * 1.5;
    col = mix(earth, litCol, lit);
    // earthshine limb (reveals the full disc) and lit-limb lip
    float edge = 1.0 - smoothstep(0.0, 5.0 * uPx, -dDisk);
    col += vec3(0.30, 0.46, 0.85) * edge * (1.0 - lit) * 0.55;
    col += vec3(1.0, 0.98, 0.94) * edge * lit * 0.25;
    // terminator: faint warm line
    col += vec3(0.9, 0.75, 0.6) * exp(-pow(dCut / 0.006, 2.0)) * 0.08 * covDisk;
  }
  float aDisk = covDisk * mix(0.93, 1.0, lit);

  // aureole + 22° halo with prismatic inner edge + moondogs
  vec2 dp = p - MC;
  float rho = length(dp);
  float od = max(dDisk, 0.0);
  float side = 0.55 + 0.45 * dot(normalize(dp + 1e-5), Ld);
  float aur = (exp(-od / 0.035) * 0.55 + exp(-od / 0.15) * 0.22) * side;
  float t = (rho - HALO_R) / 0.03;
  float I = t < 0.0 ? exp(-t * t * 2.2) : exp(-t * 0.55);
  vec3 hc = mix(vec3(1.0, 0.33, 0.25), vec3(1.0, 0.93, 0.82), smoothstep(-1.2, 0.0, t));
  hc = mix(hc, vec3(0.55, 0.75, 1.0), smoothstep(0.3, 2.5, t));
  float ang = atan(dp.y, dp.x);
  float dogs = exp(-pow(abs(cos(ang)) - 1.0, 2.0) * 900.0) * exp(-t * t * 0.5) * 0.9;
  float halo = I * (0.34 + dogs) * cellFade(p);
  vec3 glowRgb = vec3(0.62, 0.78, 1.0) * aur + hc * halo;
  float glowA = aur * 0.5 + halo * 0.45;

  // horn-tip glint (upper horn = circle intersection)
  float dd = length(OFF);
  float aa = (1.0 - CR * CR + dd * dd) / (2.0 * dd);
  float hh = sqrt(max(0.0, 1.0 - aa * aa));
  vec2 ax = OFF / dd;
  vec2 tip = MC + (ax * aa + vec2(-ax.y, ax.x) * hh) * MR;
  tip = mix(tip, MC, 0.04);
  float gl = sparkle(p - tip, 0.34) * 0.6 * cellFade(p);

  vec4 o = vec4(glowRgb, glowA);
  o = vec4(col * aDisk, aDisk) + o * (1.0 - aDisk);
  o.rgb += vec3(1.0, 0.98, 0.94) * gl;
  o.a = sat(o.a + gl * 0.5);
  return o;
}

// STORM: total eclipse with corona, chromosphere, prominences and a diamond-ring bead
vec4 moonEclipse(vec2 p) {
  const float ER = 0.50;
  vec2 q = p / ER;
  float r = length(q);
  float dDisk = (r - 1.0) * ER;
  float covDisk = cover(dDisk);
  float th = atan(q.y, q.x);
  float u = th / TAU;
  float rr = max(r - 1.0, 0.0);

  float sA = pnoise(vec2(u * 16.0, rr * 1.5 + 0.3), 16.0);
  float sB = pnoise(vec2(u * 44.0, rr * 2.4 + 5.0), 44.0);
  float sC = pnoise(vec2(u * 90.0, rr * 3.0 + 9.0), 90.0);
  float streak = pow(0.5 * sA + 0.32 * sB + 0.18 * sC, 2.0) * 1.9;
  float axis = 0.45 + 0.55 * pow(abs(cos(th - 0.42)), 2.5); // helmet streamers along one axis
  float inner = exp(-rr / 0.045);
  float outer = exp(-rr / (0.22 + 0.55 * axis * streak)) * streak;
  float plumes = exp(-rr / 0.35) * pow(sC, 3.0) * (1.0 - axis) * 0.8;
  float cor = inner * 1.1 + outer * 1.25 + plumes;
  vec3 corCol = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.55, 0.60), smoothstep(0.02, 0.35, rr));
  corCol = mix(corCol, vec3(1.0, 0.12, 0.24), smoothstep(0.3, 0.9, rr));
  corCol = mix(corCol, vec3(1.0, 0.17, 0.84), smoothstep(0.8, 1.4, rr) * 0.6);
  cor *= cellFade(p);

  // chromosphere ring + prominences
  float pr = pnoise(vec2(u * 26.0, 0.5), 26.0);
  float promH = smoothstep(0.68, 0.95, pr) * 0.11;
  float promShape = exp(-rr / (0.012 + promH)) * (0.6 + 0.8 * fbm3(vec2(u * 60.0, rr * 12.0)));
  float chrom = (r > 1.0 - 0.5 * uPx / ER) ? promShape : 0.0;
  vec3 chromCol = vec3(1.0, 0.20, 0.36);

  // the dark disc: faint coppery earthshine and inner limb glow
  float nz = sqrt(max(0.0, 1.0 - r * r));
  vec3 disk = vec3(0.020, 0.006, 0.010) + vec3(0.10, 0.02, 0.03) * (1.0 - nz) * 0.8;
  disk += vec3(0.05, 0.012, 0.02) * (fbm4(q * 3.0 + 2.0) - 0.4);
  disk += vec3(1.0, 0.35, 0.4) * exp(-(1.0 - r) / 0.012) * 0.35;

  // diamond-ring bead
  vec2 bead = vec2(cos(0.82), sin(0.82)) * ER * 1.005;
  float bd = sparkle(p - bead, 0.95) * 0.9 + exp(-dot(p - bead, p - bead) / 0.0025) * 1.4;
  bd *= cellFade(p);

  vec3 rgb = corCol * cor + chromCol * chrom * 1.4;
  float a = sat(cor * 0.55 + chrom * 0.8);
  vec4 o = vec4(rgb, a);
  o = vec4(disk * covDisk, covDisk) + o * (1.0 - covDisk);
  o.rgb += vec3(1.0, 0.96, 0.9) * bd;
  o.a = sat(o.a + bd * 0.5);
  return o;
}

void main() {
  vec2 p = cellP();
  finalColor = uStorm > 0.5 ? moonEclipse(p) : moonBase(p);
}
`;

// ─────────────────────────────────────────── H2 POLARSTJERNEN ───────────────────────────────────────
export const STAR_FRAG = ART_HEAD + /* glsl */ `
const float SR = 0.80;

float starR(float th) {
  float c2 = abs(cos(2.0 * th));
  float s2 = abs(sin(2.0 * th));
  float rMain = mix(0.21 * SR, SR, pow(c2, 6.0));
  float rDiag = 0.50 * SR * pow(s2, 22.0);
  return max(rMain, rDiag);
}

void main() {
  vec2 p = cellP();
  bool storm = uStorm > 0.5;
  float r = length(p);
  float th = atan(p.y, p.x);
  float rs = starR(th);
  // SDF-ish with gradient normalisation (d(r - rs(θ)))
  float e = 0.002;
  float drs = (starR(th + e) - starR(th - e)) / (2.0 * e);
  float d = (r - rs) / sqrt(1.0 + pow(drs / max(r, 1e-3), 2.0));
  float cov = cover(d);

  // bevel: each arm = two planes meeting in a ridge along the arm axis
  float c2 = abs(cos(2.0 * th)), s2 = abs(sin(2.0 * th));
  float rMain = mix(0.21 * SR, SR, pow(c2, 6.0));
  float rDiag = 0.50 * SR * pow(s2, 22.0);
  bool diag = rDiag > rMain;
  float A = diag ? (floor((th - 0.785398) / 1.570796 + 0.5) * 1.570796 + 0.785398) : floor(th / 1.570796 + 0.5) * 1.570796;
  vec2 ax = vec2(cos(A), sin(A));
  vec2 pp = vec2(-ax.y, ax.x);
  float side = sign(dot(p, pp) + 1e-6);
  float along = sat(r / rs);
  vec3 n = normalize(vec3(pp * side * 0.95 + ax * 0.35 * along, 0.62));
  float centreW = smoothstep(0.20 * SR, 0.0, r);
  n = normalize(mix(n, normalize(vec3(p / (0.21 * SR) * 0.6, 1.0)), centreW));
  float ndl = dot(n, KEY);
  float ridge = exp(-abs(dot(p, pp)) / (1.1 * uPx)) * (1.0 - centreW);

  vec3 lit, shade, rimC, core, halo;
  if (storm) {
    lit = vec3(1.0, 1.0, 0.98); shade = vec3(1.0, 0.62, 0.22); rimC = vec3(1.0, 0.25, 0.10);
    core = vec3(1.0, 0.98, 0.92); halo = vec3(1.0, 0.24, 0.40);
  } else {
    lit = vec3(1.0, 0.995, 0.965); shade = vec3(0.93, 0.74, 0.40); rimC = vec3(0.80, 0.56, 0.24);
    core = vec3(1.0, 0.97, 0.88); halo = vec3(0.66, 0.78, 1.0);
  }
  float f = sat(ndl * 1.25 + 0.15);
  vec3 col = mix(shade, lit, smoothstep(0.1, 0.9, f));
  // subtle env tint on the shaded planes + inner radial heat
  col += envAvg() * (1.0 - f) * (storm ? 0.10 : 0.12);
  col = mix(col, core, exp(-r / 0.10) * 0.8);
  col += vec3(1.0) * ridge * 0.55;
  float edge = 1.0 - smoothstep(0.3 * uPx, 2.4 * uPx, -d);
  col = mix(col, rimC, edge * 0.55 * (1.0 - f * 0.5));
  if (storm) {
    // white-hot body with a molten crust toward the arm tips
    float heat = smoothstep(0.35, 0.95, along);
    col = mix(col, vec3(1.0, 0.45, 0.12), heat * 0.45 * (1.0 - f * 0.6));
    col += vec3(1.0, 0.5, 0.2) * (fbm3(p * 9.0) - 0.5) * 0.25 * heat;
  }

  // glows: halo, core bloom, diffraction spikes
  float fade = cellFade(p);
  float hal = (exp(-r / 0.16) * 0.55 + exp(-r / 0.42) * 0.22) * fade;
  float bloom = exp(-r * r / 0.012) * 1.1;
  float ax1 = exp(-abs(p.y) / (0.9 * uPx + 0.006 * abs(p.x))) * exp(-abs(p.x) / 0.62);
  float ax2 = exp(-abs(p.x) / (0.9 * uPx + 0.006 * abs(p.y))) * exp(-abs(p.y) / 0.62);
  vec2 pr = rot2(0.785398) * p;
  float dg1 = exp(-abs(pr.y) / (0.7 * uPx + 0.004 * abs(pr.x))) * exp(-abs(pr.x) / 0.30);
  float dg2 = exp(-abs(pr.x) / (0.7 * uPx + 0.004 * abs(pr.y))) * exp(-abs(pr.y) / 0.30);
  float spikes = ((ax1 + ax2) * 0.95 + (dg1 + dg2) * 0.45) * fade;
  vec3 spikeCol = storm ? mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.42, 0.1), sat(r * 1.3)) : mix(vec3(1.0, 0.98, 0.92), halo, sat(r * 1.4));
  // tiny satellite glints
  float tw = sparkle(p - vec2(-0.58, 0.46), 0.16) * 0.55 + sparkle(p - vec2(0.62, -0.50), 0.12) * 0.45 + sparkle(p - vec2(0.50, 0.62), 0.09) * 0.4;
  tw *= fade;
  // storm: flickering plasma corona between the arms
  float plasma = 0.0;
  if (storm) {
    float pn = pnoise(vec2(th / TAU * 20.0, r * 4.0), 20.0);
    plasma = pow(pn, 3.0) * exp(-abs(r - 0.36) / 0.12) * 0.9 * fade;
  }

  vec3 gRgb = halo * hal + core * bloom * (1.0 - cov) + spikeCol * spikes + vec3(1.0) * tw + vec3(1.0, 0.35, 0.15) * plasma;
  float gA = sat(hal * 0.45 + spikes * 0.4 + tw * 0.4 + plasma * 0.4 + bloom * 0.3 * (1.0 - cov));
  vec4 o = vec4(gRgb, gA);
  o = vec4(col * cov, cov) + o * (1.0 - cov);
  // the core bloom sits on top of the body too
  o.rgb += core * exp(-r * r / 0.004) * 0.6;
  finalColor = o;
}
`;

// ─────────────────────────────────────────────── SUN ────────────────────────────────────────────────
export const SUN_FRAG = ART_HEAD + /* glsl */ `
const float RS = 0.47;

vec4 sun(vec2 p, bool storm) {
  float r = length(p);
  vec2 q = p / RS;
  float rq = length(q);
  float dDisk = (rq - 1.0) * RS;
  float cov = cover(dDisk);
  float th = atan(p.y, p.x);
  float u = th / TAU;
  float fade = cellFade(p);

  // palette
  vec3 cCore, cMid, cLimb, cCor, cRay, cProm;
  if (storm) {
    cCore = vec3(1.0, 0.62, 0.38); cMid = vec3(1.0, 0.16, 0.20); cLimb = vec3(0.42, 0.0, 0.05);
    cCor = vec3(1.0, 0.20, 0.25); cRay = vec3(1.0, 0.12, 0.26); cProm = vec3(1.0, 0.55, 0.12);
  } else {
    cCore = vec3(1.0, 0.97, 0.82); cMid = vec3(1.0, 0.80, 0.36); cLimb = vec3(0.96, 0.40, 0.08);
    cCor = vec3(1.0, 0.80, 0.42); cRay = vec3(1.0, 0.76, 0.30); cProm = vec3(1.0, 0.42, 0.14);
  }

  // DISC: limb darkening + granulation + spots + faculae
  vec3 disk = vec3(0.0);
  if (dDisk < 2.0 * uPx) {
    float mu = sqrt(max(0.0, 1.0 - rq * rq));
    float ld = 1.0 - 0.62 * (1.0 - mu) - 0.18 * (1.0 - mu) * (1.0 - mu);
    vec2 sq = q * (1.0 + 0.8 * (1.0 - mu));
    vec3 w1 = worley(sq * 9.0 + 3.0);
    vec3 w2 = worley(sq * 19.0 + 11.0);
    float gran = smoothstep(0.0, 0.35, w1.y - w1.x) * 0.65 + smoothstep(0.0, 0.3, w2.y - w2.x) * 0.35;
    float heat = ld * (0.80 + 0.26 * gran) + (fbm4(sq * 2.5) - 0.5) * 0.12;
    // sunspot group
    vec2 s1 = sq - vec2(0.28, -0.22);
    float spot = exp(-dot(s1, s1) / 0.004) + 0.6 * exp(-dot(s1 - vec2(0.09, 0.03), s1 - vec2(0.09, 0.03)) / 0.0018);
    float pen = exp(-dot(s1, s1) / 0.014) * 0.5;
    heat *= 1.0 - sat(spot) * 0.75 - pen * 0.3;
    // faculae (bright near limb)
    heat += smoothstep(0.55, 0.9, fbm4(sq * 5.0 + 7.0)) * (1.0 - mu) * 0.35;
    disk = mix(cLimb, cMid, smoothstep(0.25, 0.75, heat));
    disk = mix(disk, cCore, smoothstep(0.78, 1.08, heat));
    if (storm) disk *= 0.85 + 0.35 * gran;
    // lit lip + top-left specular sheen on the plasma surface
    disk += cCore * exp(-dot(q - vec2(-0.35, 0.42), q - vec2(-0.35, 0.42)) * 3.5) * 0.22;
  }

  // STYLISED RAYS behind the corona (12, alternating length) — silhouette signature
  float rays = 0.0;
  {
    float k = 12.0;
    float a = fract(u * k + 0.5) - 0.5;              // -0.5..0.5 within a ray slot
    float idx = floor(u * k + 0.5);
    float longR = mod(idx, 2.0) < 0.5 ? 0.93 : 0.74;
    float halfW = 0.34 * (1.0 - smoothstep(RS, longR, r));
    float inRay = 1.0 - smoothstep(halfW - 0.08, halfW, abs(a) * 2.0);
    float along = sat((r - RS) / (longR - RS));
    rays = inRay * (1.0 - along) * step(RS * 0.9, r);
    rays *= 0.55 + 0.45 * (1.0 - abs(a) * 2.0 / max(halfW, 1e-3));
  }

  // CORONA: polar-fbm filaments
  float rr = max(rq - 1.0, 0.0);
  float fA = pnoise(vec2(u * 18.0, rr * 1.6), 18.0);
  float fB = pnoise(vec2(u * 46.0, rr * 2.6 + 3.0), 46.0);
  float fil = pow(0.6 * fA + 0.4 * fB, 2.2) * 1.8;
  float corona = exp(-rr / 0.10) * 0.95 + exp(-rr / (0.34 + 0.4 * fil)) * fil * 0.9;

  // prominences / flares: arcs rising from the limb
  float prom = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float pa = 0.6 + fi * 1.63 + hash11(fi + 3.0) * 0.4;
    vec2 pc = vec2(cos(pa), sin(pa)) * RS * (1.02 + 0.04 * hash11(fi + 9.0));
    float pr = RS * (0.10 + 0.07 * hash11(fi + 5.0));
    float ring = abs(length(p - pc) - pr);
    float w = 0.010 + 0.012 * fbm3(p * 30.0 + fi * 7.0);
    float arc = exp(-ring / w) * step(RS, r);
    prom += arc * (0.75 + 0.5 * hash11(fi + 1.0));
  }

  // flare glint at the limb (top-left)
  vec2 fp = vec2(-0.62, 0.62) * RS * 1.06;
  float flare = sparkle(p - fp, 0.55) * 0.85;

  vec3 rgb = (cRay * rays * 0.95 + cCor * corona * 0.85 + cProm * prom * 1.3) * fade + vec3(1.0, 0.97, 0.9) * flare * fade;
  float a = sat((rays * 0.75 + corona * 0.5 + prom * 0.6 + flare * 0.5) * fade);
  // hot outer glow
  float od = max(dDisk, 0.0);
  float glow = (exp(-od / 0.06) * 0.5 + exp(-od / 0.22) * 0.25) * fade;
  rgb += cMid * glow; a = sat(a + glow * 0.35);

  vec4 o = vec4(rgb, a);
  o = vec4(disk * cov, cov) + o * (1.0 - cov);
  return o;
}

void main() {
  vec2 p = cellP();
  finalColor = sun(p, uStorm > 0.5);
}
`;
