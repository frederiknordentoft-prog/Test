import { describe, expect, it } from 'vitest';
import { hashState } from '../../src/sim/hash';
import { eksporterJson, importerJson, importerMedGrund, lagringVirker, tjekSave } from '../../src/store/persistence';
import { koer, nyt } from './helpers';

// Fase 8: import af eksporterede filer giver en venlig, præcis forklaring ved fejl og kaster aldrig.
describe('Import med grund', () => {
  const s = koer(nyt(11), 40);
  const fil = JSON.parse(eksporterJson(s)) as { app: string; state: Record<string, unknown> };
  const med = (state: Record<string, unknown>) => JSON.stringify({ ...fil, state: { ...fil.state, ...state } });

  it('en eksporteret fil (og en rå GameState) indlæses med samme hash', () => {
    const a = importerMedGrund(eksporterJson(s));
    expect(a.ok && hashState(a.state)).toBe(hashState(s));
    const b = importerMedGrund(JSON.stringify(s));
    expect(b.ok && hashState(b.state)).toBe(hashState(s));
  });

  it.each([
    ['tom fil', '   ', /tom/],
    ['ugyldig JSON', '{"app":"udfordreren","state":{', /ikke gyldig JSON/],
    ['et tal', '42', /ikke en gemt fil fra Udfordreren/],
    ['en liste', '[1,2]', /ikke en gemt fil fra Udfordreren/],
    ['null', 'null', /ikke en gemt fil fra Udfordreren/],
    ['en anden app', JSON.stringify({ app: 'noget-andet', state: {} }), /ikke en gemt fil fra Udfordreren/],
    ['nyere version', med({ version: 3 }), /nyere version/],
    ['ældre version', med({ version: 1 }), /anden version/],
    ['uden version', med({ version: undefined }), /anden version/],
    ['uden markeder', med({ markeder: undefined }), /mangler dele af spillet \(markeder\)/],
    ['medarbejder uden id', med({ staff: [{ navn: 'Ib' }] }), /mangler dele af spillet \(staff\)/],
    ['uge er tekst', med({ uge: 'x' }), /mangler dele af spillet \(uge\)/],
    ['ødelagt rng', med({ rngState: [1, 2, 'x', 4] }), /mangler dele af spillet \(rngState\)/],
  ])('%s giver en venlig fejl', (_navn, tekst, forventet) => {
    const r = importerMedGrund(tekst);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fejl).toMatch(forventet);
    expect(importerJson(tekst)).toBeNull();
  });

  it('en fil, der ser rigtig ud, men vælter simulationen, afvises pænt', () => {
    const markeder = Object.fromEntries(Object.entries(fil.state.markeder as Record<string, Record<string, unknown>>).map(([k, m]) => [k, { ...m, vertikaler: { betting: 'x' } }]));
    const r = tjekSave({ ...structuredClone(fil.state), markeder });
    expect('fejl' in r && r.fejl.grund).toBe('simulering');
  });

  it('uden IndexedDB (fx et privat vindue) melder lagringen sig som utilgængelig i stedet for at kaste', async () => {
    await expect(lagringVirker()).resolves.toBe(false);
  });
});
