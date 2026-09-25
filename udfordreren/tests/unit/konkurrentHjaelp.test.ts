// UI-hjælpere til Konkurrenter- og Platform-panelet: de skal følge sim-kernens regler.
import { describe, expect, it } from 'vitest';
import { makeRng, seedState } from '../../src/sim/rng';
import { kvartalsReaktioner } from '../../src/sim/reactions';
import { opkoebStatus } from '../../src/sim/competitors';
import { PLATFORM_MODELS } from '../../src/data/platforms';
import {
  aggressionsIndeks, afbrydRefusion, b2bIndtaegt, bedsteProdukt, konkurrentStatus, migreringFremdrift, migreringsTid, sidsteTekst, sponsorMaxBud, tilSalg,
} from '../../src/ui/lib/konkurrentHjaelp';
import { nyt } from './helpers';

describe('konkurrentHjaelp', () => {
  it('tilSalg følger opkoebStatus, når kassen er stor nok', () => {
    const s = nyt(3);
    s.kapital = 1e7;
    for (const c of s.konkurrenter) expect(tilSalg(c)).toBe(opkoebStatus(s, c).ok);
  });

  it('aggressionsIndeks rammer samme tærskel som R8 i sim-kernen', () => {
    const s = nyt(4);
    s.markeder.dk.licens = 'aktiv';
    s.bonusNiveau = 3;
    s.vipProgram = 2;
    s.marketingMix.tv = 0.2;
    const idx = aggressionsIndeks(s, 'dk');
    expect(idx.total).toBeGreaterThanOrEqual(idx.taerskel);
    s.aggressionKvartaler.dk = 1;
    kvartalsReaktioner(s, makeRng(seedState(9)));
    expect(s.reaktioner.some((r) => r.regel === 'R8' && r.marked === 'dk')).toBe(true);

    const t = nyt(4);
    t.markeder.dk.licens = 'aktiv';
    t.bonusNiveau = 1;
    expect(aggressionsIndeks(t, 'dk').total).toBeLessThan(idx.taerskel);
    t.aggressionKvartaler.dk = 1;
    kvartalsReaktioner(t, makeRng(seedState(9)));
    expect(t.reaktioner.some((r) => r.regel === 'R8')).toBe(false);
  });

  it('status, bedste produkt og startteksten', () => {
    const s = nyt(5);
    const dl = s.konkurrenter.find((c) => c.id === 'danskeLykke')!;
    expect(konkurrentStatus(s, dl).kind).toBe('aktiv');
    expect(bedsteProdukt(s, 'danskeLykke')?.ejer).toBe('danskeLykke');
    const agentix = s.konkurrenter.find((c) => c.id === 'agentix')!;
    expect(konkurrentStatus(s, agentix).kind).toBe('kommer');
    const veikko = s.konkurrenter.find((c) => c.id === 'veikko')!;
    expect(sidsteTekst(s, veikko)).toMatch(/Finland/);
  });

  it('platform: migreringstid, fremdrift, refusion og B2B', () => {
    expect(migreringsTid(PLATFORM_MODELS.whiteLabel.uger)).toBe('Straks');
    expect(migreringsTid(PLATFORM_MODELS.turnkey.uger)).toBe('6-12 mdr.');
    expect(migreringsTid(PLATFORM_MODELS.hybrid.uger)).toBe('1-2 år');
    expect(migreringsTid(PLATFORM_MODELS.egen.uger)).toBe('ca. 3 år');
    const s = nyt(6);
    const p = s.platforme.sportsbook;
    p.migrererTil = 'hybrid';
    p.migreringStartUge = s.uge;
    p.migreringFaerdigUge = s.uge + 60;
    s.uge += 15;
    expect(migreringFremdrift(s, p)?.andel).toBeCloseTo(0.25);
    expect(afbrydRefusion(p)).toBe(PLATFORM_MODELS.hybrid.capex / 2);
    p.model = 'egen';
    p.b2bKunder = 2;
    p.kvalitet = 100;
    expect(b2bIndtaegt(p)).toBeCloseTo(0.06);
  });

  it('sponsorMaxBud svarer til bydSponsorats kassegrænse', () => {
    const s = nyt(7);
    s.kapital = 10;
    const a = { id: 'x', navn: 'Test', marked: 'dk' as const, afgoeresUge: 10, mindstebud: 1, spillerBud: null, varighedUger: 104 };
    expect(sponsorMaxBud(s, a)).toBeCloseTo((10 * 3 + 5) / 2);
  });
});
