// Musikken som data (spec 6.19): temaerne skal være gyldige, loop'e på hele takter og dække alle tre akter.
import { describe, expect, it } from 'vitest';
import {
  AKT_TEMA,
  MIN_LUFT,
  TEMAER,
  TEMA_DEFS,
  TONEOMRAADE,
  TROMME_MIDI,
  erMonofon,
  iToneart,
  midiTilHz,
  nodeTilMidi,
  parseSpor,
  planlaeg,
  swingPos,
  temaLaengdeSek,
  valider,
  type TemaId,
} from '../../src/audio/moenstre';
import { aktFor } from '../../src/render/actChrome';
import { kanalVolumen, volumenTilGain } from '../../src/audio/volumen';

const ALLE = Object.keys(TEMAER) as TemaId[];
const AKT_TEMAER: TemaId[] = ['garage', 'vaekst', 'ai'];

describe('notation', () => {
  it('oversætter nodenavne til MIDI', () => {
    expect(nodeTilMidi('c4')).toBe(60);
    expect(nodeTilMidi('a4')).toBe(69);
    expect(nodeTilMidi('f#3')).toBe(54);
    expect(nodeTilMidi('bb2')).toBe(46);
    expect(nodeTilMidi('b3')).toBe(59);
    expect(nodeTilMidi('eb5')).toBe(75);
    expect(midiTilHz(69)).toBeCloseTo(440, 6);
    expect(midiTilHz(81)).toBeCloseTo(880, 6);
  });

  it('parser pauser, akkorder, styrke og trommer', () => {
    const p = parseSpor('r/2 c4/2! c4+e4+g4/4 g4/8?');
    expect(p.laengde16).toBe(16);
    expect(p.noder).toHaveLength(3);
    expect(p.noder[0]).toMatchObject({ start: 2, laengde: 2, midi: [60], styrke: 1 });
    expect(p.noder[1].midi).toEqual([60, 64, 67]);
    expect(p.noder[2].styrke).toBeLessThan(0.5);
    const t = parseSpor('k/4 s/4 h/4 o/4', true);
    expect(t.noder.map((n) => n.midi[0])).toEqual([36, 38, 42, 46]);
  });

  it('afviser ugyldige noder', () => {
    expect(() => parseSpor('h9/2')).toThrow();
    expect(() => parseSpor('c4')).toThrow();
    expect(() => parseSpor('c4/0')).toThrow();
    expect(() => parseSpor('x/4', true)).toThrow();
  });
});

