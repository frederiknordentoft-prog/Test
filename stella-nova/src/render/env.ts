/**
 * Procedural "studio in an observatory" environment.
 *
 * No HDRI files: a tiny scene of emissive cards on a night gradient is baked
 * into (a) a PMREM texture for the standard PBR materials (brass) and (b) a
 * real mip-mapped cube map that custom shaders (gems) sample with
 * textureCube / textureCubeLod for reflection and fake refraction.
 */
import * as THREE from 'three';

export interface Environment {
  /** For scene.environment and MeshStandard/Physical materials. */
  pmrem: THREE.Texture;
  /** For custom shaders: samplerCube with mipmaps, linear HDR. */
  cube: THREE.CubeTexture;
  dispose(): void;
}

function card(color: number, intensity: number, w: number, h: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

export function buildEnvironment(renderer: THREE.WebGLRenderer): Environment {
  const scene = new THREE.Scene();

  // Night gradient dome: deep navy below, indigo above, a faint warm horizon.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 low = vec3(0.012, 0.016, 0.04);
          vec3 mid = vec3(0.03, 0.045, 0.12);
          vec3 top = vec3(0.07, 0.10, 0.26);
          vec3 c = mix(low, mid, smoothstep(-0.6, 0.1, h));
          c = mix(c, top, smoothstep(0.1, 1.0, h));
          // warm horizon band so brass picks up a golden rim
          c += vec3(0.20, 0.11, 0.03) * exp(-pow(h * 5.0, 2.0)) * 0.6;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(dome);

  // Key softbox: large, warm, high and slightly toward the viewer.
  const key = card(0xfff0d0, 4.0, 16, 9);
  key.position.set(-6, 20, 12);
  key.lookAt(0, 0, 0);
  scene.add(key);

  // Cool fill from the left, low.
  const fill = card(0x4f7dff, 2.4, 10, 14);
  fill.position.set(-24, 6, -4);
  fill.lookAt(0, 0, 0);
  scene.add(fill);

  // Warm rim from behind-right.
  const rim = card(0xffb060, 3.2, 8, 10);
  rim.position.set(18, 9, -18);
  rim.lookAt(0, 0, 0);
  scene.add(rim);

  // Violet kicker opposite the fill.
  const kick = card(0x9a5cff, 2.2, 6, 8);
  kick.position.set(22, 4, 10);
  kick.lookAt(0, 0, 0);
  scene.add(kick);

  // Pin lights overhead: tiny and very bright, they become the sparkle glints.
  const pins: [number, number, number, number][] = [
    [3, 24, 2, 0xffffff],
    [-9, 22, -6, 0xffe2b0],
    [8, 21, -10, 0xcfe0ff],
    [-2, 23, -14, 0xffffff],
    [12, 20, 6, 0xffd9a0],
    [-13, 19, 8, 0xd8e6ff],
    [0, 25, 10, 0xffffff],
    [6, 18, 16, 0xfff0e0],
  ];
  for (const [x, y, z, c] of pins) {
    const p = card(c, 26, 0.9, 0.9);
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    scene.add(p);
  }

  // Dim warm bounce from the floor.
  const bounce = card(0x6b4a20, 0.8, 40, 40);
  bounce.position.set(0, -12, 0);
  bounce.lookAt(0, 0, 0);
  scene.add(bounce);

  const pmremGen = new THREE.PMREMGenerator(renderer);
  const pmrem = pmremGen.fromScene(scene, 0.02).texture;
  pmremGen.dispose();

  const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  cubeCam.update(renderer, scene);

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });

  return {
    pmrem,
    cube: cubeRT.texture,
    dispose() {
      pmrem.dispose();
      cubeRT.dispose();
    },
  };
}
