// H3 Rav (amber pebble / storm ember) and WILD Nordlysbue (ice plate with mini aurora / storm plasma orb).
import { ART_HEAD } from './glsl.ts';

// ─────────────────────────────────────────────── H3 RAV ──────────────────────────────────────────────
export const AMBER_FRAG = ART_HEAD + /* glsl */ `
const float AR = 0.80;

// pebble SDF (p units): rotated ellipse with low-frequency noise displacement
float pebbleR(float th) {
  return 1.0 + 0.055 * sin(2.0 * th + 0.7) + 0.035 * sin(3.0 * th + 2.1) + 0.025 * sin(5.0 * th + 0.3);
}
vec2 pebbleLocal(vec2 p) { return rot2(0.26) * (p - vec2(0.0, -0.01)); }
float sdPebble(vec2 p) {
  vec2 l = pebbleLocal(p);
  vec2 e = l / vec2(AR, AR * 0.80);
  float th = atan(e.y, e.x);
  float k = length(e) / pebbleR(th);
  return (k - 1.0) * AR * 0.80 * 0.97;
}

// fern fossil: an arched frond with alternating pinnae (stem = circular arc). returns ink density 0..1
const float FERN_ST = 0.052;
float pinnae(float s, float rad, float sgn, float off, float L) {
  float ink = 0.0;
  float i = floor((s - off) / FERN_ST + 0.5);
  for (int kk = -2; kk <= 1; kk++) {
    float ii = i + float(kk);
    float s0 = ii * FERN_ST + off;
    float uu = s0 / L;
    float valid = step(0.05, uu) * step(uu, 0.97);
    float len = 0.16 * (1.0 - uu * 0.8) * (0.85 + 0.3 * hash11(ii * 3.1 + sgn));
    vec2 dirv = normalize(vec2(0.55, 0.83 * sgn));
    vec2 w = vec2(s - s0, rad);
    float t = sat(dot(w, dirv) / len);
    vec2 cp = dirv * t * len + vec2(-dirv.y, dirv.x) * sgn * sin(t * 3.14159) * 0.012;
    float dd = length(w - cp);
    float wdt = 0.017 * (1.0 - t * 0.7) * (1.0 - uu * 0.45);
    ink = max(ink, valid * (1.0 - smoothstep(wdt * 0.45, wdt, dd)) * 0.9);
  }
  return ink;
}
float fern(vec2 p) {
  vec2 c = vec2(0.47, 0.47);          // curvature centre of the stem arc
  float R = 0.80;
  vec2 v = p - c;
  float ang = atan(v.y, v.x);
  float a0 = -1.80, a1 = -2.80;       // base → tip (clockwise)
  float u = (ang - a0) / (a1 - a0);   // 0 base → 1 tip
  float rad = length(v) - R;          // signed offset from the stem (+ = outer side)
  float L = abs(a1 - a0) * R;
  float s = u * L;
  float stem = abs(rad) - 0.009 * (1.0 - 0.6 * u);
  float inStem = step(-0.02, u) * step(u, 1.02);
  float ink = inStem * (1.0 - smoothstep(0.0, 0.007, stem));
  ink = max(ink, pinnae(s, rad, 1.0, 0.0, L));
  ink = max(ink, pinnae(s, rad, -1.0, FERN_ST * 0.5, L));
  return ink;
}

void main() {
  vec2 p = cellP();
  bool storm = uStorm > 0.5;
  float d = sdPebble(p);
  float cov = cover(d);
  float fade = cellFade(p);
  vec2 l = pebbleLocal(p);
  vec2 e = l / vec2(AR, AR * 0.80);
  float depth = sat(-d / (AR * 0.80));   // 0 at rim → 1 centre
  float dome = sqrt(1.0 - pow(1.0 - depth, 2.0));
  // dome normal from the SDF gradient
  float eps = 0.004;
  vec2 gr = vec2(sdPebble(p + vec2(eps, 0.0)) - sdPebble(p - vec2(eps, 0.0)), sdPebble(p + vec2(0.0, eps)) - sdPebble(p - vec2(0.0, eps))) / (2.0 * eps);
  float slope = (1.0 - depth) * 1.6;
  vec3 n = normalize(vec3(gr * slope, 1.0));
  float ndl = dot(n, KEY);
  vec3 H = normalize(KEY + vec3(0.0, 0.0, 1.0));

  vec3 col = vec3(0.0);
  if (d < 2.0 * uPx) {
    if (!storm) {
      // base gradient FFE19A → FFB547 → B8560A along the light axis
      float t = sat(dot(p, vec2(0.55, -0.72)) * 0.75 + 0.5);
      vec3 c0 = vec3(1.0, 0.882, 0.604), c1 = vec3(1.0, 0.71, 0.278), c2 = vec3(0.722, 0.337, 0.039);
      col = t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
      // thickness: darker, redder rim
      col = mix(col * vec3(0.72, 0.42, 0.22), col, smoothstep(0.0, 0.45, depth));
      // internal flow bands + dust
      float flow = fbm4(vec2(l.x * 2.2 + fbm3(l * 3.0) * 1.2, l.y * 6.0));
      col *= 0.86 + 0.26 * flow;
      float dust = smoothstep(0.90, 0.98, vnoise(l * 55.0 + 3.0)) * 0.25;
      col *= 1.0 - dust * 0.5;
      // subsurface: warm glow opposite the key light
      vec2 gc = vec2(0.20, -0.22);
      float sss = exp(-dot(p - gc, p - gc) / 0.16);
      col += vec3(1.0, 0.62, 0.18) * sss * 0.42;
      col += vec3(1.0, 0.85, 0.45) * exp(-dot(p - gc, p - gc) / 0.03) * 0.25;
      // fern fossil (inside, soft-edged, slightly refracted)
      float fe = fern(p + n.xy * 0.025);
      float feHalo = fern(p * 0.985 + n.xy * 0.025 + 0.004);
      col = mix(col, col * vec3(0.26, 0.12, 0.03), fe * 0.62);
      col += vec3(1.0, 0.75, 0.3) * sat(feHalo - fe) * 0.12;
      // bubbles
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 h = hash22(vec2(fi * 7.3 + 1.0, 3.7));
        vec2 bc = vec2(-0.40 + 0.78 * h.x, -0.36 + 0.62 * h.y);
        if (length(bc - vec2(0.05, 0.02)) < 0.14) bc += vec2(0.28, -0.1);
        float br = 0.018 + 0.036 * hash11(fi * 5.1 + 0.3);
        vec2 bq = p - bc;
        float bd = length(bq) - br;
        float inside = 1.0 - smoothstep(-uPx, uPx, bd);
        float ring = exp(-abs(bd) / (1.0 * uPx + br * 0.08));
        vec2 bn = bq / br;
        float hl = exp(-dot(bn - vec2(-0.38, 0.4), bn - vec2(-0.38, 0.4)) * 14.0);
        float shadowC = sat(dot(bn, vec2(0.6, -0.7))) * inside;
        col = mix(col, col * 1.18 + vec3(0.06, 0.04, 0.0), inside * 0.6);
        col -= col * shadowC * 0.35;
        col += vec3(1.0, 0.95, 0.8) * (ring * 0.35 + hl * inside * 0.9);
      }
      // env rim reflection (sky colour on the lower-right rim) + fresnel
      float fres = pow(1.0 - n.z, 2.0);
      col += envRefl(reflect(vec3(0.0, 0.0, -1.0), n)) * fres * 0.55;
      // crescent specular hugging the top-left rim + hotspot
      float rimBand = smoothstep(0.028, 0.045, -d) * (1.0 - smoothstep(0.075, 0.11, -d));
      float angW = pow(sat(dot(normalize(p + 1e-5), vec2(-0.62, 0.78)) * 1.15), 4.0);
      col += vec3(1.0, 0.98, 0.9) * rimBand * angW * 0.95;
      // secondary rim light (bottom-right) from the sky
      float angB = pow(sat(dot(normalize(p + 1e-5), vec2(0.6, -0.8))), 3.0);
      col += mix(vec3(1.0, 0.7, 0.35), envAvg(), 0.5) * rimBand * angB * 0.35;
      float sp = pow(max(dot(n, H), 0.0), 60.0);
      col += vec3(1.0, 0.98, 0.92) * sp * 0.8;
      col += vec3(1.0) * exp(-dot(p - vec2(-0.36, 0.34), p - vec2(-0.36, 0.34)) / 0.0018) * 0.9;
      // crisp outer lip
      col += vec3(1.0, 0.8, 0.45) * (1.0 - smoothstep(0.0, 2.5 * uPx, -d)) * sat(ndl + 0.3) * 0.5;
    } else {
      // EMBER: charred crust, glowing fissures, burning fossil
      vec2 wq = l * 3.4 + (vec2(fbm3(l * 2.0), fbm3(l * 2.0 + 5.0)) - 0.5) * 1.2;
      vec3 w = worley(wq);
      float crack = 1.0 - smoothstep(0.0, 0.10, w.y - w.x);
      float crackCore = 1.0 - smoothstep(0.0, 0.035, w.y - w.x);
      float crustN = fbm4(l * 9.0);
      vec3 crust = mix(vec3(0.045, 0.012, 0.006), vec3(0.16, 0.05, 0.02), crustN * 0.8 + w.z * 0.2);
      float heat = 0.35 + 0.65 * exp(-dot(p - vec2(0.12, -0.14), p - vec2(0.12, -0.14)) / 0.25);
      float thin = smoothstep(0.55, 0.8, fbm3(l * 3.0 + 4.0)) * heat;   // crust gets thin → glows through
      vec3 lava = mix(vec3(1.0, 0.12, 0.05), vec3(1.0, 0.45, 0.02), heat);
      col = crust;
      col = mix(col, lava * 0.8, thin * 0.7);
      col += lava * crack * heat * 1.1 + vec3(1.0, 0.82, 0.45) * crackCore * heat * 1.1;
      float fe = fern(p);
      col += vec3(1.0, 0.72, 0.30) * fe * 1.3;
      // glossy charcoal highlight + edge heat
      float sp = pow(max(dot(n, H), 0.0), 40.0);
      col += vec3(1.0, 0.75, 0.6) * sp * 0.45;
      col += vec3(1.0, 0.3, 0.08) * (1.0 - smoothstep(0.0, 4.0 * uPx, -d)) * 0.7;
      col += envRefl(reflect(vec3(0.0, 0.0, -1.0), n)) * pow(1.0 - n.z, 2.0) * 0.35;
    }
  }

  float od = max(d, 0.0);
  vec3 gcol = storm ? vec3(1.0, 0.30, 0.05) : vec3(1.0, 0.62, 0.16);
  float glow = (exp(-od / 0.045) * 0.55 + exp(-od / 0.16) * 0.28) * fade * (storm ? 1.3 : 1.0);
  float dsh = sdPebble(p - vec2(0.0, -0.05));
  float shadow = exp(-max(dsh, 0.0) / 0.05) * 0.45 * fade;
  vec4 o = vec4(0.0, 0.0, 0.0, shadow);
  o = vec4(gcol * glow, glow * 0.45) + o * (1.0 - glow * 0.45);
  o = vec4(col * cov, cov) + o * (1.0 - cov);
  if (storm) {
    // a few rising sparks
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      vec2 sp = vec2(-0.5 + hash11(fi * 3.3) * 1.0, 0.55 + hash11(fi * 7.1) * 0.3);
      float s = exp(-dot(p - sp, p - sp) / (0.00012 + 0.0002 * hash11(fi))) * fade;
      o.rgb += vec3(1.0, 0.6, 0.2) * s * 1.2; o.a = sat(o.a + s * 0.6);
    }
  }
  finalColor = o;
}
`;

