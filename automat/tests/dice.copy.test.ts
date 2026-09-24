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
  demoTag, GAMBLE, GAMBLE_FACTS, GAMBLE_FIRST_DIE, GAMBLE_THROW, GAMBLE_RESTORED, GAMBLE_NUMBERS_NOTE, DEMO_GAMBLE_SR, DEMO_PILL,
  gambleDemoNote, demoGambleDone, gambleSub, pipList, gambleOfferCopy, gambleCardHtml, gambleThrowHtml, gambleResultCopy, gambleResultHtml,
  srGambleKeep, gambleRulesP1, gambleRulesP2, faceGlyph, type GambleCardCtx,
  TIPS, GAMBLE_LOG, gambleLogResult, gambleLogRows,
} from '../src/ui/diceCopy.ts';
import { AUTO, AUTO_STOPS } from '../src/ui/autoCopy.ts';
import { autoLimits, AUTO_COUNTS } from '../src/game/auto.ts';
import { winPips, GAMBLE_BETS, resolveGamble } from '../src/math/gamble.ts';
import { MOMENT_COPY } from '../src/present/momentCopy.ts';

const COUNTS = [0, 1, 2, 37, 1947, 1948, 2011];
const UNLOCKS: DiceView['unlock'][] = ['none', 'pending', 'seen'];
const STATES: GateState[] = ['sealed', 'pending', 'open'];
const KINDS: CeremonyKind[] = ['real', 'demo', 'replay'];
const BANNED = /snart|tæt på|næsten|mangler|skynd|i dag|sidste chance|gå ikke glip|spil videre|spil mere|vinde mere|bedre chancer|højere gevinst|bonus|gratis|jackpot|garant|vundet|optjen|købt|kun\s+\S+\s+tilbage|\d+\s+(tilbage|mere)|\baf 1948\b|\/\s?1948/i;
/** Kvit eller dobbelt and autospin copy only: no luck, no "again", no safety claim, no gate and no year. */
const EXTRA = /prøv igen|en gang til|næste gang|denne gang|heldig|lykke|risikofri|sikker|\bvind\b|1948|porten|Automat/i;
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const values = (o: object): string[] => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? values(v) : []));

