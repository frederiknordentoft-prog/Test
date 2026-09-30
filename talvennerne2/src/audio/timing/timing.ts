// Timing test page (dev only, not a build entry): plays a statement through the real voice engine
// (manifest → fetch → decodeAudioData → fine-tuning → gapless scheduling) with a synthetic tone
// sprite, records the voice bus sample-accurately with an AudioWorklet, and compares every audible
// onset and every silence with the plan. Driven by run-timing.mjs in Chromium.
import type { SpeechPart } from '../../engine/types'
import { compile } from '../../speech/compile'
import { audioGraph } from '../engine'
import type { VoiceManifest } from '../manifest'
import { configureVoice, debugLastPlan, preloadSpeech, speak } from '../voice'

export interface TimingRequest {
  manifest: VoiceManifest
  parts: SpeechPart[]
  /** Expected tone frequency per clip id, to check the order. */
  freqs: Record<string, number>
  /** Decode the sprites before the live context exists (the app's preload before the first tap). */
  preloadFirst?: boolean
}

export interface MeasuredClip {
  id: string
  plannedOnsetMs: number
  measuredOnsetMs: number
  plannedOffsetMs: number
  measuredOffsetMs: number
  expectedHz: number
  measuredHz: number
}

export interface TimingResult {
  sampleRate: number
  clips: MeasuredClip[]
  gaps: { planned: number; measured: number }[]
  maxOnsetErrorMs: number
  maxOffsetErrorMs: number
  maxGapErrorMs: number
  /** ended resolved this long after the planned audible end (ms; timer jitter). */
  endedLateMs: number
  plannedTotalMs: number
  runs: number
}

const THRESHOLD = Math.pow(10, -45 / 20)

const RECORDER = `
class Tv2Recorder extends AudioWorkletProcessor {
  constructor() {
    super()
    this.on = false
    this.chunks = []
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.chunks = [] }
      if (e.data === 'stop') { this.on = false; this.port.postMessage(this.chunks); this.chunks = [] }
    }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (this.on && ch) this.chunks.push({ frame: currentFrame, data: ch.slice(0) })
    return true
  }
}
registerProcessor('tv2-recorder', Tv2Recorder)
`

interface Chunk {
  frame: number
  data: Float32Array
}

async function recorder(ctx: AudioContext, source: AudioNode) {
  const url = URL.createObjectURL(new Blob([RECORDER], { type: 'text/javascript' }))
  await ctx.audioWorklet.addModule(url)
  const node = new AudioWorkletNode(ctx, 'tv2-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] })
  const sink = ctx.createGain()
  sink.gain.value = 0
  source.connect(node)
  node.connect(sink).connect(ctx.destination)
  return {
    start: () => node.port.postMessage('start'),
    stop: () =>
      new Promise<Chunk[]>((resolve) => {
        node.port.onmessage = (e) => resolve(e.data as Chunk[])
        node.port.postMessage('stop')
      }),
  }
}

/** Runs of samples at or above −45 dBFS, merged across gaps shorter than 3 ms (zero crossings). */
function audibleRuns(chunks: Chunk[], sampleRate: number): { from: number; to: number; crossings: number }[] {
  const runs: { from: number; to: number; crossings: number }[] = []
  const merge = Math.round(0.003 * sampleRate)
  // Sign of the last audible sample: a sign change between audible samples is a zero crossing.
  let sign = 0
  for (const c of chunks) {
    for (let i = 0; i < c.data.length; i++) {
      const x = c.data[i]
      if (Math.abs(x) < THRESHOLD) continue
      const frame = c.frame + i
      const s = x > 0 ? 1 : -1
      const last = runs[runs.length - 1]
      if (last && frame - last.to <= merge) {
        if (s !== sign) last.crossings++
        last.to = frame + 1
      } else {
        runs.push({ from: frame, to: frame + 1, crossings: 0 })
      }
      sign = s
    }
  }
  return runs
}

async function run(req: TimingRequest): Promise<TimingResult> {
  configureVoice({ manifest: req.manifest, resolveUrl: (file) => `/__timing/${file}` })
  if (req.preloadFirst) await preloadSpeech([req.parts])
  const graph = audioGraph()
  if (!graph) throw new Error('Ingen Web Audio')
  const { ctx } = graph
  await ctx.resume()
  if (ctx.state !== 'running') throw new Error(`AudioContext kører ikke (${ctx.state})`)
  if (!req.preloadFirst) await preloadSpeech([req.parts])
  const rec = await recorder(ctx, graph.voiceBus)
  rec.start()
  // Let the recorder see a few blocks of silence first.
  await new Promise((r) => setTimeout(r, 100))
  const handle = speak(req.parts)
  await handle.ended
  const endedPerf = performance.now()
  const stamp = ctx.getOutputTimestamp?.()
  await new Promise((r) => setTimeout(r, 150))
  const chunks = await rec.stop()
  const planned = debugLastPlan()
  const compiledIds = compile(req.parts).clips.join(' ')
  if (!planned || planned.plan.clips.map((c) => c.id).join(' ') !== compiledIds) {
    throw new Error('Ingen plan for udsagnet: stemmen faldt tilbage til enhedens stemme')
  }
  const sr = ctx.sampleRate
  const runs = audibleRuns(chunks, sr)
  const compiled = compile(req.parts)
  if (runs.length !== planned.plan.clips.length) {
    throw new Error(`Fandt ${runs.length} lydstykker, forventede ${planned.plan.clips.length}`)
  }
  const toMs = (frame: number) => (frame / sr) * 1000
  const ctxStartMs = planned.ctxStart * 1000
  const clips: MeasuredClip[] = planned.plan.clips.map((c, i) => {
    const r = runs[i]
    const seconds = (r.to - r.from) / sr
    return {
      id: c.id,
      plannedOnsetMs: ctxStartMs + c.onsetMs,
      measuredOnsetMs: toMs(r.from),
      plannedOffsetMs: ctxStartMs + c.offsetMs,
      measuredOffsetMs: toMs(r.to),
      expectedHz: req.freqs[c.id] ?? 0,
      measuredHz: Math.round(r.crossings / 2 / seconds),
    }
  })
  const gaps = compiled.gapsMs.map((planned, i) => ({
    planned,
    measured: clips[i + 1].measuredOnsetMs - clips[i].measuredOffsetMs,
  }))
  const plannedEndCtx = planned.ctxStart + planned.plan.totalMs / 1000
  const endedCtx = stamp && stamp.contextTime !== undefined && stamp.performanceTime !== undefined
    ? stamp.contextTime + (endedPerf - stamp.performanceTime) / 1000
    : ctx.currentTime
  const maxAbs = (xs: number[]) => Math.max(...xs.map(Math.abs))
  return {
    sampleRate: sr,
    clips,
    gaps,
    maxOnsetErrorMs: maxAbs(clips.map((c) => c.measuredOnsetMs - c.plannedOnsetMs)),
    maxOffsetErrorMs: maxAbs(clips.map((c) => c.measuredOffsetMs - c.plannedOffsetMs)),
    maxGapErrorMs: maxAbs(gaps.map((g) => g.measured - g.planned)),
    endedLateMs: (endedCtx - plannedEndCtx) * 1000,
    plannedTotalMs: planned.plan.totalMs,
    runs: runs.length,
  }
}

declare global {
  interface Window {
    __timing?: { run(req: TimingRequest): Promise<TimingResult> }
  }
}

window.__timing = { run }
document.getElementById('status')!.textContent = 'Klar.'
