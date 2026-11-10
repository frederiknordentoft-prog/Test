/**
 * Sky sandbox: the sky behind a plain dark disc that stands in for the
 * instrument, so composition can be judged without the board.
 *
 * URL params (on top of the harness's q / inset / rm):
 *   mode=0..1     0 observatory night, 1 Kometnat
 *   energy=0..1   excitement
 *   disc=0        start without the stand-in disc
 *
 * window.__SN:
 *   sky                 the Sky instance (set sky.modeBlend / sky.energy)
 *   disc(on)            show or hide the stand-in disc
 *   meteor()            launch a shooting star now
 *   bakeMs              ms the constructor took, GPU bake included
 *   skyInfo()           draw calls / triangles / points the sky adds to a frame
 *   showBake(channel)   0..3 = show one baked field flat on screen, -1 = off
 */
import * as THREE from 'three';
import { BEZEL_INNER, BEZEL_OUTER, FIT_RADIUS, PALETTE } from '../core/config';
import { debug } from '../core/loop';
import { Sky } from '../render/sky';
import { createSandbox, sandboxReady } from './harness';

const { stage, onUpdate, params } = createSandbox();
const renderer = stage.renderer;

// Dev page only: the wall clock is fine for a one-off cost measurement. The
// 1×1 read-back makes the GPU finish the bake before the clock is read.
const t0 = performance.now();
const sky = new Sky(stage);
renderer.readRenderTargetPixels(sky.bakeTarget, 0, 0, 1, 1, new Uint8Array(4));
const bakeMs = Math.round(performance.now() - t0);

sky.modeBlend = Number(params.get('mode') ?? 0);
sky.energy = Number(params.get('energy') ?? 0);
stage.scene.add(sky.group);

// Stand-in instrument: a dark disc with a dim brass rim where the bezel will be.
const standIn = new THREE.Group();
const disc = new THREE.Mesh(new THREE.CircleGeometry(FIT_RADIUS, 128), new THREE.MeshBasicMaterial({ color: 0x05070d }));
disc.rotation.x = -Math.PI / 2;
const rim = new THREE.Mesh(
  new THREE.RingGeometry(BEZEL_INNER, BEZEL_OUTER, 128),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.brassDark).multiplyScalar(0.55) }),
);
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.01;
standIn.add(disc, rim);
standIn.visible = params.get('disc') !== '0';
stage.scene.add(standIn);

// Flat view of one baked field, for checking the bake itself.
const bakeView = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: { uBake: { value: sky.bakeTarget.texture }, uChannel: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uBake;
      uniform float uChannel;
      uniform float uAspect;
      varying vec2 vUv;
      void main() {
        vec2 uv = (vUv - 0.5) * vec2(max(uAspect, 1.0), max(1.0 / uAspect, 1.0)) + 0.5;
        vec4 s = texture2D(uBake, uv);
        float v = uChannel < 0.5 ? s.r : (uChannel < 1.5 ? s.g : (uChannel < 2.5 ? s.b : s.a));
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        gl_FragColor = vec4(vec3(v * v * 0.9) * inside, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  }),
);
bakeView.frustumCulled = false;
bakeView.renderOrder = 10000;
bakeView.visible = false;
stage.scene.add(bakeView);

onUpdate((dt) => {
  sky.update(dt);
  (bakeView.material as THREE.ShaderMaterial).uniforms.uAspect.value = stage.camera.aspect;
});

debug.sky = sky;
debug.bakeMs = bakeMs;
debug.disc = (on: boolean) => {
  standIn.visible = on;
};
debug.meteor = () => sky.spawnMeteor();
debug.showBake = (channel: number) => {
  bakeView.visible = channel >= 0;
  (bakeView.material as THREE.ShaderMaterial).uniforms.uBake.value = sky.bakeTarget.texture;
  (bakeView.material as THREE.ShaderMaterial).uniforms.uChannel.value = Math.max(0, channel);
};
debug.skyInfo = () => {
  // The composer resets renderer.info on every pass, so count one scene
  // render directly, with and without the sky.
  const count = () => {
    renderer.info.reset();
    renderer.setRenderTarget(stage.composer.renderTarget1);
    renderer.render(stage.scene, stage.camera);
    renderer.setRenderTarget(null);
    const r = renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, points: r.points };
  };
  const standInWas = standIn.visible;
  const bakeViewWas = bakeView.visible;
  standIn.visible = false;
  bakeView.visible = false;
  const auto = renderer.info.autoReset;
  renderer.info.autoReset = false;
  sky.group.visible = true;
  const withSky = count();
  sky.group.visible = false;
  const without = count();
  sky.group.visible = true;
  renderer.info.autoReset = auto;
  standIn.visible = standInWas;
  bakeView.visible = bakeViewWas;
  return {
    calls: withSky.calls - without.calls,
    triangles: withSky.triangles - without.triangles,
    points: withSky.points - without.points,
    memory: { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures },
    bakeMs,
    bakeSize: sky.bakeTarget.width,
    quality: stage.quality,
    mode: sky.modeBlend,
  };
};

sandboxReady();
