// Terningen · static boundary rules (like math.config.test): one mutator, two call sites, one writer, and the
// renderers never touch the store. Demo paths cannot add a die because no code path from them reaches addDie().
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : []));
const SRC = walk('src');
const read = (f: string) => readFileSync(f, 'utf8');
const GAME = read('src/game/Game.ts');
const count = (s: string, needle: string) => s.split(needle).length - 1;

/** The balanced `{ … }` block that starts at the first '{' at or after `from`. */
function block(src: string, from: number): { start: number; end: number; body: string } {
  const start = src.indexOf('{', from);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { start, end: i + 1, body: src.slice(start, i + 1) };
  }
  throw new Error('unbalanced');
}
/** Body of a class method declared as `  [private ]async? name(`. */
function method(src: string, name: string): { start: number; end: number; body: string } {
  const m = new RegExp(`\\n  (?:private |public )?(?:async )?${name}\\(`).exec(src);
  if (!m) throw new Error(`no method ${name}`);
  // skip the parameter list (it may contain object types with braces)
  let i = src.indexOf('(', m.index), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '(') depth++; else if (src[i] === ')' && --depth === 0) break; }
  return block(src, i);
}
const within = (pos: number, b: { start: number; end: number }) => pos > b.start && pos < b.end;
const positions = (s: string, needle: string) => { const out: number[] = []; for (let i = s.indexOf(needle); i >= 0; i = s.indexOf(needle, i + 1)) out.push(i); return out; };
const ASSIGN = String.raw`\s*(?:[-+*/]?=(?!=)|\+\+|--)`;
/** Any write to a store's count, however it is spelled: postfix, prefix, compound, bracket, Object.assign or a spread
 *  that sets `count`. */
const COUNT_W = new RegExp([
  String.raw`\b(?:dice|d)\.count` + ASSIGN,
  String.raw`(?:\+\+|--)\s*(?:this\.)?(?:dice|d)\.count\b`,
  String.raw`\b(?:dice|d)\s*\[\s*['"]count['"]\s*\]` + ASSIGN,
  String.raw`(?:\+\+|--)\s*(?:this\.)?(?:dice|d)\s*\[\s*['"]count['"]\s*\]`,
  String.raw`\bObject\.assign\(\s*(?:this\.)?(?:dice|d)\s*[,)]`,
  String.raw`\{\s*\.\.\.(?:this\.)?(?:dice|d)\b[^}]*\bcount\s*:`,
].join('|'), 'g');
/** Any write to the gamble counter (or a replacement of all counters), however it is spelled. */
const GAMBLE_W = new RegExp([
  String.raw`\bcounters\.gamble` + ASSIGN,
  String.raw`(?:\+\+|--)\s*(?:this\.)?(?:s\.)?counters\.gamble\b`,
  String.raw`\bcounters\s*\[\s*['"]gamble['"]\s*\]` + ASSIGN,
  String.raw`(?:\+\+|--)\s*(?:this\.)?(?:s\.)?counters\s*\[\s*['"]gamble['"]\s*\]`,
  String.raw`\bcounters\s*=(?!=)`,
  String.raw`\bObject\.assign\(\s*(?:this\.)?(?:s\.)?counters\b`,
].join('|'), 'g');
const hitsOf = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m.index ?? 0);

