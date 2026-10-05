// ids.lock.json freezes every id the game stores or speaks (SPEC §14 F0). Renaming an id breaks saved
// profiles and voice clips, so a change here must be deliberate:
//   UPDATE_IDS_LOCK=1 npx vitest run src/content/ids.lock.test.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BREEDS, CHAIN_IDS, DECOR_IDS, DOMAIN_IDS, FRAME_COLORS, MAGIC_COLORWAYS, MISCONCEPTION_IDS, MOODS,
  NATURAL_COLORWAYS, SET_IDS, SKILL_IDS, SLOTS, SPECIES_IDS, TASK_KINDS, TROPHY_IDS, WORLD_IDS,
} from '../engine/types'
import { NODES, REGIONS, WORLDS } from './curriculum'
import { DECOR, ITEMS, SPECIES, TROPHIES } from './catalog'
import { SKILLS } from './skills'
import { THING_IDS } from '../art/materials/Things'

const LOCK = fileURLToPath(new URL('./ids.lock.json', import.meta.url))

const CLIP_PATTERNS = [
  'n.mid.<0-100|1000>', 'n.end.<0-100|1000>', 'n.mid.1.et', 'n.end.1.et',
  'h.mid.<100-900>', 'h.end.<100-900>', 'hog.<100-900>',
  't.end.<minutes>', 't.half.<minutes>', 't.part.<morgen|eftermiddag|aften|…>',
  'op.<name>', 'frag.<name>', 'noun.<name>', 'q.<factId>', 's.<name>', 'hint.<name>',
  'name.species.<id>', 'name.baby.<id>', 'name.breed.<id>', 'name.color.<species>.<c1-c6|gold|rainbow|starwhite>',
  'name.item.<itemId>', 'name.set.<setId>', 'name.region.<regionId>', 'name.world.<worldId>',
  'name.animal.<species>.<n>', 'name.trophy.<trophyId>', 'name.decor.<decorId>',
]

function snapshot() {
  return {
    domains: DOMAIN_IDS,
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, { domain: s.domain, families: s.families.map((f) => f.id) }])),
    kinds: TASK_KINDS,
    reservedKinds: ['rulerDraw'],
    misconceptions: MISCONCEPTION_IDS,
    worlds: WORLD_IDS,
    chains: CHAIN_IDS,
    regions: REGIONS.map((r) => r.id),
    nodes: NODES.map((n) => n.id),
    species: SPECIES_IDS,
    breeds: Object.fromEntries(SPECIES_IDS.map((id) => [id, (BREEDS as Record<string, readonly string[]>)[id] ?? ['std']])),
    colorways: [...NATURAL_COLORWAYS, ...MAGIC_COLORWAYS],
    moods: MOODS,
    slots: SLOTS,
    sets: SET_IDS,
    items: ITEMS.map((i) => i.id),
    decor: DECOR_IDS,
    trophies: TROPHY_IDS,
    frameColors: FRAME_COLORS,
    things: THING_IDS,
    clipPatterns: CLIP_PATTERNS,
  }
}

describe('ids.lock.json', () => {
  it('matches the ids in code', () => {
    const current = snapshot()
    if (process.env.UPDATE_IDS_LOCK === '1' || !existsSync(LOCK)) {
      writeFileSync(LOCK, JSON.stringify(current, null, 2) + '\n')
    }
    expect(JSON.parse(readFileSync(LOCK, 'utf8'))).toEqual(JSON.parse(JSON.stringify(current)))
  })
})

