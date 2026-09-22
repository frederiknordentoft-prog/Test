// H1 Månen, H2 Polarstjernen and the SUN scatter — base + storm variants (compile-time STORM_ED switch).
import { ART_HEAD } from './glsl.ts';

// ───────────────────────────────────────────── H1 MÅNEN ─────────────────────────────────────────────
export const MOON_FRAG = ART_HEAD + /* glsl */ `
const float MR = 0.615;            // moon radius (p units)
const vec2 MC = vec2(0.02, -0.01);
const vec2 OFF = vec2(0.44, 0.27); // cut-circle offset (moon radii)
const float CR = 0.90;             // cut-circle radius (moon radii)
const float HALO_R = 0.86;         // 22° halo ring radius

// crater field: sums bowls from the 3x3 neighbourhood (no Voronoi clipping)
float craters(vec2 sq, float sc, vec2 Ld, float seed) {
  vec2 x = sq * sc + seed;
  vec2 i = floor(x), f = fract(x);
  float acc = 0.0;
  for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) {
    vec2 g = vec2(float(xx), float(yy));
    vec2 h = hash22(i + g + seed);
    float present = step(0.42, h.x);
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
    base *= mix(vec3(1.0, 0.985, 0.955), vec3(1.0, 0.93, 0.80), 0.55);   // pale-gold moonlight (warm = value)
    float limb = 0.62 + 0.38 * pow(nz, 0.45);
    float sunTerm = 0.55 + 0.45 * sat(dCut / (0.42 * MR)); // brighter away from the terminator
    vec3 litCol = base * limb * sunTerm * (1.0 + cs * 2.2) * 1.08;
    vec3 earth = base * vec3(0.12, 0.16, 0.27) + vec3(0.016, 0.024, 0.055);   // earthshine: the full disc stays readable
    earth *= 1.0 + cs * 0.9;
    col = mix(earth, litCol, lit);
    // earthshine limb (reveals the full disc) and lit-limb lip
    float edge = 1.0 - smoothstep(0.0, 5.0 * uPx, -dDisk);
    col += vec3(0.30, 0.46, 0.85) * edge * (1.0 - lit) * 0.38;
    col += vec3(1.0, 0.95, 0.84) * edge * lit * 0.35;
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
  vec3 hc = mix(vec3(1.0, 0.30, 0.22), vec3(1.0, 0.86, 0.55), smoothstep(-1.4, -0.3, t));
  hc = mix(hc, vec3(0.80, 1.0, 0.86), smoothstep(-0.3, 0.6, t));
  hc = mix(hc, vec3(0.50, 0.70, 1.0), smoothstep(0.6, 2.5, t));
  float ang = atan(dp.y, dp.x);
  float dogs = exp(-pow(abs(cos(ang)) - 1.0, 2.0) * 900.0) * exp(-t * t * 0.5) * 0.9;
  float halo = I * (0.20 + dogs * 0.35) * cellFade(p) * (0.75 + 0.25 * sat(dot(normalize(dp + 1e-5), Ld) + 0.5));
  vec3 glowRgb = mix(vec3(0.62, 0.78, 1.0), vec3(1.0, 0.90, 0.72), 0.45) * aur + hc * halo;
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
  vec3 corCol = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.42, 0.50), smoothstep(0.0, 0.18, rr));
  corCol = mix(corCol, vec3(1.0, 0.10, 0.24), smoothstep(0.15, 0.55, rr));
  corCol = mix(corCol, vec3(0.95, 0.12, 0.80), smoothstep(0.45, 0.9, rr) * 0.7);
  cor *= cellFade(p) * (1.0 - smoothstep(0.72, 0.97, length(p)));

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
// Faceted 8-point compass star: 4 long main points + 4 short diagonals. Straight-edged polygon folded into
// one octant (cheap exact SDF), every half-point is a bevel plane (ridge along the point axis) → one side lit,
// one side in shade, like a cut metal/crystal star. White-gold body, blue halo, diffraction spikes.
export const STAR_FRAG = ART_HEAD + /* glsl */ `
const float R1 = 0.86;   // main tip radius
const float R2 = 0.55;   // diagonal tip radius
const float RV = 0.285;  // valley radius
const float HC = 0.30;   // centre height of the bevel (relative)
const float A8 = 0.39269908; // 22.5°

