/**
 * View sandbox: the assembled IGameView full-window on the shared loop, with a
 * random board and one scripted demo per beat.
 *
 *   __SN.view                      the view (GameView)
 *   __SN.demo.spin(turbo?, anticipation?)  .wins()  .cascade()  .nova()
 *   __SN.demo.nudge(ring, dir, frac?)  .release(ring, dir)  .auto(ring, dir)
 *   __SN.demo.free(on)  .bigWin(tier | null)  .hint(ring, dir | 0)  .scatters()
 *   __SN.demo.attract(on)  .intro()
 *   __SN.cues                      every ViewCue with its anim time
 *   __SN.info()                    draw calls and triangles of one frame
 *
 * Each demo returns its promise, so a script can trigger one and then step
 * with __SN.advance(ms).
 *
 * URL: ?q=low|medium|high  &inset=top,right,bottom,left  &rm=1  &attract=1
 * Keys: s spin, t turbo spin, a spin with anticipation, w wins, c cascade,
 * n nova, f Kometnat on/off, b big-win tier cycle, h hint. Drag a ring to nudge.
 */
import { anim } from '../core/anim';
import { RINGS, RING_DIR, SPOKES, STEP_ANGLE, SYM, type SymbolId } from '../core/config';
import { debug, loop } from '../core/loop';
import { cosmetic } from '../core/rng';
import type { BeatCascade, Cell, Grid, Insets, LineWin, Quality, Refill, ViewCue } from '../core/types';
import { createGameView, type GameView } from '../render/view';

const params = new URLSearchParams(location.search);
document.documentElement.style.cssText = 'height:100%;background:#03050d;';
document.body.style.cssText = 'margin:0;height:100%;overflow:hidden;background:#03050d;touch-action:none;';
const container = document.createElement('div');
container.style.cssText = 'position:fixed;inset:0;';
document.body.appendChild(container);

const mod = (n: number, m: number) => ((n % m) + m) % m;

function randomGrid(): Grid {
  const g: Grid = [];
  for (let r = 0; r < RINGS; r++) {
    const row: SymbolId[] = [];
    for (let s = 0; s < SPOKES; s++) {
      const x = cosmetic.next();
      row.push((x < 0.6 ? cosmetic.int(4) : x < 0.95 ? 4 + cosmetic.int(4) : SYM.WILD) as SymbolId);
    }
    if (cosmetic.next() < 0.35) row[cosmetic.int(SPOKES)] = SYM.SCATTER;
    g.push(row);
  }
  return g;
}

const cellsOf = (g: Grid, id: SymbolId): Cell[] => {
  const out: Cell[] = [];
  g.forEach((row, ring) => row.forEach((sym, spoke) => sym === id && out.push({ ring, spoke })));
  return out;
};

