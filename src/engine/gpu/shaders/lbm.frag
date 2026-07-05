#version 300 es
// D2Q9 lattice-Boltzmann: fused pull-stream + boundary conditions + BGK/Smagorinsky collision.
// Distributions stored as DEVIATIONS g_i = f_i − w_i (rest state = 0) so RGBA16F precision suffices.
// texF0 = (g0,g1,g2,g3), texF1 = (g4..g7), texF2 = (g8, rho, ux, uy).
// Direction order: 0 rest, 1 E, 2 N, 3 W, 4 S, 5 NE, 6 NW, 7 SW, 8 SE.
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uF0;
uniform sampler2D uF1;
uniform sampler2D uF2;
uniform sampler2D uObstacle;
uniform ivec2 uSize;
uniform float uUin;        // inflow velocity, lattice units
uniform float uTau;        // BGK relaxation floor (>= 0.505)
uniform float uSpongeFrac; // fraction of right edge with raised viscosity

layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;

const ivec2 E[9] = ivec2[9](ivec2(0,0), ivec2(1,0), ivec2(0,1), ivec2(-1,0), ivec2(0,-1), ivec2(1,1), ivec2(-1,1), ivec2(-1,-1), ivec2(1,-1));
const float W[9] = float[9](4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0);
const int OPP[9] = int[9](0, 3, 4, 1, 2, 7, 8, 5, 6);
const int MIRY[9] = int[9](0, 1, 4, 3, 2, 8, 7, 6, 5); // free-slip specular y-mirror

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

float geq(int i, float rho, vec2 u, float usq) {
  float eu = dot(vec2(E[i]), u);
  return W[i] * (rho * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * usq) - 1.0);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);

  if (texelFetch(uObstacle, p, 0).r > 0.5) {
    // Solid: values unused (bounce-back reads the fluid cell's own g), store rest state.
    o0 = vec4(0.0);
    o1 = vec4(0.0);
    o2 = vec4(0.0, 1.0, 0.0, 0.0);
    return;
  }

  float g[9];

  if (p.x == 0) {
    // Inflow: full equilibrium at (rho=1, u=(uin,0)).
    vec2 u = vec2(uUin, 0.0);
    float usq = dot(u, u);
    for (int i = 0; i < 9; i++) g[i] = geq(i, 1.0, u, usq);
    o0 = vec4(g[0], g[1], g[2], g[3]);
    o1 = vec4(g[4], g[5], g[6], g[7]);
    o2 = vec4(g[8], 1.0, u);
    return;
  }

  // --- Streaming (pull) with bounce-back, free-slip walls, zero-gradient outflow ---
  for (int i = 0; i < 9; i++) {
    ivec2 src = p - E[i];
    int dir = i;
    if (src.y < 0) { src.y = 0; dir = MIRY[i]; }
    else if (src.y >= uSize.y) { src.y = uSize.y - 1; dir = MIRY[i]; }
    if (src.x >= uSize.x) src.x = uSize.x - 1; // right edge: copy self (zero gradient)
    if (src.x < 0) src.x = 0;
    if (texelFetch(uObstacle, src, 0).r > 0.5) {
      g[i] = fetchG(p, OPP[i]); // halfway bounce-back: own opposite from previous step
    } else {
      g[i] = fetchG(src, dir);
    }
  }

  // --- Macroscopic moments ---
  float rho = 1.0;
  vec2 mom = vec2(0.0);
  for (int i = 0; i < 9; i++) {
    rho += g[i];
    mom += vec2(E[i]) * g[i];
  }
  rho = clamp(rho, 0.2, 4.0); // soft guard against local blowup
  vec2 u = clamp(mom / rho, vec2(-0.25), vec2(0.25));
  float usq = dot(u, u);

  // --- Equilibrium + non-equilibrium stress (for Smagorinsky) ---
  float ge[9];
  float pxx = 0.0, pyy = 0.0, pxy = 0.0;
  for (int i = 0; i < 9; i++) {
    ge[i] = geq(i, rho, u, usq);
    float dg = g[i] - ge[i];
    vec2 e = vec2(E[i]);
    pxx += e.x * e.x * dg;
    pyy += e.y * e.y * dg;
    pxy += e.x * e.y * dg;
  }
  float qmag = sqrt(pxx * pxx + pyy * pyy + 2.0 * pxy * pxy);
  const float CSQ = 0.01; // Smagorinsky C^2 (C = 0.1)
  float tau = uTau + 0.5 * (sqrt(uTau * uTau + 18.0 * 1.41421356 * CSQ * qmag / rho) - uTau);

  // Sponge zone: viscosity ramps up ×8 near the outlet to absorb vortices.
  float xn = float(p.x) / float(uSize.x - 1);
  float s = smoothstep(1.0 - uSpongeFrac, 1.0, xn);
  tau = mix(tau, 0.5 + 8.0 * (tau - 0.5), s);

  // --- BGK collision ---
  float invTau = 1.0 / tau;
  for (int i = 0; i < 9; i++) g[i] -= (g[i] - ge[i]) * invTau;

  o0 = vec4(g[0], g[1], g[2], g[3]);
  o1 = vec4(g[4], g[5], g[6], g[7]);
  o2 = vec4(g[8], rho, u);
}
