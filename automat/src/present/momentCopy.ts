// Terningen · the big die moment's own words (Isfont, uppercase; pure: the copy test renders them for every count).
// The title over the staged die and its accession number under it. Nothing else is written on the stage (the DEMO
// band reuses DEMO_CAPTION, the fan's "+m" heldOverflow).
import { fmtDice } from '../game/dice.ts';

export const MOMENT_COPY = { title: 'TERNING', nr: (n: number) => `NR. ${fmtDice(n)}` } as const;
