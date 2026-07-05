#version 300 es
// Rasterize the posed shape polygon into the obstacle texture.
// aPos is in tunnel coords RELATIVE TO PIVOT; pose = rotation + pivot + sting-bend.
layout(location = 0) in vec2 aPos;

uniform vec2 uPivot;   // tunnel coords
uniform vec2 uBend;    // sting-bend translation, tunnel coords
uniform vec2 uCosSin;  // (cos θ, sin θ)
uniform float uAspect; // tunnel width in tunnel units (height = 1)

void main() {
  vec2 r = vec2(aPos.x * uCosSin.x - aPos.y * uCosSin.y, aPos.x * uCosSin.y + aPos.y * uCosSin.x);
  vec2 world = uPivot + uBend + r;
  gl_Position = vec4(world.x / uAspect * 2.0 - 1.0, world.y * 2.0 - 1.0, 0.0, 1.0);
}
