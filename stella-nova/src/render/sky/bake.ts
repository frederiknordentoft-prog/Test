/**
 * The nebula bake. All the expensive noise is evaluated once, here, into a
 * single RGBA8 texture that the dome then samples with a trivial shader.
 *
 * The texture does not hold colour. It holds four density fields, which the
 * dome recombines per mode, so one bake serves both the observatory night and
 * Kometnat and the blend between them is free:
 *
 *   R  gas A   billowing emission clouds
 *   G  gas B   thin filaments (lives on a nearer depth layer in the dome)
 *   B  milk    the Milky Way: band glow, mottling, unresolved star grain
 *   A  veil    rays that fan out from the pole (the aurora in Kometnat)
 *
 * Dust lanes are carved into R, G and B. Values are stored as sqrt(density)
 * with triangular dither, which is what keeps 8 bits from banding in a sky
 * that is almost black.
 */
import * as THREE from 'three';
import { MILKY_WAY_NORMAL, OCT_GLSL, makeTriangle } from './shared';

const VERT = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uSize;
  uniform vec3 uMilkyNormal;

  ${OCT_GLSL}

  // Integer hash: identical on every GPU, no sine precision patterns.
  uvec3 pcg3(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v;
  }
  vec3 hash3(ivec3 c) {
    return vec3(pcg3(uvec3(c))) * (1.0 / 4294967296.0);
  }

  // Gradient noise, about −1..1. Quintic fade so octaves do not show the lattice.
  float gnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = p - i;
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    ivec3 c = ivec3(i);
    float n000 = dot(hash3(c) * 2.0 - 1.0, f);
    float n100 = dot(hash3(c + ivec3(1, 0, 0)) * 2.0 - 1.0, f - vec3(1.0, 0.0, 0.0));
    float n010 = dot(hash3(c + ivec3(0, 1, 0)) * 2.0 - 1.0, f - vec3(0.0, 1.0, 0.0));
    float n110 = dot(hash3(c + ivec3(1, 1, 0)) * 2.0 - 1.0, f - vec3(1.0, 1.0, 0.0));
    float n001 = dot(hash3(c + ivec3(0, 0, 1)) * 2.0 - 1.0, f - vec3(0.0, 0.0, 1.0));
    float n101 = dot(hash3(c + ivec3(1, 0, 1)) * 2.0 - 1.0, f - vec3(1.0, 0.0, 1.0));
    float n011 = dot(hash3(c + ivec3(0, 1, 1)) * 2.0 - 1.0, f - vec3(0.0, 1.0, 1.0));
    float n111 = dot(hash3(c + ivec3(1, 1, 1)) * 2.0 - 1.0, f - vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
      mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
      u.z) * 1.2;
  }

  // Rotating between octaves hides the axes of the lattice.
  const mat3 ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

  float fbm(vec3 p, int octaves) {
    float a = 0.5, s = 0.0, n = 0.0;
    for (int i = 0; i < octaves; i++) {
      s += a * gnoise(p);
      n += a;
      p = ROT * p * 2.03 + vec3(13.7, -7.3, 4.1);
      a *= 0.5;
    }
    return s / n;
  }

  // Ridged multifractal: thin bright creases, each octave gated by the one before.
  float ridged(vec3 p, int octaves) {
    float a = 0.5, s = 0.0, n = 0.0, w = 1.0;
    for (int i = 0; i < octaves; i++) {
      float r = 1.0 - min(1.0, abs(gnoise(p)) * 2.3);
      r *= r;
      s += a * r * w;
      n += a;
      w = clamp(r * 2.2, 0.0, 1.0);
      p = ROT * p * 2.11 + vec3(-5.2, 9.4, 2.6);
      a *= 0.55;
    }
    return s / n;
  }

  // Unresolved stars: one soft speck per lattice cell, mostly faint.
  float grain(vec3 p) {
    vec3 i = floor(p);
    vec3 f = p - i;
    vec3 h = hash3(ivec3(i));
    vec3 c = 0.3 + 0.4 * hash3(ivec3(i) + ivec3(57, 113, 191));
    vec3 d = f - c;
    float b = h.x * h.x;
    return b * b * exp(-dot(d, d) * 70.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uSize;
    vec3 p = skyOctDecode(uv);
    float polar = acos(clamp(-p.y, -1.0, 1.0));

    // One shared domain warp gives every field the same slow swirl.
    vec3 wv = vec3(
      fbm(p * 2.4 + vec3(3.1, 0.0, 7.7), 3),
      fbm(p * 2.4 + vec3(-8.2, 4.4, 1.3), 3),
      fbm(p * 2.4 + vec3(5.5, -9.1, -2.8), 3));
    vec3 pw = p + wv * 0.30;

    // Provinces: whole regions of sky with gas, whole regions with none.
    float provA = fbm(p * 2.1 + vec3(4.0, 2.0, 9.0), 2);
    float provB = fbm(p * 2.1 + vec3(-6.0, 11.0, 3.0), 2);

    // The Milky Way's plane, meandering a little.
    float h = dot(p, uMilkyNormal) + 0.13 * fbm(p * 2.3 + vec3(20.0, 5.0, -3.0), 3);
    float band = exp(-h * h / (2.0 * 0.17 * 0.17));
    float core = exp(-h * h / (2.0 * 0.075 * 0.075));

    // Dust: dark creases everywhere, thickest along the Milky Way.
    float lanes = ridged(pw * 6.5 + vec3(11.0, -2.0, 6.0), 4);
    float dust = smoothstep(0.22, 0.62, lanes) * (0.25 + 0.75 * band);

    // Gas A: billows. Soft shoulders, with finer structure folded in so the
    // bright parts never go flat.
    float n1 = fbm(pw * 5.6 + vec3(1.0, 6.0, -4.0), 6);
    float fine = fbm(pw * 16.0 + n1 * 2.0 + vec3(8.0, 8.0, 1.0), 4);
    float gasA = smoothstep(-0.02, 0.60, n1 + provA * 0.80 + 0.03);
    gasA *= 0.38 + 0.62 * smoothstep(-0.30, 0.30, fine);
    gasA *= 1.0 - 0.75 * dust;

    // Gas B: filaments, warped a second time by gas A so the two interlock.
    float r1 = ridged(pw * 6.4 + n1 * 0.55 + vec3(20.0, 3.0, 11.0), 5);
    float gasB = pow(smoothstep(0.16, 0.70, r1), 1.5) * smoothstep(-0.10, 0.26, provB + 0.3 * n1);
    gasB *= 1.0 - 0.6 * dust;

    // Milky Way: wide glow, mottled core, powdered with star grain.
    float mott = smoothstep(-0.35, 0.40, fbm(pw * 10.0 + vec3(40.0, -9.0, 13.0), 5));
    float milk = band * (0.20 + 0.50 * mott) + core * 0.40 * mott;
    milk *= 1.0 - 0.9 * dust;
    float cell = uSize * 0.115;
    float specks = grain(p * cell) + 0.6 * grain(p * cell * 1.7 + 31.0);
    milk += specks * (0.10 + 0.90 * band) * (1.0 - dust) * 0.55;

    // Veil: rays fanning out from the pole. Sampling noise on (cos, sin) of the
    // azimuth keeps them periodic, so there is no seam where the angle wraps.
    float az = atan(p.z, p.x);
    vec2 ring = vec2(cos(az), sin(az));
    float rays = gnoise(vec3(ring * 7.0, polar * 1.6 + 2.0)) * 0.55
               + gnoise(vec3(ring * 19.0, polar * 2.6 + 7.0)) * 0.30
               + gnoise(vec3(ring * 47.0, polar * 4.0 + 1.0)) * 0.15;
    float curtain = fbm(vec3(ring * 1.6, polar * 2.4 + 5.0), 2);
    float veil = smoothstep(-0.05, 0.42, rays) * smoothstep(-0.18, 0.22, curtain);
    // Rays converge on the pole: fade them out before they can pinch.
    veil *= smoothstep(0.06, 0.22, polar) * (1.0 - smoothstep(1.15, 1.50, polar));
    veil *= 0.75 + 0.25 * smoothstep(-0.2, 0.3, n1);

    vec4 fields = clamp(vec4(gasA, gasB, milk, veil), 0.0, 1.0);

    // sqrt encoding + triangular dither: smooth gradients survive 8 bits.
    vec3 d1 = hash3(ivec3(gl_FragCoord.xy, 3));
    vec3 d2 = hash3(ivec3(gl_FragCoord.xy, 71));
    vec4 dither = vec4(d1 + d2 - 1.0, d1.x + d2.z - 1.0) / 255.0;
    gl_FragColor = sqrt(fields) + dither;
  }
`;

export interface NebulaBake {
  readonly target: THREE.WebGLRenderTarget;
  readonly texture: THREE.Texture;
  readonly size: number;
  dispose(): void;
}

export function bakeNebula(renderer: THREE.WebGLRenderer, requestedSize: number): NebulaBake {
  const size = Math.min(requestedSize, renderer.capabilities.maxTextureSize);
  const target = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.NoColorSpace,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: true,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.name = 'sky.nebulaBake';

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uSize: { value: size }, uMilkyNormal: { value: MILKY_WAY_NORMAL } },
    depthTest: false,
    depthWrite: false,
  });
  const geometry = makeTriangle();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(prevTarget);
  renderer.autoClear = prevAutoClear;

  geometry.dispose();
  material.dispose();

  return {
    target,
    texture: target.texture,
    size,
    dispose() {
      target.dispose();
    },
  };
}
