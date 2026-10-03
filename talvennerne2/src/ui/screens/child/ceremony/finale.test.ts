import { describe, expect, it } from 'vitest'
import { WORLD_BY_ID } from '../../../../content/curriculum'
import type { ItemId } from '../../../../engine/types'
import { planCeremonies } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import { clipText, hasClip } from '../../../../speech/catalog'
import { toDanishText } from '../../../../speech/compile'
import { endReadout } from './End'
import { alsoTodayOf, autoAdvanceMs, finaleThings, isFinaleParty, screensOf } from './flow'
import { trialSpeech } from './Steps'

/**
 * A world finale passed is its own party (QA2 P2-7): one screen with the world's animals, the trophy
 * and every thing the finale gave, with pictures and "Prøv dem på" — not a trial's bridge followed by
 * one thing on its own screen and the rest as small cards under "Også i dag".
 */

const finaleItems = (world: 'bakke' | 'skov'): ItemId[] => WORLD_BY_ID[world].finaleItems
const item = (id: ItemId, kind: 'finale' | 'level' = 'finale'): Reward =>
  ({ t: 'item', item: id, source: kind === 'finale' ? { kind: 'finale', world: 'bakke' } : { kind: 'level', level: 9 } }) as Reward

function finaleRound(world: 'bakke' | 'skov', passed = true): Reward[] {
  return [
    { t: 'learned', promoted: [], firsts: [], statuses: [], practiced: ['addTo20'], next: null },
    { t: 'answers', correct: 11, perler: 11, xp: 110 },
    { t: 'stars', node: `${world}-finale`, from: 0, stars: 2, perler: 2, xp: 40 },
    {
      t: 'trial', trial: world, finale: true, passed, first: passed, score: passed ? 11 : 7, total: 12, best: passed ? 11 : 7,
      perfect: false, perler: passed ? 25 : 0, xp: passed ? 250 : 0, skipped: [],
    },
    ...(passed ? finaleItems(world).map((i) => item(i)) : []),
    { t: 'trophy', id: world === 'bakke' ? 'world-bakke' : 'world-skov', perler: 10 },
    { t: 'friendship', uid: 'starter-rabbit', level: 3, unlock: null },
  ] as Reward[]
}

describe('a world finale passed (QA2 P2-7)', () => {
  for (const world of ['bakke', 'skov'] as const) {
    it(`gathers every thing of ${world}'s finale on its own screen`, () => {
      const plan = planCeremonies(finaleRound(world))
      const screens = screensOf(plan)
      const party = screens.find((s) => s.kind === 'step' && isFinaleParty(s.step))
      expect(party).toBeDefined()
      if (party?.kind !== 'step') throw new Error('no party')
      expect(finaleThings(party.step)).toEqual(finaleItems(world))
      // the party waits for the child: there are things to look at and to try on
      expect(autoAdvanceMs(party)).toBeNull()
      // no finale thing on a screen of its own, nor as a small card under "Også i dag"
      for (const s of screens) {
        if (s.kind === 'step' && s !== party) expect(s.step.rewards.some((r) => r.t === 'item' && r.source.kind === 'finale')).toBe(false)
      }
      const cards = alsoTodayOf(plan.alsoToday)
      expect(cards.some((c) => c.reward.t === 'item' && c.reward.source.kind === 'finale')).toBe(false)
      expect(endReadout(cards).flatMap((r) => r.parts).some((p) => 'clip' in p && finaleItems(world).some((i) => p.clip.includes(i)))).toBe(false)
    })
  }

  it('says the world and every thing aloud', () => {
    const plan = planCeremonies(finaleRound('bakke'))
    const party = screensOf(plan).find((s) => s.kind === 'step' && isFinaleParty(s.step))
    if (party?.kind !== 'step') throw new Error('no party')
    const said = toDanishText(trialSpeech(party.step))
    expect(said).toContain('Verdensfest! Du klarede finalen.')
    expect(said).toContain(clipText(WORLD_BY_ID.bakke.nameClip))
    expect(said).toContain('Dine nye ting')
    for (const p of trialSpeech(party.step)) if ('clip' in p) expect(hasClip(p.clip), p.clip).toBe(true)
    expect(hasClip('s.ceremony.tryOnAll')).toBe(true)
    expect(clipText('s.ceremony.tryOnAll')).toBe('Prøv dem på')
  })

  it('leaves a failed finale, a region trial and other things as they were', () => {
    const failed = planCeremonies(finaleRound('bakke', false))
    expect(screensOf(failed).some((s) => s.kind === 'step' && isFinaleParty(s.step))).toBe(false)
    expect(alsoTodayOf(failed.alsoToday)).toBe(failed.alsoToday)
    const trial: Reward = {
      t: 'trial', trial: 'w1-klokken', finale: false, passed: true, first: true, score: 9, total: 10, best: 9, perfect: false, perler: 10, xp: 100, skipped: [],
    }
    const region = planCeremonies([finaleRound('bakke')[0], trial, item('hverdag-head', 'level')])
    expect(screensOf(region).some((s) => s.kind === 'step' && isFinaleParty(s.step))).toBe(false)
  })
})
