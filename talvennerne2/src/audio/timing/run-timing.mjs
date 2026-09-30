// Timing test for gapless voice sequences in Chromium (SPEC §14 G1: ±5 ms).
//
//   cd talvennerne2 && flock /tmp/tv2-chromium.lock node src/audio/timing/run-timing.mjs
//
// It synthesises a tone sprite (one tone per clip id, with the pipeline's 20 ms lead, 40 ms tail and
// 120 ms between clips), encodes it like the real voice (MP3 40 kbps, 24 kHz, mono, ffmpeg-static),
// starts a Vite dev server on port 4313 and opens src/audio/timing/timing.html in Chromium. The page
// plays a statement through the real voice engine and records the voice bus with an AudioWorklet.
// Every audible onset and every silence must land within ±5 ms of the plan: as WAV, as MP3 (whose
// decoder delay the fine-tuning must absorb), as MP3 under 4× CPU throttle, and as MP3 decoded
// before the live AudioContext exists (the app's preload before the first tap). Exit code 1 on failure.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { createServer } from 'vite'
import { launch } from '../../../scripts/browser.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const PORT = Number(process.env.PORT ?? 4313)
const SR = 24000
const LEAD_MS = 20
const TAIL_MS = 40
const BETWEEN_MS = 120
const TOLERANCE_MS = 5

// "Hvad er otteogtredive plus tre hundrede og syvogfyrre? Find tallet tolv kroner og halvtreds øre."
// covers every silence: phrase 40, after mid-form 120, hundred seam 20, sentence 250, bound noun 30.
const PARTS = [
  { clip: 'frag.hvad_er' },
  { num: 38, form: 'mid' },
  { clip: 'op.plus' },
  { num: 347, form: 'end' },
  { clip: 'frag.find_tallet' },
  { money: { ore: 1250, form: 'end' } },
]
const CLIPS = [
  ['frag.hvad_er', 330, 260],
  ['n.mid.38', 392, 420],
  ['op.plus', 440, 200],
  ['hog.300', 494, 380],
  ['n.end.47', 523, 300],
  ['frag.find_tallet', 587, 340],
  ['n.mid.12', 659, 180],
  ['noun.unit.kroner_og', 698, 280],
  ['n.mid.50', 784, 240],
  ['noun.unit.ore.end', 880, 220],
]

function toneSprite() {
  const clips = {}
  const pieces = []
  let cursorMs = 100
  pieces.push(new Float32Array((cursorMs * SR) / 1000))
  for (const [id, hz, toneMs] of CLIPS) {
    const spanMs = LEAD_MS + toneMs + TAIL_MS
    const span = new Float32Array(Math.round((spanMs * SR) / 1000))
    const from = Math.round((LEAD_MS * SR) / 1000)
    const n = Math.round((toneMs * SR) / 1000)
    const fade = Math.round(0.005 * SR)
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / fade, (n - 1 - i) / fade)
      span[from + i] = 0.5 * env * Math.sin((2 * Math.PI * hz * i) / SR)
    }
    clips[id] = [cursorMs, spanMs]
    pieces.push(span, new Float32Array((BETWEEN_MS * SR) / 1000))
    cursorMs += spanMs + BETWEEN_MS
  }
  const total = pieces.reduce((s, p) => s + p.length, 0)
  const samples = new Float32Array(total)
  let at = 0
  for (const p of pieces) {
    samples.set(p, at)
    at += p.length
  }
  return { samples, clips, durationMs: cursorMs }
}

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((x, i) => buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x * 32767))), 44 + i * 2))
  return buf
}

function manifest(file, sprite) {
  return {
    version: 1,
    voice: 'tone-test',
    sampleRate: SR,
    leadMs: LEAD_MS,
    tailMs: TAIL_MS,
    sprites: { tones: { file, durationMs: sprite.durationMs, pinned: true, clips: sprite.clips } },
  }
}

const sprite = toneSprite()
const dir = mkdtempSync(path.join(tmpdir(), 'tv2-timing-'))
const wavPath = path.join(dir, 'tones.wav')
const mp3Path = path.join(dir, 'tones.mp3')
writeFileSync(wavPath, wav(sprite.samples))
execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '40k', '-ar', String(SR), '-ac', '1', mp3Path])
const files = {
  'tones.wav': { body: readFileSync(wavPath), contentType: 'audio/wav' },
  'tones.mp3': { body: readFileSync(mp3Path), contentType: 'audio/mpeg' },
}
const freqs = Object.fromEntries(CLIPS.map(([id, hz]) => [id, hz]))

const server = await createServer({ root, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } })
await server.listen()
const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
let failed = false
try {
  const scenarios = [
    { name: 'WAV', file: 'tones.wav', throttle: 1 },
    { name: 'MP3 40 kbps', file: 'tones.mp3', throttle: 1 },
    { name: 'MP3 40 kbps, 4× CPU-throttle', file: 'tones.mp3', throttle: 4 },
    { name: 'MP3 dekodet før første tryk (OfflineAudioContext)', file: 'tones.mp3', throttle: 1, preloadFirst: true },
  ]
  for (const sc of scenarios) {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.route('**/__timing/**', (route) => {
      const f = files[route.request().url().split('/__timing/')[1]]
      return f ? route.fulfill({ status: 200, body: f.body, contentType: f.contentType }) : route.fulfill({ status: 404 })
    })
    if (sc.throttle > 1) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: sc.throttle })
    }
    await page.goto(`http://127.0.0.1:${PORT}/src/audio/timing/timing.html`)
    await page.waitForFunction(() => window.__timing !== undefined, null, { timeout: 30000 })
    const request = { manifest: manifest(sc.file, sprite), parts: PARTS, freqs, preloadFirst: !!sc.preloadFirst }
    const result = await page.evaluate((req) => window.__timing.run(req), request)
    const orderOk = result.clips.every((c) => Math.abs(c.measuredHz - c.expectedHz) <= c.expectedHz * 0.03)
    const ok =
      result.maxOnsetErrorMs <= TOLERANCE_MS && result.maxOffsetErrorMs <= TOLERANCE_MS &&
      result.maxGapErrorMs <= TOLERANCE_MS && orderOk && errors.length === 0
    failed ||= !ok
    console.log(`\n${ok ? 'OK ' : 'FEJL'} ${sc.name}: ${result.runs} klip ved ${result.sampleRate} Hz, plan ${result.plannedTotalMs.toFixed(1)} ms`)
    console.log(`  største afvigelse: start ${result.maxOnsetErrorMs.toFixed(2)} ms, slut ${result.maxOffsetErrorMs.toFixed(2)} ms, mellemrum ${result.maxGapErrorMs.toFixed(2)} ms (grænse ±${TOLERANCE_MS} ms)`)
    console.log(`  ended kom ${result.endedLateMs.toFixed(1)} ms efter planlagt slut; rækkefølge ${orderOk ? 'rigtig' : 'FORKERT'}`)
    for (const [i, g] of result.gaps.entries()) {
      const a = result.clips[i]
      console.log(`  ${a.id.padEnd(20)} ${String(a.measuredHz).padStart(4)} Hz  → mellemrum ${g.planned} ms målt ${g.measured.toFixed(2)} ms`)
    }
    for (const e of errors) console.log(`  konsolfejl: ${e}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
console.log(failed ? '\nTimingtest: FEJL' : '\nTimingtest: alle scenarier inden for ±5 ms')
process.exit(failed ? 1 : 0)
