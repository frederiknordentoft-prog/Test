// The books' pure parts: the collection's counting (177 collectibles, found ones by exact species,
// breed and colour) and its "Sådan får du den", the Kan-bog's medals, the stamp book and all 34
// trophies.
import { describe, expect, it } from 'vitest'
import { SPECIES, TROPHIES } from '../../../../content/catalog'
import { TROPHY_IDS, type Animal, type ProfileDoc } from '../../../../engine/types'
import { compile } from '../../../../speech/compile'
import { hasClip } from '../../../../speech/catalog'
import { zooDemoProfile, zooNewProfile } from '../animals/testing/demo'
import { canBookModel, collectionModel, friendRegionOf, goalParts, shelfModel, stampModel, trophyModel, type CollectionModel } from './model'

const card = (m: CollectionModel, key: string) => m.pages.flatMap((p) => p.sections.flatMap((s) => s.cards)).find((c) => c.key === key)!
const clipsOf = (parts: readonly unknown[] | null) => (parts ?? []).map((p) => (p as { clip: string }).clip)

describe('Samlebogen: counting', () => {
  it('holds 177 collectibles: 24 breeds in 6 colours, a golden and a rainbow animal per species and the Stjernefølet', () => {
    const m = collectionModel(zooNewProfile())
    expect(m.total).toBe(177)
    expect(m.pages.map((p) => p.species)).toEqual(SPECIES.map((s) => s.id))
    const totals = Object.fromEntries(m.pages.map((p) => [p.species, p.total]))
    expect(totals).toMatchObject({ rabbit: 20, cat: 20, horse: 20, unicorn: 21, puppy: 8, polarbear: 8 })
    const keys = m.pages.flatMap((p) => p.sections.flatMap((s) => s.cards.map((c) => c.key)))
    expect(new Set(keys).size).toBe(177)
    expect(keys.filter((k) => k.endsWith(':gold'))).toHaveLength(16)
    expect(keys.filter((k) => k.endsWith(':rainbow'))).toHaveLength(16)
    expect(keys.filter((k) => k.endsWith(':starwhite'))).toEqual(['unicorn:foal:starwhite'])
  })

  it('counts a new child: the starter only', () => {
    const m = collectionModel(zooNewProfile())
    expect(m.found).toBe(1)
    expect(m.pages.find((p) => p.species === 'rabbit')!.found).toBe(1)
  })

  it('counts an experienced child by exact species, breed and colour', () => {
    const p = zooDemoProfile()
    const m = collectionModel(p)
    expect(m.found).toBe(p.animals.length)
    const found = Object.fromEntries(m.pages.filter((pg) => pg.found > 0).map((pg) => [pg.species, pg.found]))
    expect(found).toEqual({ rabbit: 5, cat: 4, puppy: 1, hedgehog: 1, horse: 3, fox: 1, unicorn: 1 })
    expect(card(m, 'rabbit:lop:c2').owned?.name).toBe('Trille')
    expect(card(m, 'cat:domestic:gold').owned?.uid).toBe('gold-cat')
    expect(card(m, 'rabbit:upright:rainbow').owned?.uid).toBe('rainbow-rabbit')
    expect(card(m, 'unicorn:foal:starwhite').owned?.uid).toBe('starfoal-count10')
  })

  it('counts an animal once even if a profile somehow holds two of the same', () => {
    const p = zooNewProfile()
    const twin: Animal = { ...p.animals[0], uid: 'egg-1' }
    expect(collectionModel({ ...p, animals: [...p.animals, twin] }).found).toBe(1)
  })
})

describe('Samlebogen: Sådan får du den', () => {
  const m = collectionModel(zooDemoProfile())
  const fresh = collectionModel(zooNewProfile())

  it('a species met: from the egg', () => {
    expect(clipsOf(card(m, 'rabbit:upright:c2').how)).toEqual(['s.books.how.egg'])
    expect(card(m, 'rabbit:upright:c2').breedSteps).toBeNull()
  })

  it('a breed not open yet: two of the breed before, with the steps so far', () => {
    expect(clipsOf(card(m, 'rabbit:lionhead:c1').how)).toEqual(['s.books.how.breed.lionhead'])
    expect(card(m, 'rabbit:lionhead:c1').breedSteps).toBe(1)
    // four house cats: the long-haired cat is open, the maine coon waits for two of those
    expect(clipsOf(card(m, 'cat:longhair:c1').how)).toEqual(['s.books.how.egg'])
    expect(clipsOf(card(m, 'cat:mainecoon:c1').how)).toEqual(['s.books.how.breed.mainecoon'])
    expect(card(m, 'cat:mainecoon:c1').breedSteps).toBe(0)
    expect(clipsOf(fresh.pages[0].sections[1].cards[0].how)).toEqual(['s.books.how.breed.lop'])
  })

  it('a species not met: the friend stone of its region', () => {
    const how = card(m, 'panda:std:c1').how
    expect(clipsOf(how)).toEqual(['s.books.how.meet', friendRegionOf('panda')!.nameClip])
    expect(compile(how!).text).toMatch(/^Mød den på ven-stenen i \S/)
    expect(card(m, 'panda:std:c1').breedSteps).toBeNull()
  })

  it('golden and rainbow animals, and the Stjernefølet', () => {
    expect(clipsOf(card(m, 'rabbit:upright:gold').how)).toEqual(['s.books.how.ready'])
    expect(clipsOf(card(m, 'horse:shetland:gold').how)).toEqual(['s.books.how.gold', 'name.world.bakke'])
    expect(clipsOf(card(m, 'fox:std:rainbow').how)).toEqual(['s.books.how.rainbow', 'name.world.bakke'])
    expect(clipsOf(card(fresh, 'unicorn:foal:starwhite').how)).toEqual(['s.books.how.starfoal'])
  })

  it('has a recorded line for every way, and every species has a friend stone', () => {
    for (const s of SPECIES) expect(friendRegionOf(s.id), s.id).not.toBeNull()
    for (const model of [m, fresh]) {
      for (const c of model.pages.flatMap((p) => p.sections.flatMap((x) => x.cards))) {
        if (c.owned) expect(c.how).toBeNull()
        else for (const clip of clipsOf(c.how)) expect(hasClip(clip), clip).toBe(true)
      }
    }
  })
})

