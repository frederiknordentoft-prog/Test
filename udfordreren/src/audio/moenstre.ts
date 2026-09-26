// Musikken som data (spec 6.19): tre originale chiptune-temaer — ét pr. akt — og to små jingles.
// Ren TS uden Tone og uden DOM, så noderne kan unit-testes. Afspilningen står i music.ts.
//
// Noderne skrives i en lille notation: "<node>/<varighed>" adskilt af mellemrum.
//   node:      c4, f#3, bb2 … (C4 = MIDI 60) · r = pause · akkorder med + (c4+eb4+g4) · trommer: k s h o
//   varighed:  i 16.-dele (4 = en fjerdedel, 16 = en hel takt)
//   styrke:    ! = accent, ? = svag (ellers normal)
// Stemmerne efterligner en gammel 4-kanals lydchip: to pulsbølger, en trekant og støj.
import type { Akt } from '../render/actChrome';

export type TemaId = 'garage' | 'vaekst' | 'ai' | 'titel' | 'aktSkift';
export type Boelge = 'square' | 'pulse' | 'triangle' | 'noise';
/** melodi/arp/akkord/bas er monofone (én node ad gangen); pad spiller akkorder; trommer er støjkanalen */
export type Rolle = 'melodi' | 'arp' | 'akkord' | 'pad' | 'bas' | 'trommer';
export type Klang = { attack: number; decay: number; sustain: number; release: number };

export type StemmeDef = {
  id: string;
  rolle: Rolle;
  boelge: Boelge;
  /** Pulsbredde 0-0,5 (kun 'pulse'; 0,125 og 0,25 er de klassiske) */
  puls?: number;
  /** Styrke i dB (lav — musikken skal ligge under lydeffekterne) */
  vol: number;
  /** Lavpasfilter på stemmen (Hz) */
  lavpas?: number;
  klang?: Klang;
  /** Andel af nodens længde, der klinger (resten er luft før næste node) */
  gate?: number;
  spor: string;
};

export type TemaDef = {
  id: TemaId;
  navn: string;
  bpm: number;
  toneart: { grundtone: string; skala: 'dur' | 'mol' };
  takter: number;
  /** Temaer loop'er; jingles spilles én gang */
  loop: boolean;
  /** 0-0,5: offbeat-ottendedele forsinkes (0,33 ≈ triolsving) */
  swing?: number;
  /** Lo-fi: højst så mange sekunders deterministisk forsinkelse pr. node */
  rod?: number;
  effekt?: { lavpas?: number; ekko?: { tid16: number; feedback: number; vaad: number } };
  stemmer: StemmeDef[];
};

/** En node efter parsning. Positioner og længder i 16.-dele. */
export type Node = { start: number; laengde: number; midi: number[]; styrke: number };
export type Stemme = Omit<StemmeDef, 'spor'> & { noder: Node[]; laengde16: number };
export type Tema = Omit<TemaDef, 'stemmer'> & { stemmer: Stemme[] };

/** Trommer som MIDI-numre (General MIDI-slagtøj) */
export const TROMME = { k: 36, s: 38, h: 42, o: 46 } as const;
export const TROMME_MIDI: readonly number[] = Object.values(TROMME);

/** Tilladte toneområder pr. rolle (MIDI) */
export const TONEOMRAADE: Record<Exclude<Rolle, 'trommer'>, [number, number]> = {
  melodi: [55, 96],
  arp: [55, 96],
  akkord: [48, 84],
  pad: [48, 84],
  bas: [28, 60],
};

export const STYRKE = { normal: 0.8, accent: 1, svag: 0.45 } as const;

const TONE_KLASSE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "f#3" → 54, "bb2" → 46, "c4" → 60 */
export function nodeTilMidi(navn: string): number {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(navn.trim().toLowerCase());
  if (!m) throw new Error(`Ukendt node: "${navn}"`);
  const fortegn = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + TONE_KLASSE[m[1]] + fortegn;
}

