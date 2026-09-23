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
import { POLAR_ID, POLAR_DIV, POLAR_MIN_RATE, decodePolar } from './polar.ts';

/** One-shot normalisation peak (−1 dBFS); per-SFX mix levels are applied at play time. */
export const SFX_PEAK = 0.891;

export const isStem = (id: string): boolean => id in STEM_BY_ID;
export const stemDef = (id: string): StemDef | undefined => STEM_BY_ID[id];
export const allAssetIds = (): string[] => [...Object.keys(SFX_ASSETS), ...STEMS.map((s) => s.id), POLAR_ID];

export function stemLoopFrames(def: StemDef, sr: number, div = 1): number {
  return barFrames(def.group === 'base' ? BASE_BPM : STORM_BPM, sr, div) * def.bars;
}

/**
 * Render rate for asset `id` on hardware rate `hw` (lite = low-memory device). Stems use a divisor of
 * hw (1, 2, 4) so every stem shares the bar grid; unhinted one-shots have no grid and on lite devices
 * render at `liteRate` (default 32 kHz). `div` = hw / sr (only meaningful for stems).
 */
export function assetRate(id: string, hw: number, lite = false): { sr: number; div: number } {
  const stem = STEM_BY_ID[id], sfx = SFX_ASSETS[id], polar = id === POLAR_ID;
  if (sfx && !sfx.div) {
    const sr = lite ? Math.min(hw, sfx.liteRate ?? 32000) : hw;
    return { sr, div: hw / sr };
  }
  const hint = (polar ? POLAR_DIV : stem?.div ?? sfx?.div ?? 1) as number;
  const floor = polar ? POLAR_MIN_RATE : stem ? (stem.minRate ?? 11000) : sfx?.div ? (sfx.minRate ?? 11000) : Infinity;
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
  const t0 = clock();
  if (id === POLAR_ID) { // recorded bed: decode + fold (no offline render)
    const b = await decodePolar(sr * div, div);
    RENDER_STATS.set(id, { build: 0, render: clock() - t0, post: 0 });
    return b;
  }
  if (!stem && !a) throw new Error('unknown audio asset ' + id);
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

/** The gate ceremony's own sounds: rendered lazily (prepareGate), freed again (releaseGate). */
export const GATE_SET = ['gateDrone', 'tileShimmer', 'keystone', 'sealCrack', 'gateBreath', 'lightPad'];
export const isGateAsset = (id: string): boolean => GATE_SET.includes(id);

/**
 * Base layer assets (L0–L4) per bed: under the Polar Night recording the bells, bass and ostinato follow
 * its chords (base1p/base2p/base4p, music.ts); under the procedural pad they keep its cycle.
 */
export const baseLayerIds = (bed: string): string[] =>
  (bed === POLAR_ID ? [POLAR_ID, 'base1p', 'base2p', 'base3', 'base4p'] : ['base0', 'base1', 'base2', 'base3', 'base4']);
/** Assets that depend on the chosen bed (the engine frees the ones neither the bed nor the running music uses). */
export const BED_ASSETS: ReadonlySet<string> = new Set(['base0', 'base1', 'base2', 'base4', POLAR_ID, 'base1p', 'base2p', 'base4p']);

/**
 * Base render order after unlock: the very first sounds (land arpeggio at grid assembly, UI), the base
 * bed (procedural base0, then the Polar Night recording — its decode runs alongside the queue, see
 * GameAudio.pump), everything a base spin can trigger, the remaining base layers, the big-win stingers,
 * then the dice sounds (small; any spin or card can need them). Listed with the procedural layers;
 * baseAssetIds('polar') swaps in the bed's own. Storm and gate assets are NOT here (see STORM_CORE /
 * STORM_EXTRA / GATE_SET). Callers can bump any id.
 */
export const RENDER_ORDER: string[] = [
  'land74a', 'land79a', 'land84a', 'land69a', 'land89a', 'land94a', 'tap', 'spin0',
  'base0', POLAR_ID,
  'land74b', 'land79b', 'land84b', 'land69b', 'land89b', 'land94b', 'spin1', 'spin2',
  'returnTick0', 'returnTick1', 'chime74', 'chime81', 'chime86', 'chime93', 'shatter0', 'shatter1', 'shatter2',
  'nettoCross', 'markUp', 'mote0', 'mote1', 'sun1', 'sun2', 'sun3', 'anticipation', 'countTick', 'win1a', 'win1b', 'win2',
  'stakeUp', 'stakeDown', 'levelUp62', 'levelUp74',
  'base1', 'base2', 'base3', 'base4',
  'bigWin3', 'bigWin4', 'bigWin5',
  'dieLand', 'dieBirth', 'dieQuench', 'dieHold', 'bell1948a', 'bell1948b', 'diePulse',
];
/**
 * Every base (non-storm, non-gate) asset for bed source `src`, in render order: 'polar' renders the
 * recording and the layers that follow it (base0 stays as the fallback until the recording is decoded),
 * 'code' the procedural layers only.
 */
export function baseAssetIds(src: 'polar' | 'code' = 'polar'): string[] {
  const mine = baseLayerIds(src === 'polar' ? POLAR_ID : 'base0'), code = baseLayerIds('base0');
  const order = RENDER_ORDER.map((id) => (id === POLAR_ID || id === 'base0' ? id : mine[code.indexOf(id)] ?? id)).filter((id) => src === 'polar' || id !== POLAR_ID);
  return order.concat(allAssetIds().filter((id) => !order.includes(id) && !isStormAsset(id) && !isGateAsset(id) && !BED_ASSETS.has(id)));
}
