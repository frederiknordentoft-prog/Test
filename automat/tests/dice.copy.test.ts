// Terningen · copy-lint. Every player-facing dice string outside the rules is rendered for many counts and states
// and must carry no pressure, no promise and no goal gradient; the numbers come from REPORT, never from the source.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { REPORT, CONFIG } from '../src/math/config.ts';
import { PREVIEW_STEPS, type DiceView } from '../src/game/dice.ts';
import {
  AUTOMAT_PAYBACK_CLAUSE, PAYBACK_SENTENCE, NOT_AN_OFFER, diceNumbers, countWord, CHIP_TITLE, DEMO_TAG, chipAria, PANEL,
  awardCaption, DEMO_CAPTION, srAward, srStormPop, srStormOutro, heldOverflow, stormSummaryRow, DEMO_STORM_NOTE, DEMO_DIE_BANNER,
  helloCopy, helloHtml, firstDieCopy, firstDieDemoNote, firstDieHtml, unlockCardCopy, unlockCardHtml, CHAMBER, GATE_LABELS,
  chamberMyth, chamberFacts, chamberSummary, chamberRibbon, gateState, ceremonyEyebrow, srCeremonyStart, SR_CEREMONY_END, demoGateBanner,
  placardCopy, placardHtml, MENU, DRAWER, diceRulesHtml, type CeremonyKind, type GateState,
} from '../src/ui/diceCopy.ts';

const COUNTS = [0, 1, 2, 37, 1947, 1948, 2011];
const UNLOCKS: DiceView['unlock'][] = ['none', 'pending', 'seen'];
const STATES: GateState[] = ['sealed', 'pending', 'open'];
const KINDS: CeremonyKind[] = ['real', 'demo', 'replay'];
const BANNED = /snart|tæt på|næsten|mangler|skynd|i dag|sidste chance|gå ikke glip|spil videre|spil mere|vinde mere|bedre chancer|højere gevinst|bonus|gratis|jackpot|garant|vundet|optjen|købt|kun\s+\S+\s+tilbage|\d+\s+(tilbage|mere)|\baf 1948\b|\/\s?1948/i;
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const values = (o: object): string[] => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? values(v) : []));

/** Every dice string outside diceRulesHtml() and the placard, for every count and state. */
function nonRulesCopy(): { where: string; s: string }[] {
  const out: { where: string; s: string }[] = [];
  const add = (where: string, ...ss: (string | null | undefined)[]) => { for (const s of ss) if (s) out.push({ where, s }); };
  add('hud', CHIP_TITLE, DEMO_TAG, PANEL.h, PANEL.link, DEMO_CAPTION, DEMO_STORM_NOTE, DEMO_DIE_BANNER.t, DEMO_DIE_BANNER.s, SR_CEREMONY_END);
  add('hello', ...values(helloCopy()), text(helloHtml()));
  add('firstDie', ...values(firstDieCopy()), text(firstDieHtml(null)));
  add('chamber', ...values(CHAMBER), ...values(GATE_LABELS), ...chamberFacts());
  add('menu', MENU.tab, MENU.open, MENU.kpHint, MENU.histIntro, MENU.histMark, MENU.rgLine, MENU.setting, MENU.settingHint, MENU.storage);
  add('drawer', DRAWER.h, DRAWER.die, DRAWER.first, DRAWER.gate, DRAWER.segLabel, DRAWER.segAria, DRAWER.warn, text(DRAWER.hintHtml), ...values(DRAWER.resetBanner('1.000,00 kr')));
  for (const n of PREVIEW_STEPS) add('drawer', DRAWER.seg(n));
  for (const st of STATES) for (const c of [false, true]) add(`myth ${st}`, ...chamberMyth(st, c).map((l) => l.t));
  for (const n of COUNTS) {
    add(`count ${n}`, countWord(n), awardCaption(n), srAward(n), srStormPop(n), srStormOutro(n), heldOverflow(n), MENU.status(n));
    add(`count ${n}`, ...values(stormSummaryRow(n, false)), ...values(stormSummaryRow(n, true)));
    add(`count ${n}`, firstDieDemoNote(n), text(firstDieHtml(n)), ...values(unlockCardCopy(n)), text(unlockCardHtml(n)), ...values(demoGateBanner(n)));
    for (const u of UNLOCKS) add(`chip ${n} ${u}`, chipAria(n, u));
    for (const mode of ['real', 'preview', 'demo'] as const) for (const u of UNLOCKS) add(`summary ${n} ${mode} ${u}`, chamberSummary({ count: n, unlock: u, mode }, 37));
    for (const N of PREVIEW_STEPS) for (const k of ['preview', 'demo', 'replay'] as const) add(`ribbon ${k} ${N}`, chamberRibbon(k, N, n));
    for (const k of KINDS) add(`ceremony ${k} ${n}`, ceremonyEyebrow(k, n), srCeremonyStart(k, n));
  }
  return out;
}
/** The placard for every kind/count/flag, without the sanctioned sentence (the only place it may stand besides the rules). */
function placardCopyAll(): { where: string; s: string }[] {
  const out: { where: string; s: string }[] = [];
  for (const k of KINDS) for (const n of COUNTS) for (const clause of [true, false]) {
    const c = placardCopy(k, n, clause);
    for (const s of [...values(c), text(placardHtml(k, n, clause))]) out.push({ where: `placard ${k} ${n} ${clause}`, s: s.replace(PAYBACK_SENTENCE, '') });
  }
  return out;
}

