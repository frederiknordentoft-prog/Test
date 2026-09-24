// Procedurale lydeffekter i sfxr-stil (WebAudio). Ingen lydfiler.
// Brug: spil('klik' | 'boble' | 'kasse' | 'fanfareTick' | 'fanfareSlut' | 'fejl' | 'niveauOp').
// AudioContext låses op ved første tryk/tast (iOS kræver en brugerhandling). settings.lyd respekteres.
import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import type { Signal } from '../sim/types';

export type SfxNavn = 'klik' | 'boble' | 'kasse' | 'fanfareTick' | 'fanfareSlut' | 'fejl' | 'niveauOp';

type Ctx = { ac: AudioContext; master: GainNode; stoej: AudioBuffer };
let ctx: Ctx | null = null;
let unlockInstalleret = false;

function lavKontekst(): Ctx | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
    // Hvid støj (0,5 s) genbruges til støjbaserede effekter
    const stoej = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const d = stoej.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx = { ac, master, stoej };
    return ctx;
  } catch {
    return null;
  }
}

/** Lås lyden op ved første brugerhandling (kaldes én gang fra App). */
export function installerLydUnlock(): void {
  if (unlockInstalleret || typeof window === 'undefined') return;
  unlockInstalleret = true;
  const unlock = () => {
    const c = lavKontekst();
    if (c) {
      if (c.ac.state === 'suspended') void c.ac.resume();
      // En stille buffer "vækker" iOS
      try {
        const src = c.ac.createBufferSource();
        src.buffer = c.ac.createBuffer(1, 1, 22050);
        src.connect(c.master);
        src.start(0);
      } catch {
        /* ignorer */
      }
    }
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

type ToneOpts = {
  type?: OscillatorType;
  fra: number; // Hz
  til?: number; // Hz (glid)
  varighed: number; // sek.
  vol?: number;
  start?: number; // forsinkelse i sek.
  vibrato?: number; // Hz
};

function tone(c: Ctx, o: ToneOpts): void {
  const t0 = c.ac.currentTime + (o.start ?? 0);
  const osc = c.ac.createOscillator();
  const g = c.ac.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.fra, t0);
  if (o.til && o.til !== o.fra) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.til), t0 + o.varighed);
  if (o.vibrato) {
    const lfo = c.ac.createOscillator();
    const lg = c.ac.createGain();
    lfo.frequency.value = o.vibrato;
    lg.gain.value = o.fra * 0.02;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + o.varighed + 0.05);
  }
  const vol = o.vol ?? 0.06;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.setValueAtTime(vol, t0 + o.varighed * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.varighed);
  osc.connect(g).connect(c.master);
  osc.start(t0);
  osc.stop(t0 + o.varighed + 0.02);
}

function stoej(c: Ctx, varighed: number, vol: number, filter: number, start = 0): void {
  const t0 = c.ac.currentTime + start;
  const src = c.ac.createBufferSource();
  src.buffer = c.stoej;
  const f = c.ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filter;
  f.Q.value = 1.2;
  const g = c.ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + varighed);
  src.connect(f).connect(g).connect(c.master);
  src.start(t0);
  src.stop(t0 + varighed + 0.02);
}

const SPIL: Record<SfxNavn, (c: Ctx, variant: number) => void> = {
  klik: (c) => tone(c, { type: 'square', fra: 1400, til: 900, varighed: 0.035, vol: 0.035 }),
  boble: (c, v) => {
    const f = 520 * (1 + ((v % 5) - 2) * 0.06);
    tone(c, { type: 'triangle', fra: f, til: f * 1.9, varighed: 0.08, vol: 0.05 });
  },
  kasse: (c) => {
    tone(c, { type: 'square', fra: 988, varighed: 0.07, vol: 0.045 });
    tone(c, { type: 'square', fra: 1319, varighed: 0.22, vol: 0.045, start: 0.07 });
    stoej(c, 0.12, 0.02, 6000, 0.07);
  },
  fanfareTick: (c, v) => {
    const f = 660 * Math.pow(2, Math.min(12, v) / 12);
    tone(c, { type: 'square', fra: f, varighed: 0.045, vol: 0.04 });
  },
  fanfareSlut: (c) => {
    const noder = [523.25, 659.25, 783.99, 1046.5];
    noder.forEach((f, i) => tone(c, { type: 'square', fra: f, varighed: 0.1, vol: 0.045, start: i * 0.085 }));
    tone(c, { type: 'square', fra: 1046.5, varighed: 0.42, vol: 0.05, start: 0.36, vibrato: 7 });
    tone(c, { type: 'triangle', fra: 523.25, varighed: 0.45, vol: 0.06, start: 0.36 });
  },
  fejl: (c) => {
    tone(c, { type: 'square', fra: 220, til: 150, varighed: 0.11, vol: 0.05 });
    tone(c, { type: 'square', fra: 185, til: 110, varighed: 0.16, vol: 0.05, start: 0.1 });
  },
  niveauOp: (c) => {
    const noder = [440, 554.37, 659.25, 880, 1108.73];
    noder.forEach((f, i) => tone(c, { type: 'triangle', fra: f, varighed: 0.09, vol: 0.06, start: i * 0.055 }));
    tone(c, { type: 'square', fra: 1760, varighed: 0.12, vol: 0.02, start: 0.3 });
  },
};

/** Afspil en effekt. `variant` bruges til tonehøjde (fx fanfare-tælleren). */
export function spil(navn: SfxNavn, variant = 0): void {
  if (!useGame.getState().settings.lyd) return;
  const c = ctx; // oprettes først ved første brugerhandling (se installerLydUnlock)
  if (!c) return;
  if (c.ac.state !== 'running') {
    void c.ac.resume();
    return;
  }
  try {
    SPIL[navn](c, variant);
  } catch {
    /* lyd må aldrig vælte spillet */
  }
}

let sidsteBoble = 0;
let bobleTaeller = 0;

/** Lydeffekter for signaler fra seneste step/handling. */
export function spilForSignaler(sig: readonly Signal[]): void {
  let fejl = false;
  let kasse = false;
  let niveau = false;
  let boble = false;
  for (const s of sig) {
    if (s.k === 'point') boble = true;
    else if (s.k === 'kontraktFaerdig') kasse = true;
    else if (s.k === 'niveauOp' || s.k === 'typeNiveau' || s.k === 'temaNiveau') niveau = true;
    else if (s.k === 'fejl') fejl = true;
  }
  if (fejl) spil('fejl');
  if (kasse) spil('kasse');
  if (niveau) spil('niveauOp');
  if (boble && !kasse && !niveau) {
    const nu = performance.now();
    if (nu - sidsteBoble >= 250) {
      sidsteBoble = nu;
      spil('boble', bobleTaeller++);
    }
  }
}

/** Monteres i GameScreen: afspiller lyde for sidsteSignaler. */
export function useSignalSfx(): void {
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.sidsteSignaler !== prev.sidsteSignaler && s.sidsteSignaler.length > 0) spilForSignaler(s.sidsteSignaler);
      }),
    [],
  );
}
