import { describe, expect, it } from 'vitest';
import { engine, type Engine } from './setup/engine';

/**
 * The three new features through the real store on a virtual clock: total goals and final score
 * (settlement by confirmed goals), exits (stop-loss after a goal against) and the Parken pool.
 */
type Store = InstanceType<Engine['MatchStore']>;

function harness(E: Engine, tl: Engine['FREE_PLAY']) {
  const mc = { mode: 'hovedtråd' as const, lastMs: 0, run: async () => null, dispose() {} };
  const store: Store = new E.MatchStore(tl, mc);
  let vt = 0;
  store.clock = () => vt;
  const toasts: [string, string][] = [];
  const orig = store.toast.bind(store);
  store.toast = (text: string, tone: 'info' | 'good' | 'bad') => {
    toasts.push([text, tone]);
    orig(text, tone);
  };
  const tick = () => {
    vt += 100;
    store.tick(vt);
  };
  const until = (cond: () => boolean) => {
    while (!cond() && store.sim.phase !== 'closed' && vt < 2_000_000) tick();
  };
  const pending = () => (store as unknown as { pending: { state: string } | null }).pending;
  const buy = (contract: string, kr: number) => {
    store.requestBuy(contract, kr);
    for (let i = 0; i < 40 && pending()?.state === 'lock'; i++) tick();
    if (pending()?.state === 'requote') store.acceptRequote();
  };
  const view = () => {
    store.flushNow();
    return store.view;
  };
  return { store, tick, until, toasts, buy, view, vt: () => vt };
}

const SCRIPT: Engine['FREE_PLAY'] = {
  seed: 'features-1',
  naturalGoals: false,
  naturalWhales: false,
  stoppage: 3,
  events: [
    { at: '10:00', type: 'goal', team: 0 },
    { at: '20:00', type: 'goal', team: 0, var: { secs: 8, p0: 0.6, verdict: 'annulleret' } },
    { at: '30:00', type: 'goal', team: 1 },
    { at: '40:00', type: 'goal', team: 0 },
  ],
};

