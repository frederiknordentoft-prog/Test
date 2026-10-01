// House rules for Dyrehaven's and the books' own styles and art (SPEC §11): only transform and
// opacity move, calm mode stops the loops, and every colour comes from the design tokens.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOTS = [HERE, path.join(HERE, '../books')]

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    return statSync(p).isDirectory() ? files(p) : [p]
  })

const OWN = ROOTS.flatMap(files).filter((f) => /\.(css|tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f))
const CSS = OWN.filter((f) => f.endsWith('.css')).map((f) => ({ f: path.basename(f), text: readFileSync(f, 'utf8') }))

describe('Dyrehaven and the books: styles', () => {
  it('animates and transitions only transform and opacity', () => {
    for (const { f, text } of CSS) {
      for (const m of text.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)) {
        const props = [...m[1].matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1])
        expect(props.filter((p) => p !== 'transform' && p !== 'opacity'), f).toEqual([])
      }
      for (const m of text.matchAll(/transition:\s*([^;]+);/g)) expect(m[1].trim(), f).toMatch(/^(transform|opacity)\b/)
      for (const m of text.matchAll(/transition-property:\s*([^;]+);/g)) expect(m[1].trim(), f).toMatch(/^(transform|opacity)$/)
    }
  })

  it('stops every loop in calm mode and with reduced motion', () => {
    const zoo = CSS.find((c) => c.f === 'zoo.css')!.text
    const looping = [...zoo.matchAll(/\n(\.[^{\n]+)\{[^}]*animation:[^;]*infinite/g)].map((m) => m[1].trim())
    expect(looping.length).toBeGreaterThan(3)
    const calm = zoo.slice(zoo.indexOf(':root[data-calm]'))
    for (const sel of looping) {
      const last = sel.split(/\s+/).pop()!
      expect(calm, sel).toContain(last)
    }
    expect(zoo).toMatch(/prefers-reduced-motion: reduce/)
  })

  it('takes every colour from the tokens', () => {
    for (const f of OWN) {
      const text = readFileSync(f, 'utf8')
      expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], f).toEqual([])
      expect(text.match(/\brgba?\(/g) ?? [], f).toEqual([])
    }
  })

  it('uses no CSS filter and no SVG filters, masks or text in the drawings', () => {
    for (const f of OWN) {
      const text = readFileSync(f, 'utf8')
      expect(text, f).not.toMatch(/\bfilter\s*:|<filter|<mask|<text\b|foreignObject/)
    }
  })
})
