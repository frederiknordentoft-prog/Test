import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { Sim, CHILD_85, CHILD_50, seedOf } from './testing/sim'
import { isBigCeremony, isRewardEvent } from './rewards'

it('probe4', () => {
  const out: string[] = []
  for (const seed of [seedOf('85'), 1, 2, 3, 4, 5, 6]) {
    const sim = new Sim(CHILD_85, seed).playSessions(100)
    const zero: number[] = []
    let gap = 0, maxGap = 0
    const few: number[] = []
    for (const s of sim.sessions) {
      const evs = [...s.rounds.flatMap((r) => r.rewards), ...s.actions]
      if (s.session <= 40 && evs.filter(isBigCeremony).length === 0) zero.push(s.session)
      if (s.session <= 10 && evs.filter(isRewardEvent).length < 3) few.push(s.session)
      for (const r of s.rounds) { gap = r.rewards.some(isRewardEvent) ? 0 : gap + 1; if (s.session >= 11 && s.session <= 40) maxGap = Math.max(maxGap, gap) }
    }
    const s1 = sim.sessions[0]
    const l10 = sim.sessions.find((s) => s.level >= 10)?.session, l20 = sim.sessions.find((s) => s.level >= 20)?.session
    out.push(`seed ${seed}: s1 earned ${s1.earned} L${s1.level} animals ${s1.animals} items ${s1.items} | zeroBig ${zero.join(',')} | few ${few.join(',')} | maxGap ${maxGap} | L10 ${l10} L20 ${l20} | earned s99 ${sim.sessions[98].earned} L${sim.sessions[98].level} emptied ${sim.shopEmptied()} shopItemsOwned ${Object.keys(sim.profile.inventory).length}`)
  }
  for (const seed of [1, 2, 3]) {
    const a = new Sim(CHILD_85, seed).playSessions(40), b = new Sim(CHILD_50, seed + 100).playSessions(40)
    const avg = (s: Sim) => { const rs = s.sessions.flatMap((x) => x.rounds); return rs.reduce((x, r) => x + r.perler, 0) / rs.length }
    out.push(`ratio seed ${seed}: ${avg(a).toFixed(2)} ${avg(b).toFixed(2)} ${(avg(b) / avg(a)).toFixed(3)}`)
  }
  writeFileSync('/tmp/claude-0/-home-user-Test/918cd891-b887-5552-9d79-c7ecd5307c96/scratchpad/probe4.txt', out.join('\n'))
}, 300_000)
