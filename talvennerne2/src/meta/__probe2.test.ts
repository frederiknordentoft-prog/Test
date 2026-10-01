import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { Sim, CHILD_85, CHILD_50, seedOf } from './testing/sim'
import { perlerOf, type Reward } from './rewards'

function breakdown(s: Sim) {
  const rs = s.sessions.flatMap((x) => x.rounds)
  const by: Record<string, number> = {}
  for (const r of rs) for (const w of r.rewards) by[w.t] = (by[w.t] ?? 0) + perlerOf(w as Reward)
  const acts: Record<string, number> = {}
  for (const x of s.sessions) for (const w of x.actions) acts[w.t] = (acts[w.t] ?? 0) + perlerOf(w)
  return Object.entries(by).map(([k, v]) => `${k}:${(v / rs.length).toFixed(2)}`).join(' ') + ' | actions ' + JSON.stringify(acts)
}
it('probe2', () => {
  const sim50 = new Sim(CHILD_50, seedOf('50')).playSessions(40)
  const sim85 = new Sim(CHILD_85, seedOf('85')).playSessions(40)
  writeFileSync('/tmp/claude-0/-home-user-Test/918cd891-b887-5552-9d79-c7ecd5307c96/scratchpad/probe2.txt', `85: ${breakdown(sim85)}\n50: ${breakdown(sim50)}\n`)
}, 120_000)
