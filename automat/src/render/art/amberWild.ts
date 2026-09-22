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

// fern fossil: a curled frond with alternating pinnae. returns ink density 0..1
float fern(vec2 p) {
  vec2 c = vec2(0.52, -0.62);       // curvature centre of the stem arc
  float R = 0.78;
  vec2 v = p - c;
  float ang = atan(v.y, v.x);
  float a0 = 1.72, a1 = 2.52;         // stem angular extent
  float u = (ang - a0) / (a1 - a0);   // 0 base → 1 tip
  float rad = length(v) - R;          // signed offset from stem
  float L = (a1 - a0) * R;
  float s = u * L;
  float ink = 0.0;
  // stem
  float stem = abs(rad) - 0.0065 * (1.0 - 0.6 * u);
  float inStem = step(0.0, u) * step(u, 1.0);
  ink = max(ink, inStem * (1.0 - smoothstep(0.0, 0.006, stem)));
  // pinnae
  float step_ = 0.043;
  for (int side = 0; side < 2; side++) {
    float sgn = side == 0 ? 1.0 : -1.0;
    float off = side == 0 ? 0.0 : step_ * 0.5;
    float i = floor((s - off) / step_ + 0.5);
    for (int kk = -1; kk <= 1; kk++) {
      float ii = i + float(kk);
      float s0 = ii * step_ + off;
      float uu = s0 / L;
      if (uu < 0.04 || uu > 0.97) continue;
      float len = 0.105 * (1.0 - uu * 0.85) * (0.85 + 0.3 * hash11(ii * 3.1 + sgn));
      vec2 base = vec2(s0, 0.0);
      vec2 dirv = normalize(vec2(0.62, 0.78 * sgn));
      vec2 pt = vec2(s, rad);
      vec2 w = pt - base;
      float t = sat(dot(w, dirv) / len);
      float dd = length(w - dirv * t * len);
      float wdt = 0.012 * (1.0 - t * 0.75) * (1.0 - uu * 0.5);
      ink = max(ink, (1.0 - smoothstep(wdt * 0.5, wdt, dd)) * 0.9);
    }
  }
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
      float dust = smoothstep(0.82, 0.95, vnoise(l * 70.0)) * 0.4;
      col *= 1.0 - dust * 0.5;
      // subsurface: warm glow opposite the key light
      vec2 gc = vec2(0.20, -0.22);
      float sss = exp(-dot(p - gc, p - gc) / 0.16);
      col += vec3(1.0, 0.62, 0.18) * sss * 0.42;
      col += vec3(1.0, 0.85, 0.45) * exp(-dot(p - gc, p - gc) / 0.03) * 0.25;
      // fern fossil (inside, soft-edged, slightly refracted)
      float fe = fern(p + n.xy * 0.02);
      col = mix(col, col * vec3(0.30, 0.16, 0.05), fe * 0.75);
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
      float rimBand = smoothstep(0.02, 0.07, -d) * (1.0 - smoothstep(0.08, 0.17, -d));
      float angW = pow(sat(dot(normalize(p + 1e-5), vec2(-0.62, 0.78))), 3.0);
      col += vec3(1.0, 0.98, 0.9) * rimBand * angW * 0.75;
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
export const WILD_FRAG = ART_HEAD + /* glsl */ `
const float HA = 0.70;   // hex apothem (outer)
const float BW = 0.125;  // bevel width

float sdSpikes(vec2 p) {
  float d = 1e9;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0471976;
    vec2 dir = vec2(cos(a), sin(a));
    vec2 nrm = vec2(-dir.y, dir.x);
    float rv = HA * 1.1547;
    vec2 base = dir * (rv - 0.04);
    vec2 tip = dir * (rv + 0.135);
    // tapered main spike
    vec2 w = p - base;
    float t = sat(dot(w, dir) / length(tip - base));
    float wd = mix(0.028, 0.004, t);
    d = min(d, length(w - (tip - base) * t) - wd);
    // side branches
    for (int s = -1; s <= 1; s += 2) {
      vec2 b0 = dir * (rv + 0.045);
      vec2 bd = normalize(dir + nrm * float(s) * 1.2);
      vec2 b1 = b0 + bd * 0.06;
      vec2 wb = p - b0;
      float tb = sat(dot(wb, bd) / 0.06);
      d = min(d, length(wb - bd * 0.06 * tb) - mix(0.012, 0.003, tb));
    }
  }
  return d;
}

vec3 aurora(vec2 w, out float ai) {
  // w: window space (~ -1..1)
  float x = w.x;
  float y0 = -0.30 + 0.20 * sin(x * 2.3 + 0.6) + 0.08 * sin(x * 5.3 + 1.3);
  float dy = w.y - y0;
  float rays = 0.45 + 0.55 * vnoise(vec2(x * 13.0, 0.5)) * (0.6 + 0.4 * vnoise(vec2(x * 37.0, 2.0)));
  float body = dy > 0.0 ? exp(-dy / (0.62 * rays)) : exp(dy / 0.035);
  body *= 0.55 + 0.45 * smoothstep(-1.0, 0.3, sin(x * 4.0 + 1.0));
  // second, higher and fainter curtain
  float y1 = 0.12 + 0.14 * sin(x * 1.7 + 2.4);
  float dy1 = w.y - y1;
  float rays1 = 0.5 + 0.5 * vnoise(vec2(x * 9.0, 7.0));
  float body1 = (dy1 > 0.0 ? exp(-dy1 / (0.45 * rays1)) : exp(dy1 / 0.05)) * 0.5;
  vec3 green = mix(vec3(0.24, 1.0, 0.69), uEnv0, 0.35);
  vec3 top = mix(vec3(0.54, 0.36, 1.0), uEnv2, 0.5);
  vec3 c = mix(green, top, sat(dy * 1.3)) * body + mix(green, top, sat(dy1 * 1.2 + 0.3)) * body1;
  c += vec3(0.8, 1.0, 0.9) * exp(dy / 0.02) * step(dy, 0.0) * 0.0;
  ai = sat(body + body1);
  return c;
}

vec4 wildBase(vec2 p) {
  float dOuter = sdHex(p, HA) - 0.018;
  float dSp = sdSpikes(p);
  float dAll = min(dOuter, dSp);
  float covAll = cover(dAll);
  float dIn = sdHex(p, HA - BW);
  float fade = cellFade(p);

  // bevel normal from the hex SDF gradient
  float eps = 0.003;
  vec2 g = normalize(vec2(sdHex(p + vec2(eps, 0.0), HA) - sdHex(p - vec2(eps, 0.0), HA), sdHex(p + vec2(0.0, eps), HA) - sdHex(p - vec2(0.0, eps), HA)) + 1e-6);

  vec3 col = vec3(0.0);
  if (dAll < 2.0 * uPx) {
    if (dIn < 0.0) {
      // WINDOW: night sky + mini aurora, recessed under the rim
      vec2 w = p / (HA - BW);
      vec3 sky = mix(vec3(0.02, 0.04, 0.10), vec3(0.05, 0.10, 0.22), sat(w.y * 0.5 + 0.5));
      float ai;
      vec3 au = aurora(w, ai);
      sky += au * 0.95;
      // stars
      vec2 sg = w * 18.0;
      vec2 si = floor(sg);
      float sh = hash12(si + 5.0);
      vec2 so = fract(sg) - 0.5 - (hash22(si) - 0.5) * 0.6;
      sky += vec3(0.85, 0.92, 1.0) * step(0.86, sh) * exp(-dot(so, so) * 60.0) * (1.0 - ai * 0.7) * 0.9;
      // sea horizon with reflection
      float hz = -0.66;
      if (w.y < hz) {
        vec2 rw = vec2(w.x, 2.0 * hz - w.y);
        float ai2; vec3 au2 = aurora(rw, ai2);
        float ripple = 0.6 + 0.4 * sin(w.y * 90.0 + vnoise(w * vec2(6.0, 40.0)) * 6.0);
        sky = vec3(0.01, 0.02, 0.05) + au2 * 0.35 * ripple;
      }
      sky += vec3(0.6, 1.0, 0.85) * exp(-abs(w.y - hz) / 0.012) * 0.25;
      // inner shadow under the top-left rim
      float ish = exp(dIn / 0.05) * sat(dot(g, KEY.xy) * 0.8 + 0.4);
      sky *= 1.0 - ish * 0.55;
      // glass sheen across the window
      float sheen = smoothstep(0.12, 0.0, abs(dot(p, vec2(0.70, 0.71)) - 0.22)) * 0.10;
      col = sky + vec3(0.8, 0.95, 1.0) * sheen;
    }
    if (dOuter < 0.0 && dIn >= 0.0) {
      // ICE BEVEL: two-step bevel, frosted, env reflections
      float tb = sat(-dOuter / BW);  // 0 outer edge → 1 inner edge
      float steep = step(tb, 0.45);
      vec3 n = normalize(vec3(g * (steep > 0.5 ? 0.95 : 0.45), 1.0));
      float ndl = dot(n, KEY);
      float frost = fbm4(p * 22.0) * 0.7 + vnoise(p * 90.0) * 0.3;
      vec3 iceHi = vec3(0.93, 0.98, 1.0), iceMid = vec3(0.56, 0.78, 0.98), iceLo = vec3(0.13, 0.27, 0.52);
      float f = sat(ndl * 1.2 + 0.25) * (0.82 + 0.3 * frost);
      col = f < 0.5 ? mix(iceLo, iceMid, f * 2.0) : mix(iceMid, iceHi, (f - 0.5) * 2.0);
      col += envRefl(reflect(vec3(0.0, 0.0, -1.0), n)) * 0.45;
      float sp = pow(max(dot(n, normalize(KEY + vec3(0.0, 0.0, 1.0))), 0.0), 60.0);
      col += vec3(1.0) * sp * 1.1;
      // hairline cracks in the ice
      float cr = ridge4(p * 7.0 + 3.0);
      col += vec3(0.85, 0.95, 1.0) * smoothstep(0.78, 0.95, cr) * 0.35;
      // lips
      col += vec3(1.0) * exp(-abs(-dOuter) / (1.2 * uPx)) * 0.55 * sat(ndl + 0.6);
      col += vec3(0.9, 1.0, 1.0) * exp(-abs(dIn) / (1.1 * uPx)) * 0.7;
      col += vec3(1.0) * exp(-abs(tb - 0.45) * BW / (0.9 * uPx)) * 0.25;
    }
    if (dOuter >= 0.0 && dSp < 0.0) {
      // snowflake spikes
      float t = sat(length(p) - HA);
      col = mix(vec3(0.92, 0.98, 1.0), vec3(0.55, 0.78, 1.0), t * 4.0);
      col += envAvg() * 0.2;
    }
  }

  float od = max(dAll, 0.0);
  vec3 gcol = mix(vec3(0.24, 1.0, 0.69), uEnv0, 0.3);
  float glow = (exp(-od / 0.04) * 0.55 + exp(-od / 0.15) * 0.3) * fade;
  float dsh = min(sdHex(p - vec2(0.0, -0.05), HA), sdSpikes(p - vec2(0.0, -0.05)));
  float shadow = exp(-max(dsh, 0.0) / 0.05) * 0.5 * fade;
  vec4 o = vec4(0.0, 0.0, 0.0, shadow);
  o = vec4(gcol * glow, glow * 0.45) + o * (1.0 - glow * 0.45);
  o = vec4(col * covAll, covAll) + o * (1.0 - covAll);
  return o;
}

// STORM: plasma orb inside an obsidian hex frame
vec4 wildStorm(vec2 p) {
  float dOuter = sdHex(p, HA) - 0.018;
  float dSp = sdSpikes(p);
  float dAll = min(dOuter, dSp);
  float covAll = cover(dAll);
  float dIn = sdHex(p, HA - BW);
  float fade = cellFade(p);
  float eps = 0.003;
  vec2 g = normalize(vec2(sdHex(p + vec2(eps, 0.0), HA) - sdHex(p - vec2(eps, 0.0), HA), sdHex(p + vec2(0.0, eps), HA) - sdHex(p - vec2(0.0, eps), HA)) + 1e-6);
  const float OR = 0.60;
  float r = length(p);
  float dOrb = r - OR;
  vec3 col = vec3(0.0);
  if (dAll < 2.0 * uPx) {
    // frame
    float tb = sat(-dOuter / BW);
    vec3 n = normalize(vec3(g * (tb < 0.45 ? 0.95 : 0.45), 1.0));
    float ndl = dot(n, KEY);
    col = mix(vec3(0.03, 0.008, 0.012), vec3(0.16, 0.06, 0.08), sat(ndl * 1.1 + 0.2));
    col += envRefl(reflect(vec3(0.0, 0.0, -1.0), n)) * 0.45;
    col += vec3(1.0, 0.9, 0.85) * pow(max(dot(n, normalize(KEY + vec3(0.0, 0.0, 1.0))), 0.0), 50.0) * 0.8;
    float vr = ridge4(p * 5.0 + 2.0);
    col += vec3(1.0, 0.17, 0.6) * smoothstep(0.7, 0.92, vr) * 0.8;
    col += vec3(1.0, 0.2, 0.5) * exp(-abs(dOuter) / (1.3 * uPx)) * 0.8;
    col += vec3(1.0, 0.5, 0.8) * exp(-abs(dIn) / (1.2 * uPx)) * 0.6;
    if (dOuter >= 0.0 && dSp < 0.0) col = mix(vec3(0.08, 0.02, 0.03), vec3(1.0, 0.25, 0.6), 0.35 + 0.4 * sat(length(p) - HA) * 4.0);

    if (dOrb < 0.0) {
      // interior gas
      vec3 gas = mix(vec3(0.16, 0.0, 0.14), vec3(0.03, 0.0, 0.05), sat(r / OR));
      gas += vec3(0.5, 0.05, 0.4) * fbm4(p * 4.0 + 1.3) * 0.35;
      // lightning filaments from the core to the glass
      float th = atan(p.y, p.x);
      float fil = 0.0, contact = 0.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float a0 = fi * 0.8976 + hash11(fi * 1.7) * 0.6;
        float path = a0 + (fbm3(vec2(r * 3.2, fi * 5.3)) - 0.5) * 1.6 * r + (fbm3(vec2(r * 11.0, fi * 2.1)) - 0.5) * 0.35 * r;
        float da = abs(mod(th - path + PI, TAU) - PI) * r;
        float wdt = 0.0035 + 0.006 * r;
        fil += exp(-da / wdt) * smoothstep(0.08, 0.14, r);
        // branch
        float bp = path + (fbm3(vec2(r * 6.0, fi * 9.1)) - 0.3) * 0.9 * (r - 0.3);
        float db = abs(mod(th - bp + PI, TAU) - PI) * r;
        fil += exp(-db / (wdt * 0.8)) * smoothstep(0.3, 0.42, r) * 0.6;
        vec2 cp = vec2(cos(path), sin(path)) * OR;
        contact += exp(-dot(p - cp, p - cp) / 0.0022);
      }
      vec3 filCol = vec3(1.0, 0.25, 0.85) * fil * 0.9 + vec3(1.0, 0.85, 0.95) * pow(fil, 2.0) * 0.35;
      float coreG = exp(-r / 0.07);
      col = gas + filCol + vec3(1.0, 0.55, 0.9) * contact * 0.9 + vec3(1.0, 0.9, 0.95) * coreG * 1.3;
      // electrode
      float el = 1.0 - smoothstep(0.075 - uPx, 0.075 + uPx, r);
      col = mix(col, vec3(1.0, 0.95, 0.98), el);
      // glass: fresnel rim, reflection, highlight
      float z = sqrt(max(0.0, 1.0 - (r / OR) * (r / OR)));
      vec3 gn = vec3(p / OR, z);
      float fres = pow(1.0 - z, 3.0);
      col += vec3(1.0, 0.16, 0.36) * fres * 0.9;
      col += envRefl(reflect(vec3(0.0, 0.0, -1.0), gn)) * fres * 0.6;
      float hl = exp(-dot(p - vec2(-0.25, 0.3), p - vec2(-0.25, 0.3)) / 0.012);
      float cres = smoothstep(0.06, 0.0, abs(length(p - vec2(0.05, -0.05)) - 0.5)) * sat(dot(normalize(p), vec2(-0.7, 0.7)) * 1.5 - 0.3);
      col += vec3(1.0) * (hl * 0.55 + cres * 0.30);
      col += vec3(1.0, 0.6, 0.85) * exp(-abs(dOrb) / (1.2 * uPx)) * 0.7;
    }
  }
  float od = max(dAll, 0.0);
  float glow = (exp(-od / 0.04) * 0.6 + exp(-od / 0.15) * 0.35) * fade;
  float dsh = min(sdHex(p - vec2(0.0, -0.05), HA), sdSpikes(p - vec2(0.0, -0.05)));
  float shadow = exp(-max(dsh, 0.0) / 0.05) * 0.5 * fade;
  vec4 o = vec4(0.0, 0.0, 0.0, shadow);
  o = vec4(vec3(1.0, 0.17, 0.7) * glow, glow * 0.45) + o * (1.0 - glow * 0.45);
  o = vec4(col * covAll, covAll) + o * (1.0 - covAll);
  return o;
}

void main() {
  vec2 p = cellP();
  finalColor = uStorm > 0.5 ? wildStorm(p) : wildBase(p);
}
`;
