import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Namespace scan (SPEC §9.2 "Navnerum", §13.2, §15.1 "Scans"). The origin is shared with about ten
 * other apps, so the source may never clear shared storage, register a service worker, use caches,
 * notifications or push, touch another database, write cookies, use a storage key without the
 * `talvennerne2.` prefix, use the `tv2:` prefix, or name V1's save key. It reads every file under
 * src/ plus the HTML entry points. This file is exempt: it has to spell the patterns out.
 */

const APP = fileURLToPath(new URL('../../', import.meta.url))
const SELF = ['src', 'data', 'namespace.scan.test.ts'].join('/')
/** The one module allowed to reach Web Storage with computed keys (it enforces the prefix itself). */
const STORAGE_MODULE = 'src/data/namespace.ts'
/** The one module allowed to construct Dexie. */
const DB_MODULE = 'src/data/db.ts'

interface Violation {
  file: string
  line: number
  rule: string
  text: string
}

// Plain grep rules (comments included, like the grep in the spec).
const V1_KEY = ['talvennerne', 'save'].join('.')
const RAW_RULES: { rule: string; re: RegExp }[] = [
  { rule: 'localStorage.clear', re: /localStorage\s*\??\.\s*clear\b/g },
  { rule: 'sessionStorage.clear', re: /sessionStorage\s*\??\.\s*clear\b/g },
  { rule: 'caches.', re: /\bcaches\s*\??\./g },
  { rule: 'serviceWorker.register', re: /serviceWorker\s*\??\.\s*register\b/g },
  { rule: 'Notification', re: /\bNotification\b/g },
  { rule: 'PushManager', re: /\bPushManager\b/g },
  { rule: 'tv2:', re: /tv2:/g },
  { rule: V1_KEY, re: new RegExp(V1_KEY.replace('.', '\\.'), 'g') },
  { rule: 'document.cookie', re: /document\s*\??\.\s*cookie\b/g },
  { rule: 'indexedDB.databases', re: /indexedDB\s*\??\.\s*databases\s*\(/g },
  { rule: 'getDatabaseNames', re: /\bgetDatabaseNames\s*\(/g },
]

const OWN_DB_ARG = /^\s*(DB_NAME|(['"`])talvennerne2\2)\s*$/

/** Calls whose first argument must name our own database. */
const DB_NAME_RULES: { rule: string; re: RegExp; only?: string }[] = [
  { rule: 'indexedDB.deleteDatabase med andet navn', re: /indexedDB\s*\??\.\s*deleteDatabase\s*\(([^),]*)/g },
  { rule: 'indexedDB.open med andet navn', re: /indexedDB\s*\??\.\s*open\s*\(([^),]*)/g },
  { rule: 'Dexie.delete med andet navn', re: /\bDexie\s*\.\s*delete\s*\(([^),]*)/g },
  { rule: 'new Dexie uden for src/data/db.ts', re: /\bnew\s+Dexie\s*\(([^),]*)/g, only: DB_MODULE },
]

function lineOf(text: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

/** Blank out comments, keeping line numbers ("//" only after whitespace or punctuation, not in URLs). */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[\s;{}(),=])\/\/[^\n]*/gm, '$1')
}

export function scanText(file: string, text: string): Violation[] {
  const out: Violation[] = []
  const hit = (rule: string, index: number, snippet: string) =>
    out.push({ file, line: lineOf(text, index), rule, text: snippet.trim().slice(0, 120) })

  for (const { rule, re } of RAW_RULES) for (const m of text.matchAll(re)) hit(rule, m.index, m[0])

  for (const { rule, re, only } of DB_NAME_RULES) {
    for (const m of text.matchAll(re)) {
      if (only && file === only && OWN_DB_ARG.test(m[1])) continue
      if (!only && OWN_DB_ARG.test(m[1])) continue
      hit(rule, m.index, m[0])
    }
  }

  // storage keys: every use of localStorage/sessionStorage in code must name a talvennerne2.* key
  const code = stripComments(text)
  for (const m of code.matchAll(/\b(localStorage|sessionStorage)\b/g)) {
    const after = code.slice(m.index + m[0].length, m.index + m[0].length + 200)
    const call = /^\s*\??\.\s*(getItem|setItem|removeItem)\s*\(\s*(?:(['"`])([^'"`]*)\2)?/.exec(after)
    if (call) {
      if (call[3] !== undefined) {
        if (!call[3].startsWith('talvennerne2.')) hit('storage-nøgle uden præfikset talvennerne2.', m.index, m[0] + after.slice(0, 60))
      } else if (file !== STORAGE_MODULE) {
        hit('storage-nøgle der ikke kan kontrolleres (brug src/data/namespace.ts)', m.index, m[0] + after.slice(0, 60))
      }
      continue
    }
    if (/^\s*\??\.\s*length\b/.test(after)) continue
    if (/^\s*(\??\.\s*[A-Za-z_$]|\?\.\s*\[|\[)/.test(after) && file !== STORAGE_MODULE) {
      hit('storage-adgang uden om navnerummet (brug src/data/namespace.ts)', m.index, m[0] + after.slice(0, 60))
    }
  }
  return out
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

describe('namespace scan', () => {
  it('finds no forbidden storage, cache, worker, notification or foreign-key use in src/', () => {
    const files = [
      ...walk(join(APP, 'src')),
      ...readdirSync(APP).filter((f) => f.endsWith('.html')).map((f) => join(APP, f)),
    ]
    expect(files.length).toBeGreaterThan(10)
    const violations: Violation[] = []
    for (const full of files) {
      const file = relative(APP, full).split(sep).join('/')
      if (file === SELF) continue
      if (statSync(full).size > 4_000_000) continue
      violations.push(...scanText(file, readFileSync(full, 'utf8')))
    }
    expect(violations.map((v) => `${v.file}:${v.line} [${v.rule}] ${v.text}`)).toEqual([])
  })

  it('catches what it is meant to catch', () => {
    const bad = [
      `localStorage.clear()`,
      `window.sessionStorage.clear()`,
      `await caches.open('x')`,
      `navigator.serviceWorker.register('/sw.js')`,
      `new Notification('hej')`,
      `reg.pushManager instanceof PushManager`,
      `localStorage.setItem('tv2:boot', '1')`,
      `localStorage.getItem('${V1_KEY}')`,
      `document.cookie = 'a=1'`,
      `indexedDB.deleteDatabase('kuglebanen')`,
      `indexedDB.open("elpriser", 1)`,
      `await indexedDB.databases()`,
      `Dexie.delete('vm')`,
      `const other = new Dexie('traeningslog')`,
      `localStorage.setItem('boot', '1')`,
      `sessionStorage.getItem("hint-seen")`,
      `localStorage.removeItem(\`lyt-flags\`)`,
      `localStorage.getItem(key)`,
      `localStorage['talvennerne2.boot'] = '1'`,
      `localStorage.boot = '1'`,
      `globalThis.localStorage?.setItem('x', '1')`,
      `const k = localStorage.key(0)`,
    ]
    for (const snippet of bad) expect(scanText('src/x.ts', snippet).length, snippet).toBeGreaterThan(0)
  })

  it('lets the allowed forms through', () => {
    const good = [
      `localStorage.getItem('talvennerne2.boot')`,
      `sessionStorage.setItem("talvennerne2.hint-seen", '1')`,
      `window.localStorage.removeItem(\`talvennerne2.lyt-flags\`)`,
      `if (localStorage.length > 0) {}`,
      `type K = 'localStorage' | 'sessionStorage'`,
      `indexedDB.deleteDatabase('talvennerne2')`,
      `indexedDB.deleteDatabase(DB_NAME)`,
      `// see https://example.org/localStorage.html`,
      `const n = notifications.length`,
    ]
    for (const snippet of good) expect(scanText('src/x.ts', snippet), snippet).toEqual([])
    expect(scanText('src/data/db.ts', `const db = new Dexie(DB_NAME, {})`)).toEqual([])
    expect(scanText('src/data/namespace.ts', `store(kind)?.getItem(key); localStorage.getItem(key)`)).toEqual([])
  })
})