/** Every dice string outside diceRulesHtml() and the placard, for every count and state. */
function nonRulesCopy(): { where: string; s: string }[] {
  const out: { where: string; s: string }[] = [];
  const add = (where: string, ...ss: (string | null | undefined)[]) => { for (const s of ss) if (s) out.push({ where, s }); };
  add('hud', CHIP_TITLE, DEMO_TAG, PANEL.h, PANEL.link, DEMO_CAPTION, DEMO_STORM_NOTE, DEMO_DIE_BANNER.t, DEMO_DIE_BANNER.s, SR_CEREMONY_END, ...values(TIPS));
  add('hello', ...values(helloCopy()), text(helloHtml()));
  add('firstDie', ...values(firstDieCopy()), text(firstDieHtml(null)));
  add('chamber', ...values(CHAMBER), ...values(GATE_LABELS), ...chamberFacts());
  add('menu', MENU.tab, MENU.open, MENU.kpHint, MENU.histIntro, MENU.histMark, MENU.rgLine, MENU.setting, MENU.settingHint, MENU.storage);
  add('firstDie', GAMBLE_FIRST_DIE);
  add('drawer', DRAWER.gamble, DRAWER.h, DRAWER.die, DRAWER.first, DRAWER.gate, DRAWER.segLabel, DRAWER.segAria, DRAWER.warn, text(DRAWER.hintHtml), ...values(DRAWER.resetBanner('1.000,00 kr')));
  for (const n of PREVIEW_STEPS) add('drawer', DRAWER.seg(n));
  for (const st of STATES) for (const c of [false, true]) add(`myth ${st}`, ...chamberMyth(st, c).map((l) => l.t));
  for (const n of COUNTS) {
    add(`count ${n}`, countWord(n), awardCaption(n), srAward(n), srStormPop(n), srStormOutro(n), heldOverflow(n), MENU.status(n));
    add(`count ${n}`, ...values(stormSummaryRow(n, false)), ...values(stormSummaryRow(n, true)));
    add(`count ${n}`, firstDieDemoNote(n), firstDieCopy().srDemo(n), text(firstDieHtml(n)), ...values(unlockCardCopy(n)), text(unlockCardHtml(n)), ...values(demoGateBanner(n)));
    for (const u of UNLOCKS) add(`chip ${n} ${u}`, chipAria(n, u));
    for (const mode of ['real', 'preview', 'demo'] as const) for (const u of UNLOCKS) add(`summary ${n} ${mode} ${u}`, chamberSummary({ count: n, unlock: u, mode }, 37));
    for (const N of PREVIEW_STEPS) for (const k of ['preview', 'demo', 'replay'] as const) add(`ribbon ${k} ${N}`, chamberRibbon(k, N, n));
    for (const k of KINDS) add(`ceremony ${k} ${n}`, ceremonyEyebrow(k, n), srCeremonyStart(k, n));
  }
  add('moment', MOMENT_COPY.title);
  for (const n of COUNTS) add(`moment ${n}`, MOMENT_COPY.nr(n));
  out.push(...gambleCopy(COUNTS), ...autoCopy());
  return out;
}
const GK = [1, 2, 3, 7, 20];
/** Every Kvit eller dobbelt string: k ∈ GK, spin and storm, real and demo, every pip × bet, restored (a reload or another tab) or not. */
function gambleCopy(counts: number[]): { where: string; s: string }[] {
  const out: { where: string; s: string }[] = [];
  const add = (where: string, ...ss: (string | null | undefined)[]) => { for (const s of ss) if (s) out.push({ where, s }); };
  add('gamble', ...values(GAMBLE), GAMBLE_FACTS, GAMBLE_THROW, ...values(GAMBLE_RESTORED), DEMO_GAMBLE_SR, ...values(DEMO_PILL), DRAWER.gamble, MENU.gambleSetting, MENU.gambleHint);
  add('gamble log', GAMBLE_LOG.h, GAMBLE_LOG.intro, GAMBLE_LOG.empty, ...values(GAMBLE_LOG.head));
  // "Dine valg": every row a log can hold (keep, both bets × every face, k ∈ GK)
  const log = GK.flatMap((k, i) => [
    { gid: null, id: `NL-00000001-B${String(i).padStart(6, '0')}`, source: 'spin' as const, choice: 'keep' as const, stake: k, face: null, payout: k, at: 0 },
    ...(['double', 'triple'] as const).flatMap((bet) => Array.from({ length: 6 }, (_, f) => ({ gid: `NL-00000001-T${String(i * 12 + f).padStart(6, '0')}`, id: `NL-00000001-S${String(i).padStart(6, '0')}`, source: 'storm' as const, choice: bet, stake: k, face: f, payout: resolveGamble(bet, k, f).payout, at: 0 }))),
  ]);
  for (const r of gambleLogRows(log, null, log.length)) add('gamble log row', r.choice, r.pip, r.result, r.aria);
  for (const n of counts) {
    add(`gamble n ${n}`, gambleDemoNote(n), ...values(demoGambleDone(n)), demoTag(n));
    for (const k of GK) for (const source of ['spin', 'storm'] as const) for (const demoN of [null, n]) {
      const c: GambleCardCtx = { source, k, n, demoN };
      const w = `gamble ${source} k${k} n${n}${demoN === null ? '' : ' demo'}`;
      add(w, ...values(gambleOfferCopy(c)), text(gambleCardHtml(c)), srGambleKeep(k));
      for (const bet of ['double', 'triple'] as const) {
        add(w, gambleSub(bet, k), text(gambleThrowHtml(c, bet)));
        for (let pip = 1; pip <= 6; pip++) for (const restored of [false, true, 'tab'] as const) {
          const payout = resolveGamble(bet, k, pip - 1).payout;
          const r = { ...c, bet, pip, payout, count: n + payout, restored };
          add(`${w} ${bet} ${pip}${restored ? ` restored ${restored}` : ''}`, ...values(gambleResultCopy(r)), text(gambleResultHtml(r)));
        }
      }
    }
  }
  return out;
}
/** Every autospin string (stop reasons, captions, limits for every count and stake). */
function autoCopy(): { where: string; s: string }[] {
  const out: { where: string; s: string }[] = [];
  const add = (where: string, ...ss: string[]) => { for (const s of ss) out.push({ where, s }); };
  add('auto', AUTO.title, AUTO.pill, AUTO.pillAria, AUTO.pillTitle, AUTO.stopWord, AUTO.spinsLabel, AUTO.limitLabel, AUTO.start, AUTO.close, AUTO.recheck);
  for (const n of AUTO_COUNTS) add(`auto limit off ${n}`, AUTO.limitOff(n));
  for (const r of AUTO_STOPS) for (const [n, net] of [[10, -2000], [25, 0], [3, 4520]]) add(`auto stop ${r}`, AUTO.stop(r), AUTO.summary(n, net), AUTO.sr(r, n, net));
  for (const left of [0, 1, 9, 12, 99]) add(`auto left ${left}`, AUTO.stopCap(left), AUTO.stopAria(left));
  for (const st of CONFIG.stakesOre) for (const n of AUTO_COUNTS) { add(`auto count ${n}`, AUTO.count(n)); for (const l of autoLimits(st, n)) add(`auto limit ${st}`, AUTO.limitHint(l)); }
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
  it('the extra lint holds for every Kvit eller dobbelt and autospin string (the player\'s own count aside)', () => {
    // counts other than 1948 itself: "Du har 1948 terninger." is the player's count, not the gate (the general lint
    // above runs over 1948 too)
    const all = [...gambleCopy([0, 1, 2, 37, 1947, 2011]), ...autoCopy()];
    expect(all.length).toBeGreaterThan(2000);
    for (const { where, s } of all) {
      expect(EXTRA.test(s), `${where}: ${s}`).toBe(false);
      expect(BANNED.test(s), `${where}: ${s}`).toBe(false);
    }
    // the demo buttons never say "Vind"
    for (const s of [DRAWER.gamble, DEMO_PILL.die, DEMO_PILL.dieAria]) expect(/vind/i.test(s)).toBe(false);
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
  it('the demo first-die SR line is marked as a demo and never claims a die was added', () => {
    for (const n of COUNTS) {
      const s = firstDieCopy().srDemo(n);
      expect(s).toMatch(/^Demo: /);
      expect(s).toContain(`Tæller ikke – dit antal er uændret (${n})`);
      expect(s).not.toMatch(/er lagt i|nummer 1|Din første terning/i);
    }
  });
  it('the placard keeps p1 and the sanctioned sentence with its guard in one non-scrolling block (.pl-claim)', () => {
    for (const k of KINDS) for (const clause of [true, false]) {
      const html = placardHtml(k, 1948, clause);
      const claim = html.match(/<div class="pl-claim">([\s\S]*?)<\/div>/)?.[1] ?? '';
      const body = html.match(/<div class="pl-body">([\s\S]*?)<\/div>/)?.[1] ?? '';
      expect(claim).toContain(placardCopy(k, 1948, clause).p1);
      expect(claim).toContain(NOT_AN_OFFER);
      if (clause) expect(claim).toContain(`${PAYBACK_SENTENCE} ${NOT_AN_OFFER}`);
      expect(body).not.toMatch(/tilbagebetaling|ikke et tilbud/);
    }
  });
});

describe('Kvit eller dobbelt: "Dine valg" (the menu\'s audit trail)', () => {
  const e = (o: object) => ({ gid: 'NL-0000000a-T000001', id: 'NL-0000000a-B000010', source: 'spin' as const, choice: 'double' as const, stake: 1, face: 4, payout: 2, at: 0, ...o });
  it('rows: ID, choice, face, "1 → 2 terninger" / "1 → ingen"; newest first, at most 10; an open choice is never listed', () => {
    expect(gambleLogResult(1, 2)).toBe('1 → 2 terninger');
    expect(gambleLogResult(1, 0)).toBe('1 → ingen');
    expect(gambleLogResult(3, 3)).toBe('3 → 3 terninger');
    const rows = gambleLogRows([e({}), e({ gid: null, id: 'NL-0000000a-B000011', choice: 'keep', face: null, payout: 1 }), e({ gid: 'NL-0000000a-T000002', id: 'NL-0000000a-B000012', face: 1, payout: 0 })], null);
    expect(rows.map((r) => [r.id, r.choice, r.pip, r.result])).toEqual([
      ['NL-0000000a-T000002', 'Kvit eller dobbelt', '2', '1 → ingen'],
      ['NL-0000000a-B000011', 'Behold', '–', '1 → 1 terning'],
      ['NL-0000000a-T000001', 'Kvit eller dobbelt', '5', '1 → 2 terninger'],
    ]);
    expect(gambleLogRows([e({}), e({ id: 'OPEN' })], 'OPEN').length).toBe(1);
    expect(gambleLogRows(Array.from({ length: 30 }, (_, i) => e({ id: String(i) })), null).length).toBe(10);
  });
});

describe('Kvit eller dobbelt: the card', () => {
  const ctx = (o: Partial<GambleCardCtx> = {}): GambleCardCtx => ({ source: 'spin', k: 1, n: 38, demoN: null, ...o });
  it('buttons in the order Behold, Kvit eller dobbelt, 3 for 1; data-primary on Behold only; no timer, no countdown', () => {
    for (const k of GK) for (const source of ['spin', 'storm'] as const) for (const demoN of [null, 12]) {
      const html = gambleCardHtml(ctx({ k, source, demoN }));
      const acts = [...html.matchAll(/data-gamble="([a-z]+)"/g)].map((m) => m[1]);
      expect(acts).toEqual(['keep', 'double', 'triple']);
      const btns = html.match(/<button[^>]*>/g)!;
      expect(btns.length).toBe(3);
      expect(btns.filter((b) => b.includes('data-primary')).length).toBe(1);
      expect(btns[0]).toContain('data-primary');
      expect(html).not.toMatch(/countdown|timer|progress|data-t=|sekund|\d+\s?s\b/i);
      expect(text(html)).toContain(GAMBLE_FACTS);
      // the demo card: the demo note is its amber eyebrow (DEMO, "tæller ikke" and the unchanged count), first in the card
      if (demoN !== null) expect(text(html).startsWith(`DEMO · TÆLLER IKKE · dit antal er uændret (${demoN})`)).toBe(true);
    }
  });
  it('the sub-lines are built from winPips and countWord (never typed)', () => {
    expect(pipList([4, 5, 6])).toBe('4, 5 eller 6');
    expect(pipList([5, 6])).toBe('5 eller 6');
    expect(pipList([1, 2, 3, 4])).toBe('1–4');
    expect(pipList([1, 2, 3])).toBe('1, 2 eller 3');
    for (const k of GK) {
      const o = gambleOfferCopy(ctx({ k }));
      expect(o.keep).toEqual({ label: 'Behold', sub: countWord(k) });
      expect(o.double).toEqual({ label: 'Kvit eller dobbelt', sub: `${pipList(winPips('double'))}: ${countWord(2 * k)} · 1, 2 eller 3: ingen` });
      expect(o.triple).toEqual({ label: '3 for 1', sub: `${pipList(winPips('triple'))}: ${countWord(3 * k)} · 1–4: ingen` });
      const html = gambleCardHtml(ctx({ k }));
      for (const x of [o.keep, o.double, o.triple]) expect(html).toContain(`<small class="g-s num">${x.sub}</small>`);
    }
    expect(gambleSub('double', 1)).toBe('4, 5 eller 6: 2 terninger · 1, 2 eller 3: ingen');
    expect(gambleSub('triple', 7)).toBe('5 eller 6: 21 terninger · 1–4: ingen');
    expect(GAMBLE_BETS.double.mult).toBe(2);
  });
  it('spin / storm / demo titles, eyebrows and the screen-reader offer', () => {
    expect(gambleOfferCopy(ctx({ n: 38 }))).toMatchObject({ eyebrow: 'TERNING NR. 38', title: 'Din nye terning', body: 'Du vælger én gang. Resultatet er endeligt.' });
    expect(gambleOfferCopy(ctx({ source: 'storm', k: 3 }))).toMatchObject({ eyebrow: 'TERNINGER FRA STORMEN', title: '3 terninger fra stormen', body: 'Du vælger én gang for dem alle. Resultatet er endeligt.' });
    expect(gambleOfferCopy(ctx({ demoN: 5 })).eyebrow).toBe('DEMO · TÆLLER IKKE · dit antal er uændret (5)');
    expect(gambleOfferCopy(ctx()).sr).toBe('Din nye terning venter på dit valg: Behold, Kvit eller dobbelt eller 3 for 1. Behold er valgt på forhånd.');
    expect(gambleOfferCopy(ctx({ source: 'storm', k: 4 })).sr).toMatch(/^4 terninger fra stormen venter på dit valg/);
    expect(gambleOfferCopy(ctx({ demoN: 5 })).sr).toBe('Demo: sådan fungerer Kvit eller dobbelt. Tæller ikke med. Din nye terning venter på dit valg: Behold, Kvit eller dobbelt eller 3 for 1. Behold er valgt på forhånd.');
    expect(gambleDemoNote(12)).toBe('DEMO · Sådan fungerer valget · tæller ikke · dit antal er uændret (12)');
  });
  it('result lines: the pip, the dice laid down or lost, the count (demo: unchanged); restored says it stands', () => {
    const r = (o: object) => gambleResultCopy({ ...ctx(), bet: 'double', pip: 5, payout: 2, count: 40, restored: false, ...o });
    expect(r({}).lines).toEqual(['2 terninger lægges i Terningekammeret.', 'Du har 40 terninger.']);
    expect(r({}).title).toBe('Terningen viser 5');
    expect(r({ pip: 2, payout: 0, count: 38 }).lines).toEqual(['1 terning er gået tabt.', 'Du har 38 terninger.']);
    expect(r({ demoN: 7 }).lines[1]).toBe('Dit antal er uændret (7).');
    expect(r({ restored: true })).toMatchObject({ eyebrow: 'RESULTATET AF DIT VALG', restored: 'Valget blev truffet før genindlæsningen. Resultatet står fast.' });
    expect(r({ restored: 'tab' })).toMatchObject({ eyebrow: 'RESULTATET AF DIT VALG', restored: 'Valget blev truffet i en anden fane. Resultatet står fast.' });
    expect(text(gambleResultHtml({ ...ctx(), bet: 'triple', pip: 6, payout: 3, count: 41, restored: false }))).toContain(faceGlyph(6));
    expect(srGambleKeep(1)).toBe('1 terning er lagt i Terningekammeret.');
    expect(GAMBLE_THROW).toBe('Terningen kastes …');
  });
  it('the rules: one choice per award, fair odds, only new dice, pips from winPips; the numbers note', () => {
    const rules = diceRulesHtml();
    expect(rules).toContain('<h4>Kvit eller dobbelt</h4>');
    expect(gambleRulesP1()).toContain('Kvit eller dobbelt giver 2 terninger ved 4, 5 eller 6 og ingen ved 1, 2 eller 3; 3 for 1 giver 3 terninger ved 5 eller 6 og ingen ved 1–4.');
    expect(gambleRulesP2()).toContain('Chancerne er fair');
    expect(gambleRulesP2()).toContain('aldrig dem i kammeret og aldrig penge');
    for (const p of [gambleRulesP1(), gambleRulesP2(), GAMBLE_NUMBERS_NOTE]) expect(rules).toContain(p);
    expect(firstDieHtml(null)).toContain(GAMBLE_FIRST_DIE);
    expect(MENU.gambleSetting).toBe('Tilbyd Kvit eller dobbelt');
    expect(demoTag(2)).toBe('+2 demo');
  });
});
