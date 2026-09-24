// Vertikaler. [D] = designestimat, [F] = fakta, [A] = afledt.
import type { Vertical } from '../sim/types';

export type VerticalDef = {
  id: Vertical;
  navn: string;
  kort: string;
  beskrivelse: string;
  /** Basis-churn pr. uge for aktive kunder [D] */
  churnPrUge: number;
  /** Ugentlig hold-varians (std.afv. som andel) — betting svinger, kasino er stabil [D] */
  holdVarians: number;
  /** Sandsynlighed pr. uge for en "favoritsejr"-uge [D] */
  favoritsejrChance: number;
  farve: string;
};

export const VERTICALS: Record<Vertical, VerticalDef> = {
  betting: {
    id: 'betting',
    navn: 'Sportsbetting',
    kort: 'Betting',
    beskrivelse: 'Hurtigere produkter og svingende indtjening. Favoritsejre kan æde en hel uges hold.',
    churnPrUge: 0.03, // [D]
    holdVarians: 0.22, // [D]
    favoritsejrChance: 0.06, // [D] ca. 3 uger om året
    farve: '#3fa7d6',
  },
  kasino: {
    id: 'kasino',
    navn: 'Online kasino',
    kort: 'Kasino',
    beskrivelse: 'Stabil indtjening, dyrere kunder og højere risiko. Slots skal fornyes ofte.',
    churnPrUge: 0.025, // [D]
    holdVarians: 0.04, // [D]
    favoritsejrChance: 0,
    farve: '#e8a33d',
  },
};

export const ANDEN_VERTIKAL: Record<Vertical, Vertical> = { betting: 'kasino', kasino: 'betting' };