export function midiTilHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Parse et spor. Trommestemmer bruger k/s/h/o i stedet for toner. */
export function parseSpor(spor: string, trommer = false): { noder: Node[]; laengde16: number } {
  const noder: Node[] = [];
  let pos = 0;
  for (const tok of spor.trim().split(/\s+/)) {
    const m = /^([^/]+)\/(\d+)([!?]?)$/.exec(tok);
    if (!m) throw new Error(`Ugyldigt nodetegn: "${tok}"`);
    const laengde = Number(m[2]);
    if (!(laengde > 0)) throw new Error(`Nodelængden skal være positiv: "${tok}"`);
    const styrke = m[3] === '!' ? STYRKE.accent : m[3] === '?' ? STYRKE.svag : STYRKE.normal;
    if (m[1] !== 'r') {
      const midi = m[1].split('+').map((n) => {
        if (!trommer) return nodeTilMidi(n);
        const t = TROMME[n as keyof typeof TROMME];
        if (t === undefined) throw new Error(`Ukendt tromme: "${n}"`);
        return t;
      });
      noder.push({ start: pos, laengde, midi, styrke });
    }
    pos += laengde;
  }
  return { noder, laengde16: pos };
}

// --- Små hjælpere til at skrive sporene (resultatet er stadig bare noder) ---

const gentag = (s: string, n: number): string => Array.from({ length: n }, () => s).join(' ');
/** Brudt akkord i 16.-dele: toner efter et mønster af indeks */
const arp = (akkord: string, moenster: readonly number[]): string => {
  const t = akkord.split(' ');
  return moenster.map((i) => `${t[i % t.length]}/1`).join(' ');
};
const ARP_OP = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 1];
const ARP_HOP = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 1, 2, 3, 2];
/** Drivende ottendedelsbas: grundtone, oktav og kvint */
const drivBas = (r: string, okt: string, kvint: string): string => `${r}/2 ${r}/2 ${okt}/2 ${r}/2 ${r}/2 ${okt}/2 ${r}/2 ${kvint}/2`;
/** Pulserende bas med accent på slagene */
const pulsBas = (r: string, kvint: string): string => `${r}/2! ${r}/2? ${r}/2 ${r}/2? ${r}/2! ${r}/2? ${r}/2 ${kvint}/2?`;

// --- Garagen 2012-14: varm, lidt rodet lo-fi i F-dur ---

