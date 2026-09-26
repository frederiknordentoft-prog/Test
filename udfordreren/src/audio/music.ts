// Chiptune-musik med Tone.js (spec 6.19): ét tema pr. akt, blød crossfade ved akt-skift og en jingle på titelskærmen.
// Tone indlæses LAZY (dynamic import) først, når musikken er slået til, og brugeren har trykket eller tastet — så
// hovedbundtet ikke vokser, og iOS får sin lyd-unlock. Musikken deler AudioContext med lydeffekterne (sfx.ts), når
// den findes. Stopper, når fanen skjules, og fortsætter, når den vises igen. Lyd må aldrig vælte spillet: alt er
// pakket i try/catch, og uden AudioContext sker der ingenting.
import { useEffect } from 'react';
import type * as ToneNS from 'tone';
import { useGame } from '../store/gameStore';
import { aktFor } from '../render/actChrome';
import { AKT_TEMA, TEMAER, TROMME, planlaeg, temaLaengdeSek, type Klang, type Plan, type PlanEvent, type Rolle, type Stemme, type TemaId } from './moenstre';
import { lydKontekst } from './sfx';
import { kanalVolumen, volumenTilGain } from './volumen';

type Tone = typeof ToneNS;
type Rydbar = { dispose(): unknown };
type Instans = { id: TemaId; bus: ToneNS.Gain; dele: ToneNS.Part[]; noder: Rydbar[]; slutId: number | null; udtonet: boolean };

export type MusikTilstand = 'slukket' | 'venter' | 'indlaeser' | 'spiller' | 'pause' | 'ingenLyd' | 'fejl';
export type MusikStatus = {
  tilstand: MusikTilstand;
  /** Temaet, spillet beder om lige nu (titel på titelskærmen, ellers aktens tema) */
  oensket: TemaId | null;
  /** Temaet, der sidst blev skiftet til */
  spiller: TemaId | null;
  /** Temaer med lyd i højttalerne lige nu (inkl. jingles og temaer, der er ved at blive tonet ind) */
  aktive: TemaId[];
  toneIndlaest: boolean;
  kontekst: string;
  deltKontekst: boolean;
  volumen: number;
  historik: { tema: TemaId | null; ms: number }[];
};

/** Crossfade mellem to temaer (sek.) */
const FADE = 1.6;
/** Musikkens samlede niveau ved fuld skyder — lavt, så effekterne altid kan høres */
const MUSIK_BASIS = 0.7;
/** Akt-skiftet: jinglen starter efter lydeffekten, og AI-temaet tones ind under jinglens sidste takter */
const AKT_JINGLE_FORSINKELSE = 0.7;
const AKT_OVERLAP = 3.4;

const STANDARD_KLANG: Record<Rolle, Klang> = {
  melodi: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.08 },
  arp: { attack: 0.002, decay: 0.08, sustain: 0.25, release: 0.05 },
  akkord: { attack: 0.004, decay: 0.1, sustain: 0.35, release: 0.08 },
  pad: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.2 },
  bas: { attack: 0.004, decay: 0.1, sustain: 0.8, release: 0.05 },
  trommer: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
};

const S = {
  til: false,
  oensket: null as TemaId | null,
  volumen: 0.5,
  interageret: false,
  tilstand: 'slukket' as MusikTilstand,
  spiller: null as TemaId | null,
  aktive: [] as Instans[],
  historik: [] as { tema: TemaId | null; ms: number }[],
  delt: false,
};
let T: Tone | null = null;
let master: ToneNS.Gain | null = null;
let maaler: ToneNS.Meter | null = null;
let indlaesning: Promise<void> | null = null;
let indlaesFejl = false;
const planer = new Map<TemaId, Plan>();

