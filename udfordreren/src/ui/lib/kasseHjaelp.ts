// Kassen: den løbende drift, tendensen og hvor længe kassen rækker. Rene funktioner uden React og uden kit.tsx
// (så de kan unit-testes). Engangsudgifter (flytning, projektbudgetter, sponsorbud, bøder) tæller ikke som forbrug.
import type { GameState } from '../../sim/types';
import { spillerKunderTotal } from '../../sim/customers';
import { ugeIAar } from '../../sim/time';
import { OFFICE_BY_ID } from '../../data/costs';
import { BALANCE } from '../../data/balance';

/** Ugens faste drift: BSI minus løbende omkostninger (uden kontraktbetalinger og engangsudgifter som projektbudgetter) */
export function fastDrift(g: GameState): number {
  const r = g.regnskab;
  const husleje = OFFICE_BY_ID[g.kontor].husleje + (spillerKunderTotal(g) * BALANCE.driftPrKunde) / 1e6;
  return r.bsi - (r.afgift + r.revenueShare + r.betalinger + r.bonus + r.indhold + r.marketing + r.loen + r.licenser + (r.compute ?? 0) + husleje);
}

/** Så mange uger af kvartalet skal være gået, før kvartalets egen drift står alene (før det blandes den faste drift ind) */
const TENDENS_MIN_UGER = 6;

/**
 * Det ugentlige forbrug (eller overskud) fra den løbende drift: kvartalets drift indtil nu (BSI og kontraktbetalinger
 * minus løbende omkostninger) i snit pr. uge. Engangsudgifter (kontorflytning, projektbudgetter, sponsorbud, bøder)
 * tæller IKKE med — de er betalt, og kassen viser dem allerede. Tidligt i kvartalet blandes ugens faste drift ind, så
 * én kontraktbetaling ikke får tendensen til at svinge vildt.
 */
export function ugentligTendens(g: GameState): number {
  const n = ugeIAar(g.uge) % 13; // uger talt med i kvartalAkk
  const drift = g.kvartalAkk.drift ?? 0;
  const fyld = Math.max(0, TENDENS_MIN_UGER - n);
  return (drift + fastDrift(g) * fyld) / Math.max(1, n + fyld);
}

export type Kassetid = { uger: number; tendens: number } | null;

/** Hvor mange uger rækker kassen med det nuværende forbrug? null = kassen vokser (eller står stille). */
export function kassenRaekker(g: GameState): Kassetid {
  const tendens = ugentligTendens(g);
  if (!(tendens < -0.0005) || g.kapital <= 0) return null;
  return { uger: Math.floor(g.kapital / -tendens), tendens };
}

