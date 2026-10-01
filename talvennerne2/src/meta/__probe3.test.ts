import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { Sim, CHILD_85, seedOf } from './testing/sim'
import { isBigCeremony } from './rewards'

it('probe3', () => {
  const out: string[] = []
  for (const seed of [seedOf('85'), 2, 3, 4]) {
    const sim = new Sim(CHILD_85, seed).playSessions(40)
    const zero: string[] = []
    for (const s of sim.sessions) {
      const evs = [...s.rounds.flatMap((r) => r.rewards), ...s.actions].filter(isBigCeremony)
      if (evs.length === 0) zero.push(`s${s.session}[${s.rounds.map((r) => r.node).join(',')}]`)
    }
    const counts: Record<string, number> = {}
    for (const s of sim.sessions) for (const r of [...s.rounds.flatMap((x) => x.rewards), ...s.actions]) if (isBigCeremony(r)) counts[r.t] = (counts[r.t] ?? 0) + 1
    out.push(`seed ${seed}: zero-big sessions ${zero.length}: ${zero.join(' ')}\n  totals ${JSON.stringify(counts)} medals ${JSON.stringify(Object.values(sim.profile.skillMedals).reduce((a: Record<string, number>, m) => ((a[m!] = (a[m!] ?? 0) + 1), a), {}))}`)
  }
  writeFileSync('/tmp/claude-0/-home-user-Test/918cd891-b887-5552-9d79-c7ecd5307c96/scratchpad/probe3.txt', out.join('\n'))
}, 120_000)
