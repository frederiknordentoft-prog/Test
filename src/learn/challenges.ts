// Challenge definitions with completion predicates over live measurements.

import type { Measurements } from '../engine/types';

export interface ChallengeCtx {
  m: Measurements;
  hasShape: boolean;
  kind: string | null;
  pivotLocked: boolean;
  /** Peak |deflection| over the last ~5 s, degrees. */
  thetaAmplitude: number;
}

export interface Challenge {
  id: string;
  title: string;
  detail: string;
  done: (c: ChallengeCtx) => boolean;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'street',
    title: 'Lav en hvirvelgade',
    detail: 'Sæt en stump form (fx firkant) i vinden og få hvirvler til at løsne sig i takt bagved.',
    done: (c) => c.hasShape && c.m.flowHints.strouhal !== undefined,
  },
  {
    id: 'lowdrag',
    title: 'Under Cd 0,5',
    detail: 'Tegn en form med modstandskoefficient under 0,5. Tip: rund forkant, spids hale.',
    done: (c) => c.hasShape && c.kind === 'freehand' && c.m.cd > 0.01 && c.m.cd < 0.5,
  },
  {
    id: 'flutter',
    title: 'Få den til at flagre',
    detail: 'Lås pinden op og find en let form der svinger mere end 15° i hvirvelgaden.',
    done: (c) => c.hasShape && !c.pivotLocked && c.thetaAmplitude > 15,
  },
  {
    id: 'lift',
    title: 'Løft uden vinge',
    detail: 'Få løft-koefficienten over 0,5 med låst pind — uden dråbe-værktøjet.',
    done: (c) => c.hasShape && c.pivotLocked && c.kind !== 'teardrop' && Math.abs(c.m.cl) > 0.5,
  },
];
