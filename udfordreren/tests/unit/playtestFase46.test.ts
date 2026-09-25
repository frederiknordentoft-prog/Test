// Rettelser fra playtesten af fase 4-6-UI'et: eftertanke uden rigtige navne, reaktionstekster, opkøbsgrund,
// pause ved ledigt hold, forældede toasts og debug-hoppets eventvalg.
// (Event-chips tjekkes i browseren: firmaHjaelp importerer kit.tsx, som testkonfigurationen ikke kan typetjekke.)
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { EFTERTANKE } from '../../src/data/archive';
import { COMPETITORS } from '../../src/data/competitors';
import { R8 } from '../../src/data/reactionRules';
import { delEftertanke } from '../../src/ui/lib/slutHjaelp';
import { REGEL_FORKLARING, opkoebGrund } from '../../src/ui/lib/konkurrentHjaelp';
import { opkoebStatus } from '../../src/sim/competitors';
import { GRUND_LEDIGT_HOLD, LEDIG_PAUSE_UGER, useGame } from '../../src/store/gameStore';
import type { ReaktionsRegel } from '../../src/sim/types';
import { nyt } from './helpers';

describe('eftertanke', () => {
  it('kortets del indeholder aldrig "I virkeligheden" (rigtige navne står kun i Arkivet)', () => {
    for (const k of EFTERTANKE) {
      const d = delEftertanke(k.tekst);
      expect(d.jeres).not.toContain('I virkeligheden');
      expect(d.jeres.length).toBeGreaterThan(5);
      expect(d.virkelighed ?? '').toMatch(/^I virkeligheden/);
    }
  });
});

describe('reaktionsforklaringer', () => {
  const ALLE: ReaktionsRegel[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'];
  it('findes for alle regler og indeholder ingen interne arketype-id\'er', () => {
    for (const r of ALLE) {
      const f = REGEL_FORKLARING[r];
      expect(f.hvis.length).toBeGreaterThan(5);
      expect(`${f.hvis} ${f.saa}`).not.toMatch(/appFirst|globalGigant|nordiskLicensgruppe|lokalSpecialist|b2bBygget|predictionMarket|aiNative|≥/);
    }
  });
  it('R8 følger sim-kernen: branchens omdømme falder med R8.omdoemme ved hvert tredje påbud', () => {
    expect(REGEL_FORKLARING.R8.saa).toContain(`omdømme (også jeres) falder ${Math.abs(R8.omdoemme)}`);
  });
});

describe('opkoebGrund', () => {
  it('bruger samme format som knappen (mio()), ikke sim-kernens rå "Kræver N mio. kr."', () => {
    const s = nyt();
    const c = s.konkurrenter.find((x) => COMPETITORS.some((d) => d.id === x.id) && x.arketype !== 'statsselskab' && x.arketype !== 'globalGigant' && x.styrke <= 3.5);
    if (!c) return;
    c.tilstede = true;
    s.kapital = 0.1;
    const st = opkoebStatus(s, c);
    const g = opkoebGrund(s, st);
    expect(g).toMatch(/^I mangler /);
    expect(g).not.toMatch(/\.\.$/);
  });
});

describe('gameStore', () => {
  it('pauser, når hele holdet har været ledigt i et par uger (også uden sim-kernens ledig-signal)', () => {
    const st = useGame.getState();
    st.nytSpil({ seed: 5, firmaNavn: 'Testhuset', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
    for (let i = 0; i < LEDIG_PAUSE_UGER; i++) {
      useGame.setState({ dialoger: [], paused: false, pauseGrunde: [] });
      useGame.getState().stepUge();
    }
    const nu = useGame.getState();
    expect(nu.ledigeUger).toBeGreaterThanOrEqual(LEDIG_PAUSE_UGER);
    expect(nu.paused).toBe(true);
    expect(nu.pauseGrunde).toContain(GRUND_LEDIGT_HOLD);
  });

  it('smider toasts væk, der er mere end to spiluger gamle', () => {
    const st = useGame.getState();
    st.nytSpil({ seed: 6, firmaNavn: 'Testhuset', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
    useGame.getState().toast('Gammel nyhed', 'info');
    for (let i = 0; i < 4; i++) {
      useGame.setState({ dialoger: [], paused: false });
      useGame.getState().stepUge();
    }
    expect(useGame.getState().toasts.some((t) => t.tekst === 'Gammel nyhed')).toBe(false);
  });

  it('debug-hoppet vælger ikke "skru op for marketing" igen og igen', () => {
    const st = useGame.getState();
    st.nytSpil({ seed: 7, firmaNavn: 'Testhuset', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
    useGame.getState().debugSaet((s) => {
      s.marketingMix.soeg = 1;
      s.ventendeEvents.push({ eventId: 'investorPres', uge: s.uge, ctx: {} });
    });
    useGame.getState().debugHopTilAar(2013);
    const g = useGame.getState().game!;
    const valg = g.eventLog.filter((e) => e.eventId === 'investorPres').map((e) => e.valg);
    expect(valg.length).toBeGreaterThan(0);
    expect(valg).not.toContain(0);
  });
});
