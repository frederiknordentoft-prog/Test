// Dyrehaven's pure parts: the meadow's order with decor on fixed places, the animation plan that
// never lets more than three rigs move (SPEC §6.4), an animal's friendship, tricks and forms, and
// the egg.
import { describe, expect, it } from 'vitest'
import { DECOR } from '../../../../content/catalog'
import { makeRng } from '../../../../engine/rng'
import type { Animal, ProfileDoc } from '../../../../engine/types'
import { hasClip } from '../../../../speech/catalog'
import {
  DECOR_SLOTS, MAX_ANIMATED, TRICKS, animalFacts, eggModel, kindClips, meadowAnimals, meadowCells, nameParts, planAnimation,
} from './model'
import { zooDemoProfile, zooNewProfile } from './testing/demo'

const uids = (cells: ReturnType<typeof meadowCells>) => cells.map((c) => (c.kind === 'animal' ? c.animal.uid : c.id))

describe('the meadow', () => {
  it('puts the buddy first and then the newest friend first', () => {
    const p = zooDemoProfile()
    const order = meadowAnimals(p).map((a) => a.uid)
    expect(order[0]).toBe('starter-rabbit')
    expect(order[1]).toBe('egg-6')
    const rest = meadowAnimals(p).slice(1)
    for (let i = 1; i < rest.length; i++) expect(rest[i - 1].foundAt).toBeGreaterThanOrEqual(rest[i].foundAt)
    expect(order).toHaveLength(p.animals.length)
  })

  it('stands the decor on its fixed places, whatever the number of animals', () => {
    const p = zooDemoProfile()
    const cells = meadowCells(p)
    for (const id of ['pynt-blomsterbed', 'pynt-baenk', 'pynt-dam', 'pynt-traehus'] as const) {
      expect(uids(cells).indexOf(id)).toBe(DECOR_SLOTS[id])
    }
    // a new animal never moves a bench
    const more = { ...p, animals: [...p.animals, { ...p.animals[3], uid: 'egg-7', foundAt: p.animals[3].foundAt + 1 }] }
    expect(uids(meadowCells(more)).indexOf('pynt-baenk')).toBe(DECOR_SLOTS['pynt-baenk'])
    expect(cells.filter((c) => c.kind === 'animal')).toHaveLength(p.animals.length)
  })

  it('puts decor that has no animals to stand between after them, in its fixed order', () => {
    const p = zooNewProfile()
    const all = Object.fromEntries(DECOR.map((d) => [d.id, { at: 1, x: 0.5, y: 0.7 }]))
    const cells = meadowCells({ ...p, decor: all })
    expect(uids(cells)).toEqual([
      'starter-rabbit', 'pynt-blomsterbed', 'pynt-lygte', 'pynt-baenk', 'pynt-gynge', 'pynt-dam', 'pynt-traehus', 'pynt-springvand', 'pynt-regnbuebue',
    ])
    expect(meadowCells({ ...p, animals: [], buddyUid: null })).toEqual([])
  })
})

describe('the animation plan (SPEC §6.4)', () => {
  const order = Array.from({ length: 30 }, (_, i) => `a${i}`)

  it('animates the buddy and two more, the open card counting as one', () => {
    const plan = planAnimation(order, 'a7')
    expect([...plan.meadow]).toEqual(['a7', 'a0', 'a1'])
    expect(plan.sheet).toBeNull()
    const open = planAnimation(order, 'a7', { sheet: 'a12', focus: ['a20'] })
    expect([...open.meadow]).toEqual(['a7', 'a20'])
    expect(open.meadow.has('a12')).toBe(false)
    expect(open.sheet).toBe('a12')
  })

  it('lets the last tapped animals move first', () => {
    expect([...planAnimation(order, 'a0', { focus: ['a29', 'a5', 'a9'] }).meadow]).toEqual(['a0', 'a29', 'a5'])
  })

  it('never animates more than three rigs, whatever happens', () => {
    const rng = makeRng(7)
    for (let run = 0; run < 400; run++) {
      const n = rng.between(0, 30)
      const list = order.slice(0, n)
      const buddy = n > 0 && rng.next() < 0.9 ? list[rng.between(0, n - 1)] : null
      const focus = Array.from({ length: rng.between(0, 5) }, () => `a${rng.between(0, 34)}`)
      const sheet = n > 0 && rng.next() < 0.5 ? list[rng.between(0, n - 1)] : null
      const plan = planAnimation(list, buddy, { focus, sheet })
      expect(plan.meadow.size + (plan.sheet ? 1 : 0)).toBeLessThanOrEqual(MAX_ANIMATED)
      if (sheet) expect(plan.meadow.has(sheet)).toBe(false)
      for (const uid of plan.meadow) expect(list).toContain(uid)
      if (buddy && buddy !== sheet) expect(plan.meadow.has(buddy)).toBe(true)
    }
  })
})

