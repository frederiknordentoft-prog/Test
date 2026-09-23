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
    for (const m of ['demo', 'demoSuns', 'demoDie', 'demoFirstDie', 'openChamber', 'runCeremony', 'demoReset']) expect(method(GAME, m).body.includes('awardDie'), m).toBe(false);
    const q = method(GAME, 'debug').body;
    expect(q.includes('awardDie') || q.includes('addDie')).toBe(false);
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
        for (const n of names) expect(['addDie', 'diceDefaults', 'DiceStore', 'diceFor', 'realDiceView'].includes(n), `${f} imports ${n}`).toBe(false);
      }
      expect(/\b(loadDice|saveDice|wipeDice|DICE_KEY)\b/.test(src), `${f} touches dice persistence`).toBe(false);
      expect(/terningen\.v1/.test(src), `${f} names the dice key`).toBe(false);
    }
  });
});