describe('copy-lint (no pressure, no promise, no goal gradient)', () => {
  it('no non-rules string matches the banned pattern, for every count and state', () => {
    const all = [...nonRulesCopy(), ...placardCopyAll()];
    expect(all.length).toBeGreaterThan(500);
    for (const { where, s } of all) expect(BANNED.test(s), `${where}: ${s}`).toBe(false);
  });
  it("'tilbagebetaling' and 'betaler' never appear outside the rules and the placard", () => {
    for (const { where, s } of nonRulesCopy()) expect(/tilbagebetaling|betaler/i.test(s), `${where}: ${s}`).toBe(false);
  });
  it('the sanctioned sentence is verbatim in the rules and the placard with the flag on, and absent with it off', () => {
    expect(AUTOMAT_PAYBACK_CLAUSE).toBe(true);
    expect(diceRulesHtml(REPORT, CONFIG, true)).toContain(`${PAYBACK_SENTENCE} ${NOT_AN_OFFER}`);
    expect(diceRulesHtml(REPORT, CONFIG, false)).not.toContain(PAYBACK_SENTENCE);
    expect(diceRulesHtml(REPORT, CONFIG, false)).toContain(NOT_AN_OFFER);
    for (const k of KINDS) {
      expect(placardHtml(k, 1948, true)).toContain(`${PAYBACK_SENTENCE} ${NOT_AN_OFFER}`);
      expect(placardHtml(k, 1948, false)).not.toContain(PAYBACK_SENTENCE);
      expect(placardHtml(k, 1948, false)).toContain(NOT_AN_OFFER);
    }
    // exactly one sanctioned sentence per surface
    expect(diceRulesHtml().split(PAYBACK_SENTENCE).length - 1).toBe(1);
    expect(placardHtml('real', 1948).split(PAYBACK_SENTENCE).length - 1).toBe(1);
  });
  it('the concept label sits directly under every title that names Automat 1948', () => {
    for (const st of STATES) for (const c of [false, true]) {
      const lines = chamberMyth(st, c);
      expect(lines.some((l) => l.pair === 2 && l.t.includes('Automat 1948'))).toBe(true);
    }
    expect(GATE_LABELS.concept).toBe('KONCEPT · FINDES IKKE I DENNE DEMO');
    for (const k of KINDS) expect(text(placardHtml(k, 1948))).toMatch(/Automat 1948 Koncept · findes ikke i denne demo/);
  });
});

