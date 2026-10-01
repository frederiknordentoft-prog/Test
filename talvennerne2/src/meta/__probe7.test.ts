import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { Sim, CHILD_85, seedOf } from './testing/sim'
import { perlerOf } from './rewards'

it('probe7', () => {
  const out: string[] = []
  for (const at of [5, 10, 20, 40]) {
    const sim = new Sim({ ...CHILD_85, shopper: undefined }, seedOf('85')).playSessions(at)
    const node = Object.entries(sim.profile.nodes).find(([id, n]) => n?.stars === 3 && !id.endsWith('trial'))?.[0]
    if (!node) { out.push(`at ${at}: no 3-star node`); continue }
    const per: number[] = []
    const parts: Record<string, number> = {}
    for (let i = 0; i < 20; i++) {
      const r = sim.replay(node)
      per.push(r.perler)
      for (const w of r.rewards) parts[w.t] = (parts[w.t] ?? 0) + perlerOf(w)
    }
    out.push(`at ${at} node ${node}: mean ${(per.reduce((a, b) => a + b, 0) / 20).toFixed(2)} max ${Math.max(...per)} per ${per.join(',')} parts ${JSON.stringify(parts)}`)
  }
  writeFileSync('/tmp/claude-0/-home-user-Test/918cd891-b887-5552-9d79-c7ecd5307c96/scratchpad/probe7.txt', out.join('\n'))
}, 300_000)
