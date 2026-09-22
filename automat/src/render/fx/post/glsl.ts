// Shared GLSL for the post stack (UberPost + Bloom). WebGL2 only.
//
// Coordinate spaces used by every post shader:
//   vTextureCoord  uv into the *pooled* input texture (Pixi filter convention; only [0, frame/source] is valid)
//   vScreen        0..1 uv of the root viewport (y down), independent of filter bounds / pool padding
//   css px         Pixi logical pixels (uInputSize.xy is the input source size in css px)

/** Filter vertex shader: Pixi's default + `vScreen` (screen uv) via uMap = (scale.xy, offset.zw). */
export const POST_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vScreen;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform vec4 uMap;
void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  vScreen = vTextureCoord * uMap.xy + uMap.zw;
}
`;

/** Plain filter vertex shader (no screen mapping) for the bloom chain. */
export const CHAIN_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

export const POST_COMMON = /* glsl */ `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
// interleaved gradient noise (Jimenez) - per-pixel jitter that reads as fine grain, not blotches
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;
