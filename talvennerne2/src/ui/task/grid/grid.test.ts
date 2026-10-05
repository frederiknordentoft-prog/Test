// The grid kind of wave 3 (SPEC A21), in the style of wave2.test.ts: registered with a view, a demo and
// a face in its own lazy chunk, shown for points only — symmetry's count over a net stays on the keypad
// with its ceiling and speed unchanged (only its guess rate is the keypad's now) — and the round's
// house rules: transitions on transform and opacity only, no endless motion (calm mode), tap targets
// of at least 60 px and every word it says in the clip catalogue, digit-free.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Task } from '../../../engine/types'
import { getSkill } from '../../../engine/registry'
import { ceilingFor, defaultFastMs, guessP } from '../../../engine/kinds'
import { tasksUnderTest } from '../../../engine/skills/number/testing/harness'
import { clipInfo, clipText, hasClip } from '../../../speech/catalog'
import { KIND_INSTRUCTIONS, instructionClip } from '../../../speech/clips/ui/kinds'
import { EXAMPLES } from '../../../dev/tasks/examples'
import { BUILT_KINDS, KIND_MODULES, moduleFor, shownKind } from '../registry'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AnswerValue } from '../../../engine/types'
import type { ViewMode } from '../types'
import { GridFace, GridView } from './View'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`./${rel}`, import.meta.url)), 'utf8')
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const CSS = stripComments(read('grid.css'))

