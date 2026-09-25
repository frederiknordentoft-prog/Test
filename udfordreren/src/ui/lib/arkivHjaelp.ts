// Rene hjælpere til Arkivet (spec 6.18): status pr. opslag, et hint for låste opslag og links fra nyheder.
// Titler og tekster vises ordret fra src/data/archive.ts — her skrives aldrig rigtige navne. Hintene bygges
// udelukkende af spillets egne parodinavne, lande og årstal. Ingen React.
import type { GameState, MarketId, NewsItem } from '../../sim/types';
import { ARKIV, ARKIV_ALIAS, ARKIV_BY_ID, ARKIV_MARKED, arkivId, type ArkivOpslag } from '../../data/archive';
import { MARKETS } from '../../data/markets';
import { COMPETITORS } from '../../data/competitors';
import { KONKURRENT_EVENTS } from '../../data/competitorEvents';
import { aarFor } from '../../sim/time';

/** Særlige udløsere, der ikke kan læses ud af data (se src/sim/endings.ts og src/sim/regulation.ts) */
const SAERLIGE: Record<string, string> = {
  a5: 'når Spilpakke 1 træder i kraft i Danmark',
  a17: 'når en ny prævalensmåling får politikerne op af stolen',
  a18: 'når I lancerer en bet builder',
};

function listeTekst(dele: string[]): string {
  if (dele.length <= 1) return dele[0] ?? '';
  return `${dele.slice(0, -1).join(', ')} eller ${dele[dele.length - 1]}`;
}

/** Hvad låser et opslag op? Fx "Låses op, når Sverige åbner, eller når I møder Svea Spel." */
export function arkivHint(id: string): string {
  const dele: string[] = [];
  if (SAERLIGE[id]) dele.push(SAERLIGE[id]);
  for (const [m, a] of Object.entries(ARKIV_MARKED) as [MarketId, string][]) {
    if (a !== id) continue;
    dele.push(MARKETS[m].aabnerUge === null ? `hvis ${MARKETS[m].navn} åbner` : `når ${MARKETS[m].navn} åbner`);
  }
  const rivaler = COMPETITORS.filter((c) => ARKIV_ALIAS[c.arkivId] === id).map((c) => c.navn);
  if (rivaler.length) dele.push(`når I møder ${rivaler.slice(0, 2).join(' eller ')} med licens i deres marked`);
  const aar = [...new Set(KONKURRENT_EVENTS.filter((e) => e.arkivId === id).map((e) => aarFor(e.uge)))].sort((a, b) => a - b);
  if (aar.length) dele.push(`ved en branchenyhed i ${aar[0]}`);
  if (dele.length === 0) return 'Låses op undervejs i spillet.';
  // "Låses op, når …" / "Låses op ved en branchenyhed …"
  const komma = /^(når|hvis)\b/.test(dele[0]) ? ',' : '';
  return `Låses op${komma} ${listeTekst(dele.slice(0, 3))}.`;
}

export type ArkivRaekke = { opslag: ArkivOpslag; nr: number; laast: boolean; hint: string };

/** Alle opslag i rækkefølge med status (ulåste står i game.arkiv) */
export function arkivListe(s: Pick<GameState, 'arkiv'>): ArkivRaekke[] {
  const aabne = new Set(s.arkiv ?? []);
  return ARKIV.map((opslag, i) => ({ opslag, nr: i + 1, laast: !aabne.has(opslag.id), hint: arkivHint(opslag.id) }));
}

/** Opslaget bag et id (også konkurrenternes alias-id'er), eller undefined */
export function arkivOpslag(id: string | undefined): ArkivOpslag | undefined {
  const a = arkivId(id);
  return a ? ARKIV_BY_ID[a] : undefined;
}

/** Arkiv-id for en nyhed (kun når der findes et opslag) */
export function nyhedArkivId(n: Pick<NewsItem, 'arkivId'>): string | undefined {
  return arkivOpslag(n.arkivId)?.id;
}

export function arkivNr(id: string): number {
  return ARKIV.findIndex((a) => a.id === id) + 1;
}
