/* Monte Carlo at the story's 20′ (FCK focus) for the "5.000 → 100" figure: data/mc20.json. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..');
const E = await import(path.join(ROOT, 'tests/.cache/engine.mjs'));
await import('./story.js');
const S = globalThis.UDFALD_STORY;
const mc = { mode: 'hovedtråd', lastMs: 0, run: async () => null, dispose() {} };
const st = new E.MatchStore(E.FREE_PLAY, mc);
let vt = 0;
st.clock = () => vt;
S.ffK(st, 830, () => (vt += 100));
const req = st.mcRequest(0, undefined);
const r = await E.runMc(req);
const step = 2;
const out = {
  k: st.sim.k, t: st.sim.t, probs: req.probs, askNow: req.askNow, n: req.n, counts: r.counts, mcShares: r.mcShares,
  tPts: Array.from(r.tPts).filter((_, i) => i % step === 0 || i === r.tPts.length - 1).map((x) => Math.round(x * 100) / 100),
  strands: r.strands.map((s) => ({ o: s.outcome, goals: s.goalT.map((g, i) => [Math.round(g * 100) / 100, s.goalTeam[i]]), v: Array.from(s.v).filter((_, i) => i % step === 0 || i === s.v.length - 1).map((x) => Math.round(x * 10) / 10) })),
};
fs.writeFileSync(path.join(here, '..', 'data', 'mc20.json'), JSON.stringify(out));
console.log('mc20', out.counts, out.mcShares.map((x) => x.toFixed(3)), out.strands.length, out.tPts.length);
