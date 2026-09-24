import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import { balanceretBot } from './bots/balanced';
import { markedsStandard } from '../src/sim/reviews';
import { aarFor } from '../src/sim/time';
const s = newGame({ seed: 3, firmaNavn: 'B', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
while (s.uge < 52 * 4) {
  const acts = balanceretBot.beslut(s);
  const launches = acts.filter((a) => a.t === 'launch').map((a) => (a as { projectId: string }).projectId);
  const info = launches.map((id) => { const p = s.projekter.find((x) => x.id === id)!; const std = markedsStandard(s, p.typeId); return `${p.typeId}/${p.themeId} std ${std.toFixed(0)} r=${Object.values(p.params).map((v) => (v / std).toFixed(2)).join('/')} fejl ${p.fejl.toFixed(1)} boost ${p.boostBrugt} bud ${p.budget} team ${p.faseTildeling.design.length}`; });
  stepMut(s, acts);
  for (const sig of s.signaler) if (sig.k === 'anmeldelse') { const p = s.produkter.find((x) => x.id === sig.productId)!; console.log(aarFor(s.uge), s.uge, p.total40, p.anmeldelser.map((r) => r.score).join(','), info.shift(), 'staff', s.staff.map((m) => `${m.rolle.slice(0,4)}${m.niveau}:${Math.round(m.energi)}`).join(' ')); }
}
