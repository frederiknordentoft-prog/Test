import { describe, expect, it } from 'vitest'
import { hasClip } from '../speech/catalog'
import type { Animal, Goal } from '../engine/types'
import {
  CEREMONY_ORDER, MAX_BLOCK_MS, MAX_END_MS, MAX_END_MS_WITH_HATCH, MAX_FULL_SCREEN, kindOf, planCeremonies, speechFor,
  type CeremonyKind,
} from './ceremonyQueue'
import type { Reward } from './rewards'

const animal = (over: Partial<Animal> = {}): Animal => ({
  uid: 'friend-x', species: 'cat', breed: 'domestic', colorway: 'c2', name: 'Misse', friendship: 0, stage: 1, star: false,
  shown: 1, outfit: {}, foundAt: 0, source: 'friend', ...over,
})
const goal: Goal = { kind: 'mix', need: 1, progress: 0, done: false }

const R = {
  learned: { t: 'learned', promoted: [{ key: 'add:8+5', skill: 'addTo20', box: 3 }], firsts: [], statuses: [], practiced: ['addTo20'], next: goal },
  answers: { t: 'answers', correct: 10, perler: 10, xp: 100 },
  golden: { t: 'golden', perler: 2, xp: 10, warmth: 10 },
  stars: { t: 'stars', node: 'w0-plus10-l1', from: 0, stars: 2, perler: 2, xp: 40 },
  spark: { t: 'spark', key: 'add:8+5', skill: 'addTo20', box: 3, perler: 1, xp: 25 },
  trialPass: { t: 'trial', trial: 'w0-plus10', finale: false, passed: true, first: true, score: 9, total: 10, best: 9, perfect: false, perler: 8, xp: 100, skipped: [] },
  trialFail: { t: 'trial', trial: 'w0-plus10', finale: false, passed: false, first: false, score: 7, total: 10, best: 7, perfect: false, perler: 0, xp: 0, skipped: [] },
  hut: { t: 'hut', region: 'w0-plus10' },
  opened: { t: 'opened', worlds: [], regions: ['w0-minus10'] },
  medal: { t: 'medal', skill: 'addTo10', medal: 'silver', perler: 4, xp: 100 },
  gold: { t: 'medal', skill: 'tenFriends', medal: 'gold', perler: 8, xp: 200 },
  levelUp: { t: 'levelUp', level: 5, title: 'Opdager', perler: 5 },
  growth: { t: 'growth', uid: 'starter-rabbit', stage: 2, star: false },
  trick: { t: 'friendship', uid: 'starter-rabbit', level: 3, unlock: 'cheer' },
  item: { t: 'item', item: 'hverdag-head', source: { kind: 'level', level: 2 } },
  chest: { t: 'item', item: 'opdager-head', source: { kind: 'chest', nodeId: 'w0-former-chest' } },
  animal: { t: 'animal', animal: animal(), newSpecies: true },
  trophy: { t: 'trophy', id: 'perfect-round', perler: 5 },
  stamp: { t: 'goal', goal: { ...goal, done: true, progress: 1 }, stamp: 3 },
  tier: { t: 'regionTier', region: 'w0-plus10', tier: 'bronze' },
  egg: { t: 'eggReady', species: 'cat', options: ['rabbit', 'cat'], fresh: true },
} satisfies Record<string, Reward>

const order = (kinds: readonly CeremonyKind[]) => kinds.map((k) => CEREMONY_ORDER.indexOf(k))
const isSorted = (xs: readonly number[]) => xs.every((x, i) => i === 0 || xs[i - 1] <= x)

