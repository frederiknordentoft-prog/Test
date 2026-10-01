#!/usr/bin/env node
// Packs the FLAC masters into MP3 sprites and writes the manifest the runtime reads (SPEC §10.3,
// docs/voice-manifest.md).
//
//   node scripts/voice/pack.mjs            → src/assets/voice/<sprite>-<hash>.mp3, voice-manifest.json,
//                                            voice-qa.json (ASR text, CER and LUFS for lyt.html)
//   node scripts/voice/pack.mjs --dry-run  → budgets only, nothing written
//
// One sprite per pack (catalogue `pack`), split into `<pack>.1`, `<pack>.2` … when longer than 60 s.
// Clips are laid out in id order with 120 ms of silence between them (100 ms before the first) and
// encoded with ffmpeg-static: -c:a libmp3lame -b:a 40k -ar 24000 -ac 1. A clip's [start, dur] is its
// master's span on the unencoded timeline, lead and tail included; the runtime absorbs the MP3 delay.
// Only masters whose hash matches voice/inventory.json are packed. Budgets (SPEC §10.3) fail the
// script before anything is written: preloaded sprites (n0-20, core, ui) ≤ 1.2 MB together, every
// sprite ≤ 300 KB, all sprites ≤ 16 MB.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const MASTERS = path.join(ROOT, process.env.TV2_VOICE_MASTERS ?? 'voice/masters')
const OUT = path.join(ROOT, process.env.TV2_VOICE_ASSETS ?? 'src/assets/voice')
const SR = 24000
const LEAD_PAD_MS = 100
const GAP_MS = 120
const TAIL_PAD_MS = 200
const MAX_SPRITE_MS = 60_000
const KB = 1024
export const BUDGET = { sprite: 300 * KB, pinned: 1.2 * KB * KB, total: 16 * KB * KB }
export const PINNED = new Set(['n0-20', 'core', 'ui'])

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

function decode(file) {
  const buf = execFileSync(ffmpegPath, ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], {
    maxBuffer: 64 * 1024 * 1024,
  })
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice()
}

function encode(samples) {
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  return execFileSync(
    ffmpegPath,
    ['-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0', '-map_metadata', '-1',
      '-c:a', 'libmp3lame', '-b:a', '40k', '-ar', String(SR), '-ac', '1', '-f', 'mp3', 'pipe:1'],
    { input: pcm, maxBuffer: 64 * 1024 * 1024 },
  )
}

const ms = (samples) => (samples * 1000) / SR
const samplesOf = (msValue) => Math.round((msValue * SR) / 1000)

/** Splits a pack's clips (in order) into sprites of at most 60 s. */
export function layout(pack, clips) {
  const sprites = []
  let cur = null
  for (const c of clips) {
    const need = samplesOf(GAP_MS) + c.samples
    if (!cur || (cur.length + need + samplesOf(TAIL_PAD_MS) > samplesOf(MAX_SPRITE_MS) && cur.clips.length > 0)) {
      cur = { clips: [], length: samplesOf(LEAD_PAD_MS) - samplesOf(GAP_MS) }
      sprites.push(cur)
    }
    cur.clips.push(c)
    cur.length += need
  }
  return sprites.map((s, i) => ({ id: sprites.length > 1 ? `${pack}.${i + 1}` : pack, clips: s.clips }))
}