describe('Kan-bogen', () => {
  it('lists the medals, gold first, in the child’s own words', () => {
    const can = canBookModel(zooDemoProfile())
    expect(can.count).toBe(9)
    expect(can.gold.map((e) => e.skill)).toEqual(['count10', 'hear20', 'addTo10'])
    expect(can.silver.map((e) => e.skill).sort()).toEqual(['compareLength', 'count20', 'order20'])
    expect(can.bronze.map((e) => e.skill).sort()).toEqual(['patterns', 'subTo10', 'tenFriends'])
    for (const e of [...can.gold, ...can.silver, ...can.bronze]) expect(e.clip).toBe(`s.cando.${e.skill}`)
  })

  it('has a general line for a skill without its own sentence yet, and is empty for a new child', () => {
    const can = canBookModel({ skillMedals: { mul34: 'gold' } })
    expect(can.gold).toEqual([{ skill: 'mul34', domain: 'muldiv', medal: 'gold', clip: hasClip('s.cando.mul34') ? 's.cando.mul34' : 's.books.can.more' }])
    expect(canBookModel(zooNewProfile()).count).toBe(0)
  })
})

describe('Stempelbogen', () => {
  it('counts stamps and days in total, and reads the goals', () => {
    const s = stampModel(zooDemoProfile())
    expect(s).toMatchObject({ stamps: 11, days: 16 })
    expect(s.goals.map((g) => g.goal.done)).toEqual([true, false, false])
    expect(clipsOf(s.goals[1].parts)).toEqual(['s.reward.goal.revisit', 'name.region.w0-tal10'])
    expect(goalParts({ kind: 'stars3', need: 1, progress: 0, done: false })).toEqual([{ clip: 's.reward.goal.stars3' }])
    expect(stampModel(zooNewProfile())).toMatchObject({ stamps: 0, days: 0 })
  })
})

describe('Trofæerne', () => {
  it('lists all 34 in five groups, earned ones in colour and the rest with what earns them', () => {
    const t = trophyModel(zooDemoProfile())
    expect(t.total).toBe(34)
    expect(t.groups.map((g) => g.category)).toEqual(['flid', 'stil', 'rejse', 'laering', 'venner'])
    const all = t.groups.flatMap((g) => g.entries)
    expect(all.map((e) => e.id).sort()).toEqual([...TROPHY_IDS].sort())
    expect(all.map((e) => e.id)).toEqual(t.groups.flatMap((g) => TROPHIES.filter((x) => x.category === g.category).map((x) => x.id)))
    expect(t.earned).toBe(8)
    expect(all.filter((e) => e.earned).map((e) => e.id).sort()).toEqual(['animals-15', 'animals-5', 'days-14', 'days-3', 'days-7', 'first-gold', 'first-rainbow', 'perfect-round'])
    for (const e of all) {
      expect(hasClip(e.name), e.name).toBe(true)
      expect(hasClip(e.how), e.how).toBe(true)
    }
  })

  it('shows the way to a counting trophy as a bar, never as a number', () => {
    const t = trophyModel(zooDemoProfile())
    const entry = (id: string) => t.groups.flatMap((g) => g.entries).find((e) => e.id === id)!
    expect(entry('days-30').progress).toBeCloseTo(16 / 30)
    expect(entry('animals-30').progress).toBeCloseTo(16 / 30)
    expect(entry('days-3').progress).toBeNull()
    expect(entry('world-eng').progress).toBeNull()
  })

  it('starts empty for a new child', () => {
    const p: ProfileDoc = zooNewProfile()
    const t = trophyModel(p)
    expect(t.earned).toBe(0)
    expect(t.groups.flatMap((g) => g.entries).every((e) => !e.earned)).toBe(true)
  })
})

describe('the shelf', () => {
  it('puts a plain count on each cover', () => {
    expect(shelfModel(zooDemoProfile()).map((b) => [b.id, b.count])).toEqual([['collection', 16], ['can', 9], ['stamps', 11], ['trophies', 8]])
    expect(shelfModel(zooNewProfile()).map((b) => b.count)).toEqual([1, 0, 0, 0])
  })
})
