// Cell-level FX textures: glass cell backdrop, frost-mark overlay, multiplier pill, storm lava/obsidian backdrops
// and the generic soft glow sprite. One program, uKind switch.
import { ART_HEAD } from './glsl.ts';

export const FX_KIND = { cellBg: 0, frost: 1, markRing: 2, plasmaBg: 3, stormBg: 4, glow: 5 } as const;

export const FX_FRAG = ART_HEAD + /* glsl */ `
uniform int uKind;
const float CB = 0.955;   // cell box half-size
const float CRAD = 0.17;  // corner radius

vec4 cellBg(vec2 p) {
  float d = sdRoundBox(p, vec2(CB), CRAD);
  float cov = cover(d);
  float t = sat(p.y * 0.5 + 0.5);
  vec3 c = mix(vec3(0.020, 0.045, 0.11), vec3(0.075, 0.14, 0.27), t);
  float a = mix(0.50, 0.34, t);
  // soft inner light behind the symbol
  float centre = exp(-dot(p, p) / 0.35);
  c += vec3(0.10, 0.22, 0.30) * centre * 0.35;
  // frosted micro texture + faint diagonal sheen
  c += (vnoise(p * 70.0) - 0.5) * 0.025;
  float sheen = exp(-pow((dot(p, vec2(0.62, 0.78)) - 0.55) / 0.22, 2.0)) * 0.05;
  c += vec3(0.7, 0.9, 1.0) * sheen;
  // inner bevel: bright top lip, dark bottom lip
  float lip = 1.0 - smoothstep(0.0, 3.5 * uPx, -d);
  float lip2 = exp(-(-d - 5.0 * uPx) * (-d - 5.0 * uPx) / (6.0 * uPx * uPx));
  c = mix(c, vec3(0.62, 0.80, 1.0), lip * sat(p.y * 0.9 + 0.55) * 0.65);
  c = mix(c, vec3(0.0, 0.01, 0.03), lip * sat(-p.y * 0.9 + 0.1) * 0.5);
  c += vec3(0.25, 0.4, 0.6) * lip2 * 0.12;
  a = mix(a, 0.85, lip * 0.7);
  a *= cov;
  return vec4(c * a, a);
}

vec4 frost(vec2 p) {
  float d = sdRoundBox(p, vec2(CB), CRAD);
  float cov = cover(d);
  float inD = max(-d, 0.0);                // distance from the cell border inward
  // irregular rime front
  float front = 0.30 + (fbm4(p * 3.2 + 1.7) - 0.5) * 0.30 + (vnoise(p * 11.0) - 0.5) * 0.07;
  float dens = 1.0 - smoothstep(front - 0.10, front + 0.02, inD);
  // corners grow more
  float corner = pow(max(abs(p.x), abs(p.y)) * min(abs(p.x), abs(p.y)), 2.0) * 1.5;
  dens = sat(dens + corner * (1.0 - smoothstep(0.0, 0.45, inD)));
  // feathery crystal structure: rotated ridged lines + worley facets
  float cr = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 1.047 + 0.3;
    vec2 rp = rot2(a) * p;
    float l = pow(1.0 - abs(sin(rp.x * 38.0 + fbm3(rp * 4.0 + float(i)) * 7.0)), 10.0);
    cr += l * 0.45;
  }
  vec3 w = worley(p * 9.0);
  float facets = smoothstep(0.0, 0.06, w.y - w.x);
  float cracks = 1.0 - facets;
  float rime = dens * (0.35 + 0.35 * cr + 0.35 * cracks + 0.25 * w.z);
  // sparkle points
  vec2 sg = p * 26.0;
  vec2 si = floor(sg);
  vec2 so = fract(sg) - 0.5;
  float sp = step(0.88, hash12(si)) * exp(-dot(so, so) * 40.0) * dens;
  // inner glow from the border
  float glow = exp(-inD / 0.14) * 0.55 + exp(-inD / 0.45) * 0.15;
  vec3 c = vec3(0.80, 0.93, 1.0) * rime + vec3(1.0) * sp * 1.2;
  vec3 gc = vec3(0.61, 0.79, 1.0) * glow;
  float a = sat(rime * 0.85 + sp * 0.8) * cov;
  vec3 rgb = (c * a + gc * cov);
  // bright rim line
  rgb += vec3(0.85, 0.95, 1.0) * exp(d / (1.5 * uPx)) * cov * 0.6;
  return vec4(rgb, sat(a + glow * 0.25 * cov));
}

vec4 markRing(vec2 p) {
  // centred pill (2:1), neutral white/steel rim so it can be tinted at runtime
  float d = sdRoundBox(p, vec2(0.90, 0.44), 0.44);
  float cov = cover(d);
  float rimW = 0.075;
  float inner = d + rimW;
  float t = sat(p.y / 0.44 * 0.5 + 0.5);
  vec3 fill = mix(vec3(0.020, 0.035, 0.075), vec3(0.055, 0.09, 0.17), t);
  // glossy upper reflection
  float gloss = (1.0 - smoothstep(-0.02, 0.02, sdRoundBox(p - vec2(0.0, 0.18), vec2(0.72, 0.16), 0.16))) * 0.10;
  fill += vec3(0.8, 0.9, 1.0) * gloss;
  vec3 rimC = mix(vec3(0.58, 0.64, 0.74), vec3(1.0), smoothstep(-0.6, 0.8, p.y / 0.44));
  rimC *= 0.85 + 0.25 * sat(dot(normalize(p + 1e-5), KEY.xy));
  float inRim = smoothstep(-uPx, uPx, inner);
  vec3 c = mix(fill, rimC, inRim);
  // inner dark groove + outer lip
  c *= 1.0 - exp(-abs(inner) / (1.2 * uPx)) * 0.45;
  c += vec3(1.0) * exp(-abs(d + 1.5 * uPx) / (1.0 * uPx)) * 0.35;
  float a = cov * mix(0.92, 1.0, inRim);
  float od = max(d, 0.0);
  float glow = (exp(-od / 0.05) * 0.5 + exp(-od / 0.14) * 0.2) * cellFade(p);
  vec4 o = vec4(vec3(1.0) * glow * 0.8, glow * 0.4);
  return vec4(c * a, a) + o * (1.0 - a);
}

vec4 plasmaBg(vec2 p) {
  float d = sdRoundBox(p, vec2(CB), CRAD);
  float cov = cover(d);
  vec2 wq = p * 2.6 + (vec2(fbm3(p * 2.0), fbm3(p * 2.0 + 5.2)) - 0.5) * 1.1;
  vec3 w = worley(wq);
  float edge = w.y - w.x;
  float crack = 1.0 - smoothstep(0.0, 0.14, edge);
  float core = 1.0 - smoothstep(0.0, 0.045, edge);
  float plate = fbm4(p * 6.0 + w.z * 5.0);
  float r = length(p);
  float heat = 0.35 + 0.65 * smoothstep(0.25, 0.95, max(abs(p.x), abs(p.y)));   // hotter toward the border
  vec3 crust = mix(vec3(0.07, 0.008, 0.012), vec3(0.20, 0.03, 0.02), plate * 0.7 + w.z * 0.3);
  crust *= 0.75 + 0.5 * (1.0 - r * 0.5);
  vec3 lava = mix(vec3(1.0, 0.12, 0.24), vec3(1.0, 0.42, 0.0), heat);
  vec3 c = crust + lava * crack * (0.55 + 0.6 * heat) + vec3(1.0, 0.76, 0.24) * core * heat * 0.9;
  // glowing molten rim
  float rim = exp(d / (5.0 * uPx));
  c += vec3(1.0, 0.36, 0.05) * rim * 0.9 + vec3(1.0, 0.85, 0.5) * exp(d / (1.4 * uPx)) * 0.5;
  // darken the centre so the symbol stays readable
  c *= 1.0 - exp(-r * r / 0.22) * 0.45;
  float a = 0.95 * cov;
  return vec4(c * a, a);
}

vec4 stormBg(vec2 p) {
  float d = sdRoundBox(p, vec2(CB), CRAD);
  float cov = cover(d);
  float t = sat(p.y * 0.5 + 0.5);
  vec3 c = mix(vec3(0.030, 0.006, 0.010), vec3(0.085, 0.014, 0.028), t);
  // conchoidal ripples: glossy sheen bands
  float cf = length(p - vec2(-0.9, 1.0)) * 9.0 + fbm3(p * 3.0) * 3.0;
  float rip = pow(0.5 + 0.5 * sin(cf), 6.0) * exp(-length(p - vec2(-0.6, 0.6)) * 1.4);
  c += vec3(0.55, 0.12, 0.18) * rip * 0.16;
  c += (vnoise(p * 80.0) - 0.5) * 0.012;
  float lip = 1.0 - smoothstep(0.0, 3.0 * uPx, -d);
  c = mix(c, vec3(1.0, 0.12, 0.24), lip * 0.5);
  c += vec3(1.0, 0.2, 0.3) * exp(-(-d) / 0.05) * 0.10;
  c = mix(c, vec3(0.9, 0.5, 0.55), lip * sat(p.y * 0.9 + 0.4) * 0.35);
  float a = mix(0.88, 0.95, lip) * cov;
  return vec4(c * a, a);
}

vec4 glowTex(vec2 p) {
  float r = length(p);
  float g = exp(-r * r * 3.4) * 0.85 + exp(-r * 5.5) * 0.35;
  g *= 1.0 - smoothstep(0.75, 0.99, r);
  return vec4(vec3(g), g);
}

void main() {
  vec2 p = cellP();
  if (uKind == 0) finalColor = cellBg(p);
  else if (uKind == 1) finalColor = frost(p);
  else if (uKind == 2) finalColor = markRing(p);
  else if (uKind == 3) finalColor = plasmaBg(p);
  else if (uKind == 4) finalColor = stormBg(p);
  else finalColor = glowTex(p);
}
`;
