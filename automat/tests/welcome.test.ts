import { describe, expect, it } from 'vitest';
import { welcomeCopy, welcomeState, lineText, kpLegendSvg, stormShardsSvg, type WelcomeInput } from '../src/ui/welcome.ts';

const base: WelcomeInput = { spins: 0, storms: 0, kp: 0, perksPending: 0, expired: false, storm: null };
const all: WelcomeInput[] = [
  base,
  { ...base, spins: 40, kp: 3.2 },
  { ...base, spins: 900, kp: 8.9 },
  { ...base, spins: 900, kp: 0, storms: 2 },
  { ...base, spins: 12, kp: 3.1, perksPending: 1 },
  { ...base, spins: 12, kp: 7.4, perksPending: 3 },
  { ...base, spins: 12, expired: true },
  { ...base, spins: 300, kp: 9, storm: { spinIndex: 4, spinsTotal: 10, maxMark: 16 } },
  { ...base, spins: 300, kp: 9, storm: { spinIndex: 19, spinsTotal: 20, maxMark: 128 } },
];
const texts = (i: WelcomeInput) => welcomeCopy(i).lines.map(lineText);

describe('splash welcome copy', () => {
  it('picks the state by priority: storm > expired > pending perk > returning > first', () => {
    expect(welcomeState(base)).toBe('first');
    expect(welcomeState({ ...base, spins: 1 })).toBe('returning');
    expect(welcomeState({ ...base, spins: 1, perksPending: 1 })).toBe('pending');
    expect(welcomeState({ ...base, spins: 1, perksPending: 1, expired: true })).toBe('expired');
    expect(welcomeState({ ...base, expired: true, storm: { spinIndex: 0, spinsTotal: 10, maxMark: 2 } })).toBe('storm');
  });

  it('first visit is light: ≤ 35 words, 4 lines, every line fits ~330 px (≤ 40 chars)', () => {
    const c = welcomeCopy(base);
    const words = texts(base).join(' ').split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w));
    expect(words.length).toBeLessThanOrEqual(35);
    expect(c.lines).toHaveLength(4);
    expect(c.eyebrow.lead + ' · ' + c.eyebrow.suffix).toBe('Møns Klint · Polarnat');
  });

  it('every line in every state stays ≤ 40 characters, even at maximum values', () => {
    for (const i of all) for (const t of texts(i)) expect(t.length, t).toBeLessThanOrEqual(40);
  });

  it('never promises wins, uses near-miss/pressure words or gift framing', () => {
    const banned = /gevinst|vind|næsten|så tæt|tæt på|bonus|gratis|gave|garant|jackpot|kom tilbage|skynd|betaler bedre|større|chance/i;
    for (const i of all) {
      const c = welcomeCopy(i);
      for (const t of [...texts(i), c.summary, c.eyebrow.lead, c.eyebrow.suffix]) expect(t, t).not.toMatch(banned);
    }
  });

  it('first visit: rarity leads the machine sentence and the two lines are one unbreakable pair', () => {
    const c = welcomeCopy(base);
    const t = texts(base);
    const rare = t.findIndex((x) => /sjældent/.test(x));
    const machine = t.findIndex((x) => /maskine/.test(x));
    expect(rare).toBeGreaterThanOrEqual(0);
    expect(machine).toBe(rare + 1);
    expect(c.lines[rare].pair).toBeDefined();
    expect(c.lines[rare].pair).toBe(c.lines[machine].pair);
    expect(t.join(' ')).toContain('Ladet spin');
  });

  it('returning copy is a status report with no proximity branch: identical anywhere between two rewards', () => {
    const a = welcomeCopy({ ...base, spins: 10, kp: 3.1 });
    const b = welcomeCopy({ ...base, spins: 10, kp: 4.95 });
    expect(a.lines.map(lineText)).toEqual(b.lines.map(lineText));
    expect(a.lines.map((l) => l.tone)).toEqual(b.lines.map((l) => l.tone));
    expect(texts({ ...base, spins: 10, kp: 0 })[1]).toBe('Næste: Ladet spin ved Kp 3.');
    expect(texts({ ...base, spins: 10, kp: 7.5 })[1]).toBe('Næste: Solstorm ved Kp 9.');
    expect(texts({ ...base, spins: 10, kp: 0, storms: 1 })[0]).toBe('Himlen er faldet til ro.');
    expect(welcomeCopy({ ...base, spins: 10, kp: 3.2 }).eyebrow.suffix).toBe('Kp 3,2');
  });

  it('pending perk uses the singular and plural forms', () => {
    expect(texts({ ...base, spins: 5, kp: 3, perksPending: 1 })[1]).toBe('Et Ladet spin ligger klar.');
    expect(texts({ ...base, spins: 5, kp: 3, perksPending: 2 })[1]).toBe('2 Ladede spin ligger klar.');
  });

  it('storm resume shows spins left and the highest mark, never money', () => {
    const c = welcomeCopy({ ...base, storm: { spinIndex: 4, spinsTotal: 13, maxMark: 32 } });
    expect(c.legend).toBe('storm');
    expect(c.storm).toEqual({ played: 4, total: 13 });
    expect(texts({ ...base, storm: { spinIndex: 4, spinsTotal: 13, maxMark: 32 } })).toContain('9 stormspin tilbage.');
    expect(c.lines.map(lineText).join(' ')).not.toMatch(/kr|×\s*indsats/);
    expect(c.buttonLabel).toMatch(/fortsæt Solstormen/);
  });

  it('screen-reader summaries are plain sentences (no no-break spaces)', () => {
    for (const i of all) expect(welcomeCopy(i).summary).not.toMatch(/ /);
  });

  it('legend is a static key: no fill or marker that depends on Kp', () => {
    const svg = kpLegendSvg();
    expect(svg).toContain('lg-glyph');
    expect(svg).toContain('lg-crack');
    expect((svg.match(/class="lg-dia"/g) ?? []).length).toBe(3);
    expect(stormShardsSvg(3, 10).match(/class="sh on"/g)).toHaveLength(3);
    expect(stormShardsSvg(3, 10).match(/class="sh"/g)).toHaveLength(7);
  });
});

describe('splash welcome Kp display', () => {
  it('truncates instead of rounding, so the eyebrow never reaches the next threshold early', () => {
    expect(welcomeCopy({ ...base, spins: 9, kp: 8.96 }).eyebrow.suffix).toBe('Kp 8,9');
    expect(welcomeCopy({ ...base, spins: 9, kp: 2.99, perksPending: 1 }).eyebrow.suffix).toBe('Kp 2,9');
  });
});
