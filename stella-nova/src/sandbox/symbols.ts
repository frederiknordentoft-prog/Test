/**
 * Symbols sandbox.
 *   default       a large line-up of all ten on a dark enamel disc
 *   ?view=board   all ten at true size on a mock of the four rings
 *
 * window.__SN.symbols: glow(v), dim(v), turn(rad), show(on), stats(), sheet(px), probe(px)
 */
import * as THREE from 'three';
import { BEZEL_INNER, BEZEL_OUTER, HUB_RADIUS, PALETTE, RINGS, RING_RADII, RING_WIDTH, RING_Y, SPOKES, STAR_Y, STEP_ANGLE, SYMBOLS, SYMBOL_COUNT, SYMBOL_DIAMETER, SYMBOL_Y, cellXZ, cellY, type SymbolId } from '../core/config';
import { debug, loop } from '../core/loop';
import { SymbolFactory, type SymbolView } from '../render/symbols';
import { createSandbox, sandboxReady } from './harness';

const { stage, onUpdate, params } = createSandbox();
const factory = new SymbolFactory(stage);
factory.warmup();

const views: SymbolView[] = [];
const ringGroups: THREE.Group[] = [];
const ringViews: SymbolView[][] = [];
const enamel = new THREE.MeshStandardMaterial({ color: PALETTE.enamel, metalness: 0.2, roughness: 0.25 });
const brass = new THREE.MeshStandardMaterial({ color: PALETTE.brass, metalness: 1, roughness: 0.32 });

function buildLineup(): void {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(8, 96), enamel);
  disc.rotation.x = -Math.PI / 2;
  disc.receiveShadow = true;
  stage.scene.add(disc);
  const order: SymbolId[] = [0, 1, 2, 3, 8, 4, 5, 6, 7, 9];
  const k = 1.7 / SYMBOL_DIAMETER[3];
  order.forEach((id, i) => {
    const v = factory.acquire(id, 3);
    v.object.scale.setScalar(k);
    v.object.position.set(((i % 5) - 2) * 1.95, SYMBOL_Y * k, i < 5 ? -0.5 : 1.6);
    stage.scene.add(v.object);
    views.push(v);
  });
  stage.rig.zoom = Number(params.get('zoom') || 0.74);
  stage.rig.sway = 0;
}

function buildBoard(): void {
  const grid: SymbolId[][] = [
    [0, 4, 1, 8, 2, 5, 3, 9],
    [6, 0, 7, 1, 9, 2, 4, 3],
    [2, 7, 3, 6, 0, 8, 1, 5],
    [5, 3, 9, 2, 6, 1, 7, 4],
  ];
  const base = new THREE.Mesh(new THREE.CircleGeometry(BEZEL_OUTER, 96), new THREE.MeshStandardMaterial({ color: PALETTE.night2, metalness: 0.4, roughness: 0.5 }));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.03;
  base.receiveShadow = true;
  stage.scene.add(base);
  const bezel = new THREE.Mesh(new THREE.RingGeometry(BEZEL_INNER, BEZEL_OUTER, 128), brass);
  bezel.rotation.x = -Math.PI / 2;
  stage.scene.add(bezel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS, 0.3, 48), brass);
  stage.scene.add(hub);
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.starWarm).multiplyScalar(4) }));
  star.position.y = STAR_Y;
  stage.scene.add(star);

  for (let r = 0; r < RINGS; r++) {
    const group = new THREE.Group();
    const inner = RING_RADII[r] - RING_WIDTH / 2;
    const outer = RING_RADII[r] + RING_WIDTH / 2;
    const band = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128), enamel);
    band.rotation.x = -Math.PI / 2;
    band.position.y = RING_Y[r];
    band.receiveShadow = true;
    group.add(band);
    for (const rad of [inner + 0.03, outer - 0.03]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.028, 8, 128), brass);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = RING_Y[r];
      group.add(rim);
    }
    ringViews.push([]);
    for (let s = 0; s < SPOKES; s++) {
      const socket = new THREE.Object3D();
      const { x, z } = cellXZ(r, s);
      socket.position.set(x, cellY(r), z);
      // Even rings turn their sockets to face outward, odd rings do not: the factory must look right either way.
      if (r % 2 === 0) socket.rotation.y = -s * STEP_ANGLE;
      group.add(socket);
      const v = factory.acquire(grid[r][s], r);
      socket.add(v.object);
      views.push(v);
      ringViews[r].push(v);
    }
    stage.scene.add(group);
    ringGroups.push(group);
  }
}

if (params.get('view') === 'board') buildBoard();
else buildLineup();

onUpdate((dt) => factory.update(dt));

// Whole-frame renderer statistics (the composer renders several passes, so auto reset would only show the last).
const last = { calls: 0, triangles: 0 };
stage.renderer.info.autoReset = false;
loop.onRender(() => {
  last.calls = stage.renderer.info.render.calls;
  last.triangles = stage.renderer.info.render.triangles;
  stage.renderer.info.reset();
});

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