describe("an animal's card", () => {
  const base: Animal = zooDemoProfile().animals[0]

  it('shows friendship 1–10 with the way to the next level', () => {
    expect(animalFacts({ ...base, friendship: 0 }).level).toBe(1)
    expect(animalFacts({ ...base, friendship: 35 })).toMatchObject({ level: 2, progress: 0.5 })
    expect(animalFacts({ ...base, friendship: 820 })).toMatchObject({ level: 10, progress: 1 })
    expect(animalFacts({ ...base, friendship: 5000 }).level).toBe(10)
  })

  it('unlocks the tricks at their friendship levels', () => {
    const at = (friendship: number) => animalFacts({ ...base, friendship }).tricks.filter((t) => t.unlocked).map((t) => t.id)
    expect(at(0)).toEqual([])
    expect(at(20)).toEqual(['hop'])
    expect(at(100)).toEqual(['hop', 'cheer', 'spin'])
    expect(at(820)).toEqual([...TRICKS])
    for (const t of TRICKS) expect(hasClip(`s.zoo.trick.${t}`), t).toBe(true)
  })

  it('offers only the forms the animal has reached', () => {
    const forms = (a: Partial<Animal>) => animalFacts({ ...base, ...a }).forms.filter((f) => f.reached).map((f) => f.form)
    expect(forms({ stage: 1, star: false })).toEqual([1])
    expect(forms({ stage: 3, star: false })).toEqual([1, 2, 3])
    expect(forms({ stage: 3, star: true })).toEqual([1, 2, 3, 'star'])
    expect(animalFacts({ ...base, shown: 2 }).forms.find((f) => f.shown)?.form).toBe(2)
  })

  it('reads the name and the kind of animal aloud', () => {
    expect(nameParts('Kløver')).toEqual([{ clip: 'name.animal.rabbit.1' }])
    expect(nameParts('Bamse Bo')).toEqual([{ free: 'Bamse Bo' }])
    const kinds = [...kindClips(base), ...kindClips({ species: 'fox', breed: 'std', colorway: 'c2' }), ...kindClips({ species: 'unicorn', breed: 'foal', colorway: 'starwhite' })]
    expect(kindClips({ species: 'fox', breed: 'std', colorway: 'c2' })).toEqual(['name.species.fox', 'name.color.fox.c2'])
    for (const clip of kinds) expect(hasClip(clip), clip).toBe(true)
  })
})

describe('the egg', () => {
  it('is warm and ready with the chosen species', () => {
    expect(eggModel(zooDemoProfile())).toMatchObject({ ready: true, warmth: 1, species: 'rabbit', allFound: false })
  })

  it('waits for a choice when several species are possible', () => {
    const p = zooDemoProfile()
    const egg = eggModel({ ...p, economy: { ...p.economy, eggSpecies: null, eggWarmth: 36 } })
    expect(egg.ready).toBe(false)
    expect(egg.warmth).toBeCloseTo(0.5)
    expect(egg.species).toBeNull()
    expect(egg.options).toEqual(['rabbit', 'cat', 'puppy', 'hedgehog', 'horse', 'fox'])
  })

  it('takes the only species there is', () => {
    expect(eggModel(zooNewProfile())).toMatchObject({ options: ['rabbit'], species: 'rabbit', ready: false })
  })

  it('turns into friendship when everything is found', () => {
    const p: ProfileDoc = zooNewProfile()
    const all: Animal[] = []
    for (const breed of ['upright', 'lop', 'lionhead'] as const) {
      for (const c of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const) all.push({ ...p.animals[0], uid: `x-${breed}-${c}`, breed, colorway: c, source: 'egg' })
    }
    expect(eggModel({ ...p, animals: all })).toMatchObject({ options: [], species: null, allFound: true })
  })
})