// ───────────────────────────────────────────── WILD ─────────────────────────────────────────────────
// Nordlysbue: faceted ice hex plate (flat-top, 12 bevel facets) with crystal prongs at the vertices,
// a window onto a mini aurora sky, and a glass ribbon carrying "WILD" in monoline capsule strokes
// (same stroke language as the game's Isfont) with tube bevel, gradient fill, dark outline and glow.
// STORM: obsidian frame with molten seams, a plasma orb with lightning in the window, white-hot lettering.
export const WILD_FRAG = ART_HEAD + /* glsl */ `
const float HA = 0.64;   // hex apothem (outer)
const float BW = 0.115;  // bevel width
const float RV = 0.7390; // outer vertex radius = HA / cos 30°
const vec2 BAN_C = vec2(0.0, -0.265);  // ribbon centre
const vec2 BAN_H = vec2(0.78, 0.205);  // ribbon half size
const float CAP = 0.30;  // cap height of the lettering (p units)
const float HW = 0.125;  // stroke half-width (cap units)
const float ADV = 0.47;  // gap between glyph skeletons (cap units)
const float TXT_W = 3.69; // skeleton width of "WILD" (cap units)

// ---- lettering ---------------------------------------------------------------------------------
float sdWild(vec2 p) {   // p in cap units, origin = left end of the baseline
  float d = sdSeg(p, vec2(0.0, 1.0), vec2(0.25, 0.0));
  d = min(d, sdSeg(p, vec2(0.25, 0.0), vec2(0.5, 0.74)));
  d = min(d, sdSeg(p, vec2(0.5, 0.74), vec2(0.75, 0.0)));
  d = min(d, sdSeg(p, vec2(0.75, 0.0), vec2(1.0, 1.0)));
  float x = 1.0 + ADV;
  d = min(d, sdSeg(p, vec2(x, 0.0), vec2(x, 1.0)));                       // I
  x += ADV;
  d = min(d, sdSeg(p, vec2(x, 1.0), vec2(x, 0.0)));                       // L
  d = min(d, sdSeg(p, vec2(x, 0.0), vec2(x + 0.56, 0.0)));
  x += 0.56 + ADV;
  d = min(d, sdSeg(p, vec2(x, 0.0), vec2(x, 1.0)));                       // D
  d = min(d, sdSeg(p, vec2(x, 1.0), vec2(x + 0.26, 1.0)));
  d = min(d, sdSeg(p, vec2(x, 0.0), vec2(x + 0.26, 0.0)));
  vec2 v = p - vec2(x + 0.26, 0.5);
  float arc = v.x >= 0.0 ? abs(length(v) - 0.5) : min(length(v - vec2(0.0, 0.5)), length(v + vec2(0.0, 0.5)));
  return min(d, arc);
}
vec2 txtLocal(vec2 p) { return (p - BAN_C) / CAP + vec2(TXT_W * 0.5, 0.5); }

// returns premultiplied lettering layer (fill + outline + glow) for base/storm
vec4 lettering(vec2 p, bool storm) {
  vec2 t = txtLocal(p);
  float sk = sdWild(t);
  float e = 0.01;
  vec2 g = vec2(sdWild(t + vec2(e, 0.0)) - sdWild(t - vec2(e, 0.0)), sdWild(t + vec2(0.0, e)) - sdWild(t - vec2(0.0, e)));
  g = g / max(length(g), 1e-4);
  float dIn = (sk - HW) * CAP;                  // p units; < 0 inside the stroke
  float dOut = (sk - HW - 0.085) * CAP;         // outline
  float cIn = cover(dIn), cOut = cover(dOut);
  float x = sat(sk / HW);
  vec3 n = normalize(vec3(g * x, sqrt(max(0.0, 1.0 - x * x)) + 0.15));
  float ndl = sat(dot(n, KEY));
  float sp = pow(sat(dot(n, normalize(KEY + vec3(0.0, 0.0, 1.0)))), 24.0);
  float ty = sat(t.y);
  vec3 fill;
  if (storm) {
    fill = mix(vec3(1.0, 0.16, 0.30), vec3(1.0, 0.55, 0.12), smoothstep(0.0, 0.45, ty));
    fill = mix(fill, vec3(1.0, 0.96, 0.84), smoothstep(0.45, 0.95, ty));
  } else {
    fill = mix(vec3(0.16, 0.95, 0.66), vec3(0.93, 1.0, 0.98), smoothstep(0.0, 0.85, ty));
  }
  vec3 col = fill * (0.62 + 0.52 * ndl) + vec3(1.0) * sp * 0.75;
  vec3 oc = storm ? vec3(0.10, 0.0, 0.03) : vec3(0.01, 0.04, 0.09);
  vec3 rgb = mix(oc, col, cIn);
  float a = cOut;
  // glow beyond the outline
  float od = max(dOut, 0.0);
  float gl = (exp(-od / 0.03) * 0.5 + exp(-od / 0.08) * 0.2) * (1.0 - cOut);
  vec3 gc = storm ? vec3(1.0, 0.2, 0.62) : vec3(0.24, 1.0, 0.69);
  return vec4(rgb * a + gc * gl, a + gl * 0.4);
}

// ---- frame --------------------------------------------------------------------------------------
float sdProngs(vec2 p, out vec2 axis, out float along) {
  float d = 1e9; axis = vec2(1.0, 0.0); along = 0.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0471976;
    vec2 dir = vec2(cos(a), sin(a));
    vec2 b = dir * (RV - 0.05);
    float L = 0.18;
    vec2 w = p - b;
    float t = sat(dot(w, dir) / L);
    float dd = length(w - dir * t * L) - mix(0.044, 0.0, t);
    if (dd < d) { d = dd; axis = dir; along = t; }
  }
  return d;
}
// facet normal of the two-step bevel (flat-top hex: side normals at 30° + k·60°)
vec3 bevelNormal(vec2 p, float dOuter) {
  float a = atan(p.y, p.x);
  float k = floor((a - 0.5235988) / 1.0471976 + 0.5);
  float sa = k * 1.0471976 + 0.5235988;
  vec2 sn = vec2(cos(sa), sin(sa));
  float tb = sat(-dOuter / BW);
  float tilt = tb < 0.48 ? 0.95 : 0.40;
  return normalize(vec3(sn * tilt, 1.0));
}

// ---- window contents ----------------------------------------------------------------------------
vec3 aurora(vec2 w, out float ai) {
  float x = w.x;
  float y0 = 0.02 + 0.16 * sin(x * 2.3 + 0.6) + 0.07 * sin(x * 5.3 + 1.3);
  float dy = w.y - y0;
  float rays = 0.45 + 0.55 * vnoise(vec2(x * 13.0, 0.5)) * (0.6 + 0.4 * vnoise(vec2(x * 37.0, 2.0)));
  float body = dy > 0.0 ? exp(-dy / (0.60 * rays)) : exp(dy / 0.035);
  body *= 0.55 + 0.45 * smoothstep(-1.0, 0.3, sin(x * 4.0 + 1.0));
  float y1 = 0.36 + 0.12 * sin(x * 1.7 + 2.4);
  float dy1 = w.y - y1;
  float rays1 = 0.5 + 0.5 * vnoise(vec2(x * 9.0, 7.0));
  float body1 = (dy1 > 0.0 ? exp(-dy1 / (0.42 * rays1)) : exp(dy1 / 0.05)) * 0.5;
  vec3 green = mix(vec3(0.24, 1.0, 0.69), uEnv0, 0.35);
  vec3 top = mix(vec3(0.54, 0.36, 1.0), uEnv2, 0.5);
  vec3 c = mix(green, top, sat(dy * 1.3)) * body + mix(green, top, sat(dy1 * 1.2 + 0.3)) * body1;
  c += vec3(0.85, 1.0, 0.92) * exp(dy / 0.018) * step(dy, 0.0) * body * 0.0;
  ai = sat(body + body1);
  return c;
}

vec3 skyWindow(vec2 p, vec2 g, float dIn) {
  vec2 w = p / (HA - BW);
  vec3 sky = mix(vec3(0.015, 0.03, 0.085), vec3(0.05, 0.10, 0.22), sat(w.y * 0.5 + 0.5));
  float ai;
  sky += aurora(w, ai) * 1.45;
  vec2 sg = w * 16.0;
  vec2 si = floor(sg);
  float sh = hash12(si + 5.0);
  vec2 so = fract(sg) - 0.5 - (hash22(si) - 0.5) * 0.6;
  sky += vec3(0.85, 0.92, 1.0) * step(0.84, sh) * exp(-dot(so, so) * 55.0) * (1.0 - ai * 0.7) * 0.9;
  // inner shadow under the top-left rim
  float ish = exp(dIn / 0.05) * sat(dot(g, KEY.xy) * 0.8 + 0.4);
  sky *= 1.0 - ish * 0.55;
  // glass sheen across the window
  float sheen = smoothstep(0.10, 0.0, abs(dot(p, vec2(0.70, 0.71)) - 0.26)) * 0.10;
  return sky + vec3(0.8, 0.95, 1.0) * sheen;
}

vec3 plasmaOrb(vec2 p, float OR) {
  float r = length(p);
  float th = atan(p.y, p.x);
  vec3 gas = mix(vec3(0.20, 0.0, 0.16), vec3(0.03, 0.0, 0.05), sat(r / OR));
  gas += vec3(0.5, 0.05, 0.4) * fbm4(p * 4.0 + 1.3) * 0.35;
  float fil = 0.0, contact = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float a0 = fi * 0.8976 + hash11(fi * 1.7) * 0.6;
    float path = a0 + (fbm3(vec2(r * 3.2, fi * 5.3)) - 0.5) * 1.6 * r + (fbm3(vec2(r * 11.0, fi * 2.1)) - 0.5) * 0.35 * r;
    float da = abs(mod(th - path + PI, TAU) - PI) * r;
    float wdt = 0.0035 + 0.006 * r;
    fil += exp(-da / wdt) * smoothstep(0.08, 0.14, r);
    float bp = path + (fbm3(vec2(r * 6.0, fi * 9.1)) - 0.3) * 0.9 * (r - 0.3);
    float db = abs(mod(th - bp + PI, TAU) - PI) * r;
    fil += exp(-db / (wdt * 0.8)) * smoothstep(0.3, 0.42, r) * 0.6;
    vec2 cp = vec2(cos(path), sin(path)) * OR;
    contact += exp(-dot(p - cp, p - cp) / 0.0020);
  }
  vec3 col = gas + vec3(1.0, 0.25, 0.85) * fil * 0.9 + vec3(1.0, 0.85, 0.95) * pow(fil, 2.0) * 0.35;
  col += vec3(1.0, 0.55, 0.9) * contact * 0.9 + vec3(1.0, 0.9, 0.95) * exp(-r / 0.07) * 1.3;
  col = mix(col, vec3(1.0, 0.95, 0.98), 1.0 - smoothstep(0.07 - uPx, 0.07 + uPx, r));
  float z = sqrt(max(0.0, 1.0 - (r / OR) * (r / OR)));
  vec3 gn = vec3(p / OR, z);
  float fres = pow(1.0 - z, 3.0);
  col += vec3(1.0, 0.16, 0.36) * fres * 0.9;
  col += envRefl(reflect(vec3(0.0, 0.0, -1.0), gn)) * fres * 0.5;
  float hl = exp(-dot(p - vec2(-0.20, 0.24), p - vec2(-0.20, 0.24)) / 0.010);
  col += vec3(1.0) * hl * 0.45;
  return col;
}

vec4 wild(vec2 p, bool storm) {
  float dOuter = sdHex(p, HA) - 0.012;
  vec2 pAxis; float pAlong;
  float dSp = sdProngs(p, pAxis, pAlong);
  float dAll = min(dOuter, dSp);
  float covAll = cover(dAll);
  float dIn = sdHex(p, HA - BW);
  float fade = cellFade(p);
  float eps = 0.003;
  vec2 g = normalize(vec2(sdHex(p + vec2(eps, 0.0), HA) - sdHex(p - vec2(eps, 0.0), HA), sdHex(p + vec2(0.0, eps), HA) - sdHex(p - vec2(0.0, eps), HA)) + 1e-6);
  vec3 H = normalize(KEY + vec3(0.0, 0.0, 1.0));

  vec3 col = vec3(0.0);
  if (dAll < 2.0 * uPx) {
    // window (inner hex)
    if (storm) {
      vec3 bg = mix(vec3(0.05, 0.0, 0.03), vec3(0.12, 0.0, 0.06), sat(p.y + 0.5));
      float OR = 0.47;
      float dOrb = length(p - vec2(0.0, 0.03)) - OR;
      col = dOrb < 0.0 ? plasmaOrb(p - vec2(0.0, 0.03), OR) : bg + vec3(1.0, 0.1, 0.4) * exp(-dOrb / 0.04) * 0.5;
      col += vec3(1.0, 0.6, 0.85) * exp(-abs(dOrb) / (1.2 * uPx)) * 0.6;
    } else {
      col = skyWindow(p, g, dIn);
    }
    // bevel (12 facets)
    if (dOuter < 0.0 && dIn >= 0.0) {
      vec3 n = bevelNormal(p, dOuter);
      float ndl = dot(n, KEY);
      float f = sat(ndl * 1.15 + 0.12);
      vec3 R = reflect(vec3(0.0, 0.0, -1.0), n);
      float sp = pow(max(dot(n, H), 0.0), 60.0);
      if (storm) {
        col = mix(vec3(0.012, 0.003, 0.008), vec3(0.16, 0.05, 0.09), f * f);
        col += mix(envRefl(R), vec3(1.0, 0.17, 0.6) * luma(envRefl(R)), 0.5) * 0.32 * (1.2 - f) + vec3(1.0, 0.85, 0.9) * sp * 0.9;
        vec2 vq = p * 2.6 + (vec2(fbm3(p * 2.0), fbm3(p * 2.0 + 4.1)) - 0.5) * 0.9;
        float lv = abs(fbm4(vq) - 0.5);
        col += vec3(1.0, 0.16, 0.52) * exp(-lv / 0.014) * 0.85 + vec3(1.0, 0.75, 0.9) * exp(-lv / 0.004) * 0.5;
        col += vec3(1.0, 0.12, 0.45) * sat(dot(-g, KEY.xy) * 1.2) * 0.22;   // hot rim light on the shaded sides
      } else {
        float frost = fbm4(p * 22.0) * 0.7 + vnoise(p * 90.0) * 0.3;
        vec3 iceLo = vec3(0.05, 0.13, 0.30), iceMid = vec3(0.34, 0.60, 0.90), iceHi = vec3(0.80, 0.92, 1.0);
        float ff = sat(f * 0.92 * (0.80 + 0.32 * frost));
        col = ff < 0.5 ? mix(iceLo, iceMid, ff * 2.0) : mix(iceMid, iceHi, (ff - 0.5) * 2.0);
        col += envRefl(R) * 0.45 + vec3(1.0) * sp * 0.7;
        col += vec3(0.85, 0.95, 1.0) * smoothstep(0.80, 0.95, ridge4(p * 7.0 + 3.0)) * 0.25;
      }
      // facet seams + lips
      float tb = sat(-dOuter / BW);
      vec3 lipC = storm ? vec3(1.0, 0.28, 0.55) : vec3(1.0);
      col += lipC * exp(-abs(dOuter) / (1.1 * uPx)) * 0.55 * sat(dot(g, KEY.xy) + 0.6);
      col += (storm ? vec3(1.0, 0.5, 0.75) : vec3(0.85, 1.0, 1.0)) * exp(-abs(dIn) / (1.0 * uPx)) * 0.75;
      col += lipC * exp(-abs(tb - 0.48) * BW / (0.8 * uPx)) * 0.22;
    }
    // prongs (crystal spikes, ridge along the axis)
    if (dOuter >= 0.0 && dSp < 0.0) {
      vec2 nrm = vec2(-pAxis.y, pAxis.x);
      float sd = sign(dot(p, nrm) + 1e-6);
      vec3 n = normalize(vec3(nrm * sd * 0.9 + pAxis * 0.25, 0.6));
      float f = sat(dot(n, KEY) * 1.2 + 0.2);
      col = storm ? mix(vec3(0.05, 0.01, 0.02), vec3(1.0, 0.35, 0.6), f * 0.6 + pAlong * 0.4)
                  : mix(vec3(0.30, 0.55, 0.90), vec3(0.95, 1.0, 1.0), f);
      col += (storm ? vec3(1.0, 0.5, 0.2) : vec3(0.6, 1.0, 0.85)) * pAlong * pAlong * 0.5;
      float ridge = exp(-abs(dot(p, nrm) - dot(pAxis * 0.0, nrm)) / (0.9 * uPx)) * 0.0;
      col += vec3(1.0) * ridge;
    }
  }

  // ribbon
  float dBan = sdRoundBox(p - BAN_C, BAN_H, 0.075);
  float covBan = cover(dBan);
  vec3 banC;
  {
    float by = sat((p.y - BAN_C.y) / BAN_H.y * 0.5 + 0.5);
    banC = storm ? mix(vec3(0.03, 0.0, 0.015), vec3(0.14, 0.02, 0.05), by) : mix(vec3(0.01, 0.03, 0.08), vec3(0.05, 0.13, 0.25), by);
    // glossy top band
    banC += (storm ? vec3(1.0, 0.4, 0.5) : vec3(0.6, 0.9, 1.0)) * smoothstep(0.62, 0.95, by) * 0.10;
    float lip = exp(-abs(dBan + 1.0 * uPx) / (1.0 * uPx));
    banC += (storm ? vec3(1.0, 0.35, 0.6) : vec3(0.75, 0.95, 1.0)) * lip * (0.35 + 0.55 * by);
  }
  // drop shadow of the ribbon onto the plate
  float dBanSh = sdRoundBox(p - BAN_C - vec2(0.0, -0.035), BAN_H, 0.075);
  float banSh = exp(-max(dBanSh, 0.0) / 0.03) * 0.55 * covAll;

  float od = max(dAll, 0.0);
  vec3 gcol = storm ? vec3(1.0, 0.17, 0.7) : mix(vec3(0.24, 1.0, 0.69), uEnv0, 0.3);
  float glow = (exp(-od / 0.04) * 0.55 + exp(-od / 0.14) * 0.3) * fade;
  float dsh = min(sdHex(p - vec2(0.0, -0.045), HA), sdProngs(p - vec2(0.0, -0.045), pAxis, pAlong));
  float shadow = exp(-max(min(dsh, dBanSh), 0.0) / 0.05) * 0.5 * fade;
  vec4 o = vec4(0.0, 0.0, 0.0, shadow);
  o = vec4(gcol * glow, glow * 0.45) + o * (1.0 - glow * 0.45);
  o = vec4(col * covAll * (1.0 - banSh), covAll) + o * (1.0 - covAll);
  o = vec4(banC * covBan, covBan) + o * (1.0 - covBan);
  vec4 tx = lettering(p, storm);
  o = vec4(tx.rgb, tx.a) + o * (1.0 - sat(tx.a));
  o.a = sat(o.a);
  return o;
}

void main() {
  vec2 p = cellP();
  finalColor = wild(p, uStorm > 0.5);
}
`;