struct StarS { float d; vec3 n; float ridge; float facet; };

StarS starAt(vec2 p) {
  vec2 sgn = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  vec2 q = abs(p);
  bool sw = q.y > q.x;
  if (sw) q = q.yx;
  vec2 A = vec2(R1, 0.0);
  vec2 V = RV * vec2(cos(A8), sin(A8));
  vec2 B = R2 * vec2(0.70710678, 0.70710678);
  // exact distance to the two boundary segments of this octant
  float dA = sdSeg(q, A, V), dB = sdSeg(q, V, B);
  float inside = (cross2(V - A, q - A) >= 0.0 || cross2(B - V, q - V) >= 0.0) ? -1.0 : 1.0; // reflex valley → union
  StarS s;
  s.d = min(dA, dB) * inside;
  bool diag = cross2(V, q) > 0.0;
  vec3 O = vec3(0.0, 0.0, HC);
  vec3 nr = diag ? cross(vec3(V, 0.0) - O, vec3(B, 0.0) - O) : cross(vec3(A, 0.0) - O, vec3(V, 0.0) - O);
  if (nr.z < 0.0) nr = -nr;
  vec3 n = normalize(nr);
  // ridge distance: to the point axis of the current half-point (x axis or the 45° diagonal)
  s.ridge = diag ? abs(q.x - q.y) * 0.70710678 : q.y;
  s.facet = diag ? 1.0 : 0.0;
  if (sw) n.xy = n.yx;
  n.xy *= sgn;
  s.n = n;
  return s;
}