const GARAGE: TemaDef = {
  id: 'garage',
  navn: 'Garagen',
  bpm: 92,
  toneart: { grundtone: 'F', skala: 'dur' },
  takter: 8,
  loop: true,
  swing: 0.3,
  rod: 0.007,
  effekt: { lavpas: 2600 },
  stemmer: [
    {
      id: 'melodi',
      rolle: 'melodi',
      boelge: 'pulse',
      puls: 0.25,
      vol: -17,
      klang: { attack: 0.006, decay: 0.12, sustain: 0.45, release: 0.09 },
      spor: [
        'r/2 a4/2 c5/2 a4/2 g4/2 f4/4 r/2', // F
        'r/2 f4/2 a4/2 d5/4 c5/2 a4/4', // Dm
        'bb4/3 a4/1 g4/2 f4/2 d4/4 f4/2 g4/2', // Bb
        'a4/6 g4/2 e4/4 r/4', // C
        'r/2 a4/2 c5/2 f5/2 e5/2 c5/4 a4/2', // F
        'c5/2 e5/4 d5/2 c5/2 a4/2 e4/4', // Am
        'd5/4 c5/2 bb4/2 a4/2 g4/2 f4/2 g4/2', // Bb
        'e4/4 g4/2 bb4/4 a4/2 g4/4', // C7
      ].join(' '),
    },
    {
      id: 'akkord',
      rolle: 'akkord',
      boelge: 'pulse',
      puls: 0.125,
      vol: -25,
      gate: 0.6,
      klang: { attack: 0.004, decay: 0.08, sustain: 0.3, release: 0.08 },
      spor: [
        'r/2 a3/2 r/2 e4/2 r/2 a3/2 r/2 e4/2',
        'r/2 f3/2 r/2 c4/2 r/2 f3/2 r/2 c4/2',
        'r/2 d4/2 r/2 a3/2 r/2 d4/2 r/2 a3/2',
        'r/2 e3/2 r/2 bb3/2 r/2 e3/2 r/2 g3/2',
        'r/2 a3/2 r/2 e4/2 r/2 a3/2 r/2 e4/2',
        'r/2 c4/2 r/2 g3/2 r/2 c4/2 r/2 g3/2',
        'r/2 d4/2 r/2 a3/2 r/2 d4/2 r/2 a3/2',
        'r/2 e3/2 r/2 bb3/2 r/2 e4/2 r/2 bb3/2',
      ].join(' '),
    },
    {
      id: 'bas',
      rolle: 'bas',
      boelge: 'triangle',
      vol: -11,
      gate: 0.9,
      klang: { attack: 0.004, decay: 0.1, sustain: 0.85, release: 0.05 },
      spor: [
        'f2/6 c3/2 f2/4 a2/2 c3/2',
        'd2/6 a2/2 d2/4 f2/2 a2/2',
        'bb1/6 f2/2 bb1/4 d2/2 f2/2',
        'c2/6 g2/2 c2/4 e2/2 g2/2',
        'f2/6 c3/2 f2/4 a2/2 c3/2',
        'a1/6 e2/2 a1/4 c2/2 e2/2',
        'bb1/6 f2/2 bb1/4 d2/2 f2/2',
        'c2/4 c3/2 bb2/2 g2/4 e2/2 c2/2',
      ].join(' '),
    },
    {
      id: 'trommer',
      rolle: 'trommer',
      boelge: 'noise',
      vol: -23,
      spor: `${gentag('k/2! h/2? s/2 h/1? k/1? h/2? k/2 s/2 h/2?', 7)} k/2! h/2? s/2 h/2? s/1? s/1? h/2? s/1? s/1 s/2!`,
    },
  ],
};

// --- Vækst 2015-25: lys, optimistisk startup-drive i D-dur med arpeggioer ---

const V_AKK = {
  D: 'd4 f#4 a4 d5',
  Bm: 'b3 d4 f#4 b4',
  G: 'g3 b3 d4 g4',
  A: 'a3 c#4 e4 a4',
  Fsm: 'a3 c#4 f#4 a4',
  Em: 'g3 b3 e4 g4',
  A7: 'a3 c#4 e4 g4',
} as const;
const V_BAS = {
  D: drivBas('d2', 'd3', 'a2'),
  Bm: drivBas('b1', 'b2', 'f#2'),
  G: drivBas('g1', 'g2', 'd2'),
  A: drivBas('a1', 'a2', 'e2'),
  Fsm: drivBas('f#1', 'f#2', 'c#2'),
  Em: drivBas('e2', 'e3', 'b2'),
  A7: 'a1/2 a1/2 a2/2 a1/2 c#2/2 e2/2 g2/2 e2/2',
} as const;
type VAkk = keyof typeof V_AKK;
const V_A: VAkk[] = ['D', 'Bm', 'G', 'A', 'D', 'Fsm', 'G', 'A'];
const V_B: VAkk[] = ['G', 'A', 'Fsm', 'Bm', 'Em', 'G', 'A', 'A7'];
const V_TROMME = 'k/2! h/2? s/2 h/2? k/2 h/1? h/1? s/2 h/2?';
const V_FILL = 'k/2! h/2? s/2 h/2? s/1? s/1? s/1 s/1 s/2! o/2';

