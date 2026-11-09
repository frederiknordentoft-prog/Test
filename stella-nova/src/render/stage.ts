/**
 * Stage: renderer, camera rig, environment and the post-processing chain.
 * Every render module builds on this so the whole picture shares one tone
 * curve, one bloom and one clock.
 *
 * LOOK CONVENTIONS (read before writing any material):
 *  - Linear HDR workflow. Tone mapping (ACES) and sRGB happen in OutputPass,
 *    so materials must NOT tone-map themselves (ShaderMaterial: no
 *    <tonemapping_fragment>/<colorspace_fragment>, output linear).
 *  - Bloom is threshold based: anything brighter than ~1.0 linear glows.
 *    "Lit from within" = emissive / additive colour of 1.5–6.0. Ordinary lit
 *    surfaces stay below 1.0 so brass does not smear into fog.
 *  - `stage.uTime` is the shared time uniform object ({ value: seconds }).
 *    Reuse the object itself in shader uniforms; never read the wall clock.
 *  - `stage.env.pmrem` is scene.environment. `stage.env.cube` is a mip-mapped
 *    samplerCube for custom shaders.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FIT_RADIUS, PALETTE } from '../core/config';
import { cosmetic } from '../core/rng';
import type { Quality, ScreenPoint, ViewLayout } from '../core/types';
import { buildEnvironment, type Environment } from './env';

const QUALITY: Record<Quality, { dpr: number; samples: number; bloomScale: number; shadows: boolean }> = {
  low: { dpr: 1, samples: 0, bloomScale: 0.5, shadows: false },
  medium: { dpr: 1.5, samples: 2, bloomScale: 0.75, shadows: false },
  high: { dpr: 2, samples: 4, bloomScale: 1, shadows: true },
};

/** Screen-space finishing: shockwave refraction, aberration, vignette, flash, grade, grain. */
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uAberration: { value: 0.0012 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.035 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.96, 0.86) },
    uSaturation: { value: 1.06 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uExposure: { value: 1 },
    uShockCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uShockRadius: { value: 0 },
    uShockWidth: { value: 0.08 },
    uShockStrength: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAspect, uAberration, uVignette, uGrain, uFlash, uSaturation, uExposure;
    uniform vec3 uFlashColor, uTint;
    uniform vec2 uShockCenter;
    uniform float uShockRadius, uShockWidth, uShockStrength;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;

      // Expanding ring that bends the image like a pressure wave.
      if (uShockStrength > 0.0001) {
        vec2 d = uv - uShockCenter;
        d.x *= uAspect;
        float dist = length(d);
        float band = (dist - uShockRadius) / uShockWidth;
        float w = exp(-band * band);
        vec2 dir = dist > 1e-4 ? d / dist : vec2(0.0);
        dir.x /= uAspect;
        uv -= dir * w * uShockStrength * (0.6 + 0.4 * sin(band * 3.0));
      }

      // Radial chromatic aberration, stronger toward the corners.
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * (uAberration * (0.35 + r2 * 3.0));
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      col *= uExposure;

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);
      col *= uTint;

      // Vignette: darken and cool the corners slightly.
      float v = smoothstep(0.15, 0.95, r2 * 2.2);
      col *= 1.0 - v * uVignette;
      col = mix(col, col * vec3(0.86, 0.92, 1.08), v * 0.5);

      col += uFlashColor * uFlash;

      float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (0.25 + luma * 0.6);

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

