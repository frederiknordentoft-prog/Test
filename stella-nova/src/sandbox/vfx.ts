/**
 * VFX sandbox: a placeholder instrument (dark discs, small spheres, a glowing
 * ball) and a named trigger for every effect on window.__SN.fx.
 *
 *   __SN.fx.burst()  .line()  .sparks()  .flash()  .stardust()  .dustLine()
 *   __SN.fx.shooting()  .rain()  .nova()  .comet()
 *   __SN.fx.beams(n)  .ghosts(n)  .clearBeams()
 *   __SN.fx.trails(speed)  .fountain(tier)  .ambient(v)  .info()
 *
 * URL: ?ambient=0..1 (default 0.6) plus the harness params (q, inset, rm).
 * Keys: 1 burst, 2 line, 3 stardust, 4 shooting rain, 5 beams, 6 ghosts,
 * 7 trails, 8 nova, 9 comet, 0 fountain tier cycle, c clear.
 */
import * as THREE from 'three';
import { anim } from '../core/anim';
import { BEZEL_INNER, BEZEL_OUTER, HUB_RADIUS, RING_DIR, RING_RADII, RING_WIDTH, RING_Y, RINGS, SPOKES, STAR_Y, STEP_ANGLE, SYMBOLS, SYMBOL_Y, cellXZ, cellY } from '../core/config';
import { debug } from '../core/loop';
import { Vfx, type BeamHandle } from '../render/vfx';
import { createSandbox, sandboxReady } from './harness';

const { stage, onUpdate, params } = createSandbox();

// ───────────────────────────── Placeholder instrument ─────────────────────────────

const brass = new THREE.MeshStandardMaterial({ color: 0xb8923f, metalness: 1, roughness: 0.38 });
const enamel = new THREE.MeshStandardMaterial({ color: 0x0a1230, metalness: 0.2, roughness: 0.3 });
const base = new THREE.Mesh(new THREE.CircleGeometry(BEZEL_OUTER + 0.3, 96), new THREE.MeshStandardMaterial({ color: 0x05070f, metalness: 0.4, roughness: 0.6 }));
base.rotation.x = -Math.PI / 2;
base.position.y = -0.06;
stage.scene.add(base);

const ringGroups: THREE.Group[] = [];
const symbolOf = (ring: number, socket: number) => SYMBOLS[(ring * 3 + socket * 5) % 8];
for (let r = 0; r < RINGS; r++) {
  const group = new THREE.Group();
  const band = new THREE.Mesh(new THREE.RingGeometry(RING_RADII[r] - RING_WIDTH / 2, RING_RADII[r] + RING_WIDTH / 2, 96), enamel);
  band.rotation.x = -Math.PI / 2;
  band.position.y = RING_Y[r];
  band.receiveShadow = true;
  group.add(band);
  for (const edge of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RING_RADII[r] + (edge * RING_WIDTH) / 2, 0.022, 8, 128), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = RING_Y[r];
    group.add(rim);
  }
  for (let s = 0; s < SPOKES; s++) {
    const meta = symbolOf(r, s);
    const { x, z } = cellXZ(r, s);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 20, 12),
      new THREE.MeshStandardMaterial({ color: meta.color, emissive: meta.color, emissiveIntensity: 0.35, roughness: 0.3 }),
    );
    ball.position.set(x, RING_Y[r] + SYMBOL_Y, z);
    ball.castShadow = true;
    group.add(ball);
  }
  ringGroups.push(group);
  stage.scene.add(group);
}
const bezel = new THREE.Mesh(new THREE.RingGeometry(BEZEL_INNER, BEZEL_OUTER, 128), brass);
bezel.rotation.x = -Math.PI / 2;
stage.scene.add(bezel);
const hub = new THREE.Mesh(new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS, 0.24, 48), brass);
hub.position.y = 0.06;
stage.scene.add(hub);
const star = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2a8).multiplyScalar(4) }));
star.position.y = STAR_Y;
stage.scene.add(star);

// ───────────────────────────── VFX under test ─────────────────────────────

const vfx = new Vfx(stage);
stage.scene.add(vfx.group);
vfx.ambient = params.has('ambient') ? Number(params.get('ambient')) : 0.6;

const STAR = new THREE.Vector3(0, STAR_Y, 0);
const ringAngle = [0, 0, 0, 0];
let whirl = 0;
let fountainTier: 0 | 1 | 2 | 3 = 0;
const live: BeamHandle[] = [];

/** World centre of the cell that socket `socket` of `ring` currently occupies. */
function cell(ring: number, socket: number): THREE.Vector3 {
  const a = ringAngle[ring] + socket * STEP_ANGLE;
  return new THREE.Vector3(Math.sin(a) * RING_RADII[ring], cellY(ring), -Math.cos(a) * RING_RADII[ring]);
}
const colorOf = (ring: number, socket: number) => symbolOf(ring, socket).color;

