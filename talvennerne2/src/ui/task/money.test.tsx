// Money on cards and in the shop (UI-fund 17, 18): notes are drawn as notes (PieceArt, the pay view's
// own pieces), a token like 'c5000' or 'c010000' never stands as raw text, and the note the child
// paid with in the shop is one note, not a row of 20-krone coins.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { keysForSkills, skillRegistry } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import type { AnswerValue, SkillId, Task, TaskKind } from '../../engine/types'
import { PromptScene } from '../scenes/PromptScene'
import { optionLabel } from './answers'
import { OptionFace } from './faces'

const reg = skillRegistry()
const keys = (skill: SkillId, families?: string[]) =>
  keysForSkills([{ skill, ...(families ? { families } : {}) }], { skills: reg, states: {}, audioVerified: true, mode: 'round' })

function tasks(skill: SkillId, kind: TaskKind, families?: string[], seeds = 6): Task[] {
  return keys(skill, families).flatMap((k) =>
    k.kinds.includes(kind) ? Array.from({ length: seeds }, (_, s) => k.build(kind, makeRng(s + 1), 0)) : [],
  )
}

const face = (task: Task, value: AnswerValue) => renderToStaticMarkup(<OptionFace task={task} value={value} size="md" />)
const notes = (html: string) => (html.match(/tv-piece--note/g) ?? []).length
const coins = (html: string) => (html.match(/tv-piece--coin/g) ?? []).length
/** Visible text of the markup (SVG <text> included), without tags. */
const text = (html: string) => html.replace(/<[^>]+>/g, ' ')

describe('notes and coins on cards (UI-fund 17)', () => {
  it('draws coinNames notes as notes on choice cards, never "200 kr."', () => {
    const notesTasks = tasks('coinNames', 'choice').filter((t) => (t.answer as number) >= 5000)
    expect(notesTasks.length).toBeGreaterThan(0)
    for (const t of notesTasks) {
      for (const o of t.options) {
        const html = face(t, o)
        expect(notes(html), `${t.factId} ${o}`).toBe(1)
        expect(text(html)).not.toMatch(/kr\./)
      }
    }
  })

  it('draws coins in their real sizes: the 5-krone is bigger than the 1-krone', () => {
    const t = tasks('coinNames', 'choice').find((x) => x.answer === 500)!
    const width = (html: string) => /--d:([\d.]+)/.exec(html)?.[1]
    expect(Number(width(face(t, 500)))).toBeGreaterThan(Number(width(face(t, 100))))
  })

  it('reads repeated tokens with leading zeros (c010000) as the piece, in multiSelect', () => {
    const all = tasks('coinNames', 'multiSelect', undefined, 2)
    const withNotes = all.filter((t) => t.options.some((o) => /^c0+\d+$/.test(String(o))))
    expect(withNotes.length).toBeGreaterThan(0)
    for (const t of all) {
      for (const o of t.options) {
        const html = face(t, o)
        expect(notes(html) + coins(html), `${t.factId} ${o}`).toBe(1)
        expect(text(html), `${o}`).not.toMatch(/\bc\d+/)
        expect(optionLabel(t, o)).toMatch(/^\d+(,\d\d)? kr\.$/)
      }
    }
  })

  it('draws payExact coin sets with the 50-krone note as a note (to100)', () => {
    const all = tasks('payExact', 'choice', ['to100'])
    expect(all.length).toBeGreaterThan(0)
    for (const t of all) {
      for (const o of t.options) {
        const html = renderToStaticMarkup(<OptionFace task={t} value={o} size="md" />)
        expect(text(html), String(o)).not.toMatch(/\bc\d+/)
        expect(notes(html)).toBe(String(o).split('|').filter((x) => Number(x.slice(1)) >= 5000).length)
        expect(optionLabel(t, o)).not.toMatch(/c\d/)
      }
    }
  })
})

describe('the shop scene (UI-fund 18)', () => {
  it('draws the paid 50- or 100-krone note as one note', () => {
    for (const paidOre of [5000, 10000]) {
      const html = renderToStaticMarkup(<PromptScene prompt={{ scene: 'shop', thing: 'apple', priceOre: 2300, paidOre, purse: [] }} />)
      expect(notes(html), String(paidOre)).toBe(1)
      expect(coins(html), String(paidOre)).toBe(0)
    }
  })

  it('draws a paid coin as that coin', () => {
    const html = renderToStaticMarkup(<PromptScene prompt={{ scene: 'shop', thing: 'apple', priceOre: 1300, paidOre: 2000, purse: [] }} />)
    expect(coins(html)).toBe(1)
    expect(notes(html)).toBe(0)
  })

  it('pays the change skill\'s notes as notes', () => {
    for (const t of tasks('change', 'choice', ['from50'], 3)) {
      const p = t.prompt
      if (p.scene !== 'shop') throw new Error('shop expected')
      const html = renderToStaticMarkup(<PromptScene prompt={p} task={t} />)
      expect(notes(html)).toBe(1)
      expect(coins(html)).toBe(0)
    }
  })
})
