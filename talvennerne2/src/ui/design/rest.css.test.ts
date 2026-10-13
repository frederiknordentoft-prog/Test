// Rest in the stylesheets (SPEC A25): every endless animation in the app is accounted for. It is a
// rig loop (rig.css's rest rule), a loop in a world's scene (inside .tv-backdrop, map.css's rest
// rule), an attention cue that keeps moving (REST_CUES), a loop on a screen that never rests, or it
// has a rest twin in its own stylesheet. The rest rules only pause (no delay, no `animation: none`,
// so nothing jumps and every finite animation still ends), sit at the end of their file outside
// @layer, never touch a cue, and the sky's clouds no longer drift.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { REST_CUES } from './restCues'

const APP = path.resolve(import.meta.dirname, '../../..')
const SRC = path.join(APP, 'src')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const rel = (p: string) => path.relative(APP, p).split(path.sep).join('/')
const SOURCES = walk(SRC).filter((p) => !rel(p).startsWith('src/dev/'))

interface Rule {
  selectors: string[]
  decls: [string, string][]
  /** The at-rules around the rule (@layer, @media …). */
  at: string[]
  /** Which top-level block of the file the rule is in. */
  block: number
}

/** Splits a selector list at its top-level commas. */
function splitSelectors(head: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of head) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

/** The style rules of a stylesheet with their declarations (keyframe steps left out). */
function parse(text: string): Rule[] {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const stack: string[] = []
  let buf = ''
  let block = 0
  for (const ch of css) {
    if (ch === '{') {
      stack.push(buf.split(';').pop()!.trim())
      buf = ''
    } else if (ch === '}') {
      const head = stack.pop() ?? ''
      if (!head.startsWith('@') && !stack.some((s) => s.startsWith('@keyframes'))) {
        const decls = buf
          .split(';')
          .map((d) => d.trim())
          .filter((d) => d.includes(':'))
          .map((d): [string, string] => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()])
        rules.push({ selectors: splitSelectors(head), decls, at: [...stack], block })
      }
      buf = ''
      if (stack.length === 0) block++
    } else buf += ch
  }
  return rules
}

const SHEETS = SOURCES.filter((p) => p.endsWith('.css')).map((p) => ({ file: rel(p), rules: parse(readFileSync(p, 'utf8')) }))

const isEndless = (r: Rule) =>
  !r.at.some((a) => a.includes('prefers-reduced-motion')) &&
  r.decls.some(([prop, value]) => (prop === 'animation' || prop === 'animation-iteration-count') && /\binfinite\b/.test(value))

const REST = ':root[data-rest] '
const isRestRule = (r: Rule) => r.selectors.some((s) => s.includes('[data-rest]'))

/** Every endless selector, per stylesheet. */
const ENDLESS = SHEETS.map(({ file, rules }) => ({ file, selectors: [...new Set(rules.filter(isEndless).flatMap((r) => r.selectors))] })).filter((s) => s.selectors.length > 0)

/** The rest twins, per stylesheet (the selector after `:root[data-rest] `). */
const TWINS = new Map(SHEETS.map(({ file, rules }) => [file, rules.filter(isRestRule).flatMap((r) => r.selectors.map((s) => s.slice(REST.length)))]))

const RIG = 'src/art/rig/rig.css'
const MAP = 'src/ui/screens/child/map/map.css'
/** The two blanket twins: every rig part but the blink, and everything in the map's backdrop. */
const RIG_TWIN = ".rig [class*='a-']:not(.a-blink)"
const BACKDROP_TWIN = '.tv-backdrop *'

/** Endless loops on screens that never rest: the ceremonies, onboarding (Pip, the eggs, the hand), the round's intro and the wardrobe. */
const NEVER_REST: Record<string, string[]> = {
  'src/ui/screens/child/ceremony/ceremony.css': ['.tv-cer-thing__rays', '.tv-cer-hatch__glow'],
  'src/ui/screens/child/onboarding/first-start.css': [
    '.tv-pip.is-talking .tv-pip__bird',
    '.tv-say__bubble.is-talking .tv-sound__waves',
    '.tv-eggbtn__egg',
    '.tv-eggs.is-help .tv-eggbtn',
    '.tv-onb__hand',
    '.tv-bigchoice.is-speaking .tv-bigchoice__face',
  ],
  'src/ui/screens/child/play/play.css': ['.tv-play__dots span'],
  'src/ui/screens/child/wardrobe/wardrobe.css': ['.tv-wr-card.is-guide::after', '.tv-wr-hand'],
}

