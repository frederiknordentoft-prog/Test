// Rettelser fra playtesten af fase 7-8: kassens "rækker ~N uger" uden engangsudgifter, nødgem ved reload,
// eftertanke fyldt op til tre, Arkivets dobbelte sætning, nyt spil på pause og Knuds råd om markedsstandarden.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { EFTERTANKE } from '../../src/data/archive';
import { stepMut } from '../../src/sim/step';
import { kassenRaekker, ugentligTendens } from '../../src/ui/lib/kasseHjaelp';
import { forspilGentager } from '../../src/ui/lib/arkivHjaelp';
import { delEftertanke, eftertankeKort } from '../../src/ui/lib/slutHjaelp';
import { hallOfFameMangler, scoreFald } from '../../src/ui/lib/standardHjaelp';
import { listSaves, noedGem, hent } from '../../src/store/persistence';
import { GRUND_START, useGame } from '../../src/store/gameStore';
import { koer, nyt } from './helpers';

describe('kassen rækker', () => {
  it('tæller ikke en kontorflytning som ugentligt forbrug', () => {
    const s = koer(nyt(7), 4);
    s.kapital = 1.33;
    const foer = ugentligTendens(s);
    stepMut(s, [{ t: 'upgradeOffice' }]);
    expect(s.kontor).toBe('kaelder');
    // Kvartalets resultat rummer flytningen (−1,2 mio.), men tendensen er stadig kun den løbende drift
    expect(s.kvartalAkk.resultat).toBeLessThan(-1);
    const efter = ugentligTendens(s);
    expect(Math.abs(efter - foer)).toBeLessThan(0.05);
    const k = kassenRaekker(s);
    if (k) expect(k.uger).toBeGreaterThan(0);
  });
});

describe('nødgem', () => {
  it('en synkron kopi i localStorage flyttes ind i autosave-pladsen ved næste indlæsning', async () => {
    const lager = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => lager.get(k) ?? null,
      setItem: (k: string, v: string) => void lager.set(k, v),
      removeItem: (k: string) => void lager.delete(k),
      clear: () => lager.clear(),
      key: () => null,
      length: 0,
    };
    const s = koer(nyt(11), 3);
    expect(noedGem(s)).toBe(true);
    const liste = await listSaves();
    expect(liste.find((r) => r.slot === 'auto')?.uge).toBe(s.uge);
    expect(lager.size).toBe(0);
    expect((await hent('auto'))?.uge).toBe(s.uge);
  });
});

describe('eftertanke', () => {
  it('fylder op til tre kort og siger ikke "I solgte firmaet", når statsselskabet købte af sig selv', () => {
    const s = nyt(3);
    s.slut = { id: 'danskeLykke', vaerdi: 100, eftermaele: 50, uge: 1247 };
    s.eftermaeleAkk.risikoSum = 0.08;
    s.eftermaeleAkk.risikoProever = 1;
    const valgt = EFTERTANKE.filter((k) => k.id === 'opkoebt' || k.id === 'danmarkStart');
    const kort = eftertankeKort(s, valgt);
    expect(kort).toHaveLength(3);
    const koebt = kort.find((k) => k.id === 'opkoebt');
    expect(koebt?.tekst).not.toContain('I solgte firmaet');
    for (const k of kort) {
      const d = delEftertanke(k.tekst);
      expect(d.jeres).not.toContain('I virkeligheden');
      expect(d.virkelighed ?? '').toMatch(/^I virkeligheden/);
    }
  });
});

describe('Arkivet', () => {
  it('skjuler et forspil, der kun gentager opslagets tal', () => {
    const tekst = 'I virkeligheden havde 5,2 % af voksne danskere mindst et lavt niveau af pengespilsproblemer i 2016 og 10,9 % i 2021.';
    expect(forspilGentager('I virkeligheden havde 10,9 % af voksne danskere mindst et lavt problemniveau i 2021.', tekst)).toBe(true);
    expect(forspilGentager('I virkeligheden var den danske kanalisering 91,5 % i 2024.', tekst)).toBe(false);
    expect(forspilGentager('Et forspil uden tal.', tekst)).toBe(false);
  });
});

describe('nyt spil', () => {
  it('starter på pause, til spilleren er klar', () => {
    useGame.getState().nytSpil({ seed: 9, firmaNavn: 'Pausehuset', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: true });
    const st = useGame.getState();
    expect(st.paused).toBe(true);
    expect(st.pauseGrunde).toContain(GRUND_START);
  });
});

describe('anmeldelser', () => {
  it('Knud forklarer markedsstandarden, når scoren falder med mindst 3', () => {
    const s = nyt(5);
    const skabelon = s.produkter.find((p) => p.ejer !== 'spiller');
    expect(skabelon).toBeDefined();
    if (!skabelon) return;
    s.uge = 60;
    const a = { ...structuredClone(skabelon), id: 'x1', navn: 'Første', ejer: 'spiller', total40: 22, lanceretUge: 20 };
    const b = { ...structuredClone(skabelon), id: 'x2', navn: 'Anden', ejer: 'spiller', total40: 14, lanceretUge: 58 };
    s.produkter.push(a, b);
    const f = scoreFald(s);
    expect(f?.produktId).toBe('x2');
    expect(f?.spring.til).toBeGreaterThan(f?.spring.fra ?? Infinity);
    b.total40 = 21;
    expect(scoreFald(s)).toBeNull();
  });

  it('forklarer, når 36 point ikke giver Hall of Fame (typeniveauet mangler)', () => {
    const s = nyt(5);
    const p = { ...structuredClone(s.produkter[0]), ejer: 'spiller', total40: 38, hallOfFame: false };
    s.niveauer.type[p.typeId] = 3;
    expect(hallOfFameMangler(s, p)).toEqual({ niveau: 3, krav: 7 });
    s.niveauer.type[p.typeId] = 7;
    expect(hallOfFameMangler(s, p)).toBeNull();
  });
});