describe('features', () => {
  it('totals and final score settle on confirmed goals; exits and the pool keep the saldo identity', async () => {
    const E = await engine();
    const { store, until, toasts, buy, tick, view } = harness(E, SCRIPT);
    store.speed = 4;
    until(() => store.sim.t >= 3 && !store.sim.halted);
    buy('tot:2.5:O', 200);
    buy('tot:2.5:U', 100);
    buy('cs:0-0', 100);
    buy('1x2:F', 300);
    store.stakePool(0, 100);
    expect(store.book.positions.get('tot:2.5:O')!.shares).toBeGreaterThan(0);
    expect(store.book.positions.get('cs:0-0')!.shares).toBeGreaterThan(0);
    expect(store.book.poolStakes).toHaveLength(1);
    // Unknown and wrongly keyed contracts are never open.
    expect(store.isOpen('nonsense')).toBe(false);
    expect(store.isOpen('ng2:F')).toBe(false);
    expect(store.isOpen('ng1:F')).toBe(true);

    // 10′ FCK: 0–0 is impossible from here and settles to 0 at the goal.
    until(() => store.sim.h === 1);
    expect(store.book.positions.get('cs:0-0')!.settled?.value).toBe(0);
    // The pool is closed while trading is halted.
    expect(view().pool.open || store.sim.halted).toBe(true);
    store.stakePool(1, 50);
    expect(store.book.poolStakes).toHaveLength(1);
    expect(toasts.at(-1)![0]).toMatch(/åbner efter stoppet/);

    // After the reopen: stop-loss on the FCK position, below the bid.
    until(() => !store.sim.halted && store.sim.t >= 12);
    const bidF = store.sim.bid[0];
    expect(store.placeExit('1x2:F', 'stop', bidF - 8)).toBe(true);
    expect(store.placeExit('1x2:F', 'take', bidF + 40 > 99 ? 99 : bidF + 40)).toBe(true);

    // 20′ VAR annulled: the next goal is still number 2.
    until(() => store.sim.events.some((e) => e.kind === 'var-verdict'));
    until(() => !store.sim.halted && store.sim.t >= 25);
    expect(view().d.nextIndex).toBe(2);
    buy('ng2:B', 100);
    expect(store.book.positions.get('ng2:B')!.shares).toBeGreaterThan(0);

    // 30′ BIF (goal against FCK): ng2:B pays; the stop fires after the reopen guard, at the bid.
    until(() => store.sim.a === 1);
    expect(store.book.positions.get('ng2:B')!.settled?.value).toBe(100);
    expect(store.book.positions.get('tot:2.5:O')!.settled).toBeNull();
    until(() => !store.book.exits.some((x) => x.status === 'aktiv') || store.sim.t > 34);
    const stop = store.book.exits.find((x) => x.kind === 'stop')!;
    expect(stop.status).toBe('udløst');
    expect(store.book.exits.find((x) => x.kind === 'take')!.status).toBe('annulleret');
    expect(store.book.positions.get('1x2:F')!.shares).toBe(0);
    const reopen = store.sim.events.filter((e) => e.kind === 'reopen').at(-1)!;
    expect(stop.fill!.k - reopen.k).toBeGreaterThan(7);
    expect(store.book.log.some((e) => e.kind === 'sell' && e.via === 'stop')).toBe(true);

    // 35′ at 1–1: final score 2–1.
    until(() => !store.sim.halted && store.sim.t >= 35);
    buy('cs:2-1', 50);
    buy('cs:1-1.2-2', 50);
    expect(store.book.positions.get('cs:2-1')!.shares).toBeGreaterThan(0);

    // 40′ FCK: the third confirmed goal settles Over 2.5 (the annulled VAR goal never counted).
    until(() => store.sim.h === 2);
    const over = store.book.positions.get('tot:2.5:O')!;
    expect(over.settled?.value).toBe(100);
    expect(over.settled!.t).toBeGreaterThan(39.99);
    expect(store.book.positions.get('tot:2.5:U')!.settled?.value).toBe(0);
    for (let i = 0; i < 30; i++) tick();
    const n = toasts.length;
    store.requestBuy('tot:2.5:O', 100);
    expect(toasts.slice(n).some(([t, tone]) => tone === 'bad' && /2,5 er allerede passeret/.test(t))).toBe(true);
    expect(store.isOpen('tot:1.5:U')).toBe(false);
    expect(store.isOpen('tot:3.5:O')).toBe(true);
    // 1–1 is gone at 2–1, but 2–2 is still reachable: the region stays open until the final whistle.
    expect(store.book.positions.get('cs:1-1.2-2')!.settled).toBeNull();

    until(() => store.sim.phase === 'closed');
    expect(`${store.sim.h}-${store.sim.a}`).toBe('2-1');
    expect(store.book.positions.get('cs:2-1')!.settled?.value).toBe(100);
    expect(store.book.positions.get('cs:1-1.2-2')!.settled?.value).toBe(0);
    // Pool: FCK won; payout = stake ÷ side × pool × 0.9.
    const pv = view().pool;
    const r = store.book.poolResult!;
    expect(r.winner).toBe(0);
    expect(r.payout).toBeCloseTo((100 / pv.sides[0]) * pv.total * 0.9, 6);
    const tot = store.book.totals();
    expect(store.book.saldo).toBeCloseTo(5000 - tot.staked + tot.paidOut, 6);
    for (const p of store.book.positions.values()) expect(p.shares === 0 || p.settled !== null).toBe(true);
  });

  it('final-score regions are never priced below their fair chance, and get the 10 % margin', async () => {
    const E = await engine();
    const { store, until } = harness(E, { ...E.FREE_PLAY });
    const possible = (h: number, a: number) => (h === 5 || store.sim.h <= h) && (a === 5 || store.sim.a <= a);
    const regions: ((h: number, a: number) => boolean)[] = [(h, a) => h - a >= 2, (h, a) => h >= 1 && a >= 1, (h, a) => a - h >= 2, (h, a) => h + a >= 4, (h, a) => h === a];
    for (const m of [1, 20, 40, 60]) {
      until(() => store.sim.t >= m && !store.sim.halted);
      store.tick();
      for (const f of regions) {
        const cells: [number, number][] = [];
        for (let h = 0; h < 6; h++) for (let a = 0; a < 6; a++) if (f(h, a) && possible(h, a)) cells.push([h, a]);
        if (cells.length < 2) continue;
        const q = store.quote(`cs:${cells.map(([h, a]) => `${h}-${a}`).join('.')}`)!;
        expect(q.ask).toBeGreaterThanOrEqual(Math.min(99, Math.ceil(100 * q.p * 1.1 - 1e-9)));
        expect(q.ask).toBeGreaterThan(100 * q.p);
      }
    }
  });

  it('pool: a krone staked on any side at any minute before halftime returns at most 0.95 in expectation', async () => {
    const E = await engine();
    const worst: number[] = [0, 0, 0];
    const mean = [0, 0, 0];
    const N = 20;
    for (let m = 0; m < N; m++) {
      const { store, until, view } = harness(E, { ...E.FREE_PLAY, seed: `pool-${m}` });
      store.speed = 8;
      // The payout is fixed by the sides at the close, so the stake minute only changes what you know.
      until(() => store.sim.phase === 'HT' || store.sim.phase === '2H');
      const pv = view().pool;
      expect(pv.closed).toBe(true);
      const q = store.sim.fair; // the model's probability of each final result, given halftime
      const x = 100;
      for (let i = 0; i < 3; i++) {
        const perKr = (q[i] * (pv.total + x) * 0.9) / (pv.sides[i] + x);
        worst[i] = Math.max(worst[i], perKr);
        mean[i] += perKr / N;
      }
    }
    // Structural bound: 0.9 × (Σ q·lean) / lean_i ≤ 0.9 × 1.035 / 0.985 ≈ 0.946, less your own dilution.
    for (let i = 0; i < 3; i++) {
      expect(worst[i]).toBeLessThanOrEqual(0.95);
      expect(mean[i]).toBeLessThanOrEqual(0.95);
    }
  });
});
