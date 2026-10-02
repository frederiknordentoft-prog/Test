import { describe, expect, it } from 'vitest'
import { CEREMONY_MS, MAX_BLOCK_MS, planCeremonies } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import type { Animal, SpeechPart } from '../../../../engine/types'
import { hasClip } from '../../../../speech/catalog'
import { toDanishText } from '../../../../speech/compile'
import { autoAdvanceMs, isInteractive, progressOf, screensOf, setProgress } from './flow'
import { boxBadge, cardSpeech, factTerms, keyFace, learnedItems } from './describe'
import { endReadout } from './End'
import { animalTitle, levelItems, summarySpeech, thingSpeech } from './Steps'

/**
 * The end of a round as screens (SPEC §5.8): learning first as one summary screen that waits for the
 * child, at most three full-screen ceremonies in the queue's order with the hatch last, then "Også i
 * dag" read aloud card by card; screens with something to look at or do wait for a tap, the others
 * move on by themselves after their planned time.
 */

type Learned = Extract<Reward, { t: 'learned' }>
const learned = (over: Partial<Learned> = {}): Learned => ({
  t: 'learned', promoted: [], firsts: [], statuses: [], practiced: ['addTo10'], next: null, ...over,
})
const animal = (uid: string, over: Partial<Animal> = {}): Animal => ({
  uid, species: 'cat', breed: 'domestic', colorway: 'c1', name: 'Misse', friendship: 0, stage: 1, star: false, shown: 1,
  outfit: {}, foundAt: 0, source: 'friend', ...over,
})
const clips = (parts: readonly SpeechPart[]) => parts.flatMap((p) => ('clip' in p ? [p.clip] : []))

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

  it('waits for the child on the summary, on "Prøv den på" and where the child takes part', () => {
    const waits = screens.map((s) => autoAdvanceMs(s))
    // the summary stays until the tap (review r1 P2-3), the level-up with its hat too
    expect(waits).toEqual([null, null, null, null, null])
    const thing = screens[2]
    expect(thing.kind === 'step' && isInteractive(thing.step)).toBe(true)
  })

  it('moves on by itself only where there is nothing to do, after its planned time', () => {
    const medal: Reward = { t: 'medal', skill: 'addTo10', medal: 'bronze', perler: 3, xp: 50 }
    const growth: Reward = { t: 'growth', uid: 'starter-rabbit', stage: 2, star: false }
    const s = screensOf(planCeremonies([learned(), medal, growth]))
    expect(s.map((x) => autoAdvanceMs(x))).toEqual([null, CEREMONY_MS.medal, CEREMONY_MS.growth, null])
    // a level-up without a thing has nothing to try on: it moves on by itself
    const bare = screensOf(planCeremonies([learned(), { t: 'levelUp', level: 4, title: null, perler: 5 }]))
    expect(bare.map((x) => autoAdvanceMs(x))).toEqual([null, CEREMONY_MS.levelUp, null])
  })

  it('lists what did not get the full screen as cards, with what each is about', () => {
    expect(plan.alsoToday.map((c) => c.reward.t)).toEqual(expect.arrayContaining(['friendship', 'trophy']))
    const trophy = plan.alsoToday.find((c) => c.reward.t === 'trophy')!
    expect(toDanishText(cardSpeech(trophy))).toBe('Et nyt trofæ! En perfekt tur.')
  })

  it('reads "Også i dag" aloud: the heading, then every card in turn (review r1 P2-4)', () => {
    const steps = endReadout(plan.alsoToday)
    expect(steps[0]).toEqual({ card: null, parts: [{ clip: 's.reward.alsoToday' }] })
    expect(steps.slice(1).map((s) => s.card)).toEqual(plan.alsoToday.map((_, i) => i))
    for (const [i, c] of plan.alsoToday.entries()) expect(steps[i + 1].parts).toEqual(cardSpeech(c))
    expect(endReadout([])).toEqual([])
  })

  it('remembers where the child got to (the wardrobe visit comes back to the next screen)', () => {
    expect(progressOf(plan)).toBe(0)
    setProgress(plan, 2)
    expect(progressOf(plan)).toBe(2)
    expect(progressOf(planCeremonies(ROUND))).toBe(0)
  })

  it('shows the things of a level on the level-up screen and says them there', () => {
    const up = plan.steps.find((s) => s.kind === 'levelUp')!
    expect(levelItems(up)).toEqual(['hverdag-head'])
    expect(plan.steps.filter((s) => s.kind === 'thing').flatMap((s) => s.rewards).some((r) => r.t === 'item')).toBe(false)
    expect(plan.alsoToday.some((c) => c.reward.t === 'item')).toBe(false)
  })

  it('calls a friend in a breed the child has not met "En ny race!"', () => {
    const lop = animal('friend-w0-tal10-friend', { species: 'rabbit', breed: 'lop' })
    const step = planCeremonies([learned(), { t: 'animal', animal: lop, newSpecies: false }]).steps.find((s) => s.kind === 'thing')!
    const starter = animal('starter-rabbit', { species: 'rabbit', breed: 'upright', source: 'starter' })
    expect(animalTitle(step, [starter, lop])).toBe('s.reward.animal.breed')
    expect(clips(thingSpeech(step, [starter, lop]))[0]).toBe('s.reward.animal.breed')
    // the same breed again in a new colour is a new colour
    const twin = animal('egg-1', { species: 'rabbit', breed: 'lop', source: 'egg' })
    expect(animalTitle(step, [starter, twin, lop])).toBe('s.reward.animal.color')
  })
})