const fx = {
  burst(ring = 2, spoke = 1, power = 1) {
    vfx.burst(cell(ring, spoke), colorOf(ring, spoke), power);
  },
  /** A winning line shattering, inner ring first. */
  line(spoke = 1, count = 4, gap = 0.06) {
    for (let r = 0; r < count; r++) anim.wait(r * gap).then(() => vfx.burst(cell(r, spoke), colorOf(r, spoke)));
  },
  sparks(ring = 3, spoke = 0, count = 14, speed = 3.5) {
    const p = cell(ring, spoke);
    p.y = RING_Y[ring] + 0.05;
    vfx.sparks(p, 0xf2d488, count, speed);
  },
  flash(ring = 1, spoke = 6, size = 1) {
    vfx.flash(cell(ring, spoke), colorOf(ring, spoke), size);
  },
  stardust(ring = 2, spoke = 1, duration?: number) {
    return vfx.stardust(cell(ring, spoke), STAR, colorOf(ring, spoke), { duration });
  },
  dustLine(spoke = 1, count = 4) {
    return Promise.all(Array.from({ length: count }, (_, r) => vfx.stardust(cell(r, spoke), STAR, colorOf(r, spoke))));
  },
  /** Every cell on two spokes at once: the heaviest stardust the game produces. */
  dustAll() {
    const all: Promise<void>[] = [];
    for (const s of [1, 4, 6]) for (let r = 0; r < RINGS; r++) all.push(vfx.stardust(cell(r, s), STAR, colorOf(r, s)));
    return Promise.all(all);
  },
  shooting(ring = 2, spoke = 6, duration?: number) {
    return vfx.shootingStar(cell(ring, spoke), colorOf(ring, spoke), { duration });
  },
  /** Refill: a staggered rain of shooting stars. */
  rain(n = 8, gap = 0.07) {
    for (let i = 0; i < n; i++) {
      const r = i % RINGS;
      const s = (i * 3 + 1) % SPOKES;
      anim.wait(i * gap).then(() => vfx.shootingStar(cell(r, s), colorOf(r, s)));
    }
  },
  nova(duration?: number, maxRadius?: number) {
    return vfx.shockwave(STAR, { duration, maxRadius });
  },
  comet(duration?: number) {
    return vfx.cometPass({ duration });
  },
  beams(n = 1, count: 3 | 4 = 4, first = 1) {
    for (let i = 0; i < n; i++) {
      const spoke = (first + i * (n > 4 ? 1 : 2)) % SPOKES;
      const c: 3 | 4 = n > 1 && i % 3 === 2 ? 3 : count;
      live.push(vfx.beam(spoke, c, colorOf(0, spoke)));
    }
  },
  ghosts(n = 1, count: 3 | 4 = 4, first = 2) {
    for (let i = 0; i < n; i++) {
      const spoke = (first + i * 2) % SPOKES;
      live.push(vfx.ghostBeam(spoke, count, colorOf(0, spoke)));
    }
  },
  setBeams(v: number) {
    for (const b of live) b.intensity = v;
  },
  clearBeams(fade = 0.3) {
    const done = Promise.all(live.map((b) => b.fadeOut(fade)));
    live.length = 0;
    return done;
  },
  trails(speed = 1) {
    whirl = speed;
  },
  fountain(tier: 0 | 1 | 2 | 3 = 1) {
    fountainTier = tier;
    vfx.fountain(tier);
  },
  ambient(v = 0.6) {
    vfx.ambient = v;
  },
  /** Draw calls and triangles of one frame, and the VFX module's share of them. */
  info() {
    const r = stage.renderer;
    const was = r.info.autoReset;
    r.info.autoReset = false;
    const measure = () => {
      r.info.reset();
      stage.render();
      return { calls: r.info.render.calls, triangles: r.info.render.triangles, points: r.info.render.points };
    };
    const all = measure();
    vfx.group.visible = false;
    const rest = measure();
    vfx.group.visible = true;
    r.info.autoReset = was;
    return {
      frame: all,
      vfx: { calls: all.calls - rest.calls, triangles: all.triangles - rest.triangles, points: all.points - rest.points },
      programs: r.info.programs?.length ?? 0,
      geometries: r.info.memory.geometries,
    };
  },
};

const ringColors = Array.from({ length: RINGS }, (_, r) => Array.from({ length: SPOKES }, (_, s) => colorOf(r, s)));

onUpdate((dt) => {
  for (let r = 0; r < RINGS; r++) {
    if (whirl > 0) ringAngle[r] += RING_DIR[r] * whirl * (7.5 - r * 0.8) * dt;
    ringGroups[r].rotation.y = -ringAngle[r];
    vfx.setTrail(r, whirl, ringColors[r], ringAngle[r], RING_DIR[r]);
  }
  star.scale.setScalar(1 + Math.sin(stage.time * 2) * 0.04);
  vfx.update(dt);
});

addEventListener('keydown', (e) => {
  const rng = stage.rng;
  switch (e.key) {
    case '1': fx.burst(rng.int(RINGS), rng.int(SPOKES)); break;
    case '2': fx.line(rng.int(SPOKES)); break;
    case '3': void fx.dustLine(rng.int(SPOKES)); break;
    case '4': fx.rain(); break;
    case '5': fx.beams(live.length ? 8 : 1); break;
    case '6': fx.ghosts(2); break;
    case '7': fx.trails(whirl > 0 ? 0 : 1); break;
    case '8': void fx.nova(); break;
    case '9': void fx.comet(); break;
    case '0': fx.fountain(((fountainTier + 1) % 4) as 0 | 1 | 2 | 3); break;
    case 'c': void fx.clearBeams(); break;
  }
});

debug.vfx = vfx;
debug.fx = fx;
sandboxReady();
