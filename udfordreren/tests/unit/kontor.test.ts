// Pixelkontoret (fase 7): geometrien for AI-akten (serverskabe og hologrammer må ikke stå i folk og borde),
// forvandlingens tidslinje og trofæhyldens oversigt. Rene funktioner — ingen canvas.
import { describe, expect, it } from 'vitest';
import { AGENTER_PR_SKAB, BORD_W, LICENS_H, LICENS_W, SKAB_W, antalSkabe, layoutFor, type Felt } from '../../src/render/layout';
import { aktFor, daempning, forvandlingsVarighed, holoInd, neonTaend, skabInd, FORVANDLING } from '../../src/render/actChrome';
import { OFFICES } from '../../src/data/costs';
import { trofaeOversigt } from '../../src/ui/lib/trofaeHjaelp';
import { nyt } from './helpers';

const overlapper = (a: Felt, b: Felt) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Bord + person (personrammen starter 18 px over bordpladen; hår kan stikke 1-2 px op) */
const bordFelt = (x: number, y: number): Felt => ({ x, y: y - 20, w: BORD_W, h: 29 });

describe('Kontorets AI-zoner', () => {
  for (const o of OFFICES) {
    it(`${o.id}: skabe og hologrammer står inden for scenen og fri af borde og folk`, () => {
      const L = layoutFor(o.id);
      expect(L.pladser.length).toBe(o.pladser);
      expect(L.ai.skabe.length).toBeGreaterThan(0);
      expect(L.ai.holo.length).toBeGreaterThan(0);
      const borde = L.pladser.map((p) => bordFelt(p.x, p.y));
      const skabe = L.ai.skabe.map((s) => ({ x: s.x, y: s.y - L.ai.skabH, w: SKAB_W, h: L.ai.skabH }));
      const holo = L.ai.holo.map((p) => ({ x: p.x - 4, y: p.y - 15, w: 9, h: 16 }));
      for (const f of [...skabe, ...holo]) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.x + f.w).toBeLessThanOrEqual(L.w);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.y + f.h).toBeLessThanOrEqual(L.h);
        for (const b of borde) expect(overlapper(f, b), `${o.id}: ${JSON.stringify(f)} rammer bordet ${JSON.stringify(b)}`).toBe(false);
      }
      // skabene står ikke i hinanden
      for (let i = 0; i < skabe.length; i++) for (let j = i + 1; j < skabe.length; j++) expect(overlapper(skabe[i], skabe[j])).toBe(false);
    });

    it(`${o.id}: licensbeviserne hænger på væggen uden at dække hinanden`, () => {
      const L = layoutFor(o.id);
      const felter = L.licenser.map((p) => ({ x: p.x, y: p.y, w: LICENS_W, h: LICENS_H }));
      expect(felter.length).toBeGreaterThanOrEqual(2);
      for (const f of felter) expect(f.y + f.h).toBeLessThanOrEqual(L.vaegH);
      for (let i = 0; i < felter.length; i++) for (let j = i + 1; j < felter.length; j++) expect(overlapper(felter[i], felter[j])).toBe(false);
    });
  }

  it('serverskabene vokser med antallet af agenter (mindst ét, højst hvad trinnet har plads til)', () => {
    const L = layoutFor('hovedkontor');
    expect(antalSkabe(L, 0)).toBe(1);
    expect(antalSkabe(L, 1)).toBe(1);
    expect(antalSkabe(L, AGENTER_PR_SKAB + 1)).toBe(2);
    expect(antalSkabe(L, 9)).toBe(5);
    expect(antalSkabe(L, 999)).toBe(L.ai.skabe.length);
    expect(antalSkabe(layoutFor('kaelder'), 20)).toBe(layoutFor('kaelder').ai.skabe.length);
  });
});

