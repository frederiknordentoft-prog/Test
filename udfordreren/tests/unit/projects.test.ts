import { describe, expect, it } from 'vitest';
import { applyActionMut } from '../../src/sim/actions';
import { makeRng } from '../../src/sim/rng';
import { stepMut } from '../../src/sim/step';
import { budgetFaktor, minBudget, personPoint, typeStatus, ledigeTilProjekt, boostEffekt } from '../../src/sim/projects';
import { BALANCE } from '../../src/data/balance';
import { BOOST } from '../../src/data/costs';
import type { Action, GameState, Project } from '../../src/sim/types';
import { fejl, koer, nyt } from './helpers';

const PREMATCH: Extract<Action, { t: 'startProject' }>['project'] = {
  navn: 'Første', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.07, intensitet: 3, budget: 0.15,
};

function start(s: GameState, p = PREMATCH): Project {
  applyActionMut(s, makeRng(s.rngState), { t: 'startProject', project: p });
  return s.projekter[s.projekter.length - 1];
}

describe('Projektfaser', () => {
  it('starter i koncept med alle ledige tildelt og trækker budgettet', () => {
    const s = nyt();
    const p = start(s);
    expect(p.fase).toBe('koncept');
    expect(p.faseTildeling.koncept.length).toBe(2);
    expect(s.kapital).toBeCloseTo(2 - 0.15, 5);
    expect(p.faseLaengde).toEqual({ koncept: 2, design: 3, teknik: 3, test: 2 });
    expect(p.foersteForsoeg).toBe(true);
  });

  it('går igennem Koncept → Design → Teknik → Test og bliver klar', () => {
    const s = nyt();
    const p = start(s);
    const faser: string[] = [];
    for (let i = 0; i < 12; i++) {
      stepMut(s, []);
      for (const sig of s.signaler) if (sig.k === 'fase') faser.push(sig.til);
    }
    expect(faser).toEqual(['design', 'teknik', 'test']);
    const q = s.projekter.find((x) => x.id === p.id)!;
    expect(q.klar).toBe(true);
    expect(s.signaler.some((x) => x.k === 'klar') || q.klar).toBe(true);
  });

  it('koncept giver mest originalitet, teknik giver teknik og fejl, test fjerner fejl og giver tryghed', () => {
    const s = nyt();
    const p = start(s);
    koer(s, 2);
    const efterKoncept = { ...s.projekter[0].params };
    expect(efterKoncept.originalitet).toBeGreaterThan(efterKoncept.spaending);
    expect(efterKoncept.teknik).toBe(0);
    koer(s, 3); // design
    koer(s, 3); // teknik
    const efterTeknik = s.projekter[0];
    expect(efterTeknik.params.teknik).toBeGreaterThan(efterKoncept.teknik);
    expect(efterTeknik.fejl).toBeGreaterThan(0);
    const fejlFoerTest = efterTeknik.fejl;
    const tryghedFoerTest = efterTeknik.params.tryghed;
    koer(s, 2); // test
    expect(s.projekter[0].fejl).toBeLessThan(fejlFoerTest);
    expect(s.projekter[0].params.tryghed).toBeGreaterThan(tryghedFoerTest);
    expect(p.id).toBe(s.projekter[0].id);
  });

  it('point-signaler udsendes pr. arbejdende medarbejder', () => {
    const s = nyt();
    start(s);
    stepMut(s, []);
    const point = s.signaler.filter((x) => x.k === 'point');
    expect(point.length).toBe(2);
  });

  it('en fase uden tildeling står stille', () => {
    const s = nyt();
    const p = start(s);
    applyActionMut(s, makeRng(s.rngState), { t: 'assignPhase', projectId: p.id, fase: 'koncept', ids: [] });
    koer(s, 3);
    const q = s.projekter[0];
    expect(q.fase).toBe('koncept');
    expect(q.faseUge).toBe(0);
    expect(q.params.originalitet).toBe(0);
  });

  it('nye faser arver forrige fases hold, hvis de er tomme', () => {
    const s = nyt();
    const p = start(s);
    const id = s.staff[0].id;
    applyActionMut(s, makeRng(s.rngState), { t: 'assignPhase', projectId: p.id, fase: 'design', ids: [] });
    applyActionMut(s, makeRng(s.rngState), { t: 'assignPhase', projectId: p.id, fase: 'koncept', ids: [id] });
    koer(s, 2);
    expect(s.projekter[0].fase).toBe('design');
    expect(s.projekter[0].faseTildeling.design).toEqual([id]);
  });

  it('boost koster indsigt, virker og er begrænset til 3', () => {
    const s = nyt();
    const p = start(s);
    s.indsigt = 100;
    const effekt = boostEffekt(s, s.projekter[0]);
    const rng = makeRng(s.rngState);
    for (let i = 0; i < 3; i++) applyActionMut(s, rng, { t: 'boost', projectId: p.id, param: 'spaending' });
    expect(s.projekter[0].params.spaending).toBeCloseTo(3 * effekt, 5);
    expect(s.indsigt).toBe(100 - BOOST.indsigt[0] - BOOST.indsigt[1] - BOOST.indsigt[2]);
    s.signaler = [];
    applyActionMut(s, rng, { t: 'boost', projectId: p.id, param: 'spaending' });
    expect(fejl(s).length).toBe(1);
  });

  it('test kan forlænges og fjerner flere fejl', () => {
    const s = nyt();
    const p = start(s);
    koer(s, 8); // til test
    expect(s.projekter[0].fase).toBe('test');
    applyActionMut(s, makeRng(s.rngState), { t: 'extendTest', projectId: p.id, uger: 2 });
    expect(s.projekter[0].faseLaengde.test).toBe(4);
    koer(s, 2);
    expect(s.projekter[0].klar).toBe(false);
    koer(s, 2);
    expect(s.projekter[0].klar).toBe(true);
  });

  it('afviser ugyldige projekter med forklaring', () => {
    const s = nyt();
    const rng = makeRng(s.rngState);
    applyActionMut(s, rng, { t: 'startProject', project: { ...PREMATCH, typeId: 'livebetting', margin: 0.09, budget: 0.3 } });
    expect(fejl(s)[0]).toMatch(/oddssætter/);
    s.signaler = [];
    applyActionMut(s, rng, { t: 'startProject', project: { ...PREMATCH, margin: 0.2 } });
    expect(fejl(s)[0]).toMatch(/[Mm]argin/);
    s.signaler = [];
    applyActionMut(s, rng, { t: 'startProject', project: { ...PREMATCH, typeId: 'slotsAggregator', themeId: 'eventyr', margin: 0.04 } });
    expect(fejl(s)[0]).toMatch(/licens/i);
    s.signaler = [];
    applyActionMut(s, rng, { t: 'startProject', project: { ...PREMATCH, budget: 0.01 } });
    expect(fejl(s)[0]).toMatch(/[Bb]udget/);
    expect(s.projekter.length).toBe(0);
  });

  it('garagen kan kun rumme ét projekt ad gangen', () => {
    const s = nyt();
    start(s);
    applyActionMut(s, makeRng(s.rngState), { t: 'startProject', project: PREMATCH });
    expect(s.projekter.length).toBe(1);
    expect(fejl(s)[0]).toMatch(/projekt/);
  });

  it('lancering kræver aktiv licens (12 uger)', () => {
    const s = nyt();
    const p = start(s);
    koer(s, 10);
    expect(s.projekter[0].klar).toBe(true);
    applyActionMut(s, makeRng(s.rngState), { t: 'launch', projectId: p.id });
    expect(fejl(s)[0]).toMatch(/[Ll]icens/);
    koer(s, 2);
    expect(s.markeder.dk.vertikaler.betting.status).toBe('aktiv');
    s.signaler = [];
    applyActionMut(s, makeRng(s.rngState), { t: 'launch', projectId: p.id });
    expect(fejl(s)).toEqual([]);
    expect(s.produkter.some((x) => x.ejer === 'spiller' && x.navn === 'Første')).toBe(true);
  });

  it('holdvægt: n-te person bidrager med 0,5^(n−1)', () => {
    expect(BALANCE.holdVaegt).toBe(0.5);
    const s = nyt();
    const p = start(s);
    const m = s.staff[0];
    const pp = personPoint(m, p, 'design');
    expect(pp).toBeGreaterThan(0);
    // træt medarbejder giver færre point
    const traet = { ...m, energi: 0 };
    expect(personPoint(traet, p, 'design')).toBeLessThan(pp);
  });

  it('budgetfaktor stiger logaritmisk og er loftet', () => {
    expect(budgetFaktor(0.15, 0.15)).toBe(1);
    expect(budgetFaktor(0.3, 0.15)).toBeCloseTo(1 + BALANCE.budgetLog, 5);
    expect(budgetFaktor(100, 0.15)).toBe(BALANCE.budgetMax);
    const s = nyt();
    expect(minBudget(s, 'prematch')).toBeCloseTo(0.15, 5);
  });

  it('livebetting låses op, når oddssætteren når niveau 2', () => {
    const s = nyt();
    expect(typeStatus(s, 'livebetting').ok).toBe(false);
    s.staff.find((m) => m.rolle === 'oddssaetter')!.niveau = 2;
    expect(typeStatus(s, 'livebetting').ok).toBe(true);
  });

  it('medarbejdere på kontrakt er ikke ledige til projekter', () => {
    const s = nyt();
    const offer = s.kontraktTilbud[0];
    applyActionMut(s, makeRng(s.rngState), { t: 'takeContract', contractId: offer.id, staff: [s.staff[0].id] });
    expect(ledigeTilProjekt(s).map((m) => m.id)).toEqual([s.staff[1].id]);
  });
});
