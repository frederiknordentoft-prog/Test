// Composition test (SPEC §10.4): renders spoken statements from the FLAC masters with the runtime's
// own sequence code (compile() → findBounds → planSequence → renderSequence, exactly as voice.ts
// plays them) and has them checked by ASR (scripts/tts/qa_asr.py).
//
//   node scripts/voice/run-vite.mjs scripts/voice/render.ts [--templates 30] [--no-asr] [--no-whisper]
//
//   numbers    all 899 numbers 101–999 in end form; ASR + da_numbers.py must give n back (100 %)
//   templates  30 random statements per skill (fact and kind, seeded) whose clips all have masters;
//              ASR must match toDanishText() word for word (≥ 97 %)
//
// Only statements whose clips all have an up-to-date master are rendered, so a wave-1 run reports
// how many numbers it could build (the hundreds arrive in wave 2). Results: voice/qa.json, with the
// clips the failures point at under "retake" (generate.py --retake-from voice/qa.json).
// WAV renders and ASR output stay outside git in voice/probe/takes/qa/.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import { findBounds, planSequence, renderSequence } from '../../src/audio/sequence'
import { factsOf, registeredSkills } from '../../src/engine/registry'
import { hashSeed, makeRng } from '../../src/engine/rng'
import type { SpeechPart } from '../../src/engine/types'
import { allClips, clipText } from '../../src/speech/catalog'
import { compile } from '../../src/speech/compile'
import { APP_ROOT, buildInventory, ensureCatalog, readConfig } from './inventory'

export const SR = 24000
const MASTERS = path.resolve(APP_ROOT, process.env.TV2_VOICE_MASTERS ?? 'voice/masters')
const QA_DIR = path.resolve(APP_ROOT, process.env.TV2_VOICE_QA ?? 'voice/probe/takes/qa')
const QA_JSON = path.resolve(APP_ROOT, process.env.TV2_VOICE_QA_JSON ?? 'voice/qa.json')
const ASR_PY = process.env.TV2_ASR_PYTHON ?? '/opt/tv2-asr/bin/python'

export interface MasterEntry {
  file: string | null
  hash: string
  pass: boolean
  dur?: number
  lufs?: number
  cer?: number | null
  takes?: number
  cpuS?: number
  wallS?: number
  method?: string
  check?: string
  reason?: string
}

export interface Item {
  key: string
  kind: 'number' | 'template'
  n?: number
  skill?: string
  expected: string
  clips: string[]
  gapsMs: number[]
  parts: [string, string][]
}

/** Up-to-date masters: index entries whose hash is the clip's current inventory hash. */
export function availableMasters(): Map<string, string> {
  const { config, sha1 } = readConfig()
  const inv = buildInventory(allClips(), config, sha1)
  const index = JSON.parse(readFileSync(path.join(MASTERS, 'index.json'), 'utf8')) as { clips: Record<string, MasterEntry> }
  const out = new Map<string, string>()
  for (const c of inv.clips) {
    const e = index.clips[c.id]
    if (e && e.file && e.hash === c.hash) out.set(c.id, path.join(MASTERS, e.file))
  }
  return out
}

/** A FLAC master as 24 kHz mono float samples (ffmpeg-static). */
export function decodeFlac(file: string): Float32Array {
  const buf = execFileSync(ffmpegPath as unknown as string, ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], {
    maxBuffer: 256 * 1024 * 1024,
  })
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice()
}

/** Renders clip ids with the runtime's planning, from standalone clip buffers (lead 20, tail 40). */
export function renderClips(ids: readonly string[], gapsMs: readonly number[], source: (id: string) => Float32Array): Float32Array {
  const bounds = ids.map((id) => {
    const s = source(id)
    return findBounds(s, SR, 0, (s.length * 1000) / SR, { leadMs: 20, tailMs: 40 })
  })
  const plan = planSequence(ids, bounds, gapsMs)
  return renderSequence(plan, source, SR)
}

export function wavBytes(samples: Float32Array, sr = SR): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2)
  }
  return buf
}

function itemFor(key: string, kind: Item['kind'], parts: SpeechPart[], extra: Partial<Item> = {}): Item | null {
  const c = compile(parts)
  if (c.missing.length > 0 || c.utterances.some((u) => u.kind === 'free') || c.clips.length === 0) return null
  return { key, kind, expected: c.text, clips: c.clips, gapsMs: c.gapsMs, parts: c.clips.map((id) => [id, clipText(id)]), ...extra }
}

