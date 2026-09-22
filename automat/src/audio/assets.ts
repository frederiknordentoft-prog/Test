// Asset registry + offline renderer: every SFX one-shot and every music stem is rendered once through its
// own short OfflineAudioContext (runs on the audio render thread; the main thread only builds the graph),
// then post-processed (DC removal, normalisation, trimming or loop folding).
//
// Render-rate policy (memory): stems declare a divisor hint (`div`, bandwidth) and a floor (`minRate`);
// normal devices render them at hw/div, "lite" devices (≤ 2 GB, and all iOS — Safari has no
// deviceMemory) double the divisor, never below the floor. Stems keep hw/{1,2,4} so they share the bar
// grid. Unhinted one-shots render at hw normally and at `liteRate` (32 kHz) on lite devices. All noise
// is level-matched across rates (dsp.noiseScale). dev/audio-check.mjs audits every reduced asset against
// its full-rate render (energy lost above the new Nyquist + level-aware ⅓-octave error).
import { SFX_ASSETS } from './sfx.ts';
import { STEM_BY_ID, STEMS, grid, barFrames, BASE_BPM, STORM_BPM, type StemDef } from './music.ts';
import { finishOneShot, finishLoop } from './dsp.ts';

/** One-shot normalisation peak (−1 dBFS); per-SFX mix levels are applied at play time. */
export const SFX_PEAK = 0.891;

export const isStem = (id: string): boolean => id in STEM_BY_ID;
export const stemDef = (id: string): StemDef | undefined => STEM_BY_ID[id];
export const allAssetIds = (): string[] => [...Object.keys(SFX_ASSETS), ...STEMS.map((s) => s.id)];

export function stemLoopFrames(def: StemDef, sr: number, div = 1): number {
  return barFrames(def.group === 'base' ? BASE_BPM : STORM_BPM, sr, div) * def.bars;
}

/**
 * Render rate for asset `id` on hardware rate `hw` (lite = low-memory device). Stems use a divisor of
 * hw (1, 2, 4) so every stem shares the bar grid; unhinted one-shots have no grid and on lite devices
 * render at `liteRate` (default 32 kHz). `div` = hw / sr (only meaningful for stems).
 */
export function assetRate(id: string, hw: number, lite = false): { sr: number; div: number } {
  const stem = STEM_BY_ID[id], sfx = SFX_ASSETS[id];
  if (sfx && !sfx.div) {
    const sr = lite ? Math.min(hw, sfx.liteRate ?? 32000) : hw;
    return { sr, div: hw / sr };
  }
  const hint = (stem?.div ?? sfx?.div ?? 1) as number;
  const floor = stem ? (stem.minRate ?? 11000) : sfx?.div ? (sfx.minRate ?? 11000) : Infinity;
  const want = Math.min(4, hint * (lite ? 2 : 1));
  for (const d of [4, 2] as const) if (want >= d && hw / d >= floor) return { sr: hw / d, div: d };
  return { sr: hw, div: 1 };
}

/** Main-thread cost per asset (ms): graph build, offline render wall time, post-processing. */
export const RENDER_STATS = new Map<string, { build: number; render: number; post: number }>();
const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Render one asset for hardware rate `hw` (see the rate policy above; `div` forces a divisor for QA).
 * Falls back to full rate if the platform rejects the lower rate. Throws only if the platform lacks
 * OfflineAudioContext.
 */
export async function renderAsset(id: string, hw: number, opts: { lite?: boolean; div?: number } = {}): Promise<AudioBuffer> {
  const div = opts.div ?? assetRate(id, hw, !!opts.lite).div;
  try {
    return await renderAt(id, hw / div, div);
  } catch (e) {
    if (div === 1) throw e;
    return renderAt(id, hw, 1); // platform rejected the lower rate
  }
}

async function renderAt(id: string, sr: number, div: number): Promise<AudioBuffer> {
  const stem = STEM_BY_ID[id];
  const a = SFX_ASSETS[id];
  if (!stem && !a) throw new Error('unknown audio asset ' + id);
  const t0 = clock();
  let ctx: OfflineAudioContext;
  if (stem) {
    const g = grid(stem.group === 'base' ? BASE_BPM : STORM_BPM, sr, stem.bars, stem.tail, div);
    ctx = new OfflineAudioContext(stem.ch, Math.ceil(g.end * sr), sr);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    await stem.build(ctx, out, g);
  } else {
    ctx = new OfflineAudioContext(a.ch, Math.ceil(a.dur * sr), sr);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    a.build(ctx, out);
  }
  const t1 = clock();
  const raw = await ctx.startRendering();
  const t2 = clock();
  const res = stem ? await finishLoop(raw, stemLoopFrames(stem, sr, div), stem.rmsDb) : finishOneShot(raw, SFX_PEAK);
  RENDER_STATS.set(id, { build: t1 - t0, render: t2 - t1, post: clock() - t2 });
  return res;
}

/** Storm assets that must exist before the cinematic can play (prepareStorm() resolves on these). */
export const STORM_CORE = ['storm0', 'stormSwell', 'stormRiser', 'impact', 'drop808', 'glassXL', 'reform', 'letterSlam0', 'letterSlam1'];
/** Storm assets needed later in the feature (layers from ×8, waves, stinger, summary, outro). */
export const STORM_EXTRA = ['storm1', 'waveBoom', 'stormWin', 'summary', 'fade', 'storm2', 'storm3'];
const STORM_SET = new Set([...STORM_CORE, ...STORM_EXTRA]);
/** Storm-only assets are rendered lazily (prepareStorm) and can be freed again (releaseStorm). */
export const isStormAsset = (id: string): boolean => STORM_SET.has(id);

/**
 * Base render order after unlock: the very first sounds (land arpeggio at grid assembly, UI), the base
 * bed, everything a base spin can trigger, the remaining base layers, then the big-win stingers.
 * Storm assets are NOT here (see STORM_CORE / STORM_EXTRA). Callers can bump any id.
 */
export const RENDER_ORDER: string[] = [
  'land74a', 'land79a', 'land84a', 'land69a', 'land89a', 'land94a', 'tap', 'spin0',
  'base0',
  'land74b', 'land79b', 'land84b', 'land69b', 'land89b', 'land94b', 'spin1', 'spin2',
  'returnTick0', 'returnTick1', 'chime74', 'chime81', 'chime86', 'chime93', 'shatter0', 'shatter1', 'shatter2',
  'nettoCross', 'markUp', 'mote0', 'mote1', 'sun1', 'sun2', 'sun3', 'anticipation', 'countTick', 'win1a', 'win1b', 'win2',
  'stakeUp', 'stakeDown', 'levelUp62', 'levelUp74',
  'base1', 'base2', 'base3', 'base4',
  'bigWin3', 'bigWin4', 'bigWin5',
];
/** Every base (non-storm) asset, in render order. */
export const baseAssetIds = (): string[] => RENDER_ORDER.concat(allAssetIds().filter((id) => !RENDER_ORDER.includes(id) && !isStormAsset(id)));
