#version 300 es
// 2×2 sum reduction. Repeated until 1×1 → total (Fx, Fy, Tz, badness).
precision highp float;
precision highp sampler2D;

uniform sampler2D uSrc;
uniform ivec2 uSrcSize;

out vec4 outColor;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  vec4 sum = vec4(0.0);
  for (int dy = 0; dy < 2; dy++)
    for (int dx = 0; dx < 2; dx++) {
      ivec2 q = p + ivec2(dx, dy);
      if (q.x < uSrcSize.x && q.y < uSrcSize.y) sum += texelFetch(uSrc, q, 0);
    }
  outColor = sum;
}
