import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, newTrophies, trophyPerler } from '../content/achievements'
import { TROPHIES } from '../content/catalog'
import {
  COMBO, DECOR_TOTAL, EGG, FRIENDSHIP_LEVELS, PERLER, RECOLOR_TOTAL, SHOP_SET_PRICE, SHOP_TOTAL, TITLES, TOTAL_SINK, XP,
  XP_TO_NEXT, comboEffect, eggWarmthFor, levelForXp, levelProgress, titleFor, xpForLevel,
} from '../content/economy'
import { ANIMAL_NAMES, NAME_MAX_LENGTH, cleanAnimalName, nameClip, namePool, nameSuggestions } from '../content/names'
import { newProfile } from '../engine/testing/profile'
import { SPECIES_IDS, TROPHY_IDS } from '../engine/types'
import { clipInfo, clipText } from '../speech/catalog'

describe('economy constants (SPEC §5.7)', () => {
  it('has the XP curve to level 50', () => {
    expect(XP_TO_NEXT).toHaveLength(49)
    expect([5, 10, 20, 30, 50].map(xpForLevel)).toEqual([1150, 3650, 13650, 41650, 169650])
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(149)).toBe(1)
    expect(levelForXp(150)).toBe(2)
    expect(levelForXp(3650)).toBe(10)
    expect(levelForXp(10_000_000)).toBe(50)
    expect(levelProgress(150 + 125)).toBeCloseTo(0.5)
    expect(levelProgress(10_000_000)).toBe(1)
  })

  it('has the titles', () => {
    expect(TITLES.map((t) => [t.level, t.title])).toEqual([
      [1, 'Nybegynder'], [5, 'Opdager'], [10, 'Eventyrer'], [15, 'Talspejder'], [20, 'Regnemester'],
      [30, 'Talmagiker'], [40, 'Stjerneregner'], [50, 'Talvenne-legende'],
    ])
    expect(titleFor(29).title).toBe('Regnemester')
    for (const t of TITLES) expect(clipText(t.clip)).toBe(t.title)
  })

  it('has fixed prices adding up to about 7 500 perler', () => {
    expect(SHOP_SET_PRICE).toBe(760)
    expect(SHOP_TOTAL).toBe(3040)
    expect(RECOLOR_TOTAL).toBe(3700)
    expect(DECOR_TOTAL).toBe(770)
    expect(TOTAL_SINK).toBe(7510)
  })

  it('keeps every tuned constant within ±20 % of the SPEC table', () => {
    const spec: [number, number][] = [
      [PERLER.correct, 1], [PERLER.star[1], 1], [PERLER.star[2], 1], [PERLER.star[3], 2], [PERLER.spark3, 1], [PERLER.spark5, 2],
      [PERLER.golden, 2], [PERLER.trial, 10], [PERLER.finale, 25], [PERLER.levelUp, 5], [PERLER.medal.bronze, 3],
      [PERLER.medal.silver, 5], [PERLER.medal.gold, 10], [PERLER.allGolden, 10], [EGG.golden, 10],
      [XP.correct, 10], [XP.star, 20], [XP.spark3, 25], [XP.spark5, 50], [XP.golden, 10], [XP.trial, 100], [XP.finale, 250],
      [XP.medal.bronze, 50], [XP.medal.silver, 100], [XP.medal.gold, 200],
      [eggWarmthFor(1), 15], [eggWarmthFor(2), 40], [eggWarmthFor(3), 60], [eggWarmthFor(4), 90], [eggWarmthFor(9), 90],
      [eggWarmthFor(10), 120], [eggWarmthFor(40), 120], [EGG.allFoundFriendship, 50],
    ]
    for (const [value, specValue] of spec) expect(Math.abs(value / specValue - 1), `${value} vs ${specValue}`).toBeLessThanOrEqual(0.2 + 1e-9)
  })

  it('has friendship levels and combo effects that are only looks', () => {
    expect(FRIENDSHIP_LEVELS).toEqual([0, 20, 50, 100, 170, 260, 370, 500, 650, 820])
    expect(COMBO.map((c) => c.streak)).toEqual([1, 3, 5, 10])
    expect(comboEffect(5)).toBe('superDance')
    expect(comboEffect(4)).toBeNull()
  })
})

