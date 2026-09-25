// Dialog-tempo i mange markeder: ugens Top 10/nr. 1, påbud, sanktioner og regler samles, før de når dialogkøen.
import { describe, expect, it } from 'vitest';
import type { GameState, LiveProduct, MarketId, Signal } from '../../src/sim/types';
import { samlSignaler } from '../../src/ui/lib/dialogSamling';
import { nyt } from './helpers';

const SEKS: MarketId[] = ['dk', 'uk', 'se', 'de', 'nl', 'on'];

function medProdukt(s: GameState, id: string, bedste: Partial<Record<MarketId, number>> = {}): GameState {
  s.produkter.push({ id, navn: 'Lykkehjulet', ejer: 'spiller', aktiv: true, bedstePlacering: bedste } as unknown as LiveProduct);
  return s;
}

describe('samlSignaler', () => {
  it('nr. 1 i seks markeder samme uge giver én fejring, og Top 10 for samme marked droppes', () => {
    const foer = medProdukt(nyt(1), 'p1');
    const ny = structuredClone(foer);
    const sig: Signal[] = [{ k: 'regel', marked: 'uk', regelId: 'ukSlotgraenser', varsel: true }];
    for (const m of SEKS) sig.push({ k: 'top10', productId: 'p1', marked: m, placering: 1 }, { k: 'nr1', productId: 'p1', marked: m });
    sig.push({ k: 'messeVarsel', expoId: 'x' });
    const r = samlSignaler(foer, ny, sig);
    const kinds = r.dialoger.map((d) => d.signal.k);
    expect(kinds).toEqual(['regel', 'nr1', 'messeVarsel']);
    const fejring = r.dialoger[1];
    expect(fejring.gruppe?.length).toBe(6);
    expect(fejring.gruppe?.every((x) => x.k === 'nr1')).toBe(true);
    // Hjemmemarkedet står først
    expect(fejring.signal.k === 'nr1' && fejring.signal.marked).toBe('dk');
    // Alle Top 10-signalerne og de fem andre nr. 1 er foldet ind (ingen egne toasts eller pauser)
    expect(sig.filter((x) => r.stille.has(x)).length).toBe(11);
  });

  it('et produkt, der allerede har været nr. 1, får kun en toast for nr. 1 i et udenlandsk marked', () => {
    const foer = medProdukt(nyt(2), 'p1', { dk: 1, uk: 3 });
    const ny = structuredClone(foer);
    const sig: Signal[] = [
      { k: 'nr1', productId: 'p1', marked: 'uk' },
      { k: 'top10', productId: 'p1', marked: 'se', placering: 4 },
    ];
    const r = samlSignaler(foer, ny, sig);
    expect(r.dialoger).toEqual([]);
    expect(r.toasts).toHaveLength(1);
    expect(r.toasts[0].tekst).toContain('nr. 1 i UK');
    expect(r.toasts[0].tekst).toContain('SE (nr. 4)');
    expect(sig.every((x) => r.stille.has(x))).toBe(true);
  });

  it('første Top 10 nogensinde får altid en dialog — også i et udenlandsk marked', () => {
    const foer = medProdukt(nyt(3), 'p1');
    const sig: Signal[] = [{ k: 'top10', productId: 'p1', marked: 'uk', placering: 8, foersteGang: true }];
    const r = samlSignaler(foer, structuredClone(foer), sig);
    expect(r.dialoger).toHaveLength(1);
    expect(r.toasts).toHaveLength(0);
  });

  it('påbud og bonuskrig samles pr. regel', () => {
    const s = nyt(4);
    const sig: Signal[] = [
      ...(['dk', 'uk', 'se', 'de', 'nl'] as MarketId[]).map((m): Signal => ({ k: 'reaktion', regel: 'R8', tekst: `påbud ${m}`, marked: m })),
      { k: 'reaktion', regel: 'R1', tekst: 'krig uk', marked: 'uk', competitorId: 'a' },
      { k: 'reaktion', regel: 'R1', tekst: 'krig de', marked: 'de', competitorId: 'b' },
    ];
    const r = samlSignaler(s, structuredClone(s), sig);
    expect(r.dialoger).toHaveLength(2);
    expect(r.dialoger[0].gruppe?.length).toBe(5);
    expect(r.dialoger[1].gruppe?.length).toBe(2);
  });

  it('sanktioner samme uge bliver én dialog med den alvorligste først', () => {
    const s = nyt(5);
    const sig: Signal[] = [
      { k: 'sanktion', marked: 'dk', trin: 1 },
      { k: 'sanktion', marked: 'de', trin: 3 },
      { k: 'sanktion', marked: 'nl', trin: 2, boede: 1.2 },
    ];
    const r = samlSignaler(s, structuredClone(s), sig);
    expect(r.dialoger).toHaveLength(1);
    expect(r.dialoger[0].gruppe?.map((x) => (x.k === 'sanktion' ? x.trin : 0))).toEqual([3, 2, 1]);
    expect(r.dialoger[0].signal).toBe(r.dialoger[0].gruppe?.[0]);
  });

  it('en varslet regel i kraft er en toast — medmindre den lofter jeres bonus', () => {
    const lav = nyt(6);
    lav.bonusNiveau = 0;
    lav.planlagteRegler.push({ marked: 'dk', regelId: 'dkSpilpakke1', ikrafttraedelseUge: lav.uge + 1, annonceret: true, dynamisk: false });
    const lavNy = structuredClone(lav);
    lavNy.planlagteRegler = [];
    lavNy.markeder.dk.regler.push('dkSpilpakke1');
    const sig: Signal[] = [{ k: 'regel', marked: 'dk', regelId: 'dkSpilpakke1', varsel: false }];
    const r1 = samlSignaler(lav, lavNy, sig);
    expect(r1.dialoger).toHaveLength(0);
    expect(r1.toasts[0].tekst).toContain('gælder nu');

    const hoej = structuredClone(lav);
    hoej.bonusNiveau = 3;
    const hoejNy = structuredClone(lavNy);
    hoejNy.bonusNiveau = 3;
    const r2 = samlSignaler(hoej, hoejNy, sig);
    expect(r2.dialoger).toHaveLength(1);
    expect(r2.toasts).toHaveLength(0);

    // Uden varsel (reglen var ikke planlagt): altid en dialog
    const uvarslet = structuredClone(lav);
    uvarslet.planlagteRegler = [];
    expect(samlSignaler(uvarslet, lavNy, sig).dialoger).toHaveLength(1);
  });
});