/**
 * Camera rig. The base framing is solved from the layout (the orrery always
 * fits the free rectangle); choreography then animates the plain numeric
 * offsets below with tweens.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  /** Multiplies the fitted distance. <1 pushes in, >1 pulls out. */
  zoom = 1;
  /** Added to the fitted tilt from vertical, radians. */
  tiltOffset = 0;
  /** Orbit around the vertical axis, radians. */
  azimuth = 0;
  /** Roll around the view axis, radians. */
  roll = 0;
  /** World-space offset of the look-at target. */
  readonly lookOffset = new THREE.Vector3();
  /** 0 disables the idle drift. */
  sway = 1;

  private baseDistance = 20;
  private baseTilt = 0.4;
  private trauma = 0;
  private shift = new THREE.Vector2();
  private size = new THREE.Vector2(1, 1);
  private noiseT = 0;
  private readonly target = new THREE.Vector3(0, 0, 0);

  get distance(): number {
    return this.baseDistance * this.zoom;
  }

  get tilt(): number {
    return this.baseTilt + this.tiltOffset;
  }

  /** Solve distance + view offset so a disc of FIT_RADIUS sits inside the free rect. */
  fit(layout: ViewLayout): void {
    const W = Math.max(1, layout.width);
    const H = Math.max(1, layout.height);
    const { top, right, bottom, left } = layout.insets;
    const freeW = Math.max(40, W - left - right);
    const freeH = Math.max(40, H - top - bottom);
    const aspect = W / H;
    this.size.set(W, H);

    // Keep the perspective feel constant: the shorter screen side gets ~30°.
    const cam = this.camera;
    cam.aspect = aspect;
    const baseFov = 30;
    cam.fov =
      aspect >= 1 ? baseFov : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) / aspect));
    cam.clearViewOffset();
    cam.updateProjectionMatrix();

    // More tilt when the free area is wide, flatter when it is tall and narrow.
    const freeAspect = freeW / freeH;
    this.baseTilt = THREE.MathUtils.lerp(0.25, 0.5, THREE.MathUtils.smoothstep(freeAspect, 0.7, 1.6));

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(a) * FIT_RADIUS, 0, Math.cos(a) * FIT_RADIUS));
    }
    const v = new THREE.Vector3();
    const measure = (d: number) => {
      this.place(d, this.baseTilt, 0, 0);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        v.copy(p).project(cam);
        minX = Math.min(minX, v.x);
        maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      }
      return { minX, maxX, minY, maxY };
    };
    let lo = 4, hi = 200;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const b = measure(mid);
      const wPx = ((b.maxX - b.minX) / 2) * W;
      const hPx = ((b.maxY - b.minY) / 2) * H;
      if (wPx <= freeW && hPx <= freeH) hi = mid;
      else lo = mid;
    }
    this.baseDistance = hi;
    const b = measure(hi);
    const cxPx = ((b.minX + b.maxX) / 2 * 0.5 + 0.5) * W;
    const cyPx = (1 - ((b.minY + b.maxY) / 2 * 0.5 + 0.5)) * H;
    this.shift.set(left + freeW / 2 - cxPx, top + freeH / 2 - cyPx);
    this.apply(0);
  }

  private place(distance: number, tilt: number, azimuth: number, roll: number): void {
    const cam = this.camera;
    const t = this.target;
    cam.position.set(
      t.x + Math.sin(tilt) * Math.sin(azimuth) * distance,
      t.y + Math.cos(tilt) * distance,
      t.z + Math.sin(tilt) * Math.cos(azimuth) * distance,
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(t);
    if (roll) cam.rotateZ(roll);
    cam.updateMatrixWorld(true);
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Recompute the camera transform. Call once per frame after tweens ran. */
  apply(dt: number, time = 0, reducedMotion = false): void {
    const cam = this.camera;
    const swayK = reducedMotion ? 0 : this.sway;
    const az = this.azimuth + Math.sin(time * 0.11) * 0.03 * swayK;
    const tilt = Math.max(0.02, this.tilt + Math.sin(time * 0.157 + 1.3) * 0.012 * swayK);
    this.target.set(this.lookOffset.x, this.lookOffset.y, this.lookOffset.z);
    this.place(this.distance, tilt, az, this.roll);

    if (this.trauma > 0.0005 && !reducedMotion) {
      this.noiseT += dt * 38;
      const s = this.trauma * this.trauma;
      const n = (k: number) => Math.sin(this.noiseT * (1.0 + k * 0.37) + k * 12.9898) * Math.cos(this.noiseT * (0.71 + k * 0.19) + k * 4.1);
      cam.position.x += n(1) * s * 0.22;
      cam.position.y += n(2) * s * 0.12;
      cam.position.z += n(3) * s * 0.22;
      cam.rotateZ(n(4) * s * 0.012);
      cam.updateMatrixWorld(true);
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    cam.setViewOffset(this.size.x, this.size.y, -this.shift.x, -this.shift.y, this.size.x, this.size.y);
    cam.updateProjectionMatrix();
  }
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly camera: THREE.PerspectiveCamera;
  readonly env: Environment;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly final: ShaderPass;
  /** Shared time uniform. Reuse this object in every shader. */
  readonly uTime = { value: 0 };
  /** Warm key light. Casts the only real-time shadows (high quality). */
  readonly keyLight: THREE.DirectionalLight;
  readonly fillLight: THREE.HemisphereLight;

  /** Post-FX knobs for choreography. Plain numbers, tween them. */
  readonly fx = {
    flash: 0,
    aberration: 0.0012,
    vignette: 0.42,
    saturation: 1.06,
    exposure: 1,
    bloomStrength: 0.7,
    shockRadius: 0,
    shockStrength: 0,
    shockWidth: 0.08,
    /** World position the shockwave is centred on. */
    shockCenter: new THREE.Vector3(0, 0, 0),
    tint: new THREE.Color(1, 1, 1),
  };

  time = 0;
  quality: Quality;
  reducedMotion: boolean;
  private container: HTMLElement;
  private layout: ViewLayout = { width: 1, height: 1, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  private readonly tmp = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(container: HTMLElement, opts: { quality: Quality; reducedMotion: boolean }) {
    this.container = container;
    this.quality = opts.quality;
    this.reducedMotion = opts.reducedMotion;
    this.camera = this.rig.camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(PALETTE.night0, 1);
    renderer.shadowMap.enabled = QUALITY[this.quality].shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    container.appendChild(renderer.domElement);

    this.env = buildEnvironment(renderer);
    this.scene.environment = this.env.pmrem;
    this.scene.environmentIntensity = 1.0;

    this.keyLight = new THREE.DirectionalLight(0xffe6bf, 2.4);
    this.keyLight.position.set(-5, 14, 7);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.left = -7;
    this.keyLight.shadow.camera.right = 7;
    this.keyLight.shadow.camera.top = 7;
    this.keyLight.shadow.camera.bottom = -7;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 40;
    this.keyLight.shadow.bias = -0.0006;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 5;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight(0x5a78ff, 0x1a0f05, 0.35);
    this.scene.add(this.fillLight);

    const q = QUALITY[this.quality];
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.samples });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), this.fx.bloomStrength, 0.55, 1.0);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setLayout(layout: ViewLayout): void {
    this.layout = layout;
    const q = QUALITY[this.quality];
    const dpr = Math.min(globalThis.devicePixelRatio || 1, q.dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(layout.width, layout.height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(layout.width, layout.height);
    this.bloom.resolution.set(layout.width * dpr * q.bloomScale, layout.height * dpr * q.bloomScale);
    this.final.uniforms.uAspect.value = layout.width / Math.max(1, layout.height);
    this.rig.fit(layout);
  }

  setQuality(qName: Quality): void {
    if (qName === this.quality) return;
    this.quality = qName;
    const q = QUALITY[qName];
    this.renderer.shadowMap.enabled = q.shadows;
    this.keyLight.castShadow = q.shadows;
    this.composer.renderTarget1.samples = q.samples;
    this.composer.renderTarget2.samples = q.samples;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });
    this.setLayout(this.layout);
  }

  /** Advance the shared clock and apply the camera rig. Call once per frame. */
  update(dt: number): void {
    this.time += dt;
    this.uTime.value = this.time;
    this.rig.apply(dt, this.time, this.reducedMotion);
  }

  render(): void {
    const u = this.final.uniforms;
    const fx = this.fx;
    u.uTime.value = this.time;
    u.uFlash.value = fx.flash;
    u.uAberration.value = fx.aberration;
    u.uVignette.value = fx.vignette;
    u.uSaturation.value = fx.saturation;
    u.uExposure.value = fx.exposure;
    (u.uTint.value as THREE.Color).copy(fx.tint);
    u.uShockRadius.value = fx.shockRadius;
    u.uShockStrength.value = this.reducedMotion ? 0 : fx.shockStrength;
    u.uShockWidth.value = fx.shockWidth;
    this.tmp.copy(fx.shockCenter).project(this.camera);
    (u.uShockCenter.value as THREE.Vector2).set(this.tmp.x * 0.5 + 0.5, this.tmp.y * 0.5 + 0.5);
    this.bloom.strength = fx.bloomStrength;
    this.composer.render();
  }

  /** World → CSS px relative to the canvas container. */
  project(world: THREE.Vector3, out: ScreenPoint = { x: 0, y: 0 }): ScreenPoint {
    this.tmp.copy(world).project(this.camera);
    out.x = (this.tmp.x * 0.5 + 0.5) * this.layout.width;
    out.y = (1 - (this.tmp.y * 0.5 + 0.5)) * this.layout.height;
    return out;
  }

  /** Client px → point on the orrery plane (y = planeY). null when the ray misses. */
  pickPlane(clientX: number, clientY: number, planeY = 0, out = new THREE.Vector3()): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    this.plane.constant = -planeY;
    return this.raycaster.ray.intersectPlane(this.plane, out);
  }

  /** Cosmetic randomness for presentation. Never use for outcomes. */
  get rng() {
    return cosmetic;
  }

  dispose(): void {
    this.env.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
