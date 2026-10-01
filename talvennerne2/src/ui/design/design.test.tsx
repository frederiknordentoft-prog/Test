// Design-system contracts: tokens match the spec and skills.ts, text contrast holds, the icon set is
// complete and well-formed, components speak catalogue clips, and motion stays on transform/opacity.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DOMAINS } from '../../content/skills'
import { clipText, hasClip } from '../../speech/catalog'
import { AnswerCard } from './AnswerCard'
import { Button, IconButton } from './Button'
import { Equation } from './Equation'
import { ICON_NAMES, ICONS } from './icons'
import type { IconDef } from './icons'
import { Meter } from './Meter'
import { ProgressStones } from './ProgressStones'
import { SpokenText } from './SpokenText'
import { Dock, DOCK_IDS } from '../shell/Dock'
import { TopBar } from '../shell/TopBar'

const HERE = import.meta.dirname
const tokens = readFileSync(path.join(HERE, 'tokens.css'), 'utf8')
const token = (name: string) => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)
  if (!m) throw new Error(`token ${name} missing`)
  return m[1].toUpperCase()
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255)
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('tokens', () => {
  it('have the spec values (SPEC §11)', () => {
    expect(token('ink')).toBe('#2B2144')
    expect(token('ink-2')).toBe('#5E5478')
    expect(token('paper')).toBe('#FFF8EC')
    expect(token('card')).toBe('#FFFFFF')
    expect(token('primary')).toBe('#6C4CF5')
    expect(token('primary-deep')).toBe('#4A2FC9')
    expect(token('sky-from')).toBe('#BFE6FF')
    expect(token('sky-to')).toBe('#FFF3D6')
    expect(token('good')).toBe('#22B573')
    expect(token('oops')).toBe('#FFB020')
    expect(token('star')).toBe('#FFC83D')
    expect(tokens).toMatch(/--color-line:\s*rgba\(43,\s*33,\s*68,\s*0\.1\)/)
  })

  it('carry the domain colours from skills.ts', () => {
    for (const d of DOMAINS) expect(token(`d-${d.id}`), d.id).toBe(d.color.toUpperCase())
  })

  it('keep text contrast ≥ 4.5:1', () => {
    const white = '#FFFFFF'
    const pairs: [string, string][] = [
      [token('ink'), token('paper')],
      [token('ink-2'), token('paper')],
      [token('ink-2'), token('sky-from')],
      [white, token('primary')],
      [token('primary-deep'), token('primary-soft')],
      [token('good-deep'), token('good-soft')],
      [token('oops-deep'), token('oops-soft')],
      [token('star-deep'), token('star-soft')],
      [token('ink'), token('oops')],
      [token('ink'), token('star')],
    ]
    for (const d of DOMAINS) {
      pairs.push([token(`d-${d.id}-deep`), white], [token(`d-${d.id}-deep`), token(`d-${d.id}-soft`)], [token(`d-${d.id}-deep`), token('paper')])
    }
    for (const [fg, bg] of pairs) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    // White glyphs on the filled "good" button are large and bold: 3:1 (WCAG non-text/large).
    expect(contrast(white, token('good-strong'))).toBeGreaterThanOrEqual(3)
  })

  it('never makes red an error colour', () => {
    expect(token('oops')).toBe('#FFB020')
    expect(tokens).not.toMatch(/--color-(error|danger|wrong)/)
  })

  it('ships the latin Nunito subset within the 80 KB budget', () => {
    const font = path.join(HERE, 'fonts', 'nunito-latin-wght-normal.woff2')
    expect(statSync(font).size).toBeLessThanOrEqual(80 * 1024)
    expect(tokens).toContain("url('./fonts/nunito-latin-wght-normal.woff2')")
  })
})

describe('icons', () => {
  const REQUIRED = [
    'ear', 'hand', 'bulb', 'check', 'close', 'back', 'next', 'home', 'map', 'paw', 'shirt', 'shop', 'books', 'star', 'pearl', 'egg',
    'heart', 'lock', 'parent', 'gear', 'print', 'share', 'download', 'upload', 'trash', 'plus', 'minus', 'times', 'divide',
    'equals', 'less', 'greater', 'clock', 'coin', 'ruler', 'scale', 'shapes', 'numberline', 'pause', 'play', 'soundOn',
    'soundOff', 'retry', 'flag', 'gift', 'chest', 'hut', 'bridge', 'plank', 'trophy', 'medal', 'calendar', 'stamp', 'backspace',
  ]

  it('has about fifty own icons including every required one', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(50)
    for (const n of REQUIRED) expect(ICON_NAMES, n).toContain(n)
  })

  it('draws only well-formed paths inside the 24 grid', () => {
    for (const name of ICON_NAMES) {
      const def: IconDef = ICONS[name]
      const all = [...def.stroke, ...(def.fill ?? []), ...(def.solid ?? [])]
      expect(all.length, name).toBeGreaterThan(0)
      for (const d of all) {
        expect(d, name).toMatch(/^M[-\d\s.,MmLlHhVvCcSsQqTtAaZz]+$/)
        // Absolute coordinates stay on the canvas.
        for (const m of d.matchAll(/[ML](-?[\d.]+)[ ,](-?[\d.]+)/g)) {
          expect(Number(m[1]), `${name} x`).toBeGreaterThanOrEqual(0)
          expect(Number(m[1]), `${name} x`).toBeLessThanOrEqual(24)
          expect(Number(m[2]), `${name} y`).toBeGreaterThanOrEqual(0)
          expect(Number(m[2]), `${name} y`).toBeLessThanOrEqual(24)
        }
      }
    }
  })

  it('draws times as a dot and divide as a colon', () => {
    expect(ICONS.times.stroke).toEqual([])
    expect(ICONS.times.solid).toHaveLength(1)
    expect(ICONS.divide.solid).toHaveLength(2)
  })
})