debug.symbols = {
  factory,
  views,
  glow(v: number) {
    for (const s of views) s.glow = v;
  },
  dim(v: number) {
    for (const s of views) s.dim = v;
  },
  /** Turn the rings as a spin would (clockwise radians, alternate rings the other way). */
  turn(a: number) {
    ringGroups.forEach((g, r) => {
      const angle = a * (r % 2 ? -1 : 1);
      g.rotation.y = -angle;
      for (const s of ringViews[r]) s.ringAngle = angle;
    });
  },
  show(on: boolean) {
    for (const s of views) s.object.visible = on;
  },
  stats: () => ({ ...last }),
  /** Contact sheet of the ten thumbnails, large and at phone size, over the canvas. */
  sheet(size = 176) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:10;background:#0a1230;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:13px system-ui,sans-serif;color:#f4ecd8;';
    const row = (bg: string, width: number) => {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;flex-wrap:wrap;justify-content:center;gap:10px 22px;max-width:${width}px;padding:10px 18px;border-radius:12px;background:${bg};`;
      el.appendChild(d);
      return d;
    };
    const big = row('transparent', 5 * (size + 24));
    const small = row('transparent', 800);
    const light = row('#16245a', 800);
    for (let id = 0; id < SYMBOL_COUNT; id++) {
      const fig = document.createElement('div');
      fig.style.cssText = 'text-align:center;';
      fig.innerHTML = `<img src="${factory.thumbnail(id as SymbolId, size)}" width="${size}" height="${size}" style="display:block"><span>${SYMBOLS[id].name}</span>`;
      big.appendChild(fig);
      const icon = factory.thumbnail(id as SymbolId, 64);
      for (const target of [small, light]) target.insertAdjacentHTML('beforeend', `<img src="${icon}" width="32" height="32">`);
    }
    document.body.appendChild(el);
    return el;
  },
  /** The finished frame (bloom, ACES, grade) around each symbol: mean colour and the share of clipped pixels. */
  async sample(radiusPx = 60) {
    debug.render();
    const img = await loadImage(stage.canvas.toDataURL());
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const scale = img.width / stage.canvas.clientWidth;
    const r = Math.round(radiusPx * scale);
    const p = new THREE.Vector3();
    return views.map((v) => {
      const s = stage.project(v.object.getWorldPosition(p));
      const d = ctx.getImageData(Math.round(s.x * scale) - r, Math.round(s.y * scale) - r, 2 * r, 2 * r).data;
      const sum = [0, 0, 0];
      let white = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum[0] += d[i];
        sum[1] += d[i + 1];
        sum[2] += d[i + 2];
        if (Math.min(d[i], d[i + 1], d[i + 2]) > 235) white++;
      }
      const n = d.length / 4;
      return `${SYMBOLS[v.id].key} ${sum.map((x) => Math.round(x / n)).join(',')} w${(white / n).toFixed(2)}`;
    });
  },
  /** Numbers instead of a screenshot: coverage, mean colour and clipping of each thumbnail. */
  async probe(size = 96) {
    const out: Record<string, unknown>[] = [];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    for (let id = 0; id < SYMBOL_COUNT; id++) {
      const img = await loadImage(factory.thumbnail(id as SymbolId, size));
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, size, size).data;
      let solid = 0;
      let haze = 0;
      let white = 0;
      let dark = 0;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 128) {
          solid++;
          sum[0] += d[i];
          sum[1] += d[i + 1];
          sum[2] += d[i + 2];
          if (Math.min(d[i], d[i + 1], d[i + 2]) > 235) white++;
          if (Math.max(d[i], d[i + 1], d[i + 2]) < 45) dark++;
        } else if (d[i + 3] > 8) haze++;
      }
      // Speckle: how far each solid pixel sits from the mean of its four neighbours (green channel).
      let rough = 0;
      let inner = 0;
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          const i = (y * size + x) * 4;
          if (d[i + 3] < 250 || d[i - 4 + 3] < 250 || d[i + 4 + 3] < 250 || d[i - size * 4 + 3] < 250 || d[i + size * 4 + 3] < 250) continue;
          rough += Math.abs(d[i + 1] - (d[i - 3] + d[i + 5] + d[i - size * 4 + 1] + d[i + size * 4 + 1]) / 4);
          inner++;
        }
      }
      const px = size * size;
      out.push({
        rough: +(rough / Math.max(1, inner)).toFixed(2),
        key: SYMBOLS[id].key,
        solid: +(solid / px).toFixed(3),
        haze: +(haze / px).toFixed(3),
        mean: sum.map((x) => Math.round(x / Math.max(1, solid))),
        white: +(white / Math.max(1, solid)).toFixed(3),
        dark: +(dark / Math.max(1, solid)).toFixed(3),
      });
    }
    return out;
  },
};

sandboxReady();
