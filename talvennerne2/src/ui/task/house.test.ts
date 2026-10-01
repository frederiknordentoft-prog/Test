// House rules for the round's own folders (task kinds, prompt scenes, hints, the round screen):
// colours come from the palette and tokens, animations move only transform and opacity, every
// word on screen can be read aloud, and every fixed clip the code names is in the catalogue.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasClip } from '../../speech/catalog'

const SRC = fileURLToPath(new URL('../../', import.meta.url))
const OWN = ['ui/task', 'ui/scenes', 'ui/hint', 'ui/screens/child/round', 'ui/screens/child/RoundScreen.tsx']

function walk(p: string): string[] {
  return statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => walk(path.join(p, n))) : [p]
}

const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1')

const FILES = OWN.flatMap((o) => walk(path.join(SRC, o)))
  .filter((p) => /\.(ts|tsx|css)$/.test(p) && !/\.test\.tsx?$/.test(p))
  .map((p) => ({ file: path.relative(SRC, p), code: stripComments(readFileSync(p, 'utf8')) }))

describe('the round’s folders', () => {
  it('take every colour from the palette or the design tokens', () => {
    const hex = /#[0-9a-fA-F]{3,8}\b/
    const bad = FILES.flatMap(({ file, code }) =>
      code.split('\n').flatMap((line, i) => (hex.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    )
    expect(bad).toEqual([])
  })

  it('animate only transform and opacity', () => {
    const bad: string[] = []
    for (const { file, code } of FILES.filter((f) => f.file.endsWith('.css'))) {
      for (const m of code.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
        let depth = 1
        let i = m.index! + m[0].length
        const start = i
        while (depth > 0 && i < code.length) {
          if (code[i] === '{') depth++
          else if (code[i] === '}') depth--
          i++
        }
        const body = code.slice(start, i - 1)
        for (const p of body.matchAll(/([a-z-]+)\s*:/g)) {
          if (!['transform', 'opacity', 'animation-timing-function'].includes(p[1])) bad.push(`${file}: @keyframes ${m[1]} → ${p[1]}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('show no raw text — scenes and hints included', () => {
    const jsxText = /<([A-Za-z][\w.]*)(?:\s[^<>]*)?>([^<>{}]*[A-Za-zÆØÅæøå]{2,}[^<>{}]*)<\//g
    const raw = FILES.filter((f) => f.file.endsWith('.tsx')).flatMap(({ file, code }) =>
      [...code.matchAll(jsxText)].map((m) => `${file}: <${m[1]}>${m[2].trim().slice(0, 60)}`),
    )
    expect(raw).toEqual([])
  })

  it('name only clips that are in the catalogue', () => {
    const id = /['"`]((?:s\.(?:round|kind|ui)|frag|noun\.unit|noun\.shape)\.[\w.]+)['"`]/g
    const missing = new Set<string>()
    let named = 0
    for (const { file, code } of FILES) {
      for (const m of code.matchAll(id)) {
        if (m[1].endsWith('.')) continue
        named++
        if (!hasClip(m[1])) missing.add(`${file}: ${m[1]}`)
      }
    }
    expect([...missing]).toEqual([])
    expect(named).toBeGreaterThan(40)
  })
})