const VAEKST: TemaDef = {
  id: 'vaekst',
  navn: 'Vækst',
  bpm: 116,
  toneart: { grundtone: 'D', skala: 'dur' },
  takter: 16,
  loop: true,
  stemmer: [
    {
      id: 'melodi',
      rolle: 'melodi',
      boelge: 'square',
      vol: -20,
      klang: { attack: 0.004, decay: 0.1, sustain: 0.55, release: 0.07 },
      spor: [
        'a4/2 d5/2 f#5/4 e5/2 d5/2 e5/4', // D
        'f#5/6 d5/2 b4/4 d5/4', // Bm
        'r/2 g5/2 f#5/2 e5/2 d5/4 b4/4', // G
        'c#5/4 e5/4 a5/6 r/2', // A
        'a5/2 f#5/2 a5/2 b5/2 a5/4 f#5/4', // D
        'e5/2 f#5/2 c#5/4 a4/4 c#5/4', // F#m
        'd5/2 e5/2 g5/4 f#5/2 e5/2 d5/4', // G
        'e5/6 c#5/2 e5/2 f#5/2 e5/4', // A
        'b5/4 a5/2 g5/2 d5/4 g5/4', // G
        'a5/6 e5/2 c#5/4 e5/4', // A
        'f#5/2 e5/2 f#5/2 a5/2 c#6/4 a5/4', // F#m
        'b5/8 a5/2 f#5/2 d5/4', // Bm
        'g5/2 f#5/2 e5/2 b4/2 e5/4 g5/4', // Em
        'b5/4 d6/4 b5/2 a5/2 g5/4', // G
        'a5/4 c#6/4 e6/4 c#6/4', // A
        'a5/12 r/4', // A7
      ].join(' '),
    },
    {
      id: 'arp',
      rolle: 'arp',
      boelge: 'pulse',
      puls: 0.125,
      vol: -27,
      gate: 0.7,
      klang: { attack: 0.002, decay: 0.07, sustain: 0.25, release: 0.04 },
      spor: [...V_A.map((a) => arp(V_AKK[a], ARP_OP)), ...V_B.map((a) => arp(V_AKK[a], ARP_HOP))].join(' '),
    },
    {
      id: 'bas',
      rolle: 'bas',
      boelge: 'triangle',
      vol: -11,
      gate: 0.8,
      klang: { attack: 0.003, decay: 0.08, sustain: 0.8, release: 0.04 },
      spor: [...V_A, ...V_B].map((a) => V_BAS[a]).join(' '),
    },
    {
      id: 'trommer',
      rolle: 'trommer',
      boelge: 'noise',
      vol: -23,
      spor: `${gentag(V_TROMME, 7)} ${V_FILL} ${gentag(V_TROMME, 7)} ${V_FILL}`,
    },
  ],
};

// --- AI-akten 2026+: mørk og glødende c-mol med luftige flader og en pulserende bas ---