void (async () => {
  const view = createGameView() as GameView;
  await view.init(container, { quality: (params.get('q') as Quality) || 'high', reducedMotion: params.get('rm') === '1' });

  const inset = (params.get('inset') || '0,0,0,0').split(',').map(Number);
  const insets: Insets = { top: inset[0] || 0, right: inset[1] || 0, bottom: inset[2] || 0, left: inset[3] || 0 };
  const layout = () => view.setLayout({ width: container.clientWidth, height: container.clientHeight, insets });
  layout();
  new ResizeObserver(layout).observe(container);

  let grid = randomGrid();
  view.setGrid(grid);
  view.setNovaCharge(0.35);
  if (params.get('attract') === '1') view.attract(true);

  const cues: { t: number; cue: ViewCue }[] = [];
  view.onCue((cue) => cues.push({ t: +anim.time.toFixed(3), cue }));

  /** Two honest lines on the current board: four rubies on spoke 1, three moons on spoke 5. */
  const stageWins = (): LineWin[] => {
    for (let r = 0; r < RINGS; r++) {
      grid[r][1] = SYM.RUBY;
      grid[r][5] = r < 3 ? SYM.MOON : SYM.EMERALD;
    }
    view.setGrid(grid);
    const line = (spoke: number, symbol: SymbolId, count: 3 | 4): LineWin => ({
      spoke, symbol, count, pay: 1, amount: 100,
      cells: Array.from({ length: count }, (_, ring) => ({ ring, spoke })),
    });
    return [line(1, SYM.RUBY, 4), line(5, SYM.MOON, 3)];
  };

  /** Keep the sandbox's own grid in step with a ring that turned. */
  const turned = (ring: number, dir: number) => {
    const row = grid[ring];
    grid[ring] = row.map((_, s) => row[mod(s - dir, SPOKES)]);
  };

  let free = false;
  let tier = 0;
  const demo = {
    grid: () => grid,
    spin(turbo = false, anticipation = [false, false, false, false]) {
      grid = randomGrid();
      view.spinStart({ turbo });
      return view.spinStop(grid, { turbo, anticipation, scatters: cellsOf(grid, SYM.SCATTER) });
    },
    wins(turbo = false) {
      return view.showWins(stageWins(), { multiplier: 1, ladderIndex: 0, turbo });
    },
    cascade(turbo = false) {
      const removed = stageWins().flatMap((l) => l.cells);
      const refills: Refill[] = removed.map((cell) => ({ cell, symbol: cosmetic.int(8) as SymbolId }));
      const gridAfterRefill = grid.map((row) => [...row]);
      for (const rf of refills) gridAfterRefill[rf.cell.ring][rf.cell.spoke] = rf.symbol;
      const tick = [...RING_DIR];
      const after = gridAfterRefill.map((row, r) => row.map((_, s) => row[mod(s - tick[r], SPOKES)]));
      const beat: BeatCascade = { type: 'cascade', removed, refills, gridAfterRefill, tick, grid: after, nextLadderIndex: 1, nextMultiplier: 2 };
      grid = after;
      return view.cascade(beat, { turbo });
    },
    nova(turbo = false) {
      const converted: Cell[] = [];
      for (let ring = 0; ring < 2; ring++) {
        for (let spoke = 0; spoke < SPOKES; spoke++) {
          if (grid[ring][spoke] === SYM.SCATTER) continue;
          converted.push({ ring, spoke });
          grid[ring][spoke] = SYM.WILD;
        }
      }
      view.setNovaCharge(1, { animate: true });
      return view.nova(converted, grid, { turbo }).then(() => view.setNovaCharge(0, { animate: true }));
    },
    /** A drag held at `frac` of a notch. Ring 2 turned +1 would complete four rubies on spoke 2. */
    nudge(ring = 2, dir: 1 | -1 = 1, frac = 0.7) {
      grid[0][2] = grid[1][2] = grid[3][2] = SYM.RUBY;
      grid[2][2] = SYM.EMERALD;
      grid[2][mod(2 - dir, SPOKES)] = SYM.RUBY;
      view.setGrid(grid);
      view.setNudgeActive(true);
      view.setRingOffset(ring, dir * frac * STEP_ANGLE);
      view.previewLines([{ spoke: 2, count: 4, symbol: SYM.RUBY }]);
      return Promise.resolve();
    },
    release(ring = 2, dir: 0 | 1 | -1 = 1) {
      view.previewLines(null);
      turned(ring, dir);
      return view.releaseRing(ring, dir).then(() => view.setNudgeActive(false));
    },
    auto(ring = 2, dir: 1 | -1 = 1) {
      turned(ring, dir);
      return view.applyNudge({ ring, dir });
    },
    free(on = true) {
      free = on;
      return view.setMode(on ? 'free' : 'base', { animate: true });
    },
    bigWin(t: 1 | 2 | 3 | null = 3) {
      view.bigWin(t);
      return Promise.resolve();
    },
    hint(ring = 1, dir: 0 | 1 | -1 = 1) {
      view.setHint(dir ? { ring, dir } : null);
    },
    scatters() {
      for (let r = 0; r < 3; r++) grid[r][r * 3] = SYM.SCATTER;
      view.setGrid(grid);
      return view.celebrateScatters(cellsOf(grid, SYM.SCATTER));
    },
    attract: (on = true) => view.attract(on),
    intro: () => view.intro(),
  };

  addEventListener('keydown', (e) => {
    if (e.key === 's') void demo.spin();
    else if (e.key === 't') void demo.spin(true);
    else if (e.key === 'a') void demo.spin(false, [false, false, true, true]);
    else if (e.key === 'w') void demo.wins();
    else if (e.key === 'c') void demo.cascade();
    else if (e.key === 'n') void demo.nova();
    else if (e.key === 'f') void demo.free(!free);
    else if (e.key === 'b') {
      tier = (tier + 1) % 4;
      void demo.bigWin(tier ? (tier as 1 | 2 | 3) : null);
    } else if (e.key === 'h') demo.hint(1, 1);
  });

  // Drag a ring: 1:1 up to a notch, commit past half a notch.
  let drag: { ring: number; a0: number; travel: number } | null = null;
  view.canvas.addEventListener('pointerdown', (e) => {
    const p = view.pickRing(e.clientX, e.clientY);
    if (!p) return;
    drag = { ring: p.ring, a0: p.angle, travel: 0 };
    view.setNudgeActive(true);
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = view.pickRing(e.clientX, e.clientY);
    if (!p) return;
    const d = mod(p.angle - drag.a0 + Math.PI, Math.PI * 2) - Math.PI;
    drag.travel = Math.max(-STEP_ANGLE * 1.15, Math.min(STEP_ANGLE * 1.15, d));
    view.setRingOffset(drag.ring, drag.travel);
  });
  addEventListener('pointerup', () => {
    if (!drag) return;
    const dir = Math.abs(drag.travel) > STEP_ANGLE / 2 ? (drag.travel > 0 ? 1 : -1) : 0;
    void view.releaseRing(drag.ring, dir).then(() => view.setNudgeActive(false));
    drag = null;
  });

  loop.onUpdate((dt) => view.update(dt));
  loop.onRender(() => view.render());
  loop.start();

  debug.view = view;
  debug.demo = demo;
  debug.cues = cues;
  debug.info = () => view.stats();
  (window as unknown as { __SN_READY: boolean }).__SN_READY = true;
})();