export function main(args) {
  const dryRun = args.includes('--dry-run')
  const inv = readJson(path.join(ROOT, 'voice/inventory.json'))
  const index = readJson(path.join(MASTERS, 'index.json'))
  const config = readJson(path.join(ROOT, 'voice/config.json'))
  const packs = new Map()
  let stale = 0
  for (const c of inv.clips) {
    const e = index.clips[c.id]
    if (!e || !e.file) continue
    if (e.hash !== c.hash) {
      stale++
      continue
    }
    if (!packs.has(c.pack)) packs.set(c.pack, [])
    packs.get(c.pack).push({ id: c.id, file: path.join(MASTERS, e.file), entry: e })
  }

  const manifest = { version: 1, voice: config.voice, sampleRate: SR, leadMs: 20, tailMs: 40, sprites: {} }
  const files = new Map()
  const errors = []
  let total = 0
  let pinned = 0
  for (const pack of [...packs.keys()].sort()) {
    const clips = packs.get(pack).sort((a, b) => (a.id < b.id ? -1 : 1))
    for (const c of clips) {
      c.audio = decode(c.file)
      c.samples = c.audio.length
    }
    for (const sprite of layout(pack, clips)) {
      let length = samplesOf(LEAD_PAD_MS)
      const spans = {}
      for (const [i, c] of sprite.clips.entries()) {
        if (i > 0) length += samplesOf(GAP_MS)
        spans[c.id] = [length, c.samples]
        length += c.samples
      }
      length += samplesOf(TAIL_PAD_MS)
      const pcm = new Float32Array(length)
      for (const c of sprite.clips) pcm.set(c.audio, spans[c.id][0])
      const mp3 = encode(pcm)
      const hash = createHash('sha1').update(mp3).digest('hex').slice(0, 8)
      const file = `${sprite.id}-${hash}.mp3`
      const isPinned = PINNED.has(pack)
      manifest.sprites[sprite.id] = {
        file,
        bytes: mp3.length,
        durationMs: Math.round(ms(length) * 100) / 100,
        pinned: isPinned,
        clips: Object.fromEntries(
          Object.entries(spans).map(([id, [s, n]]) => [id, [Math.round(ms(s) * 100) / 100, Math.round(ms(n) * 100) / 100]]),
        ),
      }
      files.set(file, mp3)
      total += mp3.length
      if (isPinned) pinned += mp3.length
      if (mp3.length > BUDGET.sprite) errors.push(`sprite ${sprite.id} er ${(mp3.length / KB).toFixed(1)} KB (> 300 KB)`)
      console.log(`${isPinned ? 'P' : ' '} ${sprite.id.padEnd(14)} ${String(sprite.clips.length).padStart(4)} klip ${(ms(length) / 1000).toFixed(1).padStart(5)} s ${(mp3.length / KB).toFixed(1).padStart(7)} KB  ${file}`)
    }
  }
  if (pinned > BUDGET.pinned) errors.push(`fast indlæste sprites fylder ${(pinned / KB / KB).toFixed(2)} MB (> 1,2 MB)`)
  if (total > BUDGET.total) errors.push(`alle sprites fylder ${(total / KB / KB).toFixed(2)} MB (> 16 MB)`)
  const clipCount = Object.values(manifest.sprites).reduce((n, s) => n + Object.keys(s.clips).length, 0)
  console.log(`pakning: ${clipCount} klip i ${files.size} sprites, ${(total / KB / KB).toFixed(2)} MB i alt, fast indlæst ${(pinned / KB).toFixed(1)} KB${stale ? `, ${stale} forældede mastere udeladt` : ''}`)
  if (errors.length) {
    for (const e of errors) console.error(`budget: ${e}`)
    return 1
  }
  if (dryRun) return 0

  mkdirSync(OUT, { recursive: true })
  for (const name of readdirSync(OUT)) if (name.endsWith('.mp3') && !files.has(name)) rmSync(path.join(OUT, name))
  for (const [name, bytes] of files) writeFileSync(path.join(OUT, name), bytes)
  writeFileSync(path.join(OUT, 'voice-manifest.json'), JSON.stringify(manifest) + '\n')
  // What the listening page shows next to every clip (not part of the runtime manifest).
  const qa = {}
  for (const list of packs.values()) {
    for (const c of list) {
      const e = c.entry
      qa[c.id] = { asr: e.asr ?? null, expected: e.asrExpected ?? null, cer: e.cer ?? null, lufs: e.lufs ?? null, dur: e.dur ?? null,
        take: e.take ?? 0, takes: e.takes ?? 1, pass: !!e.pass, check: e.check ?? null, method: e.method ?? null, engine: e.engine ?? null }
    }
  }
  writeFileSync(path.join(OUT, 'voice-qa.json'), JSON.stringify({ voice: config.voice, clips: qa }) + '\n')
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}
