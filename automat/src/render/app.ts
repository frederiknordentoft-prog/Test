// Pixi application, layer topology, resolution policy, resize + capture.
//
// app.stage
// └─ camera (push / shake; pivot = screen centre)
//    ├─ world  [bloom, uber]                       ← post only here
//    │   ├─ scene (identity transform; captured for the screen shatter)
//    │   │   sky · chamber · frameBack · grid · cellFx · frameFront · arc · particles · motes · banners
//    │   └─ shatterLayer
//    └─ hud (no filters: demo watermark, calm chip)
import { Application, Container, Filter, RenderTexture, Rectangle, type Renderer } from 'pixi.js';
import 'pixi.js/unsafe-eval'; // polyfills Pixi's generated uniform/UBO sync: the Artifact CSP forbids eval

Filter.defaultOptions.resolution = 'inherit'; // default is 1 → soft on retina

export interface Stage {
  app: Application;
  renderer: Renderer;
  camera: Container;
  world: Container;
  scene: Container;
  layers: {
    sky: Container; chamber: Container; frameBack: Container; grid: Container; cellFx: Container; frameFront: Container;
    arc: Container; banners: Container; particles: Container; motes: Container; shatter: Container; hud: Container;
  };
  res: number;
  w: number;
  h: number;
}

/** Resolution = min(device DPR, quality cap, pixel budget), never below 1. */
export function pickResolution(w: number, h: number, cap = 2): number {
  const dpr = window.devicePixelRatio || 1;
  const mobile = Math.min(w, h) < 700;
  const budget = mobile ? 1.8e6 : 3.5e6;
  const px = Math.max(1, w * h);
  return Math.max(1, Math.min(dpr, cap, Math.sqrt(budget / px)));
}

export async function createStage(host: HTMLElement): Promise<Stage> {
  const app = new Application();
  const w = host.clientWidth || window.innerWidth;
  const h = host.clientHeight || window.innerHeight;
  const res = pickResolution(w, h);
  // MSAA only where it is visible (DPR 1 desktop); at DPR ≥ 2 it would multisample the full-screen
  // filter textures for ~40 MB and two resolves per frame for no visible gain.
  await app.init({
    width: w, height: h, resolution: res, autoDensity: true, antialias: (window.devicePixelRatio || 1) < 2,
    background: '#050B1A', preference: 'webgl', powerPreference: 'high-performance',
    preserveDrawingBuffer: false, autoStart: true, sharedTicker: false,
  });
  app.canvas.id = 'stage';
  host.appendChild(app.canvas);
  const renderer = app.renderer as Renderer;
  const gl = (renderer as unknown as { context?: { webGLVersion?: number } }).context;
  if (!gl || gl.webGLVersion !== 2) throw new Error('WebGL2 required');

  const camera = new Container();
  const world = new Container();
  const scene = new Container();
  const mk = (name: string) => { const c = new Container(); c.label = name; return c; };
  const layers = {
    sky: mk('sky'), chamber: mk('chamber'), frameBack: mk('frameBack'), grid: mk('grid'), cellFx: mk('cellFx'), frameFront: mk('frameFront'),
    arc: mk('arc'), banners: mk('banners'), particles: mk('particles'), motes: mk('motes'), shatter: mk('shatter'), hud: mk('hud'),
  };
  // chamber: Terningen's gate (GateView) over the live sky, bloom-lit, under the machine and the particles
  scene.addChild(layers.sky, layers.chamber, layers.frameBack, layers.grid, layers.cellFx, layers.frameFront, layers.arc, layers.particles, layers.motes, layers.banners);
  world.addChild(scene, layers.shatter);
  camera.addChild(world, layers.hud);
  app.stage.addChild(camera);

  const st: Stage = { app, renderer, camera, world, scene, layers, res, w, h };
  setCameraSize(st, w, h);
  return st;
}

export function setCameraSize(st: Stage, w: number, h: number): void {
  st.w = w; st.h = h;
  st.camera.pivot.set(w / 2, h / 2);
  st.camera.position.set(w / 2, h / 2);
  st.world.filterArea = new Rectangle(0, 0, w, h);
}

export function resizeStage(st: Stage, w: number, h: number, cap = 2): void {
  const res = pickResolution(w, h, cap);
  if (Math.abs(res - st.res) > 0.01) { st.renderer.resolution = res; st.res = res; }
  st.renderer.resize(w, h);
  setCameraSize(st, w, h);
}

let captureRT: RenderTexture | null = null;
/** Render `scene` (pre-post, identity transform) into a reusable RT sized to the screen. */
export function captureScene(st: Stage): RenderTexture {
  const { w, h, res } = st;
  if (!captureRT || captureRT.width !== w || captureRT.height !== h || captureRT.source.resolution !== res) {
    captureRT?.destroy(true);
    captureRT = RenderTexture.create({ width: w, height: h, resolution: res, antialias: false });
  }
  st.renderer.render({ container: st.scene, target: captureRT, clear: true });
  return captureRT;
}
