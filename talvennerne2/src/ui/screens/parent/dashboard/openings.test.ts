// The grade and the places a grown-up opens (SPEC §8, §9.1 point 12, review P2-10): every child
// starts in Engdalen; from 1. class the worlds below the child's grade are open, and the child's own
// world when it has something to play; a grown-up opens any place with something to play, and nothing
// is ever closed again. Worlds whose skills are not registered yet are never opened.
import { describe, expect, it } from 'vitest'
import { ITEMS, SPECIES } from '../../../../content/catalog'
import { REGIONS, WORLD_BY_ID, regionsOfWorld } from '../../../../content/curriculum'
import { newProfileDoc } from '../../../../data/repo/profiles'
import { registeredSkills } from '../../../../engine/registry'
import type { SkillId } from '../../../../engine/types'
import { RELEASED_WORLDS } from '../../../../meta/built'
import { isRegionOpen, isWorldOpen, unlockView } from '../../../../meta/unlock'
import {
  applyGrade, gradeOpenings, openingRows, regionHasContent, regionOpenings, withOpenings, worldOpenings, worldReady,
  type Drawn,
} from './openings'

/** What is registered today: the skills of waves 1–2 (Engdalen, Hestebakkerne and Regnbueskoven). */
const registered: ReadonlySet<SkillId> = new Set(registeredSkills().map((d) => d.id))
/** As if every skill of Hestebakkerne had its module too. */
const withBakke: ReadonlySet<SkillId> = new Set([
  ...registered,
  ...regionsOfWorld('bakke').flatMap((r) => r.skills.map((s) => s.skill)),
])

/** As if every friend, chest and finale were drawn. */
const everything: Drawn = { species: new Set(SPECIES.map((s) => s.id)), items: new Set(ITEMS.map((i) => i.id)) }

/** Everything drawn, but only Engdalen released: the state before Hestebakkerne and Regnbueskoven opened (4/10). */
const engOnly: Drawn = { ...everything, released: new Set(['eng']) }

const engRegions = regionsOfWorld('eng').map((r) => r.id)
const kid = () => newProfileDoc('Bo', 0, { id: 'p_bo', now: 0 })

describe('what has something to play', () => {
  it('knows Engdalen is ready and the later worlds are not yet (most of their skills have no modules)', () => {
    expect(worldReady('eng', registered)).toBe(true)
    for (const r of regionsOfWorld('eng')) expect(regionHasContent(r, registered), r.id).toBe(true)
    for (const w of ['bakke', 'skov', 'fjeld'] as const) {
      const all = regionsOfWorld(w).every((r) => r.skills.every((s) => s.reviewOnly || registered.has(s.skill)))
      expect(worldReady(w, registered, everything), w).toBe(all)
    }
  })

  it('does not call a world ready when only some of its regions could be played', () => {
    // as if only Engdalen and the flat shapes of Formværkstedet had their modules
    const engAndShapes: ReadonlySet<SkillId> = new Set([
      ...regionsOfWorld('eng').flatMap((r) => r.skills.map((s) => s.skill)), 'shapes2D' as SkillId,
    ])
    const figurer = REGIONS.find((r) => r.id === 'w1-figurer')!
    expect(regionHasContent(figurer, engAndShapes)).toBe(true)
    expect(worldReady('bakke', engAndShapes, everything)).toBe(false)
    expect(worldReady('bakke', withBakke, everything)).toBe(true)
  })

  it('does not call a world ready while a region has only some of its skills (its other first stone would be empty)', () => {
    const maal = REGIONS.find((r) => r.id === 'w1-maal-penge')!
    const half = new Set([...withBakke].filter((s) => s !== maal.skills.find((x) => !x.reviewOnly)!.skill))
    expect(regionHasContent(maal, half)).toBe(true)
    expect(worldReady('bakke', half, everything)).toBe(false)
  })

  it('does not call a world ready before its friends, chests and finale are drawn', () => {
    const without = (id: string): Drawn => ({
      species: new Set([...everything.species].filter((s) => s !== id)),
      items: new Set([...everything.items].filter((i) => i !== id)),
    })
    const bakke = regionsOfWorld('bakke')
    const friend = bakke.find((r) => r.node3.kind === 'friend')!.node3
    const chest = bakke.find((r) => r.node3.kind === 'chest')!.node3
    expect(worldReady('bakke', withBakke, without(friend.kind === 'friend' ? friend.species : ''))).toBe(false)
    expect(worldReady('bakke', withBakke, without(chest.kind === 'chest' ? chest.item : ''))).toBe(false)
    expect(worldReady('bakke', withBakke, without(WORLD_BY_ID.bakke.finaleItems[0]))).toBe(false)
    // Engdalen is drawn in full
    expect(worldReady('eng', registered)).toBe(true)
  })

  it('counts only a region\'s own skills, not its reviews', () => {
    const minus = REGIONS.find((r) => r.id === 'w0-minus10')!
    expect(regionHasContent(minus, new Set(['addTo10'] as SkillId[]))).toBe(false)
    expect(regionHasContent(minus, new Set(['subTo10'] as SkillId[]))).toBe(true)
  })
})

