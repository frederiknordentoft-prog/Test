/**
 * Orrery dev page. Placeholder spheres stand in for the symbols.
 * URL params: charge, energy, glow, heat, unlocked, mode, zoom, spokes (0..1 for all lamps),
 * look=x,z (camera target), angle (ring offset in notches), bare=1 (no placeholders).
 */
import * as THREE from 'three';
import { RINGS, RING_DIR, SPOKES, STEP_ANGLE, SYMBOLS, SYMBOL_DIAMETER } from '../core/config';
import { debug } from '../core/loop';
import { Orrery } from '../render/orrery';
import { createSandbox, sandboxReady } from './harness';

const { stage, onUpdate, params } = createSandbox();
const num = (key: string, fallback: number): number => {
  const v = parseFloat(params.get(key) ?? '');
  return Number.isFinite(v) ? v : fallback;
};

const orrery = new Orrery(stage);
stage.scene.add(orrery.group);

const placeholders: THREE.Mesh[] = [];
const ball = new THREE.SphereGeometry(1, 24, 16);
for (let r = 0; r < RINGS; r++) {
  for (let s = 0; s < SPOKES; s++) {
    const meta = SYMBOLS[(r * 3 + s * 5) % 8];
    const m = new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: meta.color, emissive: meta.color, emissiveIntensity: 0.3, roughness: 0.25 }));
    const k = SYMBOL_DIAMETER[r] * 0.3;
    m.scale.set(k, k * 0.6, k);
    m.castShadow = true;
    m.visible = params.get('bare') !== '1';
    orrery.rings[r].sockets[s].add(m);
    placeholders.push(m);
  }
}

orrery.star.charge = num('charge', 0.3);
orrery.star.energy = num('energy', 0);
orrery.unlocked = num('unlocked', 0);
orrery.modeBlend = num('mode', 0);
stage.rig.zoom = num('zoom', 1);
const look = (params.get('look') ?? '0,0').split(',').map(Number);
stage.rig.lookOffset.set(look[0] || 0, 0, look[1] || 0);
for (let r = 0; r < RINGS; r++) {
  orrery.rings[r].glow = num('glow', 0);
  orrery.rings[r].heat = num('heat', 0);
  orrery.rings[r].angle = num('angle', 0) * STEP_ANGLE * RING_DIR[r];
}
for (let s = 0; s < SPOKES; s++) orrery.setSpokeGlow(s, num('spokes', 0));

// A held surge would decay by itself; the page keeps it up so it can be inspected.
const holdEnergy = num('energy', 0);
onUpdate((dt) => {
  if (holdEnergy > 0) orrery.star.energy = holdEnergy;
  orrery.update(dt);
});

/** Draw calls and triangles of one frame: everything, and the orrery's own share (placeholders excluded). */
function info(): Record<string, number> {
  const inf = stage.renderer.info;
  const measure = (): { calls: number; triangles: number } => {
    inf.autoReset = false;
    inf.reset();
    stage.render();
    inf.autoReset = true;
    return { calls: inf.render.calls, triangles: inf.render.triangles };
  };
  const shown = placeholders.map((p) => p.visible);
  placeholders.forEach((p) => (p.visible = false));
  const withOrrery = measure();
  orrery.group.visible = false;
  const without = measure();
  orrery.group.visible = true;
  placeholders.forEach((p, i) => (p.visible = shown[i]));
  return {
    orreryCalls: withOrrery.calls - without.calls,
    orreryTriangles: withOrrery.triangles - without.triangles,
    frameCalls: withOrrery.calls,
    frameTriangles: withOrrery.triangles,
    geometries: inf.memory.geometries,
    textures: inf.memory.textures,
  };
}

/**
 * Luma (0..255) of the rendered frame at world points [x, y, z], for checking
 * wash-out without a screenshot. Reads back right after a render.
 */
function probe(points: number[][]): number[] {
  stage.render();
  const gl = stage.renderer.getContext();
  const dpr = stage.renderer.getPixelRatio();
  const px = new Uint8Array(4);
  const v = new THREE.Vector3();
  return points.map(([x, y, z]) => {
    const p = stage.project(v.set(x, y, z));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(Math.round(p.x * dpr), Math.round((stage.canvas.clientHeight - p.y) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Math.round(0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]);
  });
}

debug.orrery = orrery;
debug.probe = probe;
debug.info = info;
sandboxReady();
