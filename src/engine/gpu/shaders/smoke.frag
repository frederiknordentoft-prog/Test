#version 300 es
// Smoke/trails buffer: semi-Lagrangian advection by the LBM velocity + decay + rake dye injection.
// Particles are splatted additively into this buffer afterwards; decay + advection = streaklines.
precision highp float;
precision highp sampler2D;

uniform sampler2D uPrev;   // previous smoke buffer (render res, LINEAR)
uniform sampler2D uF2;     // velocity field (sim res)
uniform sampler2D uObstacle;
uniform ivec2 uSimSize;
uniform float uAdvect;     // cells advanced this frame (substeps)
uniform float uDecay;      // e.g. 0.975
uniform float uInject;     // continuous rake dye intensity (0 = off)
uniform float uRakeRows;

in vec2 vUv;
out vec4 outColor;

const vec3 DYE = vec3(0.45, 0.72, 1.0);

void main() {
  vec2 texel = 1.0 / vec2(uSimSize);
  vec2 v = texture(uF2, vUv).zw; // cells/step
  vec2 src = vUv - v * uAdvect * texel;
  vec4 prev = texture(uPrev, src);
  ivec2 cell = clamp(ivec2(vUv * vec2(uSimSize)), ivec2(0), uSimSize - 1);
  float solid = texelFetch(uObstacle, cell, 0).r;
  vec4 col = prev * uDecay * (1.0 - solid);

  if (uInject > 0.0 && vUv.x > 0.004 && vUv.x < 0.02) {
    float rowPhase = fract(vUv.y * uRakeRows + 0.5);
    float band = smoothstep(0.38, 0.5, rowPhase) * smoothstep(0.62, 0.5, rowPhase);
    col.rgb += DYE * band * uInject;
  }

  outColor = clamp(col, 0.0, 8.0);
}