describe('components', () => {
  it('SpokenText shows the catalogue text of its clip', () => {
    expect(hasClip('s.ui.replay')).toBe(true)
    const html = renderToStaticMarkup(<SpokenText clip="s.ui.replay" />)
    expect(html).toContain('Hør igen')
    expect(renderToStaticMarkup(<SpokenText parts={[{ num: 7, form: 'end' }]} text="7" />)).toContain('>7<')
  })

  it('names every button and dock item from the clip catalogue', () => {
    const html = renderToStaticMarkup(
      <>
        <Button clip="s.ui.play" icon="play" />
        <IconButton icon="ear" clip="s.ui.replay" />
        <TopBar leading="close" onReplay={() => {}} onAdult={() => {}} />
        <Dock active="map" onSelect={() => {}} />
        <Meter kind="egg" value={0.5} />
        <Meter kind="wish" value={0.5} />
        <Meter kind="heart" value={0.5} />
      </>,
    )
    const clips = [...html.matchAll(/data-clip="([^"]+)"/g)].map((m) => m[1])
    for (const c of clips) expect(hasClip(c), c).toBe(true)
    for (const label of [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1])) {
      expect(label, 'aria-label is a clip text, not an id').not.toMatch(/^s\.ui\./)
    }
    expect(DOCK_IDS).toEqual(['map', 'animals', 'wardrobe', 'shop', 'books'])
    for (const t of ['Kort', 'Dyr', 'Garderobe', 'Butik', 'Bøger']) expect(html).toContain(t)
    expect(clipText('s.ui.dock.books')).toBe('Bøger')
  })

  it('renders answer cards in every state and the equation in house notation', () => {
    for (const state of ['idle', 'selected', 'correct', 'wrong', 'target', 'dim'] as const) {
      const html = renderToStaticMarkup(<AnswerCard state={state}>13</AnswerCard>)
      expect(html).toContain(`is-${state}`)
      if (state === 'wrong') expect(html).toContain('aria-disabled="true"')
    }
    const eq = renderToStaticMarkup(<Equation terms={[{ n: 7 }, { op: '·' }, { n: 3 }, { op: '−' }, { n: -2 }, { op: ':' }, { blank: true }]} />)
    expect(eq).toContain('·')
    expect(eq).toContain('−2')
    expect(eq).not.toMatch(/[×÷]/)
  })

  it('shows the stone path without any numbers', () => {
    const html = renderToStaticMarkup(<ProgressStones total={10} done={4} glow label="Turen" />)
    expect(html.replace(/<[^>]+>/g, '')).toBe('')
    expect(html).not.toMatch(/NaN/)
  })
})

describe('motion and colour rules in the design CSS', () => {
  const css = ['design.css', 'tokens.css', '../shell/shell.css'].map((f) => readFileSync(path.join(HERE, f), 'utf8')).join('\n')

  it('animates and transitions only transform and opacity', () => {
    const frames = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1])
    expect(frames.length).toBeGreaterThan(2)
    for (const f of frames) {
      const props = [...f.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.filter((p) => p !== 'transform' && p !== 'opacity')).toEqual([])
    }
    for (const m of css.matchAll(/transition:\s*([^;]+);/g)) {
      const value = m[1].trim()
      if (value === 'none !important') continue
      expect(value, m[0]).toMatch(/^(transform|opacity)\b/)
    }
  })

  it('keeps raw hex colours in tokens.css only', () => {
    const files = readdirSync(HERE).filter((f) => /\.(tsx?|css)$/.test(f) && f !== 'tokens.css' && !f.endsWith('.test.tsx'))
    const shell = readdirSync(path.join(HERE, '../shell')).map((f) => `../shell/${f}`)
    for (const f of [...files, ...shell]) {
      const text = readFileSync(path.join(HERE, f), 'utf8')
      expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], f).toEqual([])
    }
  })

  it('turns loops off in calm mode and with reduced motion', () => {
    expect(css).toMatch(/:root\[data-calm\][^{]*\.tv-pulse/)
    expect(css).toMatch(/prefers-reduced-motion: reduce/)
  })
})
