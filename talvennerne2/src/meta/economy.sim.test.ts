import { beforeAll, describe, expect, it } from 'vitest'
import { ITEMS } from '../content/catalog'
import { TOTAL_SINK } from '../content/economy'
import type { ProfileDoc } from '../engine/types'
import { isBigCeremony, isRewardEvent, perlerOf, type Reward } from './rewards'
import { CHILD_50, CHILD_85, GUESSER, Sim, seedOf, type SessionLog } from './testing/sim'

/**
 * The economy's acceptance checks (SPEC §5.7, "Belønningskadence"). A simulated child answers 85 %
 * right on the first try, plays five rounds a session (session 1 is onboarding and three rounds), one
 * session a day, passes 70 % of its trials, follows its first two goals and saves up for a wished-for
 * shop item. Everything but the child's answers is the real game: mastery, learning events, trials,
 * unlocking, progression, eggs and the shop. Each run is fixed by its seed.
 */

/** Perler a round pays by itself; level-ups and trophies are milestones on top (their own events). */
const roundPerler = (rs: readonly Reward[]) => rs.filter((r) => r.t !== 'levelUp' && r.t !== 'trophy').reduce((s, r) => s + perlerOf(r), 0)
const allOf = (s: SessionLog): Reward[] => [...s.rounds.flatMap((r) => r.rewards), ...s.actions]

let main: Sim

beforeAll(() => {
  main = new Sim(CHILD_85, seedOf('85')).playSessions(150)
}, 120_000)

describe('economy simulation (SPEC §5.7)', () => {
  it('1: session 1 brings the starter, a hatch, two things, level 3 and 50 perler', () => {
    const s1 = main.sessions[0]
    const all = allOf(s1)
    expect(all.some((r) => r.t === 'animal' && r.animal.source === 'starter')).toBe(true)
    expect(all.filter((r) => r.t === 'hatch').length).toBeGreaterThanOrEqual(1)
    expect(s1.items).toBeGreaterThanOrEqual(2)
    expect(s1.level).toBeGreaterThanOrEqual(3)
    expect(s1.earned).toBeGreaterThanOrEqual(50)
  })

  it('2: sessions 1–10 each have three reward events and a big ceremony', () => {
    for (const s of main.sessions.slice(0, 10)) {
      const all = allOf(s)
      expect(all.filter(isRewardEvent).length, `session ${s.session}`).toBeGreaterThanOrEqual(3)
      expect(all.filter(isBigCeremony).length, `session ${s.session}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('3: sessions 11–40 each have a big ceremony, and never more than 4 rounds go without a reward', () => {
    for (const s of main.sessions.slice(10, 40)) {
      expect(allOf(s).filter(isBigCeremony).length, `session ${s.session}`).toBeGreaterThanOrEqual(1)
    }
    let dry = 0
    for (const s of main.sessions.slice(0, 40)) {
      for (const r of s.rounds) {
        dry = r.rewards.some(isRewardEvent) ? 0 : dry + 1
        expect(dry, `session ${s.session}, round ${r.round}`).toBeLessThanOrEqual(4)
      }
    }
  })

  it('4: level 10 in session 3–7, level 20 in session 12–24, level 50 not before session 150', () => {
    const reach = (level: number) => main.sessions.find((s) => s.level >= level)?.session ?? Infinity
    expect(reach(10)).toBeGreaterThanOrEqual(3)
    expect(reach(10)).toBeLessThanOrEqual(7)
    expect(reach(20)).toBeGreaterThanOrEqual(12)
    expect(reach(20)).toBeLessThanOrEqual(24)
    expect(main.sessions[148].level).toBeLessThan(50)
  })

  it('5: the shop, the recolours and the decor cannot be emptied before session 100', () => {
    // the child spends as it goes (its wish first, then whatever it can afford)
    for (const s of main.sessions.slice(0, 99)) expect(s.emptied, `session ${s.session}`).toBe(false)
    // and even all it has earned by then would not buy everything there is
    expect(main.sessions[98].earned).toBeLessThan(TOTAL_SINK)
  })

  it('6: a child with 50 % right gets at least 70 % of the perler per round', () => {
    const strong = new Sim(CHILD_85, seedOf('85-6')).playSessions(40)
    const weak = new Sim(CHILD_50, seedOf('50')).playSessions(40)
    const perRound = (sim: Sim, pay: (r: { rewards: Reward[]; perler: number }) => number) => {
      const rounds = sim.sessions.flatMap((s) => s.rounds)
      return rounds.reduce((sum, r) => sum + pay(r), 0) / rounds.length
    }
    // what the rounds pay, and everything including level-ups and trophies
    expect(perRound(weak, (r) => roundPerler(r.rewards))).toBeGreaterThanOrEqual(0.7 * perRound(strong, (r) => roundPerler(r.rewards)))
    expect(perRound(weak, (r) => r.perler)).toBeGreaterThanOrEqual(0.7 * perRound(strong, (r) => r.perler))
  })

  it('7: replaying a three-star node 20 times pays at most 12 perler a round', () => {
    const sim = new Sim({ ...CHILD_85, shopper: undefined }, seedOf('85-7')).playSessions(10)
    const node = Object.entries(sim.profile.nodes).find(([id, n]) => n?.stars === 3 && !id.endsWith('-trial'))?.[0]
    expect(node).toBeDefined()
    for (let i = 0; i < 20; i++) {
      const r = sim.replay(node!)
      expect(roundPerler(r.rewards), `replay ${i + 1}`).toBeLessThanOrEqual(12)
      expect(r.rewards.some((x) => x.t === 'stars')).toBe(false)
    }
  })

  it('8: no skill reaches gold with fewer than 12 typed answers or on fewer than 3 days', () => {
    expect(main.golds.length).toBeGreaterThan(0)
    for (const g of main.golds) {
      expect(g.prodCorrect, g.skill).toBeGreaterThanOrEqual(12)
      expect(g.prodDays, g.skill).toBeGreaterThanOrEqual(3)
    }
  })

  it('9: a child who guesses (one in three) never reaches a mastery reward', () => {
    const guesser = new Sim(GUESSER, seedOf('guess')).playSessions(60)
    const p: ProfileDoc = guesser.profile
    const medals = Object.values(p.skillMedals)
    expect(medals).not.toContain('silver')
    expect(medals).not.toContain('gold')
    const mastery = ITEMS.filter((i) => i.source.kind === 'medal').map((i) => i.id)
    expect(mastery.filter((id) => p.inventory[id])).toEqual([])
    expect(p.animals.filter((a) => a.source === 'starFoal' || a.source === 'gold' || a.source === 'rainbow')).toEqual([])
    // it still played, earned perler for every right answer and met friends along the way
    expect(guesser.earned).toBeGreaterThan(1000)
    expect(p.animals.length).toBeGreaterThan(5)
  })

  it('is deterministic', () => {
    const a = new Sim(CHILD_85, 7).playSessions(12)
    const b = new Sim(CHILD_85, 7).playSessions(12)
    expect(b.profile).toEqual(a.profile)
    expect(b.sessions).toEqual(a.sessions)
  })
})
