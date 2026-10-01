import { describe, expect, it } from 'vitest'
import { CEREMONY_MS, MAX_BLOCK_MS, planCeremonies } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import type { Animal } from '../../../../engine/types'
import { toDanishText } from '../../../../speech/compile'
import { autoAdvanceMs, isInteractive, progressOf, screensOf, setProgress } from './flow'
import { cardSpeech, factTerms, learnedItems } from './describe'
import { levelItems } from './Steps'

/**
 * The end of a round as screens (SPEC §5.8): learning first as one summary screen, at most three
 * full-screen ceremonies in the queue's order with the hatch last, then "Også i dag"; screens move on
 * by themselves after their planned time except the ones the child takes part in.
 */

const learned = (over: Partial<Extract<Reward, { t: 'learned' }>> = {}): Reward => ({
  t: 'learned', promoted: [], firsts: [], statuses: [], practiced: ['addTo10'], next: null, ...over,
})
const animal = (uid: string): Animal => ({
  uid, species: 'cat', breed: 'domestic', colorway: 'c1', name: 'Misse', friendship: 0, stage: 1, star: false, shown: 1,
  outfit: {}, foundAt: 0, source: 'friend',
})

const ROUND: Reward[] = [
  learned({ promoted: [{ key: 'add:3+5', skill: 'addTo10', box: 3 }, { key: 'add:2+2', skill: 'addTo10', box: 1 }] }),
  { t: 'answers', correct: 10, perler: 10, xp: 100 },
  { t: 'stars', node: 'w0-plus10-l1', from: 0, stars: 2, perler: 2, xp: 40 },
  { t: 'levelUp', level: 2, title: null, perler: 5 },
  { t: 'item', item: 'hverdag-head', source: { kind: 'level', level: 2 } },
  { t: 'animal', animal: animal('friend-w0-plus10-friend'), newSpecies: true },
  { t: 'friendship', uid: 'starter-rabbit', level: 2, unlock: 'hop' },
  { t: 'trophy', id: 'perfect-round', perler: 5 },
  { t: 'eggReady', species: null, options: ['rabbit', 'cat'], fresh: true },
]

describe('the screens of the end of a round', () => {
  const plan = planCeremonies(ROUND)
  const screens = screensOf(plan)

  it('starts with one summary of the learning, the stars and the count-up, and ends with "Også i dag"', () => {
    expect(screens[0]).toMatchObject({ kind: 'summary', ms: CEREMONY_MS.learned + CEREMONY_MS.stars + CEREMONY_MS.tally })
    expect(screens[0].kind === 'summary' && screens[0].steps.map((s) => s.kind)).toEqual(['learned', 'stars', 'tally'])
    expect(screens[screens.length - 1].kind).toBe('end')
  })

  it('shows at most three ceremonies, in the queue order, with the hatch last', () => {
    const middle = screens.slice(1, -1).map((s) => (s.kind === 'step' ? s.step.kind : s.kind))
    expect(middle.length).toBeLessThanOrEqual(3)
    expect(middle[middle.length - 1]).toBe('hatch')
    expect(middle).toEqual(['levelUp', 'thing', 'hatch'])
    for (const s of screens) expect(s.blockMs).toBeLessThanOrEqual(MAX_BLOCK_MS)
  })

  it('moves on by itself except where the child takes part: the hatch, a new friend to name', () => {
    const waits = screens.map((s) => autoAdvanceMs(s))
    expect(waits[0]).toBe(2000)
    expect(waits[1]).toBe(CEREMONY_MS.levelUp)
    expect(waits.slice(2)).toEqual([null, null, null])
    const thing = screens[2]
    expect(thing.kind === 'step' && isInteractive(thing.step)).toBe(true)
  })

  it('lists what did not get the full screen as cards, with what each is about', () => {
    expect(plan.alsoToday.map((c) => c.reward.t)).toEqual(expect.arrayContaining(['friendship', 'trophy']))
    const trophy = plan.alsoToday.find((c) => c.reward.t === 'trophy')!
    expect(toDanishText(cardSpeech(trophy))).toBe('Et nyt trofæ! En perfekt tur.')
  })

  it('remembers where the child got to (the wardrobe visit comes back to the next screen)', () => {
    expect(progressOf(plan)).toBe(0)
    setProgress(plan, 2)
    expect(progressOf(plan)).toBe(2)
    expect(progressOf(planCeremonies(ROUND))).toBe(0)
  })

  it('finds the things that came with a level', () => {
    expect(levelItems(2, ROUND)).toEqual(['hverdag-head'])
    expect(levelItems(1, ROUND)).toEqual([])
  })
})

describe('"Det lærte du"', () => {
  it('reads the facts that moved as sums with their answers', () => {
    expect(factTerms('add:3+5')).toEqual([{ n: 3 }, { op: '+' }, { n: 5 }, { op: '=' }, { n: 8 }])
    expect(factTerms('sub:9-4')).toEqual([{ n: 9 }, { op: '−' }, { n: 4 }, { op: '=' }, { n: 5 }])
    expect(factTerms('ten:3')).toEqual([{ n: 3 }, { op: '+' }, { n: 7 }, { op: '=' }, { n: 10 }])
    expect(factTerms('dbl:6')?.at(-1)).toEqual({ n: 12 })
    expect(factTerms('mp:3+?=7')?.[2]).toEqual({ n: 4 })
    expect(factTerms('mul:3x7')).toEqual([{ n: 3 }, { op: '·' }, { n: 7 }, { op: '=' }, { n: 21 }])
    expect(factTerms('div:12/3')?.at(-1)).toEqual({ n: 4 })
    expect(factTerms('cnt:7')).toBeNull()
    expect(factTerms('skipCount/step2')).toBeNull()
  })

  it('shows at most three, the best first, with how well each sits', () => {
    const items = learnedItems(learned({
      promoted: [
        { key: 'add:3+5', skill: 'addTo10', box: 5 },
        { key: 'add:2+2', skill: 'addTo10', box: 3 },
        { key: 'add:1+1', skill: 'addTo10', box: 2 },
        { key: 'add:4+1', skill: 'addTo10', box: 1 },
      ],
    }) as Extract<Reward, { t: 'learned' }>)
    expect(items.map((i) => i.key)).toEqual(['add:3+5', 'add:2+2', 'add:1+1'])
    expect(items.map((i) => i.badge)).toEqual(['s.reward.learned.box5', 's.reward.learned.box3', 's.reward.learned.moved'])
    expect(toDanishText(items[0].speech)).toBe('Tre plus fem er lig med otte. Det sidder helt fast nu!')
  })

  it('names a skill without sums once, and praises the practice when nothing moved', () => {
    const items = learnedItems(learned({
      promoted: [{ key: 'cnt:7', skill: 'count10', box: 3 }, { key: 'cnt:8', skill: 'count10', box: 3 }],
    }) as Extract<Reward, { t: 'learned' }>)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ terms: null, canDo: 's.cando.count10' })
    const none = learnedItems(learned() as Extract<Reward, { t: 'learned' }>)
    expect(none).toHaveLength(1)
    expect(none[0]).toMatchObject({ canDo: 's.cando.addTo10', badge: 's.reward.learned.practiced' })
  })
})