describe('the 120 animal names (SPEC §6.3)', () => {
  it('are 120 short, distinct names, sorted by species, with a recorded clip each', () => {
    expect(ANIMAL_NAMES).toHaveLength(120)
    expect(new Set(ANIMAL_NAMES.map((a) => a.name.toLowerCase())).size).toBe(120)
    for (const s of SPECIES_IDS) expect(ANIMAL_NAMES.filter((a) => a.species === s).length, s).toBeGreaterThanOrEqual(7)
    for (const a of ANIMAL_NAMES) {
      expect(a.name.length, a.name).toBeLessThanOrEqual(NAME_MAX_LENGTH)
      expect(a.name).toMatch(/^[A-ZÆØÅ][a-zæøå-]+$/)
      expect(a.clip).toMatch(new RegExp(`^name\\.animal\\.${a.species}\\.\\d+$`))
      expect(clipText(a.clip)).toBe(a.name)
      expect(clipInfo(a.clip)?.wave).toBe(1)
    }
  })

  it('stay clear of brands, famous characters and the narrator', () => {
    const banned = ['pip', 'findus', 'pingu', 'pippi', 'bamse', 'kylling', 'rasmus', 'bambi', 'dumbo', 'simba', 'nala', 'olaf', 'elsa',
      'snoopy', 'garfield', 'nemo', 'stitch', 'pluto', 'snehvide', 'lynet', 'stampe', 'momo', 'dumle', 'pelle']
    for (const a of ANIMAL_NAMES) expect(banned, a.name).not.toContain(a.name.toLowerCase())
  })

  it('suggests six names that suit the species, never one the child uses, the same for the same animal', () => {
    for (const species of SPECIES_IDS) {
      const pool = namePool(species)
      const names = nameSuggestions({ uid: `egg-${species}`, species })
      expect(names).toHaveLength(6)
      expect(new Set(names).size).toBe(6)
      for (const n of names) expect([...pool.own, ...pool.kin]).toContain(n)
      expect(names.filter((n) => pool.own.includes(n)).length).toBeGreaterThanOrEqual(4)
      expect(nameSuggestions({ uid: `egg-${species}`, species })).toEqual(names)
    }
    const taken = nameSuggestions({ uid: 'a', species: 'rabbit' })
    const next = nameSuggestions({ uid: 'a', species: 'rabbit' }, taken)
    for (const n of next) expect(taken).not.toContain(n)
    // species-only names stay with their species
    expect(namePool('cat').kin).not.toContain('Agern')
    expect(namePool('squirrel').own).toContain('Agern')
  })

  it('cleans a typed name and finds the clip of a suggested one', () => {
    expect(cleanAnimalName('  Super   mega\u0007hund med hat  ')).toBe('Super mega hun')
    expect(cleanAnimalName('   ')).toBe('')
    expect(nameClip('mille')).toBe('name.animal.rabbit.3')
    expect(nameClip('Bob den Store')).toBeNull()
  })
})

describe('trophies (SPEC §13.1)', () => {
  it('has a condition for each of the 34 trophies and pays the catalogue perler', () => {
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual([...TROPHY_IDS].sort())
    for (const t of TROPHIES) expect(trophyPerler(t.id)).toBe(t.perler)
  })

  it('counts days in total, never in a row', () => {
    const p = newProfile({ daysPlayed: 7 })
    expect(newTrophies(p, null)).toEqual(['days-3', 'days-7'])
    expect(newTrophies({ ...p, achievements: { 'days-3': 1 } }, null)).toEqual(['days-7'])
    expect(ACHIEVEMENTS.find((a) => a.id === 'days-14')!.progress!(p)).toEqual({ have: 7, need: 14 })
  })

  it('knows a perfect round and a perfect trial when it sees one', () => {
    expect(newTrophies(newProfile(), { mode: 'round', perfect: true, trialPerfect: false })).toEqual(['perfect-round'])
    expect(newTrophies(newProfile(), { mode: 'trial', perfect: false, trialPerfect: true })).toEqual(['trial-perfect'])
    expect(newTrophies(newProfile({ skillMedals: { mul2510: 'gold', mul34: 'gold', mul6to9: 'gold' } }), null))
      .toEqual(['first-gold', 'table-complete'])
  })
})