void main() {
  vec2 p = cellP() - vec2(0.0, 0.0);
  bool storm = uStorm > 0.5;
  float r = length(p);
  float fade = sat(1.0 - smoothstep(0.80, 0.985, r)) * cellFade(p);
  StarS st = starAt(p);
  float d = st.d;
  float cov = cover(d);
  vec3 n = st.n;
  float ndl = dot(n, KEY);
  float f = sat(ndl * 1.35 + 0.05);                 // 0 shade … 1 lit plane

  vec3 lit, mid, shade, edgeC, core, halo, spikeC;
  if (storm) {
    lit = vec3(1.0, 1.0, 0.97); mid = vec3(1.0, 0.80, 0.52); shade = vec3(0.98, 0.34, 0.10);
    edgeC = vec3(1.0, 0.22, 0.08); core = vec3(1.0, 0.97, 0.90); halo = vec3(1.0, 0.18, 0.34); spikeC = vec3(1.0, 0.55, 0.22);
  } else {
    lit = vec3(1.0, 0.985, 0.93); mid = vec3(1.0, 0.80, 0.40); shade = vec3(0.74, 0.40, 0.10);
    edgeC = vec3(0.45, 0.22, 0.05); core = vec3(1.0, 0.97, 0.88); halo = vec3(0.66, 0.78, 1.0); spikeC = vec3(0.86, 0.92, 1.0);
  }
  // metallic gradient along the point: bright near the heart, deeper toward the tips
  float along = sat(r / R1);
  float ff = sat(f + 0.18 * (1.0 - along) - 0.12 * along);
  vec3 col = ff < 0.5 ? mix(shade, mid, ff * 2.0) : mix(mid, lit, (ff - 0.5) * 2.0);
  // anisotropic sheen streak across the lit planes
  col += vec3(1.0, 0.95, 0.85) * f * exp(-pow((along - 0.42) / 0.16, 2.0)) * 0.22;
  // emissive heart: body glows brighter toward the centre
  float heart = exp(-r / 0.13);
  col = mix(col, core, heart * 0.6);
  // cool env tint in the shaded planes (it lives in the aurora sky)
  col += envAvg() * (1.0 - f) * (storm ? 0.06 : 0.10);
  // ridge line (bright crest) and the lit bevel edge
  float ridge = 1.0 - smoothstep(0.25 * uPx, 1.3 * uPx, st.ridge);
  col = mix(col, vec3(1.0), ridge * 0.75 * (1.0 - heart * 0.5));
  // outline: darker gold rim toward the shade, thin bright lip toward the light
  float edge = 1.0 - smoothstep(0.4 * uPx, 2.2 * uPx, -d);
  col = mix(col, mix(edgeC, lit, f * f), edge * 0.7);
  float spec = pow(sat(dot(n, normalize(KEY + vec3(0.0, 0.0, 1.0)))), 40.0);
  col += vec3(1.0) * spec * 0.35;
  if (storm) {
    // white-hot body with molten crust toward the tips
    float tip = smoothstep(0.30, 0.85, r);
    col = mix(col, vec3(1.0, 0.36, 0.10), tip * 0.45 * (1.0 - f * 0.5));
    col += vec3(1.0, 0.55, 0.2) * (fbm3(p * 11.0) - 0.5) * 0.22 * tip;
  }

  // glows: halo, core bloom, diffraction spikes (main axes long, diagonals short), satellite glints
  float od = max(d, 0.0);
  float rim = (exp(-od / 0.025) * 0.35 + exp(-od / 0.09) * 0.20) * fade;
  float hal = (exp(-r / 0.20) * 0.40 + exp(-r / 0.45) * 0.18) * fade;
  float ax1 = exp(-abs(p.y) / (0.8 * uPx + 0.005 * abs(p.x))) * exp(-abs(p.x) / 0.55);
  float ax2 = exp(-abs(p.x) / (0.8 * uPx + 0.005 * abs(p.y))) * exp(-abs(p.y) / 0.55);
  vec2 pr = rot2(0.785398) * p;
  float dg1 = exp(-abs(pr.y) / (0.6 * uPx + 0.004 * abs(pr.x))) * exp(-abs(pr.x) / 0.30);
  float dg2 = exp(-abs(pr.x) / (0.6 * uPx + 0.004 * abs(pr.y))) * exp(-abs(pr.y) / 0.30);
  float spikes = ((ax1 + ax2) * 0.8 + (dg1 + dg2) * 0.4) * fade * smoothstep(0.1, 0.5, r);
  float tw = sparkle(p - vec2(-0.56, 0.50), 0.15) * 0.5 + sparkle(p - vec2(0.60, -0.52), 0.11) * 0.4 + sparkle(p - vec2(0.52, 0.60), 0.08) * 0.35;
  tw *= fade;
  float plasma = 0.0;
  if (storm) {
    float th = atan(p.y, p.x);
    float pn = pnoise(vec2(th / TAU * 24.0, r * 5.0), 24.0);
    plasma = pow(pn, 3.0) * exp(-abs(r - 0.34) / 0.12) * 0.8 * fade;
  }
  vec3 gRgb = halo * hal + mix(halo, vec3(1.0), 0.3) * rim + spikeC * spikes + vec3(1.0) * tw + vec3(1.0, 0.3, 0.12) * plasma;
  float gA = sat(hal * 0.45 + rim * 0.45 + spikes * 0.4 + tw * 0.45 + plasma * 0.4);
  vec4 o = vec4(gRgb, gA);
  o = vec4(col * cov, cov) + o * (1.0 - cov);
  // core bloom on top (the star's eye)
  float eye = exp(-r * r / 0.0035);
  o.rgb += core * eye * 0.9 + vec3(1.0) * sparkle(p, 0.42) * 0.35 * fade;
  o.a = sat(o.a + eye * 0.3);
  finalColor = o;
}
`;

// ─────────────────────────────────────────────── SUN ────────────────────────────────────────────────
// Scatter. Glossy plasma orb (limb darkening, fine granulation, faculae, a small spot group) inside a
// two-tier sunburst crown (16 swept rays) and a filamented corona. Everything fades on a circle (never the cell square).
export const SUN_FRAG = ART_HEAD + /* glsl */ `
const float RS = 0.47;

