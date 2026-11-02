import { describe, expect, it } from 'vitest';
import { engine } from './setup/engine';

/**
 * tune-demo: runs the scripted demo through the real store on a virtual clock, performing the
 * same steps as the ghost thumb, and checks timing, fills and accounting. The printed numbers are
 * the ones the narration may quote.
 */
describe('demo90', () => {
  it('runs end to end: every scripted action fills, no requotes, about 90 s', async () => {
    const E = await engine();
    const mc = { mode: 'hovedtråd' as const, lastMs: 0, run: (req: Parameters<typeof E.runMc>[0]) => E.runMc(req), dispose() {} };
    const store = new E.MatchStore(E.DEMO90, mc);
    store.demo = true;
    store.segments = E.demoSegments();
    let vt = 0;
    store.clock = () => vt;
    const at: { ms: number; fn: () => void }[] = [];
    const later = (ms: number, fn: () => void) => at.push({ ms: vt + ms, fn });
    const done = new Set<number>();
    const rejections: string[] = [];
    const origToast = store.toast.bind(store);
    store.toast = (text: string, tone: 'info' | 'good' | 'bad') => {
      if (tone === 'bad') rejections.push(text);
      origToast(text, tone);
    };
    const marks: Record<string, number> = {};
    let requotes = 0;
    while ((store.sim.phase as string) !== 'closed' && vt < 300000) {
      vt += 100;
      store.tick(vt);
      if (store.view && store['pending'] && (store as unknown as { pending: { state: string } }).pending.state === 'requote') requotes++;
      await Promise.resolve();
      await Promise.resolve();
      for (const a of at.filter((x) => x.ms <= vt)) {
        a.fn();
        at.splice(at.indexOf(a), 1);
      }
      const t = store.sim.t;
      const phase = store.sim.phase;
      E.DEMO_STEPS.forEach((s, i) => {
        if (done.has(i)) return;
        const due = s.do === 'settle' ? (phase as string) === 'closed' : s.do === 'byg' ? phase === 'HT' : t >= s.at && (phase === '1H' || phase === '2H') && !store.sim.halt;
        if (!due) return;
        done.add(i);
        store.holdSpeed(3500);
        if (s.do === 'hold') {
          store.setFocus(s.outcome);
          later(900, () => store.requestBuy(['1x2:F', '1x2:X', '1x2:B'][s.outcome], s.kr));
        } else if (s.do === 'limit') later(900, () => store.placeLimit(s.outcome, s.level, s.kr));
        else if (s.do === 'window') later(900, () => store.requestBuy(`w:${s.a}-${s.b}:J`, s.kr));
        else if (s.do === 'byg') {
          later(600, () => store.setLegs([{ kind: 'udfald', o: 0 }, { kind: 'maal', n: 3 }]));
          later(4200, () => {
            const q = store.build.quote;
            if (q) store.requestBuy(q.id, s.kr);
          });
        }
      });
      for (const e of store.sim.events.slice(-3)) {
        const key = `${e.kind}@${Math.round(e.t * 100) / 100}`;
        if (['goal', 'kickoff', 'fulltime', 'var-verdict', 'whale', 'half', 'second-half'].includes(e.kind) && marks[key] === undefined) marks[key] = vt;
      }
    }
    const log = store.book.log;
    const tot = store.book.totals();
    const summary = {
      seconds: vt / 1000,
      marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v / 1000])),
      score: `${store.sim.h}-${store.sim.a}`,
      log: log.map((e) => `${e.kind} ${e.contract} ${'shares' in e ? e.shares : ''}@${'price' in e ? e.price : 'value' in e ? e.value : ''} ${'kr' in e ? e.kr.toFixed(2) : 'payout' in e ? e.payout.toFixed(2) : ''}`),
      staked: tot.staked,
      paidOut: tot.paidOut,
      saldo: store.book.saldo,
      rejections,
      requotes,
    };
    console.log(JSON.stringify(summary, null, 1));
    expect(store.sim.h).toBe(2);
    expect(store.sim.a).toBe(1);
    expect(rejections).toEqual([]);
    expect(requotes).toBe(0);
    const kinds = log.map((e) => `${e.kind}:${e.contract.replace(/[0-9.-]+/g, '#')}`);
    expect(kinds).toContain('buy:#x#:F');
    expect(kinds).toContain('limit-fill:#x#:F');
    expect(kinds.some((k) => k.startsWith('buy:byg:'))).toBe(true);
    expect(kinds.some((k) => k.startsWith('buy:w:'))).toBe(true);
    expect(store.book.saldo).toBeCloseTo(5000 - tot.staked + tot.paidOut, 6);
    expect(vt / 1000).toBeGreaterThan(75);
    expect(vt / 1000).toBeLessThan(110);
  }, 180000);
});