describe('"Det lærte du" (review r1 P2-2: concrete and true)', () => {
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

  it('shows at most three, the best first, and only box 5 "sits"', () => {
    const items = learnedItems(learned({
      promoted: [
        { key: 'add:3+5', skill: 'addTo10', box: 5 },
        { key: 'add:2+2', skill: 'addTo10', box: 3 },
        { key: 'add:1+1', skill: 'addTo10', box: 2 },
        { key: 'add:4+1', skill: 'addTo10', box: 1 },
      ],
    }))
    expect(items.map((i) => i.key)).toEqual(['add:3+5', 'add:2+2', 'add:1+1'])
    expect(items.map((i) => i.badge)).toEqual(['s.reward.learned.box5', 's.reward.learned.box3', 's.reward.learned.moved'])
    expect(toDanishText(items[0].speech)).toBe('Tre plus fem er lig med otte. Det sidder helt fast nu!')
    expect(toDanishText(items[1].speech)).not.toMatch(/sidder/)
    expect([1, 2, 3, 4].map((b) => boxBadge(b as 1 | 2 | 3 | 4))).toEqual([
      's.reward.learned.started', 's.reward.learned.moved', 's.reward.learned.box3', 's.reward.learned.box3',
    ])
  })

  it('never says that something sits right after a failed trial', () => {
    const r = learned({ promoted: [{ key: 'add:3+5', skill: 'addTo10', box: 5 }, { key: 'h20:7', skill: 'hear20', box: 3 }] })
    const items = learnedItems(r, { failedTrial: true })
    expect(items.map((i) => i.badge)).not.toContain('s.reward.learned.box5')
    for (const i of items) expect(toDanishText(i.speech)).not.toMatch(/sidder/)
  })

  it('shows the numbers that moved, the way the child counted or heard them', () => {
    const [dice, heard, scatter] = learnedItems(learned({
      promoted: [
        { key: 'c10:dice:4', skill: 'count10', box: 1 },
        { key: 'h20:7', skill: 'hear20', box: 1 },
        { key: 'c10:scatter:3', skill: 'count10', box: 1 },
      ],
    }))
    expect(dice.face).toMatchObject({ t: 'number', n: 4, picture: { scene: 'objects', layout: 'dice', n: 4 } })
    // a flashed picture stays on in the summary
    expect(dice.face.t === 'number' && dice.face.picture && 'flashMs' in dice.face.picture).toBe(false)
    expect(heard.face).toEqual({ t: 'number', n: 7, picture: null })
    expect(scatter.face).toMatchObject({ t: 'number', n: 3, picture: { scene: 'objects', layout: 'scatter' } })
    expect(toDanishText(dice.speech)).toBe('Tallet fire. Godt begyndt!')
  })

  it('names a family, a figure and a pattern by what they are', () => {
    expect(keyFace('order20/after', 'order20')?.face).toEqual({ t: 'label', clip: 's.reward.learned.after' })
    expect(keyFace('order20/bigger', 'order20')?.face).toEqual({ t: 'label', clip: 's.reward.learned.bigger' })
    expect(keyFace('patterns/AB', 'patterns')?.face).toEqual({ t: 'beads', beads: ['red', 'blue', 'red', 'blue'] })
    expect(keyFace('shp:triangle:0', 'shapes2D')?.face).toEqual({ t: 'shape', shape: 'triangle', variant: 0 })
    expect(keyFace('lng:a1', 'compareLength')?.face).toEqual({ t: 'label', clip: 's.reward.learned.compareLength' })
  })

  it('never claims a whole skill ("Jeg kan …"), and every word is a recorded clip', () => {
    const r = learned({
      promoted: [
        { key: 'c10:scatter:1', skill: 'count10', box: 1 },
        { key: 'h20:1', skill: 'hear20', box: 1 },
        { key: 'order20/after', skill: 'order20', box: 2 },
      ],
      firsts: [{ skill: 'count10', family: 'flash' }],
      practiced: ['count10', 'hear20', 'order20'],
    })
    const items = learnedItems(r, { correct: [{ key: 'c10:dice:2', skill: 'count10' }] }, 5)
    expect(items).toHaveLength(4)
    for (const i of items) {
      for (const c of clips(i.speech)) {
        expect(c.startsWith('s.cando.'), c).toBe(false)
        expect(hasClip(c), c).toBe(true)
      }
    }
    expect(summarySpeech(planCeremonies([r]).steps).some((p) => 'clip' in p && p.clip.startsWith('s.cando.'))).toBe(false)
  })

  it('makes a family\'s first right answer concrete with the key it was answered on', () => {
    const r = learned({ firsts: [{ skill: 'count10', family: 'scatter' }], practiced: ['count10'] })
    const items = learnedItems(r, { correct: [{ key: 'h20:2', skill: 'hear20' }, { key: 'c10:scatter:2', skill: 'count10' }] })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ key: 'c10:scatter:2', badge: 's.reward.learned.first', face: { t: 'number', n: 2 } })
  })

  it('praises the practice with something the child got right when nothing moved', () => {
    const some = learnedItems(learned({ practiced: ['count10'] }), { correct: [{ key: 'c10:fingers:3', skill: 'count10' }] })
    expect(some).toEqual([expect.objectContaining({ key: 'c10:fingers:3', badge: 's.reward.learned.practiced', face: expect.objectContaining({ t: 'number', n: 3 }) })])
    const none = learnedItems(learned())
    expect(none).toEqual([{ key: 'practiced', face: { t: 'none' }, badge: 's.reward.learned.practiced', speech: [{ clip: 's.reward.learned.practiced' }] }])
  })
})
