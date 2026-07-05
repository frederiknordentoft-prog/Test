#version 300 es
// Streakline particles: positions in a PW×PH texture (x, y in cell coords, age, row).
// RK2 advection through the velocity field; respawn at the smoke rake.
precision highp float;
precision highp sampler2D;

uniform sampler2D uPos;    // previous positions
uniform sampler2D uF2;     // velocity field
uniform sampler2D uObstacle;
uniform ivec2 uSimSize;
uniform ivec2 uPosSize;
uniform float uSteps;      // LBM substeps this frame
uniform float uFrame;      // frame counter (for jitter hash)
uniform float uRakeRows;   // number of rake emitter rows
uniform float uSeed;

out vec4 outColor;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 velAt(vec2 pos) {
  vec2 uv = (pos + 0.5) / vec2(uSimSize);
  return texture(uF2, uv).zw;
}

void main() {
  ivec2 pi = ivec2(gl_FragCoord.xy);
  vec4 st = texelFetch(uPos, pi, 0);
  vec2 pos = st.xy;
  float age = st.z;
  float id = float(pi.x + pi.y * uPosSize.x);

  // RK2
  vec2 v1 = velAt(pos);
  vec2 v2 = velAt(pos + v1 * uSteps * 0.5);
  pos += v2 * uSteps;
  age += 1.0;

  ivec2 cell = clamp(ivec2(pos), ivec2(0), uSimSize - 1);
  bool inSolid = texelFetch(uObstacle, cell, 0).r > 0.5;
  bool gone = pos.x >= float(uSimSize.x) - 2.0 || pos.x < 0.5 || pos.y < 0.5 || pos.y >= float(uSimSize.y) - 0.5;
  float maxAge = 2200.0 + hash13(vec3(id, 7.0, uSeed)) * 1200.0;

  if (inSolid || gone || age > maxAge) {
    // Respawn at the rake: evenly spaced rows + per-particle jitter, staggered restart x.
    float row = mod(id, uRakeRows);
    float jitterY = (hash13(vec3(id, uFrame, uSeed)) - 0.5) * 0.3;
    float y = (row + 0.5 + jitterY) / uRakeRows * float(uSimSize.y);
    // Spread respawn over a wide x-band so the rake doesn't clump into blobs.
    float x = 1.5 + hash13(vec3(id, uFrame + 13.0, uSeed)) * 24.0;
    pos = vec2(x, y);
    age = 0.0;
  }

  outColor = vec4(pos, age, st.w);
}