describe('the end of a round (SPEC §5.8)', () => {
  it('shows learning first, then stars, then perler and XP, and the hatch always last', () => {
    const plan = planCeremonies([R.egg, R.levelUp, R.stars, R.answers, R.golden, R.trialPass, R.learned, R.spark])
    const kinds = plan.steps.map((s) => s.kind)
    expect(kinds.slice(0, 3)).toEqual(['learned', 'stars', 'tally'])
    expect(kinds.at(-1)).toBe('hatch')
    expect(isSorted(order(kinds))).toBe(true)
    expect(plan.steps[2].rewards).toEqual([R.answers, R.golden, R.spark])
  })

  it('always opens with "Det lærte du", with the next goal when the round taught nothing new', () => {
    const plan = planCeremonies([R.answers], { nextGoal: goal })
    expect(plan.steps[0]).toMatchObject({ kind: 'learned', rewards: [{ t: 'learned', next: goal }] })
  })

  it('gives at most three ceremonies the full screen and keeps the rest as "Også i dag" cards', () => {
    const all = [R.learned, R.answers, R.stars, R.trialPass, R.opened, R.gold, R.medal, R.levelUp, R.growth, R.chest, R.item, R.animal, R.trophy, R.stamp, R.trick, R.tier, R.hut]
    const plan = planCeremonies(all)
    const ceremonies = plan.steps.filter((s) => !['learned', 'stars', 'tally'].includes(s.kind))
    expect(ceremonies.length).toBeLessThanOrEqual(MAX_FULL_SCREEN)
    expect(isSorted(order(plan.steps.map((s) => s.kind)))).toBe(true)
    expect(isSorted(order(plan.alsoToday.map((c) => c.kind)))).toBe(true)
    // nothing is dropped: every reward is on a step or a card
    const shown = [...plan.steps.flatMap((s) => s.rewards), ...plan.alsoToday.map((c) => c.reward)]
    for (const r of all) expect(shown).toContain(r)
    // small news is always a card
    for (const r of [R.trophy, R.stamp, R.trick, R.tier, R.hut]) expect(plan.alsoToday.map((c) => c.reward)).toContain(r)
  })

  it('weighs everything but the hatch and a new level against 6 s, or 12 s with a hatch', () => {
    const many = [R.learned, R.answers, R.stars, R.trialPass, R.gold, R.levelUp, R.growth, R.chest, R.animal]
    const timed = (p: ReturnType<typeof planCeremonies>) => p.steps.filter((s) => s.kind !== 'levelUp').reduce((sum, s) => sum + s.ms, 0)
    const plan = planCeremonies(many)
    expect(timed(plan)).toBeLessThanOrEqual(MAX_END_MS)
    const withEgg = planCeremonies([...many, R.egg])
    expect(timed(withEgg)).toBeLessThanOrEqual(MAX_END_MS_WITH_HATCH)
    expect(withEgg.steps.at(-1)?.kind).toBe('hatch')
  })

  it('always gives a new level its own screen, however much else happened (review r1 P2-1)', () => {
    const crowded = [R.learned, R.answers, R.stars, R.gold, R.medal, R.levelUp, R.animal, R.growth, R.trophy]
    for (const rewards of [crowded, [...crowded, R.egg], [...crowded, R.trialPass, R.opened]]) {
      const plan = planCeremonies(rewards)
      const ceremonies = plan.steps.filter((s) => !['learned', 'stars', 'tally'].includes(s.kind))
      expect(ceremonies.map((s) => s.kind)).toContain('levelUp')
      expect(ceremonies.length).toBeLessThanOrEqual(MAX_FULL_SCREEN)
      expect(plan.alsoToday.some((c) => c.reward.t === 'levelUp')).toBe(false)
      expect(isSorted(order(plan.steps.map((s) => s.kind)))).toBe(true)
    }
    // with a hatch the climax and the level both stay, and the hatch is still last
    const kinds = planCeremonies([...crowded, R.egg]).steps.map((s) => s.kind)
    expect(kinds).toContain('levelUp')
    expect(kinds.at(-1)).toBe('hatch')
  })

  it('shows the thing a level brings on the level\'s screen, and only there', () => {
    const up: Reward = { t: 'levelUp', level: 2, title: null, perler: 5 }
    const plan = planCeremonies([R.learned, R.answers, up, R.item, R.medal, R.chest])
    const level = plan.steps.find((s) => s.kind === 'levelUp')!
    expect(level.rewards).toEqual([up, R.item])
    const elsewhere = [...plan.steps.filter((s) => s !== level).flatMap((s) => s.rewards), ...plan.alsoToday.map((c) => c.reward)]
    expect(elsewhere).not.toContain(R.item)
    // a chest's thing is its own news
    expect(elsewhere).toContain(R.chest)
  })

  it('makes one screen of two levels at once, with the things of both', () => {
    const l2: Reward = { t: 'levelUp', level: 2, title: null, perler: 5 }
    const l3: Reward = { t: 'levelUp', level: 3, title: null, perler: 5 }
    const neck: Reward = { t: 'item', item: 'hverdag-neck', source: { kind: 'level', level: 3 } }
    const plan = planCeremonies([R.learned, R.answers, l2, l3, R.item, neck])
    const levels = plan.steps.filter((s) => s.kind === 'levelUp')
    expect(levels).toHaveLength(1)
    expect(levels[0].rewards).toEqual([l3, l2, R.item, neck])
    expect(plan.alsoToday).toEqual([])
  })

  it('says "Nye steder" when the fog lets several places through', () => {
    const one: Reward = { t: 'opened', worlds: [], regions: ['w0-minus10'] }
    const three: Reward = { t: 'opened', worlds: [], regions: ['w0-tal20', 'w0-minus10', 'w0-tiervenner'] }
    expect(speechFor('trial', [one])).toEqual([{ clip: 's.reward.region.open' }])
    expect(speechFor('trial', [three])).toEqual([{ clip: 's.reward.regions.open' }])
    expect(hasClip('s.reward.regions.open')).toBe(true)
  })

  it('gives the screen to the biggest news: a passed trial and a new friend before a level item', () => {
    const plan = planCeremonies([R.learned, R.answers, R.item, R.trialPass, R.animal])
    expect(plan.steps.map((s) => s.kind)).toEqual(['learned', 'tally', 'trial', 'thing'])
    expect(plan.steps[3].rewards).toEqual([R.animal])
    expect(plan.alsoToday.map((c) => c.reward)).toEqual([R.item])
  })

  it('lifts the fog in the trial step, and a failed trial is shown gently with the hut on a card', () => {
    const pass = planCeremonies([R.learned, R.answers, R.trialPass, R.opened])
    expect(pass.steps.find((s) => s.kind === 'trial')?.rewards).toEqual([R.trialPass, R.opened])
    const fail = planCeremonies([R.learned, R.answers, R.trialFail, R.hut])
    expect(fail.steps.find((s) => s.kind === 'trial')?.speech).toEqual([{ clip: 's.reward.trial.ready' }])
    expect(fail.alsoToday.map((c) => c.reward)).toEqual([R.hut])
  })

  it('shows a warm egg once; an egg left for later waits on a card', () => {
    const stale = { ...R.egg, fresh: false }
    const plan = planCeremonies([R.learned, R.answers, stale])
    expect(plan.steps.map((s) => s.kind)).toEqual(['learned', 'tally'])
    expect(plan.alsoToday.map((c) => c.reward)).toEqual([stale])
  })

  it('can skip everything with one tap, blocks input at most 1 s and never starts by itself', () => {
    const plan = planCeremonies([R.learned, R.answers, R.stars, R.medal, R.levelUp, R.egg])
    for (const s of plan.steps) {
      expect(s.blockMs).toBeLessThanOrEqual(MAX_BLOCK_MS)
      expect(s.skip).toBe(s.kind === 'hatch' ? 'reveal' : 'tap')
    }
    expect(plan.steps.at(-1)).toMatchObject({ kind: 'hatch', taps: 3 })
    expect(plan).toMatchObject({ buttons: ['next', 'toMap'], autoFocus: null, autoStart: false })
  })

  it('maps every reward to a kind and speaks only recorded clips', () => {
    const all = Object.values(R) as Reward[]
    for (const r of all) {
      const kind = kindOf(r)!
      expect(CEREMONY_ORDER).toContain(kind)
      for (const part of speechFor(kind, [r])) if ('clip' in part) expect(hasClip(part.clip), part.clip).toBe(true)
    }
    const growthForms: Reward[] = [{ ...R.growth, stage: 3 }, { ...R.growth, star: true, stage: 3 }]
    for (const r of growthForms) for (const part of speechFor('growth', [r])) if ('clip' in part) expect(hasClip(part.clip)).toBe(true)
    for (const unlock of ['hop', 'cheer', 'spin', 'call', 'signature', 'dance'] as const) {
      expect(hasClip(`s.reward.friendship.${unlock}`)).toBe(true)
    }
    for (const medal of ['bronze', 'silver', 'gold']) expect(hasClip(`s.reward.medal.${medal}`)).toBe(true)
  })
})
