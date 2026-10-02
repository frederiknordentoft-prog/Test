// Wave 2's kinds (clockSet, pay, share, colorParts): they are registered with a view, a demo and a
// face, load lazily, fall back when a task cannot be played, and keep the round's house rules on top
// of house.test.ts — transitions only on transform and opacity, every endless loop stopped in calm
// mode, tap targets of at least 60 px, and every word they use in the clip catalogue.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Task, TaskKind } from '../../engine/types'
import { clipText, hasClip } from '../../speech/catalog'
import { KIND_INSTRUCTIONS, instructionClip } from '../../speech/clips/ui/kinds'
import { clips as KIND2_CLIPS } from '../../speech/clips/ui/kinds2'
import { EXAMPLES } from '../../dev/tasks/examples'
import { BUILT_KINDS, KIND_MODULES, moduleFor } from './registry'

const WAVE2: TaskKind[] = ['clockSet', 'pay', 'share', 'colorParts']
const CSS: Record<string, string> = {
  clockSet: 'clockSet/clockSet.css',
  pay: 'pay/pay.css',
  share: 'share/share.css',
  colorParts: 'colorParts/colorParts.css',
}
const read = (rel: string) => readFileSync(fileURLToPath(new URL(`./${rel}`, import.meta.url)), 'utf8')
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('wave 2 in the registry', () => {
  it('has all four kinds with a view, a demo and a face', () => {
    for (const kind of WAVE2) {
      const m = KIND_MODULES[kind]
      expect(m, kind).toBeDefined()
      expect(BUILT_KINDS).toContain(kind)
      expect(typeof m!.View, kind).toBe('function')
      expect(typeof m!.Demo, kind).toBe('function')
      expect(typeof m!.Face, kind).toBe('function')
    }
  })

  it('shows every harness example with its own kind, and draws the question itself where it is the answer surface', () => {
    const owned: Record<string, boolean> = {
      'clock-half': true, 'clock-digital': false, 'pay-17': false, 'share-12-3': true, 'parts-3/4': true,
    }
    for (const kind of WAVE2) {
      expect(EXAMPLES[kind].length, kind).toBeGreaterThanOrEqual(3)
      for (const e of EXAMPLES[kind]) {
        expect(moduleFor(e.task), e.id).toBe(KIND_MODULES[kind])
        if (e.id in owned) expect(!!moduleFor(e.task).ownsPrompt?.(e.task), e.id).toBe(owned[e.id])
      }
    }
  })

  it('stacks the struck answer over the confirm button: clocks, trays, plates and figures are wide', () => {
    for (const kind of WAVE2) expect(KIND_MODULES[kind]!.wideFace, kind).toBe(true)
  })

  it('falls back to cards or keys for a task its kind cannot play', () => {
    const share = EXAMPLES.share[0].task
    const noDeal: Task = { ...share, prompt: { scene: 'share', total: 100, recipients: 10, thing: 'apple' } }
    expect(moduleFor(noDeal)).toBe(KIND_MODULES.keypad)
    const pay = EXAMPLES.pay[0].task
    const unpayable: Task = { ...pay, answer: 1730 }
    expect(moduleFor(unpayable)).toBe(KIND_MODULES.keypad)
    const parts = EXAMPLES.colorParts[0].task
    const notAFraction: Task = { ...parts, answer: 'shape:circle:0', options: ['shape:circle:0', 'shape:square:0'] }
    expect(moduleFor(notAFraction)).toBe(KIND_MODULES.choice)
  })
})

describe('wave 2 house rules', () => {
  it('transitions only transform and opacity', () => {
    const bad: string[] = []
    for (const [kind, file] of Object.entries(CSS)) {
      const css = stripComments(read(file))
      for (const m of css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)) {
        for (const part of m[1].split(',')) {
          const prop = part.trim().split(/\s+/)[0]
          if (!['transform', 'opacity', 'none'].includes(prop) && !prop.startsWith('var(')) bad.push(`${kind}: ${part.trim()}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('stops every endless animation in calm mode and with reduced motion', () => {
    for (const [kind, file] of Object.entries(CSS)) {
      const css = stripComments(read(file))
      const loops = [...css.matchAll(/([^{}]+)\{[^{}]*animation:[^;{}]*infinite[^;{}]*;/g)].map((m) => m[1].trim().split('\n').pop()!.trim())
      for (const sel of loops) {
        expect(css.includes(`:root[data-calm] ${sel}`), `${kind}: ${sel} in calm mode`).toBe(true)
        expect(css.slice(css.indexOf('prefers-reduced-motion')).includes(sel), `${kind}: ${sel} with reduced motion`).toBe(true)
      }
    }
  })

  it('keeps every tap target at least 60 px', () => {
    const targets: [string, string][] = [
      ['pay', '.tv-pay__src'],
      ['pay', '.tv-pay__take'],
      ['share', '.tv-deal__plate'],
    ]
    for (const [kind, sel] of targets) {
      const css = stripComments(read(CSS[kind]))
      const block = new RegExp(`(^|\\n)${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? ''
      const px = (name: string) => Number(new RegExp(`(?:^|\\n|;)\\s*${name}:\\s*(\\d+)px`).exec(block)?.[1] ?? 0)
      expect(px('min-width'), `${sel} min-width`).toBeGreaterThanOrEqual(60)
      if (sel !== '.tv-deal__plate') expect(px('min-height'), `${sel} min-height`).toBeGreaterThanOrEqual(60)
    }
    // the clock dial and the figures are far bigger than 60 px at every breakpoint
    const clock = stripComments(read(CSS.clockSet))
    for (const m of clock.matchAll(/--dial:\s*min\((\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(240)
  })

  it('says every instruction and name, digit-free', () => {
    for (const kind of WAVE2) {
      for (const form of ['long', 'short'] as const) {
        const id = instructionClip(kind, form)
        expect(hasClip(id), id).toBe(true)
        expect(clipText(id)).toBe(KIND_INSTRUCTIONS[kind][form])
      }
      expect(KIND_INSTRUCTIONS[kind].long.length).toBeGreaterThan(KIND_INSTRUCTIONS[kind].short.length)
    }
    for (const [id, text] of Object.entries(KIND2_CLIPS)) {
      expect(id.startsWith('s.kind.'), id).toBe(true)
      expect(hasClip(id), id).toBe(true)
      expect(text, id).not.toMatch(/\d/)
    }
  })

  it('never shows the time, the sum or a count as digits on the answer surface', () => {
    // the views draw clocks, coins and things; the only numbers they print are the asked fraction
    // (colorParts) and, as support on a new key, the tray's sum (pay)
    for (const kind of WAVE2) {
      const src = read(`${kind}/View.tsx`)
      expect(src.includes('digitalText'), kind).toBe(false)
      expect(src.includes('formatNumber'), kind).toBe(false)
    }
    expect(read('pay/View.tsx')).toMatch(/task\.scaffold && sum > 0/)
  })
})
