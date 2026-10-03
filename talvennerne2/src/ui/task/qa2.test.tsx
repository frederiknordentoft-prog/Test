// QA2 P2-4 and P2-5. A number-line task that names the number to place shows it above the line
// ("Sæt nålen ved 30" was only heard), and never where the number on the line is the answer to find.
// A fillSlots equation ("64 = ? + ?") draws its blanks as the places, once, and a wrong answer stands
// number by number in its own place — in the view and on the strategy's struck answer.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import type { RegionSkill } from '../../content/curriculum'
import type { Task, TaskKind } from '../../engine/types'
import { FillSlotsFace, FillSlotsView, equationPlaces, fillSlotsOwnsPrompt } from './fillSlots/View'
import { NumberlineView, placeTarget } from './numberline/View'

const reg = skillRegistry()
const noop = () => undefined

/** Every task of these skills in this kind, a few instances each. */
function tasks(skills: RegionSkill[], kind: TaskKind, n = 6): Task[] {
  const out: Task[] = []
  for (const k of keysForSkills(skills, { skills: reg, states: {}, audioVerified: true, mode: 'round' })) {
    if (!k.kinds.includes(kind)) continue
    for (let i = 0; i < n; i++) out.push(k.build(kind, makeRng(i + 1), i))
  }
  return out
}

describe('the number to place on the line (QA2 P2-4)', () => {
  it('names the number of every placing task, and it is the answer only where placing is the task', () => {
    const placing = tasks([{ skill: 'numberLine100' }, { skill: 'numberLine1000', families: ['placeHundreds', 'placeAny'] }], 'numberline')
    expect(placing.length).toBeGreaterThan(10)
    for (const t of placing) {
      const target = placeTarget(t)
      expect(target, t.factId).not.toBeNull()
      expect(target!.n, t.factId).toBe(t.answer)
      const html = renderToStaticMarkup(<NumberlineView task={t} mode="input" given={null} onSubmit={noop} onActivity={noop} onDraft={noop} speaking={null} />)
      expect(html, t.factId).toContain(`data-nline-target="${t.answer}"`)
      expect(html, t.factId).toContain(`>${t.answer}<`)
      expect(html).toContain('Sæt nålen ved')
    }
  })

  it('shows the number to round, never the rounded answer', () => {
    for (const t of tasks([{ skill: 'numberLine1000', families: ['round10', 'round100'] }], 'numberline')) {
      const target = placeTarget(t)
      expect(target, t.factId).not.toBeNull()
      expect(target!.n, t.factId).not.toBe(t.answer)
    }
  })

  it('shows nothing where the place on the line is the answer to find', () => {
    const asking = [
      ...tasks([{ skill: 'order20' }], 'numberline', 2),
      ...tasks([{ skill: 'addTo20' }, { skill: 'doubles' }, { skill: 'add100Carry' }], 'numberline', 1),
    ]
    expect(asking.length).toBeGreaterThan(10)
    for (const t of asking) {
      expect(placeTarget(t), t.factId).toBeNull()
      const html = renderToStaticMarkup(<NumberlineView task={t} mode="input" given={null} onSubmit={noop} onActivity={noop} onDraft={noop} speaking={null} />)
      expect(html).not.toContain('data-nline-target')
    }
  })
})

describe('a wrong answer in an equation with places (QA2 P2-5)', () => {
  const expand = [
    ...tasks([{ skill: 'tensOnes', families: ['expand'] }], 'fillSlots', 3),
    ...tasks([{ skill: 'placeValue1000', families: ['expand', 'digitValue'] }], 'fillSlots', 3),
  ]

  it('draws "64 = ? + ?" with its blanks as the places, once', () => {
    expect(expand.length).toBeGreaterThan(5)
    for (const t of expand) {
      expect(equationPlaces(t), t.factId).not.toBeNull()
      expect(fillSlotsOwnsPrompt(t), t.factId).toBe(true)
      const html = renderToStaticMarkup(<FillSlotsView task={t} mode="input" given={null} onSubmit={noop} onActivity={noop} onDraft={noop} speaking={null} />)
      const places = String(t.answer).split('|').length
      expect((html.match(/data-slot="/g) ?? []).length, t.factId).toBe(places)
      const whole = t.prompt.scene === 'equation' && 'n' in t.prompt.terms[0] ? t.prompt.terms[0].n : null
      expect(html).toContain(`>${whole}<`)
    }
  })

  it('shows each number of a wrong answer in its own place, in the view and struck in the strategy', () => {
    const t = expand.find((x) => String(x.answer).split('|').length === 2)!
    expect(t).toBeDefined()
    const whole = t.prompt.scene === 'equation' && 'n' in t.prompt.terms[0] ? t.prompt.terms[0].n : 0
    // the digits typed as the parts: "6 | 4" for 64
    const digits = String(whole).split('')
    const given = digits.slice(0, 2).join('|')
    const view = renderToStaticMarkup(<FillSlotsView task={t} mode="wrong" given={given} onSubmit={noop} onActivity={noop} onDraft={noop} speaking={null} />)
    const slots = [...view.matchAll(/data-slot="(\d)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[2].replace(/<[^>]+>/g, ''))
    expect(slots).toEqual(digits.slice(0, 2))
    const face = renderToStaticMarkup(<FillSlotsFace task={t} value={given} size="sm" />)
    const cards = [...face.matchAll(/tv-minicard">([\s\S]*?)<\/span><\/span>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
    expect(cards).toEqual(digits.slice(0, 2))
    expect(face).toContain(`>${whole}<`)
    expect(face).toContain('>=<')
  })

  it('leaves rows and fractions as they were', () => {
    const fraction = tasks([{ skill: 'fractionShape' }], 'fillSlots', 1)
    for (const t of fraction) expect(equationPlaces(t), t.factId).toBeNull()
    const rows = tasks([{ skill: 'skipCount', families: ['step2'] }], 'fillSlots', 1)
    for (const t of rows) expect(fillSlotsOwnsPrompt(t), t.factId).toBe(true)
  })
})