/** The 899 numbers 101–999 in end form. */
export function numberItems(): Item[] {
  const out: Item[] = []
  for (let n = 101; n <= 999; n++) out.push(itemFor(`n${n}`, 'number', [{ num: n, form: 'end' }], { n })!)
  return out
}

/** Every distinct statement a skill can say (every fact in every kind), whose clips pass `has`. */
export function skillStatements(has: (id: string) => boolean): Map<string, Item[]> {
  const out = new Map<string, Item[]>()
  for (const def of registeredSkills()) {
    const seen = new Set<string>()
    const list: Item[] = []
    for (const fact of factsOf(def)) {
      for (const kind of def.kinds) {
        const item = itemFor(`${def.id}|${fact.id}|${kind}`, 'template', def.speech(fact, kind), { skill: def.id })
        if (!item || !item.clips.every(has)) continue
        const sig = item.clips.join(' ')
        if (seen.has(sig)) continue
        seen.add(sig)
        list.push(item)
      }
    }
    out.set(def.id, list)
  }
  return out
}

interface AsrRow {
  key: string
  kind: string
  asr: string
  asr_w2v: string
  asr_whisper?: string
  cer: number
  ok: boolean
  ok_w2v: boolean
  verbatim: boolean
  engine: string
  nums: number[]
  blamed?: string[]
}

const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0)

export async function main(args: string[]): Promise<number> {
  const opt = (name: string, dflt: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : dflt
  }
  await ensureCatalog()
  const perSkill = Number(opt('--templates', '30'))
  const noAsr = args.includes('--no-asr')
  const masters = availableMasters()
  const cache = new Map<string, Float32Array>()
  const source = (id: string) => {
    let s = cache.get(id)
    if (!s) cache.set(id, (s = decodeFlac(masters.get(id)!)))
    return s
  }
  const has = (id: string) => masters.has(id)

  const allNumbers = numberItems()
  const numbers = allNumbers.filter((it) => it.clips.every(has))
  const statements = skillStatements(has)
  const templates: Item[] = []
  const skillRows: Record<string, { statements: number; sampled: number }> = {}
  for (const [skill, list] of statements) {
    const sample = makeRng(hashSeed(`qa:${skill}`)).shuffle(list).slice(0, perSkill)
    skillRows[skill] = { statements: list.length, sampled: sample.length }
    templates.push(...sample)
  }

  rmSync(QA_DIR, { recursive: true, force: true })
  mkdirSync(path.join(QA_DIR, 'wav'), { recursive: true })
  const meta: string[] = []
  for (const it of [...numbers, ...templates]) {
    const wav = path.join(QA_DIR, 'wav', `${it.key.replace(/[^A-Za-z0-9._-]/g, '_')}.wav`)
    writeFileSync(wav, wavBytes(renderClips(it.clips, it.gapsMs, source)))
    meta.push(JSON.stringify({ key: it.key, kind: it.kind, n: it.n, skill: it.skill, expected: it.expected, parts: it.parts, wav }))
  }
  writeFileSync(path.join(QA_DIR, 'meta.jsonl'), meta.join('\n') + '\n')
  console.log(`render: ${numbers.length}/899 tal og ${templates.length} skabelonsætninger fra ${masters.size} mastere → ${path.relative(APP_ROOT, QA_DIR)}`)
  if (noAsr) return 0

  const asrOut = path.join(QA_DIR, 'asr.jsonl')
  const py = spawnSync('nice', ['-n', '19', ASR_PY, path.join(APP_ROOT, 'scripts/tts/qa_asr.py'), path.join(QA_DIR, 'meta.jsonl'), asrOut,
    ...(args.includes('--no-whisper') ? ['--no-whisper'] : [])], { stdio: 'inherit' })
  if (py.status !== 0 || !existsSync(asrOut)) {
    console.error('render: qa_asr.py fejlede')
    return 1
  }
  const rows = new Map<string, AsrRow>()
  for (const line of readFileSync(asrOut, 'utf8').split('\n')) if (line.trim()) {
    const r = JSON.parse(line) as AsrRow
    rows.set(r.key, r)
  }
  return writeQa(numbers, templates, skillRows, rows, masters)
}