float rayMask(float u, float r, float k, float phase, float r0, float r1, float w0) {
  float a = fract(u * k + phase) - 0.5;              // -0.5..0.5 inside one ray slot
  float along = sat((r - r0) / (r1 - r0));
  float hw = w0 * (1.0 - along);                       // triangular ray
  float m = 1.0 - smoothstep(hw - 0.02 - 1.2 * uPx / max(r, 0.05) * k / TAU, hw, abs(a));
  return m * step(r0 * 0.85, r) * (1.0 - smoothstep(0.92, 1.0, along));
}

vec4 sun(vec2 p, bool storm) {
  float r = length(p);
  vec2 q = p / RS;
  float rq = length(q);
  float dDisk = (rq - 1.0) * RS;
  float cov = cover(dDisk);
  float th = atan(p.y, p.x);
  float u = th / TAU;
  float fade = (1.0 - smoothstep(0.80, 0.975, r)) * cellFade(p);

  vec3 cCore, cMid, cLimb, cCor, cRayA, cRayB, cProm;
  if (storm) {
    cCore = vec3(1.0, 0.80, 0.52); cMid = vec3(1.0, 0.22, 0.16); cLimb = vec3(0.45, 0.0, 0.06);
    cCor = vec3(1.0, 0.16, 0.26); cRayA = vec3(1.0, 0.20, 0.30); cRayB = vec3(1.0, 0.10, 0.55); cProm = vec3(1.0, 0.52, 0.14);
  } else {
    cCore = vec3(1.0, 0.98, 0.84); cMid = vec3(1.0, 0.76, 0.26); cLimb = vec3(0.93, 0.36, 0.05);
    cCor = vec3(1.0, 0.78, 0.36); cRayA = vec3(1.0, 0.80, 0.34); cRayB = vec3(1.0, 0.56, 0.16); cProm = vec3(1.0, 0.45, 0.12);
  }

  // DISC
  vec3 disk = vec3(0.0);
  if (dDisk < 2.0 * uPx) {
    float mu = sqrt(max(0.0, 1.0 - rq * rq));
    float ld = 1.0 - 0.56 * (1.0 - mu) - 0.24 * (1.0 - mu) * (1.0 - mu);
    vec2 sq = q * (1.0 + 0.55 * (1.0 - mu));          // foreshortened toward the limb
    vec3 w1 = worley(sq * 17.0 + 3.0);
    float cellB = 1.0 - w1.x * 1.25;                    // soft bright cell centres (no hard lanes)
    float gran = mix(sat(cellB), fbm3(sq * 24.0 + 5.0), 0.45);
    float mott = fbm4(sq * 3.2 + 1.3);
    float heat = ld * (0.86 + 0.06 * (gran - 0.5) * 2.0 + 0.12 * (mott - 0.5));
    // small sunspot group (umbra + penumbra)
    vec2 s1 = sq - vec2(0.34, -0.30);
    float umbra = exp(-dot(s1, s1) / 0.0022) + 0.7 * exp(-dot(s1 - vec2(0.10, 0.04), s1 - vec2(0.10, 0.04)) / 0.0010);
    float pen = exp(-dot(s1, s1) / 0.010);
    heat *= 1.0 - sat(umbra) * 0.55 - pen * 0.18;
    // faculae: bright mottling near the limb
    heat += smoothstep(0.55, 0.85, fbm3(sq * 6.0 + 7.0)) * (1.0 - mu) * 0.25;
    disk = mix(cLimb, cMid, smoothstep(0.30, 0.72, heat));
    disk = mix(disk, cCore, smoothstep(0.80, 1.06, heat) * 0.85);
    // hot heart + glossy top-left sheen + thin bright limb lip
    disk += cCore * exp(-rq * rq * 6.0) * 0.22;
    vec2 hl = q - vec2(-0.36, 0.40);
    disk += vec3(1.0, 0.99, 0.94) * exp(-dot(hl, hl) * 5.0) * 0.30;
    disk += cMid * (1.0 - smoothstep(0.0, 3.0 * uPx, -dDisk)) * 0.35;
    if (storm) disk *= 0.94 + 0.12 * gran;
  }

  // SUNBURST: 8 long + 8 short rays, slightly swept (turbine feel), bright spine
  float sweep = (r - RS) * 0.35;
  float uu = u + sweep / TAU;
  float rl = rayMask(uu, r, 8.0, 0.5, RS * 0.92, 0.93, 0.30);
  float rs = rayMask(uu, r, 8.0, 0.0, RS * 0.92, 0.72, 0.26);
  float spineL = exp(-abs(fract(uu * 8.0 + 0.5) - 0.5) * r * TAU / 8.0 / (1.0 * uPx + 0.004)) * rl;
  float spineS = exp(-abs(fract(uu * 8.0) - 0.5) * r * TAU / 8.0 / (1.0 * uPx + 0.004)) * rs;
  float along = sat((r - RS) / (0.93 - RS));
  vec3 rayCol = mix(cRayA, cRayB, along);
  vec3 rays = rayCol * (rl + rs * 0.85) * (1.0 - along * 0.55) + vec3(1.0, 0.95, 0.8) * (spineL + spineS) * 0.45;
  float rayA = (rl + rs * 0.85) * (1.0 - along * 0.35);

  // CORONA: soft glow + polar-fbm streamers
  float rr = max(rq - 1.0, 0.0);
  float fA = pnoise(vec2(u * 20.0, rr * 1.8), 20.0);
  float fB = pnoise(vec2(u * 52.0, rr * 2.8 + 3.0), 52.0);
  float fil = pow(0.6 * fA + 0.4 * fB, 2.0) * 1.7;
  float corona = exp(-rr / 0.09) * 0.85 + exp(-rr / (0.26 + 0.3 * fil)) * fil * 0.38;

  // prominences: 3 flame arches standing on the limb (outer half only, thick feet, ragged plasma)
  float prom = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float pa = 0.9 + fi * 2.2 + hash11(fi + 3.0) * 0.5;
    vec2 dir = vec2(cos(pa), sin(pa));
    vec2 pc = dir * RS * 0.99;
    float pr = RS * (0.11 + 0.05 * hash11(fi + 5.0));
    vec2 v = p - pc;
    float up = dot(v, dir);                                   // height above the limb tangent
    float ring = abs(length(v) - pr);
    float feet = 1.0 - sat(up / pr);                          // 1 at the limb → 0 at the apex
    float w = (0.009 + 0.014 * feet) * (0.7 + 0.8 * fbm3(p * 26.0 + fi * 7.0));
    float arch = exp(-ring / w) * smoothstep(-0.01, 0.02, up) * step(RS, r);
    float haze = exp(-ring / 0.035) * smoothstep(0.0, 0.03, up) * step(RS, r) * 0.25;
    prom += (arch + haze) * (0.75 + 0.35 * hash11(fi + 1.0));
  }

  // flare glint on the top-left limb
  vec2 fp = vec2(-0.62, 0.64) * RS * 1.02;
  float flare = sparkle(p - fp, 0.50) * 0.75;

  vec3 rgb = (rays + cCor * corona * 0.9 + cProm * prom * 0.6) * fade + vec3(1.0, 0.97, 0.9) * flare * fade;
  float a = sat((rayA * 0.9 + corona * 0.55 + prom * 0.3 + flare * 0.5) * fade);
  float od = max(dDisk, 0.0);
  float glow = (exp(-od / 0.05) * 0.5 + exp(-od / 0.18) * 0.22) * fade;
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
