// Indsigt og forskning (spec 6.5): tjenes ved lanceringer, messer, kontrakter; bruges på boost, træning og forskning.
import type { GameState, Vertical } from './types';
import { RESEARCH, RESEARCH_BY_ID, type ResearchNode } from '../data/research';
import { aarFor } from './time';
import { afvis, nyhed, signal } from './util';

export type ForskningsEffekt = {
  paramBonus: { spaending: number; originalitet: number; teknik: number; tryghed: number };
  fejl: number;
  churn: number;
  cac: number;
  arpu: number;
  indsigt: number;
  boost: number;
  tillid: number;
  ansvarNoder: number;
};

/** Samlede effekter af ulåst forskning. Param-bonusser med vertikal gælder kun den vertikal. */
export function forskningsEffekt(s: GameState, vertikal?: Vertical): ForskningsEffekt {
  const e: ForskningsEffekt = {
    paramBonus: { spaending: 0, originalitet: 0, teknik: 0, tryghed: 0 },
    fejl: 0, churn: 0, cac: 0, arpu: 0, indsigt: 0, boost: 0, tillid: 0, ansvarNoder: 0,
  };
  for (const id of s.forskning.ulaast) {
    const n = RESEARCH_BY_ID[id];
    if (!n) continue;
    const gaelder = !n.vertikal || !vertikal || n.vertikal === vertikal;
    if (gaelder && n.effekt.paramBonus) {
      for (const [k, v] of Object.entries(n.effekt.paramBonus)) e.paramBonus[k as keyof ForskningsEffekt['paramBonus']] += v ?? 0;
    }
    if (gaelder && n.effekt.arpu) e.arpu += n.effekt.arpu;
    e.fejl += n.effekt.fejl ?? 0;
    e.churn += n.effekt.churn ?? 0;
    e.cac += n.effekt.cac ?? 0;
    e.indsigt += n.effekt.indsigt ?? 0;
    e.boost += n.effekt.boost ?? 0;
    e.tillid += n.effekt.tillid ?? 0;
    if (n.effekt.tillid) e.ansvarNoder += 1;
  }
  return e;
}

/** Features, som nye produkter i en vertikal får fra forskning */
export function forskningsFeatures(s: GameState, vertikal: Vertical): string[] {
  return s.forskning.ulaast
    .map((id) => RESEARCH_BY_ID[id])
    .filter((n): n is ResearchNode => !!n && !!n.feature && (!n.vertikal || n.vertikal === vertikal))
    .map((n) => n.feature as string);
}

export function forskningStatus(s: GameState, n: ResearchNode): { ok: boolean; grund?: string } {
  if (s.forskning.ulaast.includes(n.id)) return { ok: false, grund: 'Allerede ulåst' };
  if (s.forskning.igang?.nodeId === n.id) return { ok: false, grund: 'I gang' };
  if (s.forskning.igang) return { ok: false, grund: 'Der forskes allerede i noget andet' };
  if (aarFor(s.uge) < n.fraAar) return { ok: false, grund: `Fra ${n.fraAar}` };
  const mangler = n.kraever.filter((k) => !s.forskning.ulaast.includes(k));
  if (mangler.length) return { ok: false, grund: `Kræver ${mangler.map((m) => RESEARCH_BY_ID[m]?.navn ?? m).join(', ')}` };
  if (s.indsigt < n.indsigt) return { ok: false, grund: `Kræver ${n.indsigt} indsigt` };
  return { ok: true };
}

export function startResearch(s: GameState, nodeId: string): boolean {
  const n = RESEARCH_BY_ID[nodeId];
  if (!n) return afvis(s, 'Ukendt forskning.');
  const st = forskningStatus(s, n);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke starte forskningen.');
  s.indsigt -= n.indsigt;
  s.forskning.igang = { nodeId, resterendeUger: n.uger };
  return true;
}

export function ugentligForskning(s: GameState): void {
  const ig = s.forskning.igang;
  if (!ig) return;
  ig.resterendeUger -= 1;
  if (ig.resterendeUger <= 0) {
    s.forskning.ulaast.push(ig.nodeId);
    s.forskning.igang = null;
    const n = RESEARCH_BY_ID[ig.nodeId];
    if (n?.feature) s.aarAkk.nyeFeatures += 1;
    signal(s, { k: 'forskning', nodeId: ig.nodeId });
    nyhed(s, `Forskning færdig: ${n?.navn ?? ig.nodeId}.`, 'firma');
  }
}

/** Indsigt fra analytikere: +1 pr. måned pr. analytiker (tildeles hver 4. uge) */
export function passivIndsigt(s: GameState, analytikere: number): void {
  if (analytikere > 0 && s.uge % 4 === 0) s.indsigt += analytikere;
}

export { RESEARCH };
