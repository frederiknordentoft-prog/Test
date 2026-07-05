#version 300 es
// Momentum-exchange force per boundary-adjacent fluid cell.
// For each link pointing into a solid neighbor: ΔF = e_i · (f_i + f_ī) with f = g + w.
// Output: R = Fx, G = Fy, B = torque about pivot, A = badness (NaN / rho blowup, scaled 1/1024).
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uF0;
uniform sampler2D uF1;
uniform sampler2D uF2;
uniform sampler2D uObstacle;
uniform ivec2 uSize;
uniform vec2 uPivotCells; // pivot position in cell coords

out vec4 outColor;

const ivec2 E[9] = ivec2[9](ivec2(0,0), ivec2(1,0), ivec2(0,1), ivec2(-1,0), ivec2(0,-1), ivec2(1,1), ivec2(-1,1), ivec2(-1,-1), ivec2(1,-1));
const float W[9] = float[9](4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0);
const int OPP[9] = int[9](0, 3, 4, 1, 2, 7, 8, 5, 6);

float fetchG(ivec2 p, int i) {
  if (i < 4) {
    vec4 t = texelFetch(uF0, p, 0);
    return i == 0 ? t.x : i == 1 ? t.y : i == 2 ? t.z : t.w;
  } else if (i < 8) {
    vec4 t = texelFetch(uF1, p, 0);
    return i == 4 ? t.x : i == 5 ? t.y : i == 6 ? t.z : t.w;
  }
  return texelFetch(uF2, p, 0).x;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 mac = texelFetch(uF2, p, 0);
  vec4 obs = texelFetch(uObstacle, p, 0);

  // Badness: evaluated at EVERY fluid texel so blowups anywhere are caught.
  float bad = 0.0;
  if (obs.r < 0.5) {
    float rho = mac.y;
    if (isnan(rho) || isnan(mac.z) || isnan(mac.w) || rho < 0.21 || rho > 3.99) bad = 1.0;
  }

  vec2 F = vec2(0.0);
  float T = 0.0;
  if (obs.g > 0.5) {
    for (int i = 1; i < 9; i++) {
      ivec2 q = p + E[i];
      if (q.x < 0 || q.y < 0 || q.x >= uSize.x || q.y >= uSize.y) continue;
      if (texelFetch(uObstacle, q, 0).r > 0.5) {
        float fi = fetchG(p, i) + W[i];
        float fo = fetchG(p, OPP[i]) + W[i];
        vec2 dF = vec2(E[i]) * (fi + fo);
        F += dF;
        vec2 r = vec2(p) + 0.5 + 0.5 * vec2(E[i]) - uPivotCells;
        T += r.x * dF.y - r.y * dF.x;
      }
    }
  }
  outColor = vec4(F, T, bad * 0.0009765625);
}
