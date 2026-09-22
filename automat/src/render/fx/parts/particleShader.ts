// Custom ParticleContainer shader for the two-channel fx atlas (R = hot core, G = tinted body).
// Additive by construction: writes premultiplied colour with alpha 0 (dst alpha untouched), so it works with
// blendMode 'add' (ONE, ONE). Per particle: aColor.rgb = tint × intensity, aColor.a = white-hot core amount.
import { GlProgram, Matrix, Shader, Texture, TextureStyle } from 'pixi.js';

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aVertex;
in vec2 aUV;
in vec4 aColor;
in vec2 aPosition;
in float aRotation;
uniform mat3 uTranslationMatrix;
uniform float uRound;
uniform vec2 uResolution;
uniform vec4 uColor;
out vec2 vUV;
out vec4 vColor;
void main() {
  float c = cos(aRotation), s = sin(aRotation);
  vec2 v = vec2(aVertex.x * c - aVertex.y * s, aVertex.x * s + aVertex.y * c) + aPosition;
  gl_Position = vec4((uTranslationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  // container alpha (uColor.a) scales everything; tint/core are straight (not premultiplied) here
  vColor = vec4(aColor.rgb, aColor.a) * uColor.a;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vColor;
uniform sampler2D uTexture;
out vec4 finalColor;
void main() {
  vec2 m = texture(uTexture, vUV).rg;      // r = core, g = body
  vec3 body = vColor.rgb * m.g;
  // core: white-hot, but keeps a trace of the tint so saturated embers never turn grey
  vec3 core = mix(vec3(1.0), vColor.rgb / max(1e-3, max(vColor.r, max(vColor.g, vColor.b))), 0.25) * (m.r * vColor.a);
  finalColor = vec4(body + core, 0.0);
}
`;

let program: GlProgram | null = null;

/** A fresh Shader instance (the program is shared). One per ParticleContainer. */
export function createParticleShader(): Shader {
  program ??= GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'nordlys-fx-particles' });
  return new Shader({
    glProgram: program,
    resources: {
      uTexture: Texture.WHITE.source,
      uSampler: new TextureStyle({}),
      uniforms: {
        uTranslationMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
        uColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
        uRound: { value: 0, type: 'f32' },
        uResolution: { value: [0, 0], type: 'vec2<f32>' },
      },
    },
  });
}