describe('the grade', () => {
  it('opens nothing in 0. class: the first two places of Engdalen are open as always', () => {
    expect(gradeOpenings(0, registered)).toEqual({ worlds: [], regions: [] })
    const p = applyGrade(kid(), 0, registered)
    expect(p.unlocked).toEqual({ worlds: [], regions: [] })
    expect(unlockView(p).regions).toEqual(['w0-tal10', 'w0-former'])
  })

  it('opens all of Engdalen from 1. class, and no world that is not released', () => {
    for (const g of [1, 2, 3] as const) {
      expect(gradeOpenings(g, registered, engOnly), `grade ${g}`).toEqual({ worlds: [], regions: engRegions })
      const p = applyGrade(kid(), g, registered, engOnly)
      expect(p.grade).toBe(g)
      for (const r of engRegions) expect(isRegionOpen(p, r), r).toBe(true)
      for (const w of ['bakke', 'skov', 'fjeld'] as const) expect(isWorldOpen(p, w), w).toBe(false)
      // the first two were open anyway: only the others are stored
      expect(p.unlocked.regions).toEqual(engRegions.filter((r) => r !== 'w0-tal10' && r !== 'w0-former'))
    }
  })

  it('opens the released worlds below the grade and the child\'s own world (Hestebakkerne and Regnbueskoven 4/10, Stjernefjeldet at its release)', () => {
    const bakke = regionsOfWorld('bakke').map((r) => r.id)
    const skov = regionsOfWorld('skov').map((r) => r.id)
    expect(gradeOpenings(1, registered)).toEqual({ worlds: ['bakke'], regions: engRegions })
    expect(gradeOpenings(2, registered)).toEqual({ worlds: ['bakke', 'skov'], regions: [...engRegions, ...bakke] })
    // a third-grader gets the three worlds below, and Stjernefjeldet itself once it is released
    const fjeld = RELEASED_WORLDS.has('fjeld') ? ['fjeld'] : []
    expect(gradeOpenings(3, registered)).toEqual({ worlds: ['bakke', 'skov', ...fjeld], regions: [...engRegions, ...bakke, ...skov] })
  })

  it('opens the child\'s own world once it has something to play', () => {
    // as if only Engdalen and Hestebakkerne had their modules: Regnbueskoven is not ready
    const toBakke: ReadonlySet<SkillId> = new Set(
      [...regionsOfWorld('eng'), ...regionsOfWorld('bakke')].flatMap((r) => r.skills.map((s) => s.skill)),
    )
    expect(gradeOpenings(1, toBakke, everything)).toEqual({ worlds: ['bakke'], regions: engRegions })
    const two = gradeOpenings(2, toBakke, everything)
    expect(two.worlds).toEqual(['bakke'])
    expect(two.regions).toEqual([...engRegions, ...regionsOfWorld('bakke').map((r) => r.id)])
  })

  it('never closes anything again: a lower grade keeps what is open', () => {
    const up = applyGrade(kid(), 2, registered)
    const down = applyGrade(up, 0, registered)
    expect(down.grade).toBe(0)
    expect(down.unlocked).toEqual(up.unlocked)
    // the same grade again changes nothing at all
    expect(applyGrade(up, 2, registered)).toBe(up)
  })
})

describe('what a grown-up opens', () => {
  it('opens a region, and its world with it', () => {
    const p = withOpenings(kid(), regionOpenings('w0-minus10', registered))
    expect(isRegionOpen(p, 'w0-minus10')).toBe(true)
    expect(p.unlocked).toEqual({ worlds: [], regions: ['w0-minus10'] })
    // a region of a world that is not released cannot be opened: its world's first stones would lead nowhere
    expect(regionOpenings('w1-figurer', registered, engOnly)).toEqual({ worlds: [], regions: [] })
    expect(regionOpenings('w1-figurer', registered)).toEqual({ worlds: ['bakke'], regions: ['w1-figurer'] })
    expect(regionOpenings('w1-tal100', withBakke, everything)).toEqual({ worlds: ['bakke'], regions: ['w1-tal100'] })
  })

  it('opens a whole world with something to play, and never an empty one', () => {
    const p = withOpenings(kid(), worldOpenings('eng', registered))
    for (const r of engRegions) expect(isRegionOpen(p, r), r).toBe(true)
    expect(worldOpenings('bakke', registered, engOnly)).toEqual({ worlds: [], regions: [] })
    if (!worldReady('fjeld', registered)) expect(worldOpenings('fjeld', registered)).toEqual({ worlds: [], regions: [] })
    const q = withOpenings(kid(), worldOpenings('bakke', withBakke, everything))
    expect(isWorldOpen(q, 'bakke')).toBe(true)
  })

  it('only ever adds', () => {
    const p = withOpenings(kid(), { regions: ['w0-plus10'] })
    expect(withOpenings(p, { regions: ['w0-plus10', 'w0-tal10'] })).toBe(p)
    const q = withOpenings(p, { regions: ['w0-tal20'] })
    expect(q.unlocked.regions).toEqual(['w0-plus10', 'w0-tal20'])
  })

  it('lists every world: what is open, what can be opened, and what comes later', () => {
    const rows = openingRows(kid(), registered)
    expect(rows.map((w) => w.id)).toEqual(['eng', 'bakke', 'skov', 'fjeld'])
    const eng = rows[0]
    expect(eng).toMatchObject({ name: 'Engdalen', grade: 0, open: true, ready: true })
    expect(eng.regions.filter((r) => r.open).map((r) => r.id)).toEqual(['w0-tal10', 'w0-former'])
    expect(eng.closed).toEqual(['w0-plus10', 'w0-tal20', 'w0-minus10', 'w0-tiervenner'])
    for (const w of rows.slice(1)) {
      if (w.ready) continue
      expect(w.open, w.id).toBe(false)
      expect(w.closed, w.id).toEqual([])
    }
    const graded = openingRows(applyGrade(kid(), 1, registered), registered)
    expect(graded[0].closed).toEqual([])
  })
})