const debug = (() => {
  try {
    return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
})();

function harAudio(): boolean {
  return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
}

function skjult(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

async function indlaesTone(): Promise<void> {
  try {
    (window as unknown as { TONE_SILENCE_LOGGING?: boolean }).TONE_SILENCE_LOGGING = true;
    const mod = await import('tone');
    // Del AudioContext med lydeffekterne: den er allerede låst op af første tryk (vigtigt på iOS)
    const ac = lydKontekst();
    if (ac) {
      try {
        mod.setContext(ac, true);
        S.delt = true;
      } catch {
        S.delt = false;
      }
    }
    const m = new mod.Gain(0);
    const glat = new mod.Filter({ frequency: 9000, type: 'lowpass' });
    m.chain(glat, mod.getDestination());
    if (debug) {
      maaler = new mod.Meter({ normalRange: true, smoothing: 0.5 });
      m.connect(maaler);
    }
    master = m;
    T = mod;
    if (mod.getContext().state !== 'running') void mod.start().catch(() => undefined);
  } catch (e) {
    indlaesFejl = true;
    console.warn('Musikken kunne ikke starte:', e);
  }
}

function plan(id: TemaId): Plan {
  let p = planer.get(id);
  if (!p) {
    p = planlaeg(TEMAER[id]);
    planer.set(id, p);
  }
  return p;
}

function oscillator(s: Stemme): { type: 'pulse'; width: number } | { type: 'square' | 'triangle' } {
  if (s.boelge === 'pulse') return { type: 'pulse', width: s.puls ?? 0.25 };
  return { type: s.boelge === 'triangle' ? 'triangle' : 'square' };
}

/** Byg en stemmes lydkæde og returnér funktionen, der spiller én node */
function lavStemme(t: Tone, s: Stemme, ud: ToneNS.ToneAudioNode, noder: Rydbar[]): (tid: number, e: PlanEvent) => void {
  let maal: ToneNS.ToneAudioNode = ud;
  if (s.lavpas) {
    const f = new t.Filter({ frequency: s.lavpas, type: 'lowpass', Q: 0.7 });
    f.connect(ud);
    noder.push(f);
    maal = f;
  }
  const env = s.klang ?? STANDARD_KLANG[s.rolle];
  if (s.rolle === 'trommer') {
    const kick = new t.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 5,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.05 },
      volume: s.vol + 5,
    });
    const snare = new t.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.04 }, volume: s.vol });
    const hat = new t.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 }, volume: s.vol - 3 });
    const aaben = new t.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.06 }, volume: s.vol - 6 });
    const snareF = new t.Filter({ frequency: 1900, type: 'bandpass', Q: 0.8 });
    const hatF = new t.Filter({ frequency: 7000, type: 'highpass' });
    kick.connect(maal);
    snare.chain(snareF, maal);
    hat.connect(hatF);
    aaben.connect(hatF);
    hatF.connect(maal);
    noder.push(kick, snare, hat, aaben, snareF, hatF);
    return (tid, e) => {
      const m = e.midi[0];
      if (m === TROMME.k) kick.triggerAttackRelease(52, 0.1, tid, e.styrke);
      else if (m === TROMME.s) snare.triggerAttackRelease(0.1, tid, e.styrke);
      else if (m === TROMME.h) hat.triggerAttackRelease(0.03, tid, e.styrke);
      else aaben.triggerAttackRelease(0.16, tid, e.styrke);
    };
  }
  if (s.rolle === 'pad') {
    const p = new t.PolySynth(t.Synth, { oscillator: oscillator(s), envelope: env, volume: s.vol });
    p.maxPolyphony = 12;
    p.connect(maal);
    noder.push(p);
    return (tid, e) => p.triggerAttackRelease(e.hz, e.varighed, tid, e.styrke);
  }
  const syn = new t.Synth({ oscillator: oscillator(s), envelope: env, volume: s.vol });
  syn.connect(maal);
  noder.push(syn);
  return (tid, e) => syn.triggerAttackRelease(e.hz[0], e.varighed, tid, e.styrke);
}

