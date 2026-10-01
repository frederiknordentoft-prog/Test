#!/usr/bin/env node
// End-to-end check of the packed voice in Chromium (always behind the shared lock):
//
//   cd talvennerne2 && flock /tmp/tv2-chromium.lock node scripts/voice/e2e.mjs [--dist]
//
// It serves the app with Vite (port 4317, PORT= overrides), opens lyt.html?e2e=1 and lets the real
// runtime (src/audio/voice.ts: manifest → sprite fetch → decodeAudioData → fine-tuning → gapless
// plan) speak. Checks:
//   1. window.__voiceLog gets exactly the clips compile() asked for, and every statement is played
//      from the sprites (the scheduled plan has the same clips; no fall-back to the device voice);
//   2. five composed sums are recorded from the voice bus: each must be audible and continuous
//      (no silence longer than the planned sentence gap) and is checked by ASR (qa_asr.py);
//   3. the recording is saved as voice/probe/pipeline-sample.wav (≤ 2 MB) and the results as
//      voice/probe/pipeline-sample.json.
// Exit code 1 on failure. Only statements whose clips are all in the manifest are used.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, preview } from 'vite'
import { launch } from '../browser.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const PORT = Number(process.env.PORT ?? 4317)
const OUT_WAV = path.join(ROOT, 'voice/probe/pipeline-sample.wav')
const OUT_JSON = path.join(ROOT, 'voice/probe/pipeline-sample.json')
const QA_DIR = path.join(ROOT, 'voice/probe/takes/qa-e2e')
const ASR_PY = process.env.TV2_ASR_PYTHON ?? '/opt/tv2-asr/bin/python'

const sum = (a, op, b) => [{ clip: 'frag.hvad_er' }, { num: a, form: 'mid' }, { clip: op === '+' ? 'op.plus' : 'op.minus' }, { num: b, form: 'end' }]
const SUMS = [sum(7, '+', 5), sum(312, '−', 18), sum(600, '+', 20), sum(104, '+', 9), sum(19, '−', 11)]
const LOG_CHECKS = [
  [{ clip: 'q.add:3+4' }],
  [{ clip: 'frag.find_tallet' }, { num: 13, form: 'end' }],
  [{ clip: 'frag.hvilket_tal_kommer_efter' }, { num: 16, form: 'end' }],
  [{ num: 0, form: 'end' }],
]

function wav(pcm16, sr) {
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + pcm16.length, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(sr, 24)
  head.writeUInt32LE(sr * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36)
  head.writeUInt32LE(pcm16.length, 40)
  return Buffer.concat([head, pcm16])
}

/** Longest run of samples below −45 dBFS between the first and last audible sample (ms). */
function longestSilenceMs(samples, sr) {
  const thr = 32767 * Math.pow(10, -45 / 20)
  let first = -1
  let last = -1
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) >= thr) { if (first < 0) first = i; last = i }
  if (first < 0) return { audibleMs: 0, longestMs: 0 }
  let longest = 0
  let run = 0
  for (let i = first; i <= last; i++) {
    if (Math.abs(samples[i]) < thr) run++
    else { longest = Math.max(longest, run); run = 0 }
  }
  return { audibleMs: ((last - first + 1) * 1000) / sr, longestMs: (longest * 1000) / sr }
}

// --dist serves the production build (npm run build first) instead of the dev server.
const useDist = process.argv.includes('--dist')
const server = useDist
  ? await preview({ root: ROOT, logLevel: 'error', preview: { port: PORT, strictPort: true, host: '127.0.0.1' } })
  : await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, strictPort: true, host: '127.0.0.1' } })
