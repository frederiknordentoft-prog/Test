#version 300 es
// Marks boundary-adjacent fluid cells (G channel) — the cells owning momentum-exchange links.
precision highp float;

uniform sampler2D uRaw; // raw rasterized obstacle (R = solid)
uniform ivec2 uSize;

out vec4 outColor;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float solid = texelFetch(uRaw, p, 0).r > 0.5 ? 1.0 : 0.0;
  float boundary = 0.0;
  if (solid < 0.5) {
    for (int dy = -1; dy <= 1; dy++)
      for (int dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        ivec2 q = clamp(p + ivec2(dx, dy), ivec2(0), uSize - 1);
        if (texelFetch(uRaw, q, 0).r > 0.5) boundary = 1.0;
      }
  }
  outColor = vec4(solid, boundary, 0.0, 1.0);
}
