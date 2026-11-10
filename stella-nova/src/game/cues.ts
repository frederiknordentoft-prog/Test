/**
 * ViewCue → sound and haptics. The view announces what just happened on
 * screen; this is the only place that decides what it sounds and feels like,
 * so picture and sound cannot drift apart.
 */
import { RINGS } from '../core/config';
import type { IAudio, IGameView, ViewCue } from '../core/types';

export interface CueContext {
  audio: IAudio;
  view: IGameView;
  /** Canvas width in CSS px, for stereo placement. */
  width(): number;
  haptics(): boolean;
}

function vibrate(ctx: CueContext, pattern: number | number[]): void {
  if (!ctx.haptics()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety; some frames forbid it.
  }
}

function panAt(ctx: CueContext, x: number): number {
  const w = Math.max(1, ctx.width());
  return Math.max(-0.8, Math.min(0.8, ((x / w) * 2 - 1) * 0.8));
}

export function playCue(cue: ViewCue, ctx: CueContext): void {
  const { audio, view } = ctx;
  switch (cue.type) {
    case 'whirlStart':
      audio.sfx('spinStart');
      audio.whirl(true, 1);
      break;
    case 'ringNotch':
      audio.sfx('ringNotch', { index: cue.ring, gain: Math.min(1, 0.35 + cue.speed * 0.65) });
      break;
    case 'ringStop':
      audio.sfx('ringStop', { index: cue.ring });
      if (cue.isLast) audio.whirl(false);
      else audio.whirl(true, (RINGS - 1 - cue.ring) / RINGS);
      vibrate(ctx, 8);
      break;
    case 'anticipation':
      audio.tension(cue.on);
      audio.music(cue.on ? 'tension' : 'spin');
      break;
    case 'scatterLand':
      audio.sfx('scatterLand', { index: cue.countSoFar - 1, pan: panAt(ctx, view.cellScreen(cue.cell).x) });
      vibrate(ctx, 12);
      break;
    case 'beamFire':
      audio.sfx('beamFire', { index: cue.index, tier: cue.count === 4 ? 2 : 1, symbol: cue.symbol, pan: panAt(ctx, view.spokeTipScreen(cue.spoke).x) });
      break;
    case 'gemBurst':
      audio.sfx('gemBurst', { index: cue.index, symbol: cue.symbol, pan: panAt(ctx, view.cellScreen(cue.cell).x) });
      break;
    case 'stardustArrive':
      audio.sfx('stardust');
      break;
    case 'refillLand':
      audio.sfx('refillLand', { index: cue.index, symbol: cue.symbol, pan: panAt(ctx, view.cellScreen(cue.cell).x) });
      break;
    case 'tick':
      audio.sfx('tick');
      vibrate(ctx, 14);
      break;
    case 'nudgeDetent':
      audio.sfx('nudgeDetent', { index: cue.ring });
      vibrate(ctx, 6);
      break;
    case 'nudgeCommit':
      audio.sfx('nudgeCommit', { index: cue.ring });
      vibrate(ctx, 12);
      break;
    case 'nudgeCancel':
      audio.sfx('nudgeCancel');
      break;
    case 'novaCharge':
      audio.sfx('novaSwell');
      break;
    case 'novaFlash':
      audio.sfx('novaFlash');
      vibrate(ctx, [30, 40, 90]);
      break;
    case 'novaShockwave':
      audio.sfx('novaShockwave');
      break;
    case 'wildTransform':
      audio.sfx('wildTransform', { index: cue.index, pan: panAt(ctx, view.cellScreen(cue.cell).x) });
      break;
    case 'cometPass':
      audio.sfx('cometPass');
      break;
    case 'modeShift':
      break;
  }
}
