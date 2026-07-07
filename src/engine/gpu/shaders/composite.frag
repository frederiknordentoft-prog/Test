#version 300 es
// Final composite: dark tunnel + field overlay + smoke + obstacle silhouette with rim light.
precision highp float;
precision highp sampler2D;

uniform sampler2D uF2;       // (g8, rho, ux, uy)
uniform sampler2D uObstacle; // R solid, G boundary
uniform sampler2D uSmoke;    // trails/dye buffer (render res)
uniform sampler2D uLutSeq;   // sequential colormap (viridis-like)
uniform sampler2D uLutDiv;   // diverging colormap (blue-white-orange)
uniform ivec2 uSize;         // sim grid size
uniform float uUin;
uniform int uOverlay;        // 0 none, 1 speed, 2 vorticity, 3 pressure, 4 streamlines
uniform float uTime;
uniform float uSmokeOn;

in vec2 vUv;
out vec4 outColor;

const vec3 BG0 = vec3(0.043, 0.055, 0.078); // #0b0e14
const vec3 BG1 = vec3(0.055, 0.071, 0.102);
const vec3 BODY = vec3(0.86, 0.89, 0.94);
const vec3 RIM = vec3(0.49, 0.83, 0.99); // #7dd3fc accent

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 velAt(vec2 uv) {
  return texture(uF2, uv).zw;
}

void main() {
  vec2 uv = vUv;
  ivec2 cell = ivec2(uv * vec2(uSize));
  cell = clamp(cell, ivec2(0), uSize - 1);
  vec4 mac = texelFetch(uF2, cell, 0);
  vec4 obs = texelFetch(uObstacle, cell, 0);

  vec3 col = mix(BG0, BG1, uv.y * 0.7 + 0.15 * hash12(uv * 700.0) * 0.04);

  // --- Field overlay ---
  if (uOverlay == 1) {
    float t = clamp(length(mac.zw) / (1.6 * max(uUin, 1e-4)), 0.0, 1.0);
    vec3 fc = texture(uLutSeq, vec2(t, 0.5)).rgb;
    col = mix(col, fc, 0.8);
  } else if (uOverlay == 2) {
    ivec2 cxm = clamp(cell - ivec2(1, 0), ivec2(0), uSize - 1);
    ivec2 cxp = clamp(cell + ivec2(1, 0), ivec2(0), uSize - 1);
    ivec2 cym = clamp(cell - ivec2(0, 1), ivec2(0), uSize - 1);
    ivec2 cyp = clamp(cell + ivec2(0, 1), ivec2(0), uSize - 1);
    float curl = (texelFetch(uF2, cxp, 0).w - texelFetch(uF2, cxm, 0).w)
               - (texelFetch(uF2, cyp, 0).z - texelFetch(uF2, cym, 0).z);
    float t = clamp(curl / (0.35 * max(uUin, 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
    vec3 fc = texture(uLutDiv, vec2(t, 0.5)).rgb;
    col = mix(col, fc, 0.8);
  } else if (uOverlay == 3) {
    // Pressure as Cp = Δp/(½ρU²), mapped ASYMMETRICALLY to [-3, +1]: Cp > 1 is
    // impossible in steady incompressible flow, so the stagnation point (Cp = 1)
    // gets full saturation instead of a washed-out mid-tone.
    float pdev = (mac.y - 1.0) / 3.0; // lattice pressure deviation, p = rho/3
    float cp = pdev / max(0.5 * uUin * uUin, 1e-6);
    float t = clamp((cp + 3.0) / 4.0, 0.0, 1.0);
    vec3 fc = texture(uLutDiv, vec2(t, 0.5)).rgb;
    col = mix(col, fc, 0.8);
  } else if (uOverlay == 4) {
    // Screen-space LIC-lite: average noise along the local flow direction.
    vec2 texel = 1.0 / vec2(uSize);
    vec2 pos = uv;
    float acc = 0.0;
    float wsum = 0.0;
    vec2 pf = pos;
    vec2 pb = pos;
    for (int s = 0; s < 10; s++) {
      vec2 vf = velAt(pf);
      vec2 vb = velAt(pb);
      pf += normalize(vf + 1e-6) * texel * 1.4;
      pb -= normalize(vb + 1e-6) * texel * 1.4;
      float w = 1.0 - float(s) / 10.0;
      acc += (hash12(floor(pf * vec2(uSize) * 0.8)) + hash12(floor(pb * vec2(uSize) * 0.8))) * w;
      wsum += 2.0 * w;
    }
    float lic = acc / wsum;
    lic = smoothstep(0.35, 0.65, lic);
    float speed = clamp(length(mac.zw) / (1.4 * max(uUin, 1e-4)), 0.0, 1.0);
    col = mix(col, mix(BG1, RIM, 0.25 + 0.75 * speed), lic * 0.55);
  }

  // --- Smoke (additive, screen-ish) ---
  if (uSmokeOn > 0.5) {
    vec3 smoke = texture(uSmoke, uv).rgb;
    col += smoke * 0.9;
  }

  // --- Obstacle silhouette + rim light ---
  if (obs.r > 0.5) {
    // interior: check for rim (any fluid in 8-neighborhood)
    float rim = 0.0;
    for (int dy = -1; dy <= 1; dy++)
      for (int dx = -1; dx <= 1; dx++) {
        ivec2 q = clamp(cell + ivec2(dx, dy), ivec2(0), uSize - 1);
        if (texelFetch(uObstacle, q, 0).r < 0.5) rim = 1.0;
      }
    col = mix(BODY * 0.92, RIM, rim * 0.65);
  }

  // Vignette
  vec2 d = uv - 0.5;
  col *= 1.0 - 0.28 * dot(d, d) * 2.2;

  outColor = vec4(col, 1.0);
}
