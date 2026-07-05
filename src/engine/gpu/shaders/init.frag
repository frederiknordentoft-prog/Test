#version 300 es
// Initialize all distributions to equilibrium deviations at (rho=1, u=(uin,0)).
precision highp float;

uniform sampler2D uObstacle;
uniform float uUin;

layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;

const ivec2 E[9] = ivec2[9](ivec2(0,0), ivec2(1,0), ivec2(0,1), ivec2(-1,0), ivec2(0,-1), ivec2(1,1), ivec2(-1,1), ivec2(-1,-1), ivec2(1,-1));
const float W[9] = float[9](4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0);

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (texelFetch(uObstacle, p, 0).r > 0.5) {
    o0 = vec4(0.0);
    o1 = vec4(0.0);
    o2 = vec4(0.0, 1.0, 0.0, 0.0);
    return;
  }
  vec2 u = vec2(uUin, 0.0);
  float usq = dot(u, u);
  float g[9];
  for (int i = 0; i < 9; i++) {
    float eu = dot(vec2(E[i]), u);
    g[i] = W[i] * ((1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * usq) - 1.0);
  }
  o0 = vec4(g[0], g[1], g[2], g[3]);
  o1 = vec4(g[4], g[5], g[6], g[7]);
  o2 = vec4(g[8], 1.0, u);
}