describe('Akt-chrome og forvandlingen', () => {
  it('akterne følger årene', () => {
    expect(aktFor(0)).toBe('garage');
    expect(aktFor(3 * 52 - 1)).toBe('garage');
    expect(aktFor(3 * 52)).toBe('vaekst');
    expect(aktFor(14 * 52 - 1)).toBe('vaekst');
    expect(aktFor(14 * 52)).toBe('ai');
  });

  it('lyset dæmpes, neonen tænder, skabe rulles ind og hologrammerne kommer — i den rækkefølge', () => {
    expect(daempning(0)).toBe(0);
    expect(daempning(FORVANDLING.daempTil)).toBe(1);
    expect(neonTaend(FORVANDLING.neonFra - 1)).toBe(0);
    expect(neonTaend(FORVANDLING.neonTil)).toBe(1);
    expect(skabInd(FORVANDLING.skabFra, 0)).toBe(0);
    expect(skabInd(FORVANDLING.skabFra + FORVANDLING.skabVarighed, 0)).toBe(1);
    // skab nr. 2 kommer efter skab nr. 1
    expect(skabInd(FORVANDLING.skabFra + 200, 1)).toBeLessThan(skabInd(FORVANDLING.skabFra + 200, 0));
    expect(holoInd(FORVANDLING.holoFra - 1, 0)).toBe(0);
    expect(FORVANDLING.daempFra).toBeLessThan(FORVANDLING.neonFra);
    expect(FORVANDLING.neonFra).toBeLessThan(FORVANDLING.skabFra);
    expect(FORVANDLING.skabFra).toBeLessThan(FORVANDLING.holoFra);
  });

  it('forvandlingen tager nogle sekunder — og aldrig en evighed', () => {
    const kort = forvandlingsVarighed(1, 0);
    const lang = forvandlingsVarighed(14, 14);
    expect(kort).toBeGreaterThanOrEqual(3000);
    expect(lang).toBeGreaterThanOrEqual(kort);
    expect(lang).toBeLessThanOrEqual(6000);
    // alle hologrammer er helt fremme, før forvandlingen slutter
    expect(holoInd(lang, 13)).toBe(1);
    expect(skabInd(lang, 13)).toBe(1);
  });
});

describe('Trofæhylden', () => {
  it('tom hylde har en venlig tekst og ingen trofæer', () => {
    const s = nyt();
    const t = trofaeOversigt(s);
    expect(t.priserIalt).toBe(0);
    expect(t.kuponerIalt).toBe(0);
    expect(t.hof).toEqual([]);
    expect(t.tekst).toMatch(/tom/);
  });

  it('gallapriser, kuponer, Hall of Fame og licenser tælles og sorteres', () => {
    const s = nyt();
    const skabelon = s.produkter[0];
    for (let i = 0; i < 8; i++) {
      s.produkter.push({ ...structuredClone(skabelon), id: `p${i}`, navn: `Spil ${i}`, ejer: 'spiller', lanceretUge: i * 10, total40: 30 + i, guldkupon: i >= 1, hallOfFame: i >= 5 });
    }
    s.galla = [
      { aar: 2014, vundet: ['produkt'], kategorier: [] },
      { aar: 2015, vundet: [], kategorier: [] },
      { aar: 2016, vundet: ['innovation', 'platform'], kategorier: [] },
    ];
    s.markeder.dk.licens = 'aktiv';
    s.markeder.se.licens = 'suspenderet';
    const t = trofaeOversigt(s);
    expect(t.priserIalt).toBe(3);
    expect(t.priser.map((p) => p.aar)).toEqual([2016, 2014]); // nyeste først, tomme år springes over
    expect(t.kuponerIalt).toBe(7);
    expect(t.kuponer.length).toBe(6);
    expect(t.kuponer[0].navn).toBe('Spil 7'); // nyeste først
    expect(t.hof.map((p) => p.total40)).toEqual([37, 36, 35]); // bedste først
    expect(t.licenser.find((l) => l.marked === 'se')?.status).toBe('suspenderet');
    expect(t.licenser.some((l) => l.marked === 'uk')).toBe(s.markeder.uk.licens !== 'ingen');
    expect(t.tekst).toMatch(/aktiv/);
  });
});
