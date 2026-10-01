import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { Sim, CHILD_85, CHILD_50, GUESSER, seedOf } from './testing/sim'
import { isBigCeremony, isRewardEvent } from './rewards'

it('probe', () => {
  const t0 = performance.now()
  const out: string[] = []
  const sim = new Sim({ ...CHILD_85, spender: true }, seedOf('85'))
  sim.playSessions(160)
  out.push(`85 time ${(performance.now() - t0).toFixed(0)} ms`)
  let firstL10 = 0, firstL20 = 0, firstL50 = 0
  let gap = 0, maxGap = 0
  for (const s of sim.sessions) {
    const evs = [...s.rounds.flatMap((r) => r.rewards), ...s.actions]
    const big = evs.filter(isBigCeremony).length
    const rew = evs.filter(isRewardEvent).length
    for (const r of s.rounds) {
      const has = r.rewards.some(isRewardEvent)
      gap = has ? 0 : gap + 1
      if (s.session >= 11 && s.session <= 40) maxGap = Math.max(maxGap, gap)
    }
    if (!firstL10 && s.level >= 10) firstL10 = s.session
    if (!firstL20 && s.level >= 20) firstL20 = s.session
    if (!firstL50 && s.level >= 50) firstL50 = s.session
    const perRound = s.rounds.reduce((a, r) => a + r.perler, 0) / s.rounds.length
    if (s.session <= 12 || s.session % 10 === 0) out.push(`s${s.session} L${s.level} earned ${s.earned} bal ${s.perler} perRound ${perRound.toFixed(1)} animals ${s.animals} items ${s.items} big ${big} rew ${rew} nodes ${s.rounds.map((r) => r.node).join(',')}`)
  }
  out.push(`L10 ${firstL10} L20 ${firstL20} L50 ${firstL50} maxGap(11-40) ${maxGap}`)
  out.push(`earned by s99: ${sim.sessions[98].earned}; shopEmptied at end ${sim.shopEmptied()}`)
  out.push(`golds ${sim.golds.length} first ${JSON.stringify(sim.golds[0])} min prod ${Math.min(...sim.golds.map((g) => g.prodCorrect))} min days ${Math.min(...sim.golds.map((g) => g.prodDays))}`)
  const s1 = sim.sessions[0]
  out.push(`s1 actions ${s1.actions.map((r) => r.t).join(',')} rewards ${s1.rounds.map((r) => r.rewards.map((x) => x.t).join('|')).join(' / ')}`)
  const sim50 = new Sim(CHILD_50, seedOf('50')).playSessions(40)
  const sim85 = new Sim(CHILD_85, seedOf('85')).playSessions(40)
  const avg = (s: Sim) => { const rs = s.sessions.flatMap((x) => x.rounds); return rs.reduce((a, r) => a + r.perler, 0) / rs.length }
  out.push(`perRound 85 ${avg(sim85).toFixed(2)} 50 ${avg(sim50).toFixed(2)} ratio ${(avg(sim50) / avg(sim85)).toFixed(3)} L50child ${sim50.profile.economy.level} L85 ${sim85.profile.economy.level}`)
  const g = new Sim(GUESSER, seedOf('g')).playSessions(60)
  out.push(`guesser medals ${JSON.stringify(g.profile.skillMedals)} animals ${g.profile.animals.map((a) => a.source).join(',')} items ${Object.keys(g.profile.inventory).join(',')}`)
  writeFileSync('/tmp/claude-0/-home-user-Test/918cd891-b887-5552-9d79-c7ecd5307c96/scratchpad/probe.txt', out.join('\n'))
}, 120_000)