if (!useDist) await server.listen()
const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const failures = []
const result = { logChecks: [], sums: [] }
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`http://127.0.0.1:${PORT}/lyt.html?e2e=1`)
  await page.waitForFunction(() => window.__lyt !== undefined, null, { timeout: 60000 })
  if (!(await page.evaluate(() => window.__lyt.ready()))) throw new Error('Ingen voice-manifest.json: kør pack.mjs først')
  await page.click('body')

  for (const parts of LOG_CHECKS) {
    const before = await page.evaluate(() => (window.__voiceLog ?? []).length)
    const r = await page.evaluate((p) => window.__lyt.say(p), parts)
    const logged = await page.evaluate((n) => (window.__voiceLog ?? []).slice(n), before)
    const ok = JSON.stringify(logged) === JSON.stringify(r.clips) && JSON.stringify(r.planned) === JSON.stringify(r.clips)
    result.logChecks.push({ text: r.text, clips: r.clips, logged, planned: r.planned, ok })
    console.log(`${ok ? 'OK  ' : 'FEJL'} ${r.text}  __voiceLog: ${logged.join(' ')}`)
    if (!ok) failures.push(`__voiceLog/plan for "${r.text}"`)
  }

  const rec = await page.evaluate((s) => window.__lyt.record(s, 700), SUMS)
  const pcm = Buffer.from(rec.pcm16, 'base64')
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2)
  mkdirSync(path.dirname(OUT_WAV), { recursive: true })
  writeFileSync(OUT_WAV, wav(pcm, rec.sampleRate))
  mkdirSync(QA_DIR, { recursive: true })
  const meta = []
  rec.statements.forEach((st, i) => {
    const from = Math.round((rec.startsMs[i] * rec.sampleRate) / 1000)
    const to = i + 1 < rec.startsMs.length ? Math.round((rec.startsMs[i + 1] * rec.sampleRate) / 1000) : samples.length
    const seg = samples.slice(from, to)
    const file = path.join(QA_DIR, `sum${i + 1}.wav`)
    writeFileSync(file, wav(Buffer.from(seg.buffer), rec.sampleRate))
    const gaps = longestSilenceMs(seg, rec.sampleRate)
    const played = JSON.stringify(st.planned) === JSON.stringify(st.clips)
    result.sums.push({ text: st.text, clips: st.clips, played, ...gaps, plannedMs: st.plannedMs })
    meta.push(JSON.stringify({ key: `sum${i + 1}`, kind: 'template', expected: st.text, parts: st.clips.map((c, k) => [c, st.texts[k]]), wav: file }))
    if (!played) failures.push(`"${st.text}" blev ikke spillet fra spritesene`)
    if (gaps.audibleMs < 500) failures.push(`"${st.text}" er næsten stille (${gaps.audibleMs.toFixed(0)} ms hørbart)`)
    if (gaps.longestMs > 260) failures.push(`"${st.text}" har et hul på ${gaps.longestMs.toFixed(0)} ms`)
  })
  writeFileSync(path.join(QA_DIR, 'meta.jsonl'), meta.join('\n') + '\n')
  const py = spawnSync(ASR_PY, [path.join(ROOT, 'scripts/tts/qa_asr.py'), path.join(QA_DIR, 'meta.jsonl'), path.join(QA_DIR, 'asr.jsonl')], { stdio: 'inherit' })
  if (py.status === 0) {
    const rows = readFileSync(path.join(QA_DIR, 'asr.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    rows.forEach((r, i) => Object.assign(result.sums[i], { asr: r.asr_w2v, asrWhisper: r.asr_whisper ?? null, cer: r.cer, verbatim: r.ok, engine: r.engine }))
  } else failures.push('qa_asr.py fejlede')
  for (const s of result.sums) {
    console.log(`${s.played && s.verbatim ? 'OK  ' : 'FEJL'} ${s.text}  ASR: '${s.asr}' CER ${s.cer}  længste stille stykke ${s.longestMs?.toFixed(0)} ms`)
    if (!s.verbatim) failures.push(`ASR hørte "${s.asr}" for "${s.text}"`)
  }
  result.sampleRate = rec.sampleRate
  result.seconds = Math.round((samples.length / rec.sampleRate) * 10) / 10
  result.bytes = statSync(OUT_WAV).size
  if (result.bytes > 2 * 1024 * 1024) failures.push(`pipeline-sample.wav er ${result.bytes} bytes (> 2 MB)`)
  result.consoleErrors = errors
  if (errors.length) failures.push(...errors.map((e) => `konsolfejl: ${e}`))
} finally {
  await browser.close()
  await server.close()
}
result.failures = failures
writeFileSync(OUT_JSON, JSON.stringify(result, null, 1) + '\n')
console.log(`\n${path.relative(ROOT, OUT_WAV)}: ${result.seconds} s ved ${result.sampleRate} Hz, ${((result.bytes ?? 0) / 1024).toFixed(0)} KB`)
console.log(failures.length ? `e2e: FEJL\n  ${failures.join('\n  ')}` : 'e2e: stemmen spiller fra spritesene, og sammensatte regnestykker hænger sammen')
process.exit(failures.length ? 1 : 0)
