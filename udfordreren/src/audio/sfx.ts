// Procedurale lydeffekter i sfxr-stil (WebAudio). Ingen lydfiler.
// Brug: spil('klik' | 'boble' | 'kasse' | 'fanfareTick' | 'fanfareSlut' | 'fejl' | 'niveauOp' | 'lancering' | 'guldkupon'
//            | 'dunk' | 'aktSkift' | 'besked' | 'ding').
// AudioContext låses op ved første tryk/tast (iOS kræver en brugerhandling). settings.lyd og settings.lydVolumen
// respekteres. Musikken (music.ts) deler samme AudioContext via lydKontekst().
import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import type { Signal } from '../sim/types';
import { kanalVolumen, volumenTilGain } from './volumen';

export type SfxNavn =
  | 'klik'
  | 'boble'
  | 'kasse'
  | 'fanfareTick'
  | 'fanfareSlut'
  | 'fejl'
  | 'niveauOp'
  | 'lancering'
  | 'guldkupon'
  | 'dunk'
  | 'aktSkift'
  | 'besked'
  | 'ding';

type Ctx = { ac: AudioContext; master: GainNode; stoej: AudioBuffer; vol: number };
let ctx: Ctx | null = null;
let unlockInstalleret = false;
/** Effekternes niveau ved fuld skyder */
const SFX_BASIS = 0.9;

function sfxGain(): number {
  const st = useGame.getState().settings;
  return volumenTilGain(kanalVolumen(st.lydVolumen, 'lyd'));
}

function lavKontekst(): Ctx | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const master = ac.createGain();
    const vol = sfxGain();
    master.gain.value = SFX_BASIS * vol;
    master.connect(ac.destination);
    // Hvid støj (0,5 s) genbruges til støjbaserede effekter (kosmetisk tilfældighed — ikke sim-kernen)
    const stoej = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const d = stoej.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx = { ac, master, stoej, vol };
    return ctx;
  } catch {
    return null;
  }
}

/** Den fælles AudioContext (null før første brugerhandling, eller hvis browseren ikke har WebAudio) */
export function lydKontekst(): AudioContext | null {
  return ctx?.ac ?? null;
}

const UNLOCK_HAENDELSER = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

/**
 * Lås lyden op ved første brugerhandling (kaldes én gang fra App). På iOS tæller kun visse hændelser som en
 * brugerhandling (touchend, click, keydown), så der lyttes, indtil konteksten faktisk kører.
 */
export function installerLydUnlock(): void {
  if (unlockInstalleret || typeof window === 'undefined') return;
  unlockInstalleret = true;
  const opt: AddEventListenerOptions = { capture: true, passive: true };
  const fjern = () => {
    for (const k of UNLOCK_HAENDELSER) window.removeEventListener(k, unlock, opt);
  };
  function unlock(): void {
    const c = lavKontekst();
    if (!c) {
      fjern(); // ingen WebAudio: så er der intet at låse op
      return;
    }
    if (c.ac.state === 'running') {
      fjern();
      return;
    }
    try {
      void c.ac
        .resume()
        .then(() => {
          if (c.ac.state === 'running') fjern();
        })
        .catch(() => undefined);
      // En stille buffer "vækker" iOS
      const src = c.ac.createBufferSource();
      src.buffer = c.ac.createBuffer(1, 1, 22050);
      src.connect(c.master);
      src.start(0);
    } catch {
      /* ignorer */
    }
  }
  for (const k of UNLOCK_HAENDELSER) window.addEventListener(k, unlock, opt);
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

/** Filtreret støj; med `tilFilter` glider filteret (sus op eller ned) */
function stoej(c: Ctx, varighed: number, vol: number, filter: number, start = 0, tilFilter?: number): void {
  const t0 = c.ac.currentTime + start;
  const src = c.ac.createBufferSource();
  src.buffer = c.stoej;
  src.loop = varighed > 0.45;
  const f = c.ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(filter, t0);
  if (tilFilter) f.frequency.exponentialRampToValueAtTime(tilFilter, t0 + varighed);
  f.Q.value = 1.2;
  const g = c.ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + varighed);
  src.connect(f).connect(g).connect(c.master);
  src.start(t0);
  src.stop(t0 + varighed + 0.02);
}

