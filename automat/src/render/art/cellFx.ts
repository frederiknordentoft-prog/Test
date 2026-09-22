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
  vec3 c = mix(vec3(0.020, 0.045, 0.11), vec3(0.070, 0.13, 0.26), t);
  float a = mix(0.62, 0.46, t);
  // soft inner light behind the symbol
  float centre = exp(-dot(p, p) / 0.35);
  c += vec3(0.10, 0.22, 0.30) * centre * 0.30;
  // frosted micro texture + faint diagonal sheen
  c += (vnoise(p * 70.0) - 0.5) * 0.02;
  float sheen = exp(-pow((dot(p, vec2(0.62, 0.78)) - 0.55) / 0.22, 2.0)) * 0.06;
  c += vec3(0.7, 0.9, 1.0) * sheen;
  // glass tile edge: bright top/left lip, dark bottom lip, faint inner bevel line
  float lip = 1.0 - smoothstep(0.0, 3.0 * uPx, -d);
  float lip2 = exp(-pow(-d - 6.0 * uPx, 2.0) / (4.0 * uPx * uPx));
  float lit = sat(dot(normalize(p + 1e-5), vec2(-0.55, 0.83)) * 0.8 + 0.45);
  c = mix(c, vec3(0.62, 0.82, 1.0), lip * lit * 0.8);
  c = mix(c, vec3(0.0, 0.01, 0.03), lip * (1.0 - lit) * 0.5);
  c += vec3(0.30, 0.48, 0.70) * lip2 * 0.14;
  a = mix(a, 1.0, lip * 0.8);
  a *= cov;
  return vec4(c * a, a);
}

vec4 frost(vec2 p) {
  float d = sdRoundBox(p, vec2(CB), CRAD);
  float cov = cover(d);
  float inD = max(-d, 0.0);                // distance from the cell border inward
  float ang = atan(p.y, p.x);
  // rime front: lobed, thicker in the corners, spiky needle tips
  float corner = pow(sat(min(abs(p.x), abs(p.y)) / CB), 2.2);
  float front = 0.12 + 0.13 * fbm3(p * 2.6 + 1.7) + 0.20 * corner;
  float needles = pow(vnoise(vec2(ang * 16.0, inD * 2.0 + 3.0)), 3.0) * 0.12 + pow(vnoise(vec2(ang * 41.0, 7.0)), 4.0) * 0.07;
  float fr = front + needles;
  float dens = 1.0 - smoothstep(fr - 0.05, fr + 0.004, inD);
  // crystal plates at two scales + fine hoar lines
  vec3 w1 = worley(p * 7.0 + 2.0);
  vec3 w2 = worley(p * 17.0 + 9.0);
  float plates = 0.55 + 0.45 * w1.z;
  float seams = (1.0 - smoothstep(0.0, 0.07, w1.y - w1.x)) * 0.8 + (1.0 - smoothstep(0.0, 0.05, w2.y - w2.x)) * 0.5;
  float hoar = pow(1.0 - abs(sin(dot(rot2(ang) * p, vec2(0.0, 1.0)) * 90.0 + fbm3(p * 6.0) * 6.0)), 12.0) * 0.5;
  float rime = dens * (0.30 + 0.30 * plates + 0.45 * seams + hoar);
  // bright crisp edge along the growth front
  float frontLine = exp(-abs(inD - fr) / 0.012) * (1.0 - smoothstep(0.0, 0.04, inD - fr)) * 0.7;
  // sparkle points in the rime
  vec2 sg = p * 22.0;
  vec2 si = floor(sg);
  vec2 so = fract(sg) - 0.5 - (hash22(si + 3.0) - 0.5) * 0.5;
  float sp = step(0.86, hash12(si)) * exp(-dot(so, so) * 60.0) * (dens * 0.8 + 0.2);
  // cool inner glow from the border + faint tint across the whole cell
  float glow = exp(-inD / 0.12) * 0.55 + exp(-inD / 0.40) * 0.16 + 0.05;
  vec3 c = vec3(0.82, 0.94, 1.0) * rime + vec3(0.9, 0.98, 1.0) * frontLine * dens + vec3(1.0) * sp * 1.3;
  float a = sat(rime * 0.82 + sp * 0.8 + frontLine * 0.4) * cov;
  vec3 rgb = c * cov + vec3(0.45, 0.72, 1.0) * glow * cov;
  // bright rim line
  rgb += vec3(0.85, 0.96, 1.0) * exp(d / (1.4 * uPx)) * cov * 0.7;
  return vec4(rgb, sat(a + glow * 0.22 * cov));
}

vec4 markRing(vec2 p) {
  // Non-square target (0.62 : 0.30 of a cell). p.x ∈ [-aspect, aspect], p.y ∈ [-1, 1].
  p.x *= uAspect;
  float R = 0.78;
  vec2 hb = vec2(uAspect - 0.20, R);
  float d = sdRoundBox(p, hb, R);
  float cov = cover(d);
  float rimW = 0.16;
  float inner = d + rimW;
  float t = sat(p.y / R * 0.5 + 0.5);
  // deep glass fill with a soft cool core so bright digits pop
  vec3 fill = mix(vec3(0.012, 0.022, 0.050), vec3(0.045, 0.075, 0.150), t);
  fill += vec3(0.10, 0.20, 0.32) * exp(-dot(p * vec2(0.55, 1.4), p * vec2(0.55, 1.4)) * 1.2) * 0.35;
  // glossy upper reflection band
  float gb = sdRoundBox(p - vec2(0.0, R * 0.42), vec2(hb.x - 0.18, R * 0.26), R * 0.26);
  fill += vec3(0.75, 0.88, 1.0) * (1.0 - smoothstep(-0.03, 0.03, gb)) * 0.10 * (0.4 + 0.6 * t);
  // metallic rim: bright top, darker bottom, key-light glint
  float ry = p.y / R;
  vec3 rimC = mix(vec3(0.36, 0.44, 0.58), vec3(1.0, 1.0, 1.0), smoothstep(-0.9, 0.9, ry));
  float glint = pow(sat(dot(normalize(p + 1e-5), normalize(vec2(-0.7, 0.7)))), 6.0);
  rimC += vec3(1.0) * glint * 0.5;
  float inRim = smoothstep(-uPx, uPx, inner);
  vec3 c = mix(fill, rimC, inRim);
  // groove between rim and fill + crisp outer lip
  c *= 1.0 - exp(-abs(inner) / (1.4 * uPx)) * 0.55;
  c += vec3(1.0) * exp(-abs(d + 1.2 * uPx) / (0.9 * uPx)) * 0.25 * sat(ry + 0.6);
  float a = cov * mix(0.94, 1.0, inRim);
  // outer glow, faded before the texture border
  vec2 ep = vec2(uAspect, 1.0) - abs(p);
  float edgeFade = sat(min(ep.x, ep.y) / 0.14);
  float od = max(d, 0.0);
  float glow = (exp(-od / 0.05) * 0.45 + exp(-od / 0.12) * 0.2) * edgeFade;
  vec4 o = vec4(vec3(0.75, 0.9, 1.0) * glow * 0.7, glow * 0.35);
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