describe('numbers come from REPORT (never typed into the copy)', () => {
  it('facts, hello, first-die and rules contain the REPORT-derived numbers exactly as formatted', () => {
    const k = diceNumbers();
    expect(helloCopy().facts).toContain(`ca. ${k.spins} spin`);
    expect(helloCopy().sr).toContain(`ca. ${k.spins} spin`);
    expect(firstDieCopy().facts).toContain(`ca. ${k.spins} spin`);
    expect(firstDieCopy().sr).toContain(`ca. ${k.spins} spin`);
    const [, f2, f3] = chamberFacts();
    expect(f2).toContain(`1 terning pr. ${k.per} betalte spin`);
    expect(f2).toContain(`ca. ${k.spins} spin`);
    expect(f2).toContain(`mindst ca. ${k.hours} timers spil`);
    expect(f3).toContain(`ca. ${k.lossPct} af indsatserne`);
    const rules = diceRulesHtml();
    for (const v of [k.ratePct, `1 pr. ${k.per}`, `1 pr. ${k.perBase}`, k.stormPct, `efter ca. ${k.firstMedian} spin`, `ca. ${k.spins}`, `${k.spinsP5}–${k.spinsP95}`,
      `mindst ca. ${k.hours} timer`, `ca. ${k.lossPct}`, `ca. ${k.lowKr} kr`, `ca. ${k.kr} kr`, k.lossShare, k.rtp, k.model, `${k.journeys} simulerede`]) expect(rules, v).toContain(v);
    // today's values (spec note: 1 per 140 paid spins, ≈ 273.000 spins, median first die at spin 121)
    expect([k.per, k.spins, k.firstMedian]).toEqual([String(Math.round(1 / REPORT.diceRate)), '273.000', '121']);
  });
  it('another REPORT gives other numbers everywhere (nothing is hard-coded)', () => {
    const R2 = { ...REPORT, diceRate: 1 / 500, diceRateBase: 1 / 900, dice1948Spins: 987_654, dice1948SpinsP5: 900_000, dice1948SpinsP95: 1_100_000, diceFirstMedian: 345, dice1948LossX: 40_000 };
    const k = diceNumbers(R2);
    expect(k.spins).toBe('988.000');
    expect(k.per).toBe('500');
    expect(helloCopy(R2).facts).toContain('ca. 988.000 spin');
    expect(firstDieCopy(R2).facts).toContain('ca. 988.000 spin');
    expect(chamberFacts(R2)[1]).toContain('1 terning pr. 500 betalte spin');
    expect(chamberFacts(R2)[1]).toContain(`mindst ca. ${Math.floor((987_654 * 3) / 3600 / 10) * 10} timers spil`);
    expect(diceRulesHtml(R2, CONFIG)).toContain('efter ca. 345 spin');
    expect(diceRulesHtml(R2, CONFIG)).toContain('ca. 20.000 kr'); // 40.000× at 0,50 kr
  });
  it('diceCopy.ts contains no literal numbers from the sim (spec estimates or today\'s values)', () => {
    const src = readFileSync('src/ui/diceCopy.ts', 'utf8');
    const k = diceNumbers();
    const lits = ['142', '203', '277', '230', '5.500', '22.000', k.per, k.perBase, k.spins, k.spinsP5, k.spinsP95, k.hours, k.firstMedian, k.lowKr, k.kr, k.krP5, k.krP95, k.lowP5, k.lowP95];
    for (const l of lits) {
      const re = new RegExp(`(?<![\\d.,])${l.replace(/\./g, '\\.')}(?![\\d])`);
      expect(re.test(src), `literal ${l} in diceCopy.ts`).toBe(false);
    }
  });
});

describe('captions, myth and layout classes', () => {
  it('award captions are accession numbers', () => {
    expect(awardCaption(38)).toBe('TERNING NR. 38');
    expect(awardCaption(1948)).toBe('TERNING NR. 1948');
    expect(awardCaption(2011)).toBe('TERNING NR. 2011');
  });
  it('full myth lines are ≤ 46 characters, and every myth is marked as legend ("Man siger …")', () => {
    for (const st of STATES) {
      for (const l of chamberMyth(st)) expect(l.t.length, l.t).toBeLessThanOrEqual(46);
      expect(chamberMyth(st)[0].t.startsWith('Man siger')).toBe(true);
      expect(chamberMyth(st, true)[0].t.startsWith('Man siger')).toBe(true);
    }
    expect(helloCopy().myth.startsWith('Man siger')).toBe(true);
  });
  it('the hello and first-die facts are body size (class "facts"), never a footnote', () => {
    for (const html of [helloHtml(), firstDieHtml(null), firstDieHtml(3)]) {
      const m = html.match(/<p class="([^"]*)">[^<]*I gennemsnit tager/);
      expect(m, html).not.toBeNull();
      expect(m![1]).toBe('facts');
    }
  });
  it('the chip is a count only (never a fraction, "/1948" or a remaining count)', () => {
    for (const n of COUNTS) for (const u of UNLOCKS) expect(chipAria(n, u)).toMatch(new RegExp(`^Terninger: ${n}\\.`));
    expect(gateState({ count: 1948, unlock: 'none', mode: 'real' })).toBe('pending');
    expect(gateState({ count: 1948, unlock: 'seen', mode: 'preview' })).toBe('open');
  });
  it('the first-die button is "Forstået" (never "Fortsæt" / "Spil videre")', () => {
    expect(firstDieCopy().ok).toBe('Forstået');
    expect(firstDieHtml(null)).not.toMatch(/Fortsæt|Spil videre/);
  });
});