const CUES: ReadonlySet<string> = new Set(REST_CUES)

function classify(file: string, selector: string): string | null {
  if (CUES.has(selector)) return 'cue'
  if (file === RIG && selector.startsWith('.rig') && /\.a-[\w-]+/.test(selector.split(' ').pop()!)) return 'rig'
  const scene = /^src\/art\/scenes\/(\w+)\.css$/.exec(file)
  if (scene && selector.startsWith(`.${scene[1]}-scene `)) return 'backdrop scene'
  if (NEVER_REST[file]?.includes(selector)) return 'never rests'
  if (TWINS.get(file)?.includes(selector)) return 'twin'
  return null
}

describe('rest in the stylesheets (SPEC A25)', () => {
  it('finds the endless loops it accounts for', () => {
    const all = ENDLESS.flatMap((e) => e.selectors)
    expect(all.length).toBeGreaterThan(80)
    expect(ENDLESS.map((e) => e.file)).toEqual(expect.arrayContaining([RIG, MAP, 'src/art/scenes/eng.css', 'src/ui/design/design.css']))
  })

  it('accounts for every endless loop: rig, backdrop scene, cue, a screen that never rests, or a twin in its own file', () => {
    const loose = ENDLESS.flatMap(({ file, selectors }) => selectors.filter((s) => classify(file, s) === null).map((s) => `${file}: ${s}`))
    expect(loose).toEqual([])
  })

  it('pauses only: the rest rules set animation-play-state and nothing else, at the end of the file, outside @layer', () => {
    let count = 0
    for (const { file, rules } of SHEETS) {
      const rest = rules.filter(isRestRule)
      if (rest.length === 0) continue
      for (const r of rest) {
        count++
        expect(r.at, `${file}: ${r.selectors.join(', ')}`).toEqual([])
        for (const s of r.selectors) expect(s.startsWith(REST), `${file}: ${s}`).toBe(true)
        expect(r.decls, `${file}: ${r.selectors.join(', ')}`).toEqual([['animation-play-state', 'paused !important']])
      }
      const first = Math.min(...rest.map((r) => r.block))
      const after = rules.filter((r) => r.block >= first && !isRestRule(r))
      expect(after.map((r) => r.selectors.join(', ')), `${file}: only rest rules after the first one`).toEqual([])
    }
    expect(count).toBe(6)
    const files = [...TWINS].filter(([, t]) => t.length > 0).map(([f]) => f).sort()
    expect(files).toEqual([
      RIG,
      'src/ui/design/design.css',
      'src/ui/screens/child/animals/zoo.css',
      MAP,
      'src/ui/screens/child/round/round.css',
      'src/ui/task/task.css',
    ])
  })

  it('twins only endless loops of its own file, or one of the two blanket rules', () => {
    for (const [file, twins] of TWINS) {
      const endless = ENDLESS.find((e) => e.file === file)?.selectors ?? []
      for (const t of twins) {
        if ((file === RIG && t === RIG_TWIN) || (file === MAP && t === BACKDROP_TWIN)) continue
        expect(endless, `${file}: ${t} is not an endless loop of this file`).toContain(t)
      }
    }
    expect(TWINS.get(RIG)).toEqual([RIG_TWIN])
    expect(TWINS.get(MAP)).toContain(BACKDROP_TWIN)
  })

  it('never twins a cue, and the cues are all real endless loops', () => {
    for (const [file, twins] of TWINS) for (const t of twins) expect(CUES.has(t), `${file}: ${t}`).toBe(false)
    // the rig's blanket leaves the blink running
    expect(RIG_TWIN).toContain(':not(.a-blink)')
    expect(CUES.has('.rig .a-blink')).toBe(true)
    const endless = new Set(ENDLESS.flatMap((e) => e.selectors))
    for (const cue of REST_CUES) expect(endless.has(cue), cue).toBe(true)
    for (const [file, selectors] of Object.entries(NEVER_REST)) {
      const own = ENDLESS.find((e) => e.file === file)?.selectors ?? []
      for (const s of selectors) expect(own, `${file}: ${s}`).toContain(s)
    }
  })

  it('keeps every cue out of the backdrop: only the map draws the scenes, inside .tv-backdrop', () => {
    const backdrop = readFileSync(path.join(SRC, 'ui/screens/child/map/Backdrop.tsx'), 'utf8')
    expect(backdrop).toMatch(/import\.meta\.glob[^(]*\('\.\.\/\.\.\/\.\.\/\.\.\/art\/scenes\/\*\.tsx'\)/)
    expect(backdrop).toMatch(/className=\{cx\('tv-backdrop'/)
    const scenes = SOURCES.filter((p) => /src\/art\/scenes\/\w+\.tsx$/.test(rel(p)))
    expect(scenes.length).toBeGreaterThanOrEqual(4)
    // no other app code imports a scene
    const importers = SOURCES.filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !rel(p).startsWith('src/art/scenes/'))
      .filter((p) => /from '[^']*art\/scenes\/(eng|bakke|skov|fjeld)'/.test(readFileSync(p, 'utf8')))
      .map(rel)
    expect(importers).toEqual([])
    // the scenes draw with shapes only (no rig, no design components), and none of their classes is a cue's
    const classes = [...new Set(REST_CUES.flatMap((c) => c.match(/\.[\w-]+/g) ?? []).map((c) => c.slice(1)))].filter((c) => !c.startsWith('is-'))
    for (const p of [path.join(SRC, 'ui/screens/child/map/Backdrop.tsx'), ...scenes]) {
      const text = readFileSync(p, 'utf8')
      expect(text, rel(p)).not.toMatch(/from '[^']*\/(?:rig\/Rig|design\/(?!cx'))[^']*'/)
      const tokens = new Set(
        [...text.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
          .flatMap((m) => (m[1] !== undefined ? [m[1]] : [...m[2].matchAll(/['"`]([^'"`]*)['"`]/g)].map((q) => q[1])))
          .flatMap((v) => v.split(/\s+/)),
      )
      expect(tokens.size, rel(p)).toBeGreaterThan(2)
      for (const c of classes) expect(tokens.has(c), `${rel(p)} draws the cue ${c}`).toBe(false)
    }
  })

  it('lets only the map, Dyrehaven, "Vælg spiller" and a task waiting for its answer rest', () => {
    const users = SOURCES.filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p))
      .filter((p) => /\buseRestAllowed\(/.test(readFileSync(p, 'utf8')))
      .map(rel)
      .sort()
    expect(users).toEqual([
      'src/ui/design/rest.ts',
      'src/ui/screens/child/AnimalsScreen.tsx',
      'src/ui/screens/child/MapScreen.tsx',
      'src/ui/screens/child/ProfilePickerScreen.tsx',
      'src/ui/screens/child/RoundScreen.tsx',
    ])
    const round = readFileSync(path.join(SRC, 'ui/screens/child/RoundScreen.tsx'), 'utf8')
    expect(round).toContain("useRestAllowed(beat === 'asking' && !paused && !away && demoKind === null)")
  })

  it('lets the sky stand still: its clouds have no animation', () => {
    for (const { file, rules } of SHEETS) {
      for (const r of rules) {
        if (!r.selectors.some((s) => /\.tv-sky__clouds\b|\.tv-drift\b/.test(s))) continue
        for (const [prop, value] of r.decls) {
          if (!prop.startsWith('animation')) continue
          expect(value, `${file}: ${r.selectors.join(', ')}`).toMatch(/^none\b/)
        }
      }
    }
    const shell = SHEETS.find((s) => s.file === 'src/ui/shell/shell.css')!
    const clouds = shell.rules.find((r) => r.selectors.includes('.tv-sky__clouds') && r.at.length === 1)!
    expect(clouds.decls.map(([p]) => p)).not.toContain('animation')
  })
})