const AI: TemaDef = {
  id: 'ai',
  navn: 'AI-akten',
  bpm: 84,
  toneart: { grundtone: 'C', skala: 'mol' },
  takter: 16,
  loop: true,
  effekt: { ekko: { tid16: 3, feedback: 0.38, vaad: 0.32 } },
  stemmer: [
    {
      id: 'flade',
      rolle: 'pad',
      boelge: 'pulse',
      puls: 0.35,
      vol: -27,
      lavpas: 1300,
      klang: { attack: 0.9, decay: 0.6, sustain: 0.75, release: 1.8 },
      spor: [
        'c4+eb4+g4+bb4/32', // Cm7
        'ab3+c4+eb4+g4/32', // Abmaj7
        'f3+ab3+c4+g4/32', // Fm(add9)
        'g3+b3+d4+f4/32', // G7
        'c4+eb4+g4+bb4/32', // Cm7
        'eb4+g4+bb4+d5/32', // Ebmaj7
        'ab3+c4+eb4+g4/32', // Abmaj7
        'bb3+d4+f4+ab4/16', // Bb7
        'g3+b3+d4+f4/16', // G7
      ].join(' '),
    },
    {
      id: 'bas',
      rolle: 'bas',
      boelge: 'pulse',
      puls: 0.5,
      vol: -15,
      lavpas: 520,
      gate: 0.7,
      klang: { attack: 0.004, decay: 0.16, sustain: 0.3, release: 0.08 },
      spor: [
        gentag(pulsBas('c2', 'g2'), 2),
        gentag(pulsBas('ab1', 'eb2'), 2),
        gentag(pulsBas('f1', 'c2'), 2),
        gentag(pulsBas('g1', 'd2'), 2),
        gentag(pulsBas('c2', 'g2'), 2),
        gentag(pulsBas('eb2', 'bb2'), 2),
        gentag(pulsBas('ab1', 'eb2'), 2),
        pulsBas('bb1', 'f2'),
        pulsBas('g1', 'd2'),
      ].join(' '),
    },
    {
      id: 'gloed',
      rolle: 'melodi',
      boelge: 'pulse',
      puls: 0.125,
      vol: -22,
      gate: 0.85,
      klang: { attack: 0.01, decay: 0.35, sustain: 0.3, release: 0.5 },
      spor: [
        'r/4 g5/4 eb5/4 c5/4',
        'd5/6 eb5/2 r/8',
        'r/4 c6/4 bb5/2 ab5/2 g5/4',
        'eb5/8 r/8',
        'r/4 ab5/4 g5/2 f5/2 eb5/4',
        'f5/6 c5/2 r/8',
        'r/4 b4/4 d5/4 f5/4',
        'eb5/4 d5/4 b4/8',
        'r/2 g5/2 c6/4 bb5/4 g5/4',
        'eb5/12 r/4',
        'r/4 bb5/4 g5/4 d5/4',
        'eb5/8 r/8',
        'r/4 eb6/4 c6/4 ab5/4',
        'g5/8 r/8',
        'r/4 f5/4 d5/4 bb4/4',
        'b4/4 d5/4 f5/4 r/4',
      ].join(' '),
    },
    {
      id: 'trommer',
      rolle: 'trommer',
      boelge: 'noise',
      vol: -28,
      spor: `${gentag('k/2! h/2? h/2? h/2? s/4 h/2? h/1? h/1?', 15)} k/2! h/2? h/2? h/2? s/4 s/1? s/1 o/2?`,
    },
  ],
};

// --- Jingles ---

const TITEL: TemaDef = {
  id: 'titel',
  navn: 'Titel',
  bpm: 132,
  toneart: { grundtone: 'C', skala: 'dur' },
  takter: 2,
  loop: false,
  stemmer: [
    {
      id: 'melodi',
      rolle: 'melodi',
      boelge: 'square',
      vol: -19,
      klang: { attack: 0.004, decay: 0.12, sustain: 0.55, release: 0.25 },
      spor: 'g4/1 c5/1 e5/1 g5/1 c6/3 g5/1 a5/2 b5/2 c6/4 e6/2 d6/2 c6/2 g5/2 c6/8!',
    },
    {
      id: 'akkord',
      rolle: 'akkord',
      boelge: 'pulse',
      puls: 0.25,
      vol: -25,
      klang: { attack: 0.004, decay: 0.1, sustain: 0.4, release: 0.25 },
      spor: 'e4/4 e4/2 d4/2 f4/4 g4/4 g4/2 g4/2 e4/2 f4/2 e4/8',
    },
    {
      id: 'bas',
      rolle: 'bas',
      boelge: 'triangle',
      vol: -11,
      klang: { attack: 0.004, decay: 0.1, sustain: 0.8, release: 0.2 },
      spor: 'c3/4 c3/2 g2/2 f2/4 g2/4 c3/2 g2/2 e2/2 g2/2 c2/8',
    },
    {
      id: 'trommer',
      rolle: 'trommer',
      boelge: 'noise',
      vol: -23,
      spor: 'k/4! s/2 h/2? k/2 k/2 s/4 s/1? s/1? s/1 s/1 h/2? h/2? k/2! o/6',
    },
  ],
};