describe('Terningen boundaries', () => {
  it('addDie( appears only in Game.ts, once, inside awardDie (besides its definition in dice.ts)', () => {
    for (const f of SRC) {
      if (f.endsWith(join('game', 'dice.ts')) || f.endsWith(join('game', 'Game.ts'))) continue;
      expect(read(f).includes('addDie('), f).toBe(false);
    }
    expect(count(read('src/game/dice.ts'), 'addDie(')).toBe(1); // the definition
    const at = positions(GAME, 'addDie(');
    expect(at.length).toBe(1);
    expect(within(at[0], method(GAME, 'awardDie'))).toBe(true);
    // awardDie returns 0 in demo mode before it can reach addDie
    expect(method(GAME, 'awardDie').body).toMatch(/if \(this\.demoMode \|\| !diceFor\(r\.totalOre, r\.stakeOre\)\) return 0;[\s\S]*addDie\(/);
  });

  it('awardDie( is called exactly twice: in spin() and inside runStorm\'s if (!demo) block, never in the resume replay', () => {
    const calls = positions(GAME, 'this.awardDie(');
    expect(calls.length).toBe(2);
    expect(count(GAME, 'awardDie(')).toBe(3); // + the declaration
    for (const f of SRC) if (!f.endsWith(join('game', 'Game.ts'))) expect(read(f).includes('awardDie('), f).toBe(false);
    const spin = method(GAME, 'spin');
    const storm = method(GAME, 'runStorm');
    expect(calls.filter((p) => within(p, spin)).length).toBe(1);
    const inStorm = calls.filter((p) => within(p, storm));
    expect(inStorm.length).toBe(1);
    // the storm call sits in an `if (!demo) {` block inside the while loop over unplayed spins
    const loop = block(GAME, GAME.indexOf('while (st.spinIndex < st.spinsTotal)', storm.start));
    expect(within(inStorm[0], loop)).toBe(true);
    const guard = block(GAME, GAME.indexOf('if (!demo) {', loop.start));
    expect(guard.start).toBeLessThan(loop.end);
    expect(within(inStorm[0], guard)).toBe(true);
    // the silent replay for a resume never awards (and the award is never gated on opts.resume)
    const replay = GAME.split('\n').filter((l) => l.includes('opts.resume.spinIndex'));
    expect(replay.length).toBeGreaterThan(0);
    for (const l of replay) expect(l.includes('awardDie')).toBe(false);
    expect(/if \([^)]*resume/.test(guard.body) || /if \([^)]*resume[^)]*\)\s*\{?\s*dieNo/.test(storm.body)).toBe(false);
    // the storm guarantee line ('-G') is not a spin and never awards
    const g = GAME.split('\n').find((l) => l.includes("'-G'"))!;
    expect(g).toBeTruthy();
    expect(g.includes('awardDie') || g.includes('true)')).toBe(false);
    // in spin() the die is judged directly after the balance credit, before record() and persist()
    const sb = spin.body;
    expect(sb.indexOf('this.s.balanceOre += r.totalOre;')).toBeLessThan(sb.indexOf('this.awardDie(r)'));
    expect(sb.indexOf('this.awardDie(r)')).toBeLessThan(sb.indexOf('this.record('));
    expect(sb.indexOf('this.record(')).toBeLessThan(sb.indexOf('this.persist()'));
    expect(sb.indexOf('this.persist()')).toBeLessThan(sb.indexOf('presentSpin('));
  });

  it('demo tools and demo spins have no path to awardDie', () => {
    for (const m of ['demo', 'demoSuns', 'demoDie', 'demoFirstDie', 'demoGamble', 'openChamber', 'runCeremony', 'demoReset']) expect(method(GAME, m).body.includes('awardDie'), m).toBe(false);
    const q = method(GAME, 'debug').body;
    expect(q.includes('awardDie') || q.includes('addDie')).toBe(false);
  });

  it('demo tools and debug never reach the gamble mutators or their callers', () => {
    for (const m of ['demo', 'demoSuns', 'demoDie', 'demoFirstDie', 'demoGamble', 'demoThrow', 'openChamber', 'runCeremony', 'demoReset', 'debug']) {
      const b = method(GAME, m).body;
      for (const n of ['settleGamble', 'openGamble', 'commitGamble', 'offerDice', 'clearSettled']) expect(b.includes(n), `${m} → ${n}`).toBe(false);
    }
  });

  it('settleGamble( is called once, inside commitGamble (demo guard first, persisted in the same call); the gamble counter moves only there', () => {
    for (const f of SRC) {
      if (f.endsWith(join('game', 'dice.ts')) || f.endsWith(join('game', 'Game.ts'))) continue;
      expect(read(f).includes('settleGamble('), f).toBe(false);
    }
    const at = positions(GAME, 'settleGamble(');
    expect(at.length).toBe(1);
    const commit = method(GAME, 'commitGamble');
    expect(within(at[0], commit)).toBe(true);
    expect(commit.body).toMatch(/if \(this\.demoMode \|\| !this\.dice\.gamble \|\| this\.dice\.gamble\.settled\) return null;[\s\S]*settleGamble\([\s\S]*this\.persist\(\)/);
    // the stored choice is re-read at the press: made in another tab (gone, settled or another id), it is never drawn
    // or written again here; that tab's result is shown and this one closes it in memory only
    expect(commit.body).toMatch(/const st = peekDice\(\);\s*if \(st\) this\.dice = st;\s*if \(this\.dice\.gamble\?\.id !== id \|\| this\.dice\.gamble\.settled\) return this\.madeElsewhere\(id\);[\s\S]*settleGamble\(/);
    expect(method(GAME, 'madeElsewhere').body.includes('settleGamble') || method(GAME, 'madeElsewhere').body.includes('persist')).toBe(false);
    const inc = positions(GAME, '++this.s.counters.gamble');
    expect(inc.length).toBe(1);
    expect(within(inc[0], commit)).toBe(true);
    // every other write, however spelled: only the never-decreasing catch-up in commitGamble and the QA hooks in debug
    const dbg = method(GAME, 'debug');
    for (const f of SRC) if (!f.endsWith(join('game', 'Game.ts'))) expect(hitsOf(read(f), GAMBLE_W).length, f).toBe(0);
    for (const h of hitsOf(GAME, GAMBLE_W)) expect(within(h, commit) || within(h, dbg), `counters.gamble write outside commitGamble/debug at ${h}`).toBe(true);
    expect(hitsOf(commit.body, GAMBLE_W).length).toBe(2);
    // a second tab may have thrown since this one loaded: the stored counter is caught up with first (an index is never reused)
    expect(commit.body).toMatch(/this\.s\.counters\.gamble = Math\.max\(this\.s\.counters\.gamble, storedGambleIdx\(\)\);\s*const idx = \+\+this\.s\.counters\.gamble;/);
    // the face comes from the 'gamble' domain, drawn in the same call
    expect(commit.body).toMatch(/gambleFace\(spinRng\(this\.s\.sessionSeed, 'gamble', idx\)\)/);
    // clearSettled( only after the result was shown (finishGamble, which returns in demo mode)
    const cs = positions(GAME, 'clearSettled(');
    expect(cs.length).toBe(1);
    const fin = method(GAME, 'finishGamble');
    expect(within(cs[0], fin)).toBe(true);
    expect(fin.body).toMatch(/if \(this\.demoMode\) return;[\s\S]*clearSettled\(/);
    expect(fin.body).toMatch(/if \(this\.dice\.gamble\?\.id === run\.id\) clearSettled\(this\.dice\);\s*if \(!run\.elsewhere\) this\.persist\(\);/);
  });

  it('the write detectors catch every spelling (and no read)', () => {
    for (const w of ['this.dice.count++', '++this.dice.count', '--d.count', 'd.count += 2', 'dice.count = 0', "this.dice['count'] = 3", '++d["count"]', 'Object.assign(this.dice, x)', 'this.dice = { ...this.dice, count: 9 }'])
      expect(hitsOf(w, COUNT_W).length, w).toBe(1);
    for (const r of ['this.dice.count === 1', 'd.count >= 1948', 'const n = this.dice.count;', 'x = d.count - 1', '{ ...d, gamble: null }', 'Object.assign(d.st, { sc: 1 })'])
      expect(hitsOf(r, COUNT_W).length, r).toBe(0);
    for (const w of ['this.s.counters.gamble++', '++this.s.counters.gamble', 'this.s.counters.gamble += 1', 'counters.gamble = 7', "this.s.counters['gamble']++", '--this.s.counters["gamble"]', 'this.s.counters = { gamble: 0 }', 'Object.assign(this.s.counters, c)'])
      expect(hitsOf(w, GAMBLE_W).length, w).toBe(1);
    for (const r of ['this.s.counters.gamble === 1', 'idx < this.s.counters.gamble + 1000', 's?.counters?.gamble', '++this.s.counters.demo', 'counters: { ...d.counters }'])
      expect(hitsOf(r, GAMBLE_W).length, r).toBe(0);
  });

  it('the count is written only by addDie and settleGamble (dice.ts), or by the QA hook in debug', () => {
    for (const f of SRC) {
      const src = read(f);
      const hits = hitsOf(src, COUNT_W);
      if (f.endsWith(join('game', 'dice.ts'))) {
        // an exported function's body: the first '{' that ends its signature line (return types may hold braces)
        const fn = (name: string) => block(src, src.indexOf(' {\n', src.indexOf(`export function ${name}(`)));
        const ok = [fn('addDie'), fn('settleGamble')];
        expect(hits.length).toBe(2);
        for (const h of hits) expect(ok.some((b) => within(h, b)), `dice.ts write at ${h}`).toBe(true);
      } else if (f.endsWith(join('game', 'Game.ts'))) {
        const dbg = method(GAME, 'debug');
        for (const h of hits) expect(within(h, dbg), `Game.ts write outside debug at ${h}`).toBe(true);
      } else expect(hits.length, f).toBe(0);
    }
  });

  it('openGamble( appears once, inside offerDice (demo + canOffer guard first); offerDice is called exactly twice, before the commit persist', () => {
    for (const f of SRC) {
      if (f.endsWith(join('game', 'dice.ts')) || f.endsWith(join('game', 'Game.ts'))) continue;
      expect(read(f).includes('openGamble('), f).toBe(false);
    }
    const at = positions(GAME, 'openGamble(');
    expect(at.length).toBe(1);
    const offer = method(GAME, 'offerDice');
    expect(within(at[0], offer)).toBe(true);
    expect(offer.body.replace(/^\{\s*/, '')).toMatch(/^if \(this\.demoMode \|\| !canOffer\(/);
    const calls = positions(GAME, 'this.offerDice(');
    expect(calls.length).toBe(2);
    // spin(): between this.awardDie(r) and this.persist() (the offer is committed with the spin)
    const spin = method(GAME, 'spin');
    const inSpin = calls.filter((p) => within(p, spin));
    expect(inSpin.length).toBe(1);
    expect(GAME.indexOf('this.awardDie(r)', spin.start)).toBeLessThan(inSpin[0]);
    expect(inSpin[0]).toBeLessThan(GAME.indexOf('this.persist()', spin.start));
    // runStorm: the finish block that clears activeStorm, before its persist()
    const storm = method(GAME, 'runStorm');
    const inStorm = calls.filter((p) => within(p, storm));
    expect(inStorm.length).toBe(1);
    const clear = GAME.indexOf('this.s.activeStorm = null', storm.start);
    const fin = block(GAME, GAME.lastIndexOf('if (!demo) {', clear));
    expect(within(clear, fin) && within(inStorm[0], fin)).toBe(true);
    expect(clear).toBeLessThan(inStorm[0]);
    expect(inStorm[0]).toBeLessThan(fin.body.indexOf('this.persist()') + fin.start);
  });

  it('the choice is committed before the reveal: commitGamble before pick(res), the awaited pick before gambleThrow(', () => {
    const act = method(GAME, 'gambleAct').body;
    expect(act.indexOf('commitGamble(')).toBeGreaterThan(0);
    expect(act.indexOf('commitGamble(')).toBeLessThan(act.indexOf('pick(res)'));
    const run = method(GAME, 'runGamble').body;
    expect(run.indexOf('run.pick = r')).toBeGreaterThan(0);
    expect(run.indexOf('run.pick = r')).toBeLessThan(run.indexOf('gambleThrow('));
    // the reveal waits for T.floor as well as for the presentation
    expect(run).toMatch(/Promise\.all\(\[wait\(T\.floor\), this\.award\.gambleThrow\(/);
    // SPIN / Space / Enter mean Behold only
    expect(method(GAME, 'gambleKey').body).toMatch(/this\.gambleAct\('keep'\)/);
    expect(method(GAME, 'gambleKey').body).not.toMatch(/double|triple/);
  });

  it('autospin: the balance stop comes before this.refill() in spin(); autoContinue only ever calls this.spin()', () => {
    const sb = method(GAME, 'spin').body;
    const stop = sb.indexOf("if (this.auto) { this.stopAuto('balance'); return; }");
    expect(stop).toBeGreaterThan(0);
    expect(stop).toBeLessThan(sb.indexOf('this.refill()'));
    const ac = method(GAME, 'autoContinue').body;
    expect(ac).toContain('this.spin()');
    expect(/presentSpin|timeScale|clock\.scale|\.scale\s*=/.test(ac)).toBe(false);
    expect(/timeScale|clock\.scale/.test(method(GAME, 'startAuto').body)).toBe(false);
    // autospin never refills
    expect(method(GAME, 'refill').body).toMatch(/\|\| this\.auto\) return;/);
  });

  it('saveDice( appears only in store.ts and Game.persist (one write, same task as save())', () => {
    for (const f of SRC) {
      if (f.endsWith(join('game', 'store.ts')) || f.endsWith(join('game', 'Game.ts'))) continue;
      expect(read(f).includes('saveDice('), f).toBe(false);
    }
    const at = positions(GAME, 'saveDice(');
    expect(at.length).toBe(1);
    const persist = method(GAME, 'persist');
    expect(within(at[0], persist)).toBe(true);
    expect(persist.body.replace(/\s+/g, ' ')).toContain('save(this.s); saveDice(this.dice);');
    // wipeDice only in "Nulstil demo"
    const w = positions(GAME, 'wipeDice(');
    expect(w.length).toBe(1);
    expect(within(w[0], method(GAME, 'demoReset'))).toBe(true);
  });

  it("unlock 'seen' / unlockedAt are written only at a real ceremony's seal", () => {
    const at = positions(GAME, 'unlockedAt = Date.now()');
    expect(at.length).toBe(1);
    const seal = method(GAME, 'sealGate');
    expect(within(at[0], seal)).toBe(true);
    expect(seal.body).toMatch(/if \(this\.demoMode \|\| this\.dice\.unlock !== 'pending'\) return;/);
    expect(count(GAME, "unlock = 'seen'")).toBe(1);
    const run = method(GAME, 'runCeremony').body;
    expect(run).toContain("if (kind === 'real') this.sealGate()");
    for (const m of run.matchAll(/this\.sealGate\(\)/g)) expect(run.slice(Math.max(0, (m.index ?? 0) - 40), m.index)).toContain("kind === 'real'");
  });

  it('src/math never imports game/dice', () => {
    for (const f of walk('src/math')) expect(/from '[^']*dice[^']*'/.test(read(f)), f).toBe(false);
  });

  it('DOM and Pixi modules never touch the store: no mutator, store type, persistence or rule imports', () => {
    const view = [...walk('src/ui'), ...walk('src/render'), ...walk('src/present')];
    for (const f of view) {
      const src = read(f);
      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']*game\/dice(?:\.ts)?)'/g)) {
        const names = m[1].split(',').map((s) => s.replace(/\btype\b/, '').trim()).filter(Boolean);
        for (const n of names) expect(['addDie', 'diceDefaults', 'DiceStore', 'diceFor', 'realDiceView', 'openGamble', 'settleGamble', 'clearSettled', 'cloneDice', 'canOffer', 'stagedOf'].includes(n), `${f} imports ${n}`).toBe(false);
      }
      expect(/\b(loadDice|saveDice|wipeDice|DICE_KEY)\b/.test(src), `${f} touches dice persistence`).toBe(false);
      expect(/terningen\.v1/.test(src), `${f} names the dice key`).toBe(false);
    }
  });
});