/** Start et tema (eller en jingle) om `forsinkelse` sek. og ton det ind over `fadeInd` sek. */
function startTema(id: TemaId, forsinkelse: number, fadeInd: number): void {
  const t = T;
  if (!t || !master) return;
  const tema = TEMAER[id];
  const p = plan(id);
  const noder: Rydbar[] = [];
  const bus = new t.Gain(0);
  const kaede: ToneNS.ToneAudioNode[] = [];
  if (tema.effekt?.lavpas) kaede.push(new t.Filter({ frequency: tema.effekt.lavpas, type: 'lowpass', Q: 0.5 }));
  if (tema.effekt?.ekko) {
    const e = tema.effekt.ekko;
    kaede.push(new t.FeedbackDelay({ delayTime: e.tid16 * p.sek16, feedback: e.feedback, wet: e.vaad }));
  }
  bus.chain(...kaede, master);
  noder.push(...kaede);
  const tr = t.getTransport();
  const t0 = tr.seconds + forsinkelse;
  const nu = t.now();
  bus.gain.setValueAtTime(0, nu + forsinkelse);
  if (fadeInd > 0.05) bus.gain.linearRampToValueAtTime(1, nu + forsinkelse + fadeInd);
  else bus.gain.setValueAtTime(1, nu + forsinkelse);
  const dele: ToneNS.Part[] = tema.stemmer.map((s, i) => {
    const spil = lavStemme(t, s, bus, noder);
    const events = (p.stemmer[i]?.events ?? []).map((e) => ({ ...e, time: e.tid }));
    const del = new t.Part<PlanEvent & { time: number }>((tid, e) => {
      try {
        spil(tid, e);
      } catch {
        /* en tabt node er bedre end et væltet spil */
      }
    }, events);
    if (tema.loop) {
      del.loop = true;
      del.loopStart = 0;
      del.loopEnd = p.loopSek;
    }
    del.start(t0);
    return del;
  });
  noder.push(bus);
  const inst: Instans = { id, bus, dele, noder, slutId: null, udtonet: false };
  // Jingles rydder sig selv op, når de har klinget ud (på transportens tid, så en skjult fane ikke klipper dem)
  if (!tema.loop) {
    inst.slutId = tr.scheduleOnce(() => {
      setTimeout(() => ryd(inst), 0);
    }, t0 + p.loopSek + 3);
  }
  S.aktive.push(inst);
}

function ryd(inst: Instans): void {
  S.aktive = S.aktive.filter((i) => i !== inst);
  try {
    if (inst.slutId !== null && T) T.getTransport().clear(inst.slutId);
  } catch {
    /* ignorer */
  }
  for (const d of inst.dele) {
    try {
      d.dispose();
    } catch {
      /* ignorer */
    }
  }
  for (const n of inst.noder) {
    try {
      n.dispose();
    } catch {
      /* ignorer */
    }
  }
  inst.dele = [];
  inst.noder = [];
}

function toneUd(inst: Instans, fade: number): void {
  if (inst.udtonet) return;
  inst.udtonet = true;
  try {
    inst.bus.gain.rampTo(0, fade);
  } catch {
    /* ignorer */
  }
  setTimeout(() => ryd(inst), (fade + 0.4) * 1000);
}

function skiftTil(ny: TemaId | null): void {
  const forrige = S.spiller;
  S.spiller = ny;
  S.historik = [...S.historik, { tema: ny, ms: Math.round(performance.now()) }].slice(-30);
  const derVarLyd = S.aktive.some((i) => !i.udtonet);
  for (const inst of S.aktive) toneUd(inst, FADE);
  if (!ny) return;
  if (ny === 'ai' && (forrige === 'vaekst' || forrige === 'garage')) {
    // Akt to: vækst-temaet tones ud, jinglen mørkner, og AI-temaet vokser frem under den
    startTema('aktSkift', AKT_JINGLE_FORSINKELSE, 0);
    startTema('ai', AKT_JINGLE_FORSINKELSE + temaLaengdeSek(TEMAER.aktSkift) - AKT_OVERLAP, AKT_OVERLAP - 0.4);
    return;
  }
  if (TEMAER[ny].loop) startTema(ny, derVarLyd ? 0.25 : 0.05, derVarLyd ? FADE : 0.4);
  else startTema(ny, derVarLyd ? 0.4 : 0.05, 0);
}

function saetMasterVolumen(tid: number): void {
  if (!master) return;
  try {
    master.gain.rampTo(MUSIK_BASIS * volumenTilGain(S.volumen), tid);
  } catch {
    /* ignorer */
  }
}

/** Bring lyden i overensstemmelse med ønsket (til/fra, tema, volumen, synlighed) */
function synk(): void {
  if (!S.til) {
    for (const inst of S.aktive) toneUd(inst, 0.5);
    if (S.spiller !== null) S.historik = [...S.historik, { tema: null, ms: Math.round(performance.now()) }].slice(-30);
    S.spiller = null;
    S.tilstand = 'slukket';
    return;
  }
  if (!harAudio()) {
    S.tilstand = 'ingenLyd';
    return;
  }
  if (indlaesFejl) {
    S.tilstand = 'fejl';
    return;
  }
  if (!S.interageret) {
    S.tilstand = 'venter';
    return;
  }
  if (!T) {
    S.tilstand = 'indlaeser';
    if (!indlaesning) indlaesning = indlaesTone().then(() => synk());
    return;
  }
  if (skjult()) {
    S.tilstand = 'pause';
    return;
  }
  try {
    const tr = T.getTransport();
    if (tr.state !== 'started') tr.start();
    saetMasterVolumen(0.2);
    if (S.oensket !== S.spiller) skiftTil(S.oensket);
    S.tilstand = 'spiller';
  } catch (e) {
    S.tilstand = 'fejl';
    console.warn('Musikken fejlede:', e);
  }
}