describe('grid in the registry', () => {
  it('has a view, a demo and a face, loaded with the first point task', () => {
    const m = KIND_MODULES.grid
    expect(m).toBeDefined()
    expect(BUILT_KINDS).toContain('grid')
    for (const part of [m!.View, m!.Demo, m!.Face]) expect(typeof part).toBe('function')
    expect(read('../registry.ts')).toMatch(/grid: lazyKind\(\(\) => import\('\.\/grid'\)/)
    expect(read('index.ts')).toMatch(/GridView as View, GridFace as Face/)
  })

  it('shows every harness example on the net, which is the question itself', () => {
    expect(EXAMPLES.grid.length).toBeGreaterThanOrEqual(3)
    for (const e of EXAMPLES.grid) {
      expect(shownKind(e.task), e.id).toBe('grid')
      expect(moduleFor(e.task), e.id).toBe(KIND_MODULES.grid)
      expect(moduleFor(e.task).ownsPrompt?.(e.task), e.id).toBe(true)
    }
    expect(EXAMPLES.grid.map((e) => e.task.skill)).toEqual(EXAMPLES.grid.map(() => 'gridCoords'))
  })

  it('falls back for what is no point: a count goes on the keypad, a set of cells on cards', () => {
    const t = EXAMPLES.grid[0].task
    const count: Task = { ...t, answer: 3, answerType: 'int', prompt: { scene: 'grid', w: 4, h: 4, filled: [1, 2], axis: 'v' } }
    expect(moduleFor(count)).toBe(KIND_MODULES.keypad)
    const cells: Task = { ...t, answer: '1|5', options: ['1|5', '2|6'] }
    expect(moduleFor(cells)).toBe(KIND_MODULES.choice)
  })
})

describe('symmetry over a net is unchanged but for its guess rate (SPEC A21)', () => {
  const symmetry = getSkill('symmetry')!
  const built = tasksUnderTest(symmetry)
  // what kinds.ts said before A21: a grid without coordinates was guessed as any subset of its squares
  const oldGuess = (t: Task) => {
    const g = t.prompt.scene === 'grid' ? t.prompt : null
    const cells = g ? g.w * g.h : 16
    return g?.coords ? 1 / cells : 1 / 2 ** cells
  }
  const oldCeiling = (t: Task) => (oldGuess(t) <= 0.12 ? 5 : oldGuess(t) >= 0.5 ? 2 : 3)

  it('shows the count on the keypad, guessed 1 in 13 like the keys', () => {
    const grid = built.filter((b) => b.kind === 'grid')
    expect(grid.length).toBeGreaterThan(0)
    for (const { fact, task: t } of grid) {
      expect([shownKind(t), moduleFor(t) === KIND_MODULES.keypad], fact.id).toEqual(['keypad', true])
      expect(guessP(t), fact.id).toBeCloseTo(1 / 13, 12)
    }
  })

  it('keeps every symmetry task’s kind, ceiling and speed', () => {
    for (const { fact, kind, task: t } of built) {
      const where = `${fact.id} ${kind}`
      expect(shownKind(t), where).toBe(kind === 'grid' ? 'keypad' : kind)
      if (kind === 'grid') expect(ceilingFor(t), where).toBe(oldCeiling(t))
      // the old formula: 5 s + 1.5 s per cell of the answer, a number being one
      if (kind === 'grid') expect(defaultFastMs(t), where).toBe(6_500)
    }
    // the family's own speeds (symmetry.ts) are what the round uses, and they stay
    expect(symmetry.families.map((f) => f.fastMs?.grid)).toEqual([12_000, 12_000])
  })
})

describe('grid house rules', () => {
  it('transitions only transform and opacity', () => {
    const bad: string[] = []
    for (const m of CSS.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)) {
      for (const part of m[1].split(',')) {
        const prop = part.trim().split(/\s+/)[0]
        if (!['transform', 'opacity', 'none'].includes(prop)) bad.push(part.trim())
      }
    }
    expect(bad).toEqual([])
    expect(CSS).not.toMatch(/animation:[^;]*infinite/)
  })

  it('stops even the short glides in calm mode and with reduced motion', () => {
    for (const sel of ['.tv-grid__point', '.tv-grid__halo', '.tv-grid__num circle']) {
      expect(CSS.includes(`:root[data-calm] ${sel}`), sel).toBe(true)
      expect(CSS.slice(CSS.indexOf('prefers-reduced-motion')).includes(sel), sel).toBe(true)
    }
  })

  it('keeps the tap targets at least 60 px: the strips of numbers and the net', () => {
    const block = (sel: string) => new RegExp(`(^|\\n)${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(CSS)?.[2] ?? ''
    expect(block('.tv-grid__strip.is-x')).toMatch(/min-height:\s*60px/)
    expect(block('.tv-grid__strip.is-y')).toMatch(/min-width:\s*60px/)
    // the net is the figure but half a square: far above 60 px at the smallest figure (319 px)
    expect(CSS).toMatch(/--fig: min\(420px, calc\(100vw - 2 \* var\(--gutter\) - 24px\), 56vh\)/)
  })

  it('says its instruction and the names of its controls, digit-free, recorded with wave 3', () => {
    for (const form of ['long', 'short'] as const) {
      const id = instructionClip('grid', form)
      expect(hasClip(id), id).toBe(true)
      expect(clipText(id)).toBe(KIND_INSTRUCTIONS.grid[form])
      expect(clipInfo(id)?.wave, id).toBe(3)
    }
    expect(KIND_INSTRUCTIONS.grid.long.length).toBeGreaterThan(KIND_INSTRUCTIONS.grid.short.length)
    expect(KIND_INSTRUCTIONS.grid.short).toBe('Først hen, så op.')
    expect(KIND_INSTRUCTIONS.grid.long).not.toMatch(/felter/)
    for (const id of ['s.kind.grid.board', 's.kind.grid.along', 's.kind.grid.up']) {
      expect(hasClip(id), id).toBe(true)
      expect(clipText(id), id).not.toMatch(/\d/)
      expect(clipInfo(id)?.wave, id).toBe(3)
    }
    // every other kind's words stay in wave 1
    expect(clipInfo(instructionClip('keypad', 'long'))?.wave).toBe(1)
    const src = read('View.tsx')
    for (const id of src.match(/s\.kind\.grid\.\w+/g) ?? []) expect(hasClip(id), id).toBe(true)
  })
})

describe('the grid view as drawn', () => {
  const ex = (id: string) => EXAMPLES.grid.find((e) => e.id === id)!.task
  const view = (task: Task, mode: ViewMode = 'input', given: AnswerValue | null = null) =>
    renderToStaticMarkup(createElement(GridView, { task, mode, given, onSubmit: () => {}, onActivity: () => {}, onDraft: () => {}, speaking: null }))

  it('sets a point on one net with the asked pair under it, and no point before the first tap', () => {
    const html = view(ex('grid-place'))
    expect(html).toMatch(/role="group"[^>]*aria-label="Nettet"/)
    expect(html).not.toMatch(/data-point=/)
    expect(html).not.toMatch(/role="slider"/)
    expect(html).toMatch(/tv-grid__digit">3<.*tv-grid__digit">2</)
    expect(html).toContain('data-grid-mode="place"')
  })

  it('reads a drawn point on two strips of numbers, the pair blank until picked', () => {
    const html = view(ex('grid-read'))
    expect(html).toMatch(/role="slider"[^>]*aria-label="Tallene forneden"/)
    expect(html).toMatch(/role="slider"[^>]*aria-label="Tallene til venstre"/)
    expect(html).toContain('data-point="2,5"')
    expect(html.match(/is-blank/g)).toHaveLength(2)
  })

  it('shows the answer handed in: the child’s point struck, the picked numbers lit', () => {
    const wrong = view(ex('grid-place'), 'wrong', 'pt:2,3')
    expect(wrong).toContain('data-point="2,3"')
    expect(wrong).toContain('tv-strike')
    const right = view(ex('grid-read'), 'correct', 'x:2|y:5')
    expect(right).toMatch(/is-x is-on" data-num="x2"/)
    expect(right).toMatch(/is-y is-on" data-num="y5"/)
    expect(right).toContain('tv-grid__pair is-good')
  })

  it('walks from 0 along and up to the child’s point only on a new key', () => {
    expect(view(ex('grid-place-new'), 'wrong', 'pt:4,5')).toContain('tv-grid__walk')
    expect(view(ex('grid-place'), 'wrong', 'pt:2,3')).not.toContain('tv-grid__walk')
  })

  it('pictures an answer as its pair, either form', () => {
    for (const value of ['pt:3,2', 'x:3|y:2', 'y:2|x:3']) {
      const html = renderToStaticMarkup(createElement(GridFace, { task: ex('grid-place'), value, size: 'md' }))
      expect(html, value).toMatch(/tv-grid__digit">3<.*tv-grid__digit">2</)
    }
  })
})
