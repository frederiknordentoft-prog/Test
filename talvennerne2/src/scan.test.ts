// Source scans for the ethical guardrails and house rules (SPEC §13, §15.1 "Scans"). They read the
// source text, so they hold for code that is not covered by any other test. Test files are skipped:
// they legitimately contain the forbidden strings as test data.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const APP = path.resolve(ROOT, '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

/** Comments may discuss the rules ("never Math.random", "no sad mood"); code may not break them. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1')

const SOURCES = walk(ROOT)
  .filter((p) => /\.(ts|tsx|css)$/.test(p))
  .filter((p) => !/\.test\.tsx?$/.test(p))
  .map((p) => {
    const text = readFileSync(p, 'utf8')
    return { file: path.relative(APP, p), text, code: stripComments(text) }
  })

function offenders(re: RegExp, files = SOURCES, where: 'text' | 'code' = 'code'): string[] {
  const out: string[] = []
  for (const s of files) {
    const { file } = s
    s[where].split('\n').forEach((line, i) => {
      if (re.test(line)) out.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`)
      re.lastIndex = 0
    })
  }
  return out
}

describe('house rules', () => {
  it('uses no emoji anywhere in src — the game draws its own icons', () => {
    expect(offenders(/\p{Extended_Pictographic}/u, SOURCES, 'text')).toEqual([])
  })

  it('writes multiplication as · and division as :, never × or ÷', () => {
    expect(offenders(/[×÷]/, SOURCES, 'text')).toEqual([])
  })

  it('never uses Math.random in game logic', () => {
    const logic = SOURCES.filter((s) => /^src\/(engine|meta|content|state|data|parent)\//.test(s.file))
    expect(offenders(/Math\.random\s*\(/, logic)).toEqual([])
  })
})

describe('ethical guardrails (SPEC §13)', () => {
  it('has no sad mood — animals never express guilt, longing or hunger', () => {
    expect(offenders(/['"`]sad['"`]/)).toEqual([])
  })

  it('has no guilt texts', () => {
    expect(offenders(/savner|ked af det|venter på dig|glem ikke|kom tilbage|din ven bliver/i)).toEqual([])
  })

  it('never says "only N more" to push the child on', () => {
    expect(offenders(/\bkun (\d+|\{[^}]*\}|en|et|to|tre|fire|fem) (til|mere)\b/i)).toEqual([])
  })

  it('keeps Date out of prices, goals and the wardrobe — nothing is time-limited', () => {
    const timeless = SOURCES.filter((s) => /^src\/content\/(economy|goals|wardrobe)\.ts$/.test(s.file))
    expect(offenders(/\bDate\b/, timeless)).toEqual([])
  })

  it('shows no raw text on child screens — every word can be read aloud', () => {
    const child = SOURCES.filter((s) => /^src\/ui\/(screens\/child|task)\/.*\.tsx$/.test(s.file))
    const raw: string[] = []
    const jsxText = /<([A-Za-z][\w.]*)(?:\s[^<>]*)?>([^<>{}]*[A-Za-zÆØÅæøå]{2,}[^<>{}]*)<\//g
    for (const { file, text } of child) {
      for (const m of text.matchAll(jsxText)) raw.push(`${file}: <${m[1]}>${m[2].trim().slice(0, 60)}`)
    }
    expect(raw).toEqual([])
  })
})

describe('app identity', () => {
  it('declares its own manifest id so it never replaces another app on the home screen', () => {
    const manifest = JSON.parse(readFileSync(path.join(APP, 'public/manifest.webmanifest'), 'utf8'))
    expect(manifest.id).toBe('/Test/talvennerne2/')
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
  })
})