/** Genoptag konteksten inde i en brugerhandling (iOS kræver et tryk, fx efter et opkald eller en skjult fane) */
function vaekKontekst(): void {
  try {
    const ac = (T?.getContext().rawContext ?? lydKontekst()) as AudioContext | null;
    if (ac && ac.state !== 'running' && ac.state !== 'closed') void ac.resume().catch(() => undefined);
  } catch {
    /* ignorer */
  }
}

function interaktion(): void {
  if (!S.interageret) {
    S.interageret = true;
    synk();
    return;
  }
  // Også når musikken er slået fra: effekterne deler konteksten, og efter en iOS-afbrydelse (opkald, låst skærm)
  // skal lyden vågne ved næste tryk, ikke først ved næste lyd, der tilfældigvis udløses af et tryk
  vaekKontekst();
}

function synlighed(): void {
  if (!T || !master) return;
  try {
    const tr = T.getTransport();
    if (skjult()) {
      master.gain.rampTo(0, 0.1);
      if (tr.state === 'started') tr.pause(T.now() + 0.12);
      if (S.til) S.tilstand = 'pause';
      return;
    }
    if (!S.til) return;
    vaekKontekst();
    if (tr.state !== 'started') tr.start();
    saetMasterVolumen(0.8);
  } catch {
    /* ignorer */
  }
  synk();
}

const INTERAKTIONER = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

/** Lyt efter første tryk/tast (lyd-unlock) og efter skjult/synlig fane. Returnerer oprydning. */
export function installerMusik(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const opt: AddEventListenerOptions = { capture: true, passive: true };
  for (const k of INTERAKTIONER) window.addEventListener(k, interaktion, opt);
  document.addEventListener('visibilitychange', synlighed);
  return () => {
    for (const k of INTERAKTIONER) window.removeEventListener(k, interaktion, opt);
    document.removeEventListener('visibilitychange', synlighed);
  };
}

/** Sæt ønsket musik. Tone indlæses først, når musikken er slået til, og brugeren har interageret. */
export function saetMusik(o: { til: boolean; tema: TemaId | null; volumen: number }): void {
  S.til = o.til;
  S.oensket = o.tema;
  S.volumen = o.volumen;
  synk(); // sætter også den nye volumen, når musikken spiller
}

export function musikStatus(): MusikStatus {
  let kontekst = 'ingen';
  try {
    if (T) kontekst = T.getContext().state;
  } catch {
    /* ignorer */
  }
  return {
    tilstand: S.tilstand,
    oensket: S.oensket,
    spiller: S.spiller,
    aktive: S.aktive.filter((i) => !i.udtonet).map((i) => i.id),
    toneIndlaest: T !== null,
    kontekst,
    deltKontekst: S.delt,
    volumen: S.volumen,
    historik: [...S.historik],
  };
}

/** Musikkens niveau lige nu (0-1, kun i debug) — til at bekræfte, at der faktisk kommer lyd ud */
export function musikNiveau(): number | null {
  try {
    const v = maaler?.getValue();
    return typeof v === 'number' ? v : Array.isArray(v) ? Math.max(...v) : null;
  } catch {
    return null;
  }
}

if (debug && typeof window !== 'undefined') {
  (window as unknown as { __musik: unknown }).__musik = { status: musikStatus, niveau: musikNiveau };
}

/** Temaet til skærmen: titel-jinglen på titelskærmen, ellers aktens tema */
export function temaFor(uge: number | null): TemaId {
  return uge === null ? 'titel' : AKT_TEMA[aktFor(uge)];
}

/** Monteres ét sted (App): vælger tema ud fra akten og følger indstillingerne */
export function useMusik(): void {
  const tema = useGame((s) => temaFor(s.game ? s.game.uge : null));
  const til = useGame((s) => s.settings.musik);
  const vol = useGame((s) => kanalVolumen(s.settings.musikVolumen, 'musik'));
  useEffect(() => installerMusik(), []);
  useEffect(() => {
    saetMusik({ til, tema, volumen: vol });
  }, [til, tema, vol]);
}