const C_DUR = [523.25, 659.25, 783.99, 1046.5];

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
    C_DUR.forEach((f, i) => tone(c, { type: 'square', fra: f, varighed: 0.1, vol: 0.045, start: i * 0.085 }));
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
  /** Produktet går i luften: et sus op og to klare toner */
  lancering: (c) => {
    stoej(c, 0.34, 0.035, 700, 0, 5200);
    tone(c, { type: 'square', fra: 196, til: 784, varighed: 0.3, vol: 0.028 });
    tone(c, { type: 'square', fra: 783.99, varighed: 0.08, vol: 0.045, start: 0.31 });
    tone(c, { type: 'square', fra: 1174.66, varighed: 0.24, vol: 0.045, start: 0.39, vibrato: 8 });
    tone(c, { type: 'triangle', fra: 392, varighed: 0.3, vol: 0.05, start: 0.39 });
  },
  /** Guldkuponen: glimtende arpeggio med ekko. Variant 1 = Hall of Fame med en ekstra fanfare. */
  guldkupon: (c, v) => {
    const glimt = [1318.51, 1567.98, 1975.53, 2637.02];
    glimt.forEach((f, i) => tone(c, { type: 'square', fra: f, varighed: 0.07, vol: 0.03, start: i * 0.05 }));
    glimt.forEach((f, i) => tone(c, { type: 'triangle', fra: f, varighed: 0.09, vol: 0.035, start: 0.22 + i * 0.05 }));
    tone(c, { type: 'triangle', fra: 1318.51, varighed: 0.6, vol: 0.05, start: 0.45, vibrato: 6 });
    stoej(c, 0.5, 0.01, 9000, 0.05);
    if (v >= 1) {
      C_DUR.forEach((f, i) => tone(c, { type: 'square', fra: f, varighed: 0.14, vol: 0.04, start: 0.75 + i * 0.1 }));
      tone(c, { type: 'square', fra: 1046.5, varighed: 0.55, vol: 0.045, start: 1.15, vibrato: 7 });
      tone(c, { type: 'triangle', fra: 261.63, varighed: 0.6, vol: 0.07, start: 1.15 });
    }
  },
  /** Sanktion: et dumpt dunk og to sure toner (går sammen med skærmrystet) */
  dunk: (c) => {
    tone(c, { type: 'triangle', fra: 150, til: 45, varighed: 0.32, vol: 0.12 });
    stoej(c, 0.25, 0.05, 180);
    tone(c, { type: 'square', fra: 233.08, til: 220, varighed: 0.18, vol: 0.035, start: 0.12 });
    tone(c, { type: 'square', fra: 174.61, til: 164.81, varighed: 0.32, vol: 0.035, start: 0.3 });
  },
  /** Akt to: lyset går ned, og noget nyt gløder op (c-mol) */
  aktSkift: (c) => {
    tone(c, { type: 'square', fra: 1760, til: 110, varighed: 0.5, vol: 0.028 });
    stoej(c, 0.55, 0.025, 5000, 0, 300);
    tone(c, { type: 'triangle', fra: 65.41, varighed: 1, vol: 0.1, start: 0.45 });
    [261.63, 311.13, 392, 587.33].forEach((f, i) => tone(c, { type: 'triangle', fra: f, varighed: 0.95, vol: 0.03, start: 0.5 + i * 0.07, vibrato: 5 }));
  },
  /** Der er nyt: en hændelse, en verdensnyhed eller et tilbud */
  besked: (c) => {
    tone(c, { type: 'triangle', fra: 659.25, varighed: 0.09, vol: 0.06 });
    tone(c, { type: 'triangle', fra: 987.77, varighed: 0.16, vol: 0.06, start: 0.09 });
  },
  /** Lille succes: forskning færdig, licens godkendt, ny agent */
  ding: (c) => {
    tone(c, { type: 'square', fra: 1567.98, varighed: 0.06, vol: 0.03 });
    tone(c, { type: 'triangle', fra: 2093, varighed: 0.35, vol: 0.05, start: 0.05, vibrato: 6 });
  },
};

/** Afspil en effekt. `variant` bruges til tonehøjde (fx fanfare-tælleren). */
export function spil(navn: SfxNavn, variant = 0): void {
  if (!useGame.getState().settings.lyd) return;
  const c = ctx; // oprettes først ved første brugerhandling (se installerLydUnlock)
  if (!c) return;
  if (c.ac.state !== 'running') {
    void c.ac.resume().catch(() => undefined);
    return;
  }
  try {
    const vol = sfxGain();
    if (vol <= 0.0001) return;
    if (vol !== c.vol) {
      c.vol = vol;
      c.master.gain.setTargetAtTime(SFX_BASIS * vol, c.ac.currentTime, 0.01);
    }
    SPIL[navn](c, variant);
  } catch {
    /* lyd må aldrig vælte spillet */
  }
}

let sidsteBoble = 0;
let bobleTaeller = 0;

/** Signaler med egen dialog-lyd (spilles af dialogen, når den vises) — her kun de små "der skete noget"-lyde */
const BESKED_SIGNALER: Signal['k'][] = ['event', 'verdensNyhed', 'tilbud', 'sponsorAuktion', 'regel', 'messeVarsel'];
const DING_SIGNALER: Signal['k'][] = ['forskning', 'licens', 'platform', 'agent'];

/** Lydeffekter for signaler fra seneste step/handling. */
export function spilForSignaler(sig: readonly Signal[]): void {
  let fejl = false;
  let kasse = false;
  let niveau = false;
  let boble = false;
  let lancering = false;
  let ding = false;
  let besked = false;
  for (const s of sig) {
    if (s.k === 'point') boble = true;
    else if (s.k === 'kontraktFaerdig' || s.k === 'opkoeb' || (s.k === 'sponsorResultat' && s.spillerVandt)) kasse = true;
    else if (s.k === 'niveauOp' || s.k === 'typeNiveau' || s.k === 'temaNiveau') niveau = true;
    else if (s.k === 'fejl') fejl = true;
    else if (s.k === 'lanceret') lancering = true;
    else if (BESKED_SIGNALER.includes(s.k)) besked = true;
    else if (DING_SIGNALER.includes(s.k)) {
      if (s.k === 'platform' && !s.faerdig) continue;
      if (s.k === 'agent' && s.handling !== 'ny') continue;
      ding = true;
    }
  }
  if (fejl) spil('fejl');
  if (lancering) spil('lancering');
  if (kasse) spil('kasse');
  if (niveau) spil('niveauOp');
  const stor = fejl || lancering || kasse || niveau;
  if (!stor && ding) spil('ding');
  else if (!stor && besked) spil('besked');
  if (boble && !stor) {
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