describe('temaerne', () => {
  it('alle tre akter har et tema, der loop’er', () => {
    for (const akt of ['garage', 'vaekst', 'ai'] as const) {
      const t = TEMAER[AKT_TEMA[akt]];
      expect(t, akt).toBeDefined();
      expect(t.loop).toBe(true);
    }
    // Aktens tema følger kontorets akt-chrome gennem hele spillet
    expect(AKT_TEMA[aktFor(0)]).toBe('garage');
    expect(AKT_TEMA[aktFor(2 * 52)]).toBe('garage');
    expect(AKT_TEMA[aktFor(3 * 52)]).toBe('vaekst');
    expect(AKT_TEMA[aktFor(13 * 52 + 51)]).toBe('vaekst');
    expect(AKT_TEMA[aktFor(14 * 52)]).toBe('ai');
    expect(AKT_TEMA[aktFor(1247)]).toBe('ai');
  });

  it('jinglerne findes og spilles én gang', () => {
    expect(TEMAER.titel.loop).toBe(false);
    expect(TEMAER.aktSkift.loop).toBe(false);
  });

  it.each(ALLE)('%s er gyldigt (takter går op, toner i toneområdet, 2-4 stemmer)', (id) => {
    expect(valider(TEMAER[id])).toEqual([]);
  });

  it.each(AKT_TEMAER)('%s har 8-16 hele takter og det rigtige tempo', (id) => {
    const t = TEMAER[id];
    expect(Number.isInteger(t.takter)).toBe(true);
    expect(t.takter).toBeGreaterThanOrEqual(8);
    expect(t.takter).toBeLessThanOrEqual(16);
    const [lo, hi] = { garage: [90, 96], vaekst: [112, 120], ai: [80, 88] }[id as 'garage' | 'vaekst' | 'ai'];
    expect(t.bpm).toBeGreaterThanOrEqual(lo);
    expect(t.bpm).toBeLessThanOrEqual(hi);
  });

  it('hver stemme er præcis loop-længden lang', () => {
    for (const id of ALLE) {
      const t = TEMAER[id];
      for (const s of t.stemmer) expect(s.laengde16, `${id}/${s.id}`).toBe(t.takter * 16);
    }
  });

  it('toner ligger i rollens toneområde, og trommer er kendte', () => {
    for (const id of ALLE) {
      for (const s of TEMAER[id].stemmer) {
        for (const n of s.noder) {
          for (const m of n.midi) {
            if (s.rolle === 'trommer') expect(TROMME_MIDI).toContain(m);
            else {
              const [lo, hi] = TONEOMRAADE[s.rolle];
              expect(m, `${id}/${s.id}`).toBeGreaterThanOrEqual(lo);
              expect(m, `${id}/${s.id}`).toBeLessThanOrEqual(hi);
            }
          }
        }
      }
    }
  });

  it('bruger chip-bølgerne: puls, firkant, trekant og støj', () => {
    const boelger = new Set(ALLE.flatMap((id) => TEMAER[id].stemmer.map((s) => s.boelge)));
    expect([...boelger].sort()).toEqual(['noise', 'pulse', 'square', 'triangle']);
  });

  it('akternes temaer holder sig i tonearten, og AI-akten er i mol', () => {
    expect(TEMAER.ai.toneart.skala).toBe('mol');
    expect(TEMAER.garage.toneart.skala).toBe('dur');
    expect(TEMAER.vaekst.toneart.skala).toBe('dur');
    for (const id of AKT_TEMAER) {
      const t = TEMAER[id];
      const toner = t.stemmer.filter((s) => s.rolle !== 'trommer').flatMap((s) => s.noder.flatMap((n) => n.midi));
      const i = toner.filter((m) => iToneart(m, t.toneart)).length;
      expect(i / toner.length, id).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('temaerne er forskellige', () => {
    const melodi = (id: TemaId) => TEMAER[id].stemmer.find((s) => s.rolle === 'melodi')!.noder.map((n) => n.midi[0]).join(',');
    expect(new Set(AKT_TEMAER.map(melodi)).size).toBe(3);
    expect(new Set(AKT_TEMAER.map((id) => TEMAER[id].toneart.grundtone)).size).toBe(3);
  });

  it('musikken er lav (under lydeffekterne)', () => {
    for (const id of ALLE) for (const s of TEMA_DEFS[id].stemmer) expect(s.vol).toBeLessThanOrEqual(-10);
  });
});

describe('tidsplan', () => {
  it('loop-længden er hele takter i sekunder', () => {
    for (const id of ALLE) {
      const t = TEMAER[id];
      const p = planlaeg(t);
      expect(p.loopSek).toBeCloseTo((t.takter * 4 * 60) / t.bpm, 9);
      expect(p.loopSek).toBeCloseTo(temaLaengdeSek(t), 9);
      expect(p.loopSek / (p.sek16 * 16)).toBeCloseTo(t.takter, 9);
    }
  });

  it('alle noder ligger inden for loopet, og monofone stemmer overlapper aldrig (heller ikke over loop-grænsen)', () => {
    for (const id of ALLE) {
      const t = TEMAER[id];
      const p = planlaeg(t);
      for (const s of p.stemmer) {
        for (const e of s.events) {
          expect(e.tid).toBeGreaterThanOrEqual(0);
          expect(e.tid).toBeLessThan(p.loopSek);
          expect(e.varighed).toBeGreaterThan(0);
          expect(e.hz.every((h) => h > 20 && h < 5000)).toBe(true);
        }
        if (!erMonofon(s.rolle)) continue;
        for (let i = 0; i < s.events.length; i++) {
          const e = s.events[i];
          const naeste = i + 1 < s.events.length ? s.events[i + 1].tid : t.loop ? s.events[0].tid + p.loopSek : Infinity;
          expect(e.tid, `${id}/${s.id} #${i}`).toBeLessThan(naeste);
          expect(e.tid + e.varighed, `${id}/${s.id} #${i}`).toBeLessThanOrEqual(naeste - MIN_LUFT + 1e-9);
        }
      }
    }
  });

  it('swing flytter kun offbeat-ottendedelene og bevarer rækkefølgen', () => {
    expect(swingPos(0, 0.3)).toBe(0);
    expect(swingPos(4, 0.3)).toBe(4);
    expect(swingPos(2, 0.3)).toBeCloseTo(2.6, 9);
    expect(swingPos(2, 0)).toBe(2);
    let sidst = -1;
    for (let x = 0; x <= 16; x += 0.25) {
      const y = swingPos(x, 0.3);
      expect(y).toBeGreaterThan(sidst);
      sidst = y;
    }
  });

  it('er deterministisk (garagens lo-fi-rod bruger en hash, ikke tilfældighed)', () => {
    expect(planlaeg(TEMAER.garage)).toEqual(planlaeg(TEMAER.garage));
    const g = planlaeg(TEMAER.garage).stemmer[0].events.map((e) => e.tid);
    const v = planlaeg(TEMAER.vaekst).stemmer[0].events.map((e) => e.tid / planlaeg(TEMAER.vaekst).sek16);
    // Vækst har hverken swing eller rod: noderne ligger præcis på 16.-delene
    expect(v.every((x) => Math.abs(x - Math.round(x)) < 1e-9)).toBe(true);
    // Garagen svinger og roder lidt
    expect(g.some((x) => Math.abs(x / planlaeg(TEMAER.garage).sek16 - Math.round(x / planlaeg(TEMAER.garage).sek16)) > 0.01)).toBe(true);
  });
});

describe('lydstyrke', () => {
  it('bruger standarden for ældre gemte indstillinger og holder sig i 0-1', () => {
    expect(kanalVolumen(undefined, 'musik')).toBe(0.5);
    expect(kanalVolumen(undefined, 'lyd')).toBe(1);
    expect(kanalVolumen(2, 'lyd')).toBe(1);
    expect(kanalVolumen(-1, 'musik')).toBe(0);
    expect(kanalVolumen(Number.NaN, 'musik')).toBe(0.5);
    expect(kanalVolumen('0.3', 'musik')).toBe(0.5);
    expect(volumenTilGain(0)).toBe(0);
    expect(volumenTilGain(1)).toBe(1);
    expect(volumenTilGain(0.5)).toBeLessThan(0.5);
  });
});
