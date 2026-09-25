// Marked-panelets nye visninger fra insider-spiltesten: pres-loggen, afgiftsstigningens præcise pp og faste afgiftstrin.
import { describe, expect, it } from 'vitest';
import { nyt } from './helpers';
import { ugeFor } from '../../src/sim/time';
import { aendrPres } from '../../src/sim/util';
import { annoncer } from '../../src/sim/regulation';
import type { GameState, MarketId } from '../../src/sim/types';

// markedHjaelp og tvaersHjaelp importerer ikon-typen fra kit.tsx, som tsconfig.node.json ikke oversætter (ingen JSX):
// modulerne hentes dynamisk med de få typer, testen bruger
type PresPost = { uge: number; kilde: string; delta: number };
type Kommende = { id: string; navn: string; beskrivelse: string; uge: number; dynamisk: boolean; tal?: string; op?: boolean };
type MarkedHjaelp = {
  kommendeAfgifter(g: GameState, m: MarketId, horisont?: number): Kommende[];
  kommendeRegler(g: GameState, m: MarketId): Kommende[];
  presDeltaTekst(d: number): string;
  presHistorik(g: GameState, m: MarketId): PresPost[];
  presOverskrift(p: PresPost[]): string;
  regelBeskrivelseMedPp(regelId: string, pp?: number): string;
};
type TvaersHjaelp = {
  regelIkraft(g: GameState, m: MarketId, regelId: string): { uge: number; dynamisk: boolean; pp?: number } | null;
  regelKonsekvenser(g: GameState, m: MarketId, regelId: string, pp?: number): { tekst: string }[];
};
const sti = (navn: string) => `../../src/ui/lib/${navn}.ts`;
const { kommendeAfgifter, kommendeRegler, presDeltaTekst, presHistorik, presOverskrift, regelBeskrivelseMedPp } = (await import(/* @vite-ignore */ sti('markedHjaelp'))) as MarkedHjaelp;
const { regelIkraft, regelKonsekvenser } = (await import(/* @vite-ignore */ sti('tvaersHjaelp'))) as TvaersHjaelp;

describe('politisk pres: hvor kom det fra?', () => {
  it('viser de seneste ændringer med kilde og fortegn, nyeste først', () => {
    const s = nyt();
    s.uge = 100;
    aendrPres(s, 'dk', 1, 'Medieskandale');
    s.uge = 113;
    aendrPres(s, 'dk', -0.5, 'Lobby bag lukkede døre');
    const p = presHistorik(s, 'dk');
    expect(p.map((x) => x.kilde)).toEqual(['Lobby bag lukkede døre', 'Medieskandale']);
    expect(p.map((x) => presDeltaTekst(x.delta))).toEqual(['−0,5', '+1']);
    expect(presOverskrift(p)).toBe('Hvorfor presset steg og faldt');
    expect(presOverskrift(p.slice(1))).toBe('Hvorfor presset steg');
    expect(presHistorik(s, 'se')).toEqual([]);
  });
});

describe('afgiftsstigninger med præcist tal', () => {
  it('varslet stigning viser den trukne pp i beskrivelse, liste og konsekvenser', () => {
    const s = nyt();
    s.uge = ugeFor(2027, 0);
    s.planlagteRegler.push({ marked: 'dk', regelId: 'afgiftsstigning', ikrafttraedelseUge: s.uge + 60, annonceret: true, dynamisk: true, pp: 6 });
    const r = kommendeRegler(s, 'dk').find((x) => x.navn === 'Afgiftsstigning' && x.dynamisk);
    expect(r?.beskrivelse).toContain('afgiften stiger 6 pp');
    expect(r?.tal).toBe('+6 pp');
    expect(regelIkraft(s, 'dk', 'afgiftsstigning')?.pp).toBe(6);
    expect(regelKonsekvenser(s, 'dk', 'afgiftsstigning', 6).some((k) => k.tekst.startsWith('Afgiften stiger 6 procentpoint'))).toBe(true);
    // Uden tal (gamle gemte spil) står intervallet, som sim-kernen så trækker fra
    expect(regelBeskrivelseMedPp('afgiftsstigning')).toContain('3-8 pp');
    // Andre regler er uændrede
    expect(regelBeskrivelseMedPp('bonusloft', 6)).not.toContain('6 pp');
  });

  it('annoncer() fra sim-kernen giver samme tal i planen og signalet', () => {
    const s = nyt();
    s.uge = ugeFor(2027, 0);
    s.markeder.dk.licens = 'aktiv';
    annoncer(s, 'dk', 'afgiftsstigning', s.uge + 40, true);
    const sig = s.signaler.find((x) => x.k === 'regel');
    const plan = regelIkraft(s, 'dk', 'afgiftsstigning');
    expect(sig && sig.k === 'regel' ? sig.pp : undefined).toBe(plan?.pp);
    expect(kommendeRegler(s, 'dk').some((x) => x.tal === `+${plan?.pp} pp`)).toBe(true);
  });
});

describe('faste afgiftstrin i "På vej"', () => {
  it('viser dato og fra → til for vedtagne trin', () => {
    const s = nyt();
    s.uge = ugeFor(2020, 6);
    const dk = kommendeAfgifter(s, 'dk');
    expect(dk).toHaveLength(1);
    expect(dk[0].uge).toBe(ugeFor(2021, 0));
    expect(dk[0].tal).toBe('20 % → 28 %');
    expect(dk[0].beskrivelse).toContain('fra 20 % til 28 %');
    expect(dk[0].op).toBe(true);
    expect(kommendeRegler(s, 'dk').some((x) => x.id === dk[0].id)).toBe(true);
  });

  it('tager kun trin med inden for horisonten, og markeder uden trin giver ingenting', () => {
    const s = nyt();
    s.uge = ugeFor(2023, 6);
    // Holland: 2024, 2025 og 2026 — de to første ligger inden for to år, kun 2024 inden for varslet (39 uger)
    expect(kommendeAfgifter(s, 'nl').map((x) => x.uge)).toEqual([ugeFor(2024, 0), ugeFor(2025, 0)]);
    expect(kommendeAfgifter(s, 'nl', 39).map((x) => x.tal)).toEqual(['29 % → 30,5 %']);
    expect(kommendeAfgifter(s, 'de')).toEqual([]);
  });
});