/** Overgangen til AI-akten: vækstens lyse arpeggio mørkner, en rejser i støjen, og en c-mol-flade tager over */
const AKT_SKIFT: TemaDef = {
  id: 'aktSkift',
  navn: 'Akt to',
  bpm: 84,
  toneart: { grundtone: 'C', skala: 'mol' },
  takter: 4,
  loop: false,
  effekt: { ekko: { tid16: 3, feedback: 0.3, vaad: 0.28 } },
  stemmer: [
    {
      id: 'arp',
      rolle: 'arp',
      boelge: 'pulse',
      puls: 0.125,
      vol: -23,
      gate: 0.75,
      klang: { attack: 0.002, decay: 0.08, sustain: 0.3, release: 0.06 },
      spor: [
        arp('d5 f#5 a5 d6', [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 1]),
        arp('d5 f5 a5 d6', [0, 1, 2, 3, 2, 1, 0, 1]),
        arp('c5 eb5 g5 c6', [0, 1, 2, 3, 2, 1, 0, 1]),
        'r/32',
      ].join(' '),
    },
    {
      id: 'flade',
      rolle: 'pad',
      boelge: 'triangle',
      vol: -21,
      klang: { attack: 1.4, decay: 0.8, sustain: 0.8, release: 2.2 },
      spor: 'r/32 c4+eb4+g4+d5/32',
    },
    {
      id: 'bas',
      rolle: 'bas',
      boelge: 'triangle',
      vol: -12,
      klang: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 1.2 },
      spor: 'd2/16 c2/48!',
    },
    {
      id: 'trommer',
      rolle: 'trommer',
      boelge: 'noise',
      vol: -24,
      spor: `${gentag('h/2?', 8)} ${gentag('h/1', 16)} k/16! r/16`,
    },
  ],
};

function byg(def: TemaDef): Tema {
  return {
    ...def,
    stemmer: def.stemmer.map(({ spor, ...s }) => ({ ...s, ...parseSpor(spor, s.rolle === 'trommer') })),
  };
}

export const TEMA_DEFS: Record<TemaId, TemaDef> = { garage: GARAGE, vaekst: VAEKST, ai: AI, titel: TITEL, aktSkift: AKT_SKIFT };
export const TEMAER: Record<TemaId, Tema> = {
  garage: byg(GARAGE),
  vaekst: byg(VAEKST),
  ai: byg(AI),
  titel: byg(TITEL),
  aktSkift: byg(AKT_SKIFT),
};

/** Hvilket tema hver akt spiller */
export const AKT_TEMA: Record<Akt, TemaId> = { garage: 'garage', vaekst: 'vaekst', ai: 'ai' };

// --- Tidsplan: fra 16.-dele til sekunder (swing, lo-fi-rod og monofone stemmer uden overlap) ---

export type PlanEvent = { tid: number; varighed: number; midi: number[]; hz: number[]; styrke: number };
export type Plan = { id: TemaId; loopSek: number; sek16: number; stemmer: { id: string; rolle: Rolle; events: PlanEvent[] }[] };

/** Varigheden af et helt gennemløb i sekunder (altid hele takter i 4/4) */
export function temaLaengdeSek(t: Pick<TemaDef, 'bpm' | 'takter'>): number {
  return (t.takter * 4 * 60) / t.bpm;
}

/** Swing: offbeat-ottendedelen i hver fjerdedel flyttes; monoton, så rækkefølgen bevares */
export function swingPos(pos16: number, swing: number): number {
  if (!swing) return pos16;
  const a = Math.max(0, Math.min(0.5, swing)) * 2;
  const q = Math.floor(pos16 / 4);
  const r = pos16 - q * 4;
  const w = r <= 2 ? (r * (2 + a)) / 2 : 2 + a + ((r - 2) * (2 - a)) / 2;
  return q * 4 + w;
}

