// Ugentlig Top 10 pr. marked (spec 6.3) med egne og konkurrenters produkter, pile og "NY!".
// Listen rangerer efter ugens nye spillere pr. produkt — det nærmeste, en spiludbyder kommer på
// Game Dev Storys ugentlige salg — så en stærk lancering kan storme listen og derefter glide ned.
import type { ChartEntry, GameState, MarketId } from './types';
import { MARKETS } from '../data/markets';
import { nyhed, signal } from './util';

export function beregnTop10(s: GameState, m: MarketId): ChartEntry[] {
  const forrige = new Map(s.markeder[m].top10.map((e) => [e.productId, e.placering]));
  const nye = (p: (typeof s.produkter)[number]) => p.nyeSpillerePrUge?.[m] ?? 0;
  const kandidater = s.produkter
    .filter((p) => p.aktiv && nye(p) > 0)
    .sort((a, b) => nye(b) - nye(a) || (b.bsiPrUge[m] ?? 0) - (a.bsiPrUge[m] ?? 0) || (a.id < b.id ? -1 : 1))
    .slice(0, 10);
  return kandidater.map((p, i) => ({
    productId: p.id,
    placering: i + 1,
    forrige: forrige.get(p.id) ?? null,
    ny: p.bedstePlacering[m] === undefined,
  }));
}

export function ugentligHitliste(s: GameState): void {
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    if (m === 'dk' && s.markeder.dk.top10.some((e) => s.produkter.find((p) => p.id === e.productId)?.ejer === 'spiller')) {
      s.kvartalAkk.top10Uger = (s.kvartalAkk.top10Uger ?? 0) + 1;
    }
    const ms = s.markeder[m];
    if (!ms.aaben) {
      ms.top10 = [];
      continue;
    }
    ms.top10 = beregnTop10(s, m);
    for (const e of ms.top10) {
      const p = s.produkter.find((x) => x.id === e.productId);
      if (!p) continue;
      const foer = p.bedstePlacering[m];
      if (foer === undefined || e.placering < foer) p.bedstePlacering[m] = e.placering;
      p.ugerITop10 += 1;
      if (p.ejer !== 'spiller') continue;
      if (foer === undefined) {
        // Hvert produkts første gang på listen fejres; første gang nogensinde er en milepæl
        const foersteGang = s.milepaele.foersteTop10 === undefined;
        if (foersteGang) s.milepaele.foersteTop10 = s.uge;
        signal(s, { k: 'top10', productId: p.id, marked: m, placering: e.placering, foersteGang });
        nyhed(s, `${p.navn} går ind på Top 10 i ${MARKETS[m].navn} som nr. ${e.placering}!`, 'firma');
      }
      if (e.placering === 1 && (foer === undefined || foer > 1)) {
        if (m === 'dk' && s.milepaele.foersteNr1Dk === undefined) s.milepaele.foersteNr1Dk = s.uge;
        signal(s, { k: 'nr1', productId: p.id, marked: m });
        nyhed(s, `${p.navn} er nr. 1 i ${MARKETS[m].navn}!`, 'firma');
      }
    }
  }
}
