#version 300 es
precision highp float;

uniform vec3 uColor;
uniform float uIntensity;

in float vGlow;
out vec4 outColor;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  float a = exp(-r2 * 3.0) * vGlow * uIntensity;
  outColor = vec4(uColor * a, a);
}