/** Deterministisk hash → [0, 1) (kosmetisk "rod" uden Math.random) */
export function hash01(a: number, b: number): number {
  let h = (Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const MONOFON: Rolle[] = ['melodi', 'arp', 'akkord', 'bas', 'trommer'];
export const erMonofon = (r: Rolle): boolean => MONOFON.includes(r);
/** Mindste luft mellem to noder i en monofon stemme (så udløsningen aldrig klipper den næste node) */
export const MIN_LUFT = 0.012;

export function planlaeg(t: Tema): Plan {
  const sek16 = 60 / t.bpm / 4;
  const loopSek = temaLaengdeSek(t);
  const stemmer = t.stemmer.map((s, si) => {
    const gate = s.gate ?? (s.rolle === 'pad' ? 1 : 0.92);
    const events: PlanEvent[] = s.noder.map((n, ni) => {
      const start = swingPos(n.start, t.swing ?? 0) * sek16 + (t.rod ? hash01(si + 1, ni + 1) * t.rod : 0);
      const slut = swingPos(n.start + n.laengde, t.swing ?? 0) * sek16;
      return { tid: start, varighed: Math.max(0.03, (slut - start) * gate), midi: n.midi, hz: n.midi.map(midiTilHz), styrke: n.styrke };
    });
    if (erMonofon(s.rolle)) {
      events.forEach((e, i) => {
        const naeste = i + 1 < events.length ? events[i + 1].tid : t.loop ? events[0].tid + loopSek : Infinity;
        e.varighed = Math.max(0.02, Math.min(e.varighed, naeste - e.tid - MIN_LUFT));
      });
    }
    return { id: s.id, rolle: s.rolle, events };
  });
  return { id: t.id, loopSek, sek16, stemmer };
}

// --- Validering (bruges af unit-testene) ---

const SKALA: Record<'dur' | 'mol', number[]> = { dur: [0, 2, 4, 5, 7, 9, 11], mol: [0, 2, 3, 5, 7, 8, 10, 11] }; // mol inkl. ledetonen

/** Ligger tonen i temaets toneart? (mol regnes harmonisk, så ledetonen er med) */
export function iToneart(midi: number, toneart: TemaDef['toneart']): boolean {
  const g = nodeTilMidi(`${toneart.grundtone.toLowerCase()}4`) % 12;
  return SKALA[toneart.skala].includes((((midi - g) % 12) + 12) % 12);
}

/** Tjek et tema. Returnerer en liste af problemer (tom = gyldigt). */
export function valider(t: Tema): string[] {
  const fejl: string[] = [];
  const maal = t.takter * 16;
  if (!Number.isInteger(t.takter) || t.takter < 1) fejl.push(`${t.id}: takter skal være et helt tal`);
  if (t.stemmer.length < 2 || t.stemmer.length > 4) fejl.push(`${t.id}: 2-4 stemmer (har ${t.stemmer.length})`);
  for (const s of t.stemmer) {
    if (s.laengde16 !== maal) fejl.push(`${t.id}/${s.id}: ${s.laengde16} 16.-dele, skal være ${maal}`);
    if ((s.boelge === 'noise') !== (s.rolle === 'trommer')) fejl.push(`${t.id}/${s.id}: støj hører til trommerne`);
    if (s.puls !== undefined && (s.puls <= 0 || s.puls > 0.5)) fejl.push(`${t.id}/${s.id}: pulsbredde uden for 0-0,5`);
    if (s.vol > -6) fejl.push(`${t.id}/${s.id}: for høj (${s.vol} dB)`);
    let sidsteSlut = 0;
    for (const n of s.noder) {
      if (n.start + n.laengde > maal) fejl.push(`${t.id}/${s.id}: node efter loopets slutning`);
      if (erMonofon(s.rolle) && n.midi.length !== 1) fejl.push(`${t.id}/${s.id}: akkord i en monofon stemme`);
      if (n.start < sidsteSlut) fejl.push(`${t.id}/${s.id}: noder overlapper ved ${n.start}`);
      sidsteSlut = n.start + n.laengde;
      for (const m of n.midi) {
        if (s.rolle === 'trommer') {
          if (!TROMME_MIDI.includes(m)) fejl.push(`${t.id}/${s.id}: ukendt tromme ${m}`);
        } else {
          const [lo, hi] = TONEOMRAADE[s.rolle];
          if (m < lo || m > hi) fejl.push(`${t.id}/${s.id}: tone ${m} uden for ${lo}-${hi}`);
        }
      }
    }
  }
  return fejl;
}