describe('curriculum and catalogue', () => {
  it('has 10 domains, 72 skills and 15 kinds, in the same order as the metadata', () => {
    expect(DOMAIN_IDS).toHaveLength(10)
    expect(SKILL_IDS).toHaveLength(72)
    expect(TASK_KINDS).toHaveLength(15)
    expect(SKILLS.map((s) => s.id)).toEqual([...SKILL_IDS])
    expect(MISCONCEPTION_IDS).toHaveLength(32)
  })

  it('gives every skill at least one production kind among its kinds', () => {
    for (const s of SKILLS) {
      expect(s.production.length, s.id).toBeGreaterThan(0)
      for (const k of s.production) expect(s.kinds, s.id).toContain(k)
    }
  })

  it('places every skill in at least one region, with valid families', () => {
    const placed = new Set(REGIONS.flatMap((r) => r.skills.filter((s) => !s.reviewOnly).map((s) => s.skill)))
    expect([...SKILL_IDS].filter((id) => !placed.has(id))).toEqual([])
    for (const r of REGIONS) {
      for (const rs of r.skills) {
        const meta = SKILLS.find((s) => s.id === rs.skill)!
        for (const f of rs.families ?? []) expect(meta.families.map((x) => x.id), `${r.id}/${rs.skill}`).toContain(f)
      }
    }
  })

  it('has 4 worlds, 28 regions and 172 nodes', () => {
    expect(WORLDS.map((w) => w.regions.length)).toEqual([6, 7, 8, 7])
    expect(REGIONS).toHaveLength(28)
    expect(NODES).toHaveLength(172)
    expect(new Set(NODES.map((n) => n.id)).size).toBe(172)
  })

  it('keeps every requires inside the same chain and world order', () => {
    for (const r of REGIONS) {
      for (const req of r.requires) {
        const other = REGIONS.find((x) => x.id === req)
        expect(other, `${r.id} requires ${req}`).toBeDefined()
        expect(other!.chain, `${r.id} → ${req}`).toBe(r.chain)
        expect(WORLD_IDS.indexOf(other!.world)).toBeLessThanOrEqual(WORLD_IDS.indexOf(r.world))
      }
    }
  })

  it('has one friend node per species and one chest per chest item', () => {
    const friends = REGIONS.flatMap((r) => (r.node3.kind === 'friend' ? [r.node3.species] : []))
    expect([...friends].sort()).toEqual([...SPECIES_IDS].sort())
    for (const r of REGIONS) {
      if (r.node3.kind !== 'chest') continue
      const item = ITEMS.find((i) => i.id === (r.node3 as { item: string }).item)!
      expect(item.source, r.id).toEqual({ kind: 'chest', nodeId: `${r.id}-chest` })
    }
    for (const w of WORLDS) {
      for (const id of w.finaleItems) expect(ITEMS.find((i) => i.id === id)!.source).toEqual({ kind: 'finale', world: w.id })
    }
    const chestOrFinale = ITEMS.filter((i) => i.source.kind === 'chest' || i.source.kind === 'finale').map((i) => i.id)
    const fromMap = [
      ...REGIONS.flatMap((r) => (r.node3.kind === 'chest' ? [r.node3.item] : [])),
      ...WORLDS.flatMap((w) => w.finaleItems),
    ]
    expect([...fromMap].sort()).toEqual([...chestOrFinale].sort())
  })

  it('has 74 items: 11 sets covering all 6 slots, plus 8 milestones', () => {
    expect(ITEMS).toHaveLength(74)
    for (const set of SET_IDS) {
      expect(ITEMS.filter((i) => i.set === set).map((i) => i.slot).sort()).toEqual([...SLOTS].sort())
    }
    expect(ITEMS.filter((i) => i.set === 'milepael')).toHaveLength(8)
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(74)
    for (const i of ITEMS) expect(i).not.toHaveProperty('tier')
  })

  it('has 16 species with 6 colours, 24 breeds, 8 decor and 34 trophies', () => {
    expect(SPECIES).toHaveLength(16)
    for (const s of SPECIES) expect(s.colors).toHaveLength(6)
    expect(SPECIES.reduce((n, s) => n + s.breeds.length, 0)).toBe(24)
    expect(DECOR.map((d) => d.id)).toEqual(expect.arrayContaining([...DECOR_IDS]))
    expect(DECOR.reduce((n, d) => n + d.price, 0)).toBe(770)
    expect(TROPHIES.map((t) => t.id)).toEqual(expect.arrayContaining([...TROPHY_IDS]))
    expect(TROPHY_IDS).toHaveLength(34)
  })

  it('never has a sad mood', () => {
    expect(MOODS as readonly string[]).not.toContain('sad')
  })
})