function writeQa(
  numbers: Item[],
  templates: Item[],
  skillRows: Record<string, { statements: number; sampled: number }>,
  rows: Map<string, AsrRow>,
  masters: Map<string, string>,
): number {
  const retake = new Set<string>()
  const failure = (it: Item) => {
    const r = rows.get(it.key)!
    for (const id of r.blamed ?? []) retake.add(id)
    return { key: it.key, n: it.n, skill: it.skill, expected: it.expected, asr: r.asr_w2v, asrWhisper: r.asr_whisper, clips: it.clips, blamed: r.blamed ?? [] }
  }
  const numOk = numbers.filter((it) => rows.get(it.key)?.ok)
  const numW2v = numbers.filter((it) => rows.get(it.key)?.ok_w2v)
  const perSkill: Record<string, object> = {}
  for (const [skill, row] of Object.entries(skillRows)) {
    const items = templates.filter((t) => t.skill === skill)
    const ok = items.filter((t) => rows.get(t.key)?.ok).length
    perSkill[skill] = { ...row, verbatim: ok, verbatimW2v: items.filter((t) => rows.get(t.key)?.ok_w2v).length, rate: pct(ok, items.length) }
  }
  const tplOk = templates.filter((t) => rows.get(t.key)?.ok)
  const index = JSON.parse(readFileSync(path.join(MASTERS, 'index.json'), 'utf8')) as { clips: Record<string, MasterEntry> }
  const entries = [...masters.keys()].map((id) => [id, index.clips[id]] as const)
  const lufs = entries.map(([, e]) => e.lufs ?? 0)
  const cers = entries.map(([, e]) => e.cer).filter((c): c is number => typeof c === 'number')
  const qa = {
    version: 1,
    generated: new Date().toISOString(),
    clips: {
      masters: entries.length,
      pass: entries.filter(([, e]) => e.pass).length,
      notPassed: entries.filter(([, e]) => !e.pass).map(([id, e]) => ({ id, reason: e.reason ?? '' })),
      cerMean: cers.length ? Math.round((10000 * cers.reduce((a, b) => a + b, 0)) / cers.length) / 10000 : null,
      lufsMin: Math.min(...lufs),
      lufsMax: Math.max(...lufs),
      seconds: Math.round(entries.reduce((s, [, e]) => s + (e.dur ?? 0), 0) * 10) / 10,
      takes: entries.reduce((s, [, e]) => s + (e.takes ?? 1), 0),
      generationHours: Math.round((entries.reduce((s, [, e]) => s + (e.wallS ?? 0), 0) / 3600) * 100) / 100,
    },
    numbers: {
      range: [101, 999],
      total: 899,
      rendered: numbers.length,
      correct: numOk.length,
      correctWav2vec2: numW2v.length,
      rate: pct(numOk.length, numbers.length),
      failures: numbers.filter((it) => !rows.get(it.key)?.ok).map(failure),
    },
    templates: {
      perSkill,
      rendered: templates.length,
      verbatim: tplOk.length,
      verbatimWav2vec2: templates.filter((t) => rows.get(t.key)?.ok_w2v).length,
      rate: pct(tplOk.length, templates.length),
      failures: templates.filter((t) => !rows.get(t.key)?.ok).map(failure),
    },
    gates: {
      numbersAllCorrect: numOk.length === numbers.length,
      numbersComplete: numbers.length === 899,
      templates97: templates.length > 0 && tplOk.length / templates.length >= 0.97,
    },
    retake: [...retake].filter((id) => masters.has(id)).sort(),
  }
  writeFileSync(QA_JSON, JSON.stringify(qa, null, 1) + '\n')
  console.log(`tal: ${numOk.length}/${numbers.length} rigtige (${qa.numbers.rate} %; wav2vec2 alene ${numW2v.length}), ${numbers.length}/899 kunne bygges`)
  console.log(`skabeloner: ${tplOk.length}/${templates.length} ordret (${qa.templates.rate} %)`)
  for (const [skill, row] of Object.entries(perSkill)) console.log(`  ${skill.padEnd(14)} ${JSON.stringify(row)}`)
  if (qa.retake.length) console.log(`peger på: ${qa.retake.join(', ')}`)
  const ok = qa.gates.numbersAllCorrect && (templates.length === 0 || qa.gates.templates97)
  return ok ? 0 : 2
}
