#version 300 es
// Renders particles as soft points into the smoke buffer (additive).
precision highp float;
precision highp sampler2D;

uniform sampler2D uPos;
uniform sampler2D uF2;
uniform ivec2 uPosSize;
uniform ivec2 uSimSize;
uniform float uPointSize;
uniform float uUin;

out float vGlow;

void main() {
  ivec2 pi = ivec2(gl_VertexID % uPosSize.x, gl_VertexID / uPosSize.x);
  vec4 st = texelFetch(uPos, pi, 0);
  vec2 uv = (st.xy + 0.5) / vec2(uSimSize);
  float speed = length(texture(uF2, uv).zw) / max(uUin, 1e-4);
  vGlow = clamp(0.35 + speed * 0.65, 0.0, 1.4);
  // fade-in for freshly respawned particles + near the rake (hides the spawn curtain)
  vGlow *= smoothstep(0.0, 40.0, st.z) * smoothstep(6.0, 60.0, st.x);
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = uPointSize;
}
