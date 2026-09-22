// Asset registry + offline renderer: every SFX one-shot and every music stem is rendered once through its
// own short OfflineAudioContext (runs on the audio render thread; the main thread only builds the graph),
// then post-processed (DC removal, normalisation, trimming or loop folding).
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

/** Effective divisor for an asset rendered for a context/render rate `full` (never below ~11 kHz). */
export function assetDiv(id: string, full: number): 1 | 2 | 4 {
  const want = (STEM_BY_ID[id]?.div ?? SFX_ASSETS[id]?.div ?? 1) as 1 | 2 | 4;
  for (const d of [4, 2] as const) if (want >= d && full / d >= 11000) return d;
  return 1;
}

/** Main-thread cost per asset (ms): graph build, offline render wall time, post-processing. */
export const RENDER_STATS = new Map<string, { build: number; render: number; post: number }>();
const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Render one asset for a context whose render rate is `full` (bandwidth-limited assets use full/2 or
 * full/4; playback resamples). Falls back to `full` if the platform rejects the lower rate.
 * Throws only if the platform lacks OfflineAudioContext.
 */
export async function renderAsset(id: string, full: number): Promise<AudioBuffer> {
  const div = assetDiv(id, full);
  try {
    return await renderAt(id, full / div, div);
  } catch (e) {
    if (div === 1) throw e;
    return renderAt(id, full, 1);
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
    stem.build(ctx, out, g);
  } else {
    ctx = new OfflineAudioContext(a.ch, Math.ceil(a.dur * sr), sr);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    a.build(ctx, out);
  }
  const t1 = clock();
  const raw = await ctx.startRendering();
  const t2 = clock();
  const res = stem ? finishLoop(raw, stemLoopFrames(stem, sr, div), stem.rmsDb) : finishOneShot(raw, SFX_PEAK);
  RENDER_STATS.set(id, { build: t1 - t0, render: t2 - t1, post: clock() - t2 });
  return res;
}

/**
 * Render order after unlock: the very first sounds (land arpeggio at grid assembly, UI), the base bed,
 * everything a base spin can trigger, then the Solstorm cinematic set + storm core (the demo can reach the
 * storm ~5 s after unlock), then the remaining base layers and storm layers. Callers can bump any id.
 */
export const RENDER_ORDER: string[] = [
  'land74a', 'land79a', 'land84a', 'land69a', 'land89a', 'land94a', 'tap', 'spin0',
  'base0',
  'land74b', 'land79b', 'land84b', 'land69b', 'land89b', 'land94b', 'spin1', 'spin2',
  'returnTick0', 'returnTick1', 'chime74', 'chime81', 'chime86', 'chime93', 'shatter0', 'shatter1', 'shatter2',
  'nettoCross', 'markUp', 'mote0', 'mote1', 'sun1', 'sun2', 'sun3', 'anticipation', 'countTick', 'win1', 'win2',
  'stakeUp', 'stakeDown', 'levelUp62', 'levelUp74',
  'stormSwell', 'stormRiser', 'impact', 'drop808', 'glassXL', 'reform', 'letterSlam0', 'letterSlam1', 'storm0',
  'base1', 'base2', 'base3', 'base4',
  'bigWin3', 'bigWin4', 'bigWin5', 'waveBoom', 'summary', 'fade',
  'storm1', 'storm2', 'storm3',
];
