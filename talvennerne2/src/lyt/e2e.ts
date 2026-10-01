// Test hooks for the listening page in Chromium (scripts/voice/e2e.mjs), installed only with ?e2e=1.
// They drive the real voice engine — manifest, sprite fetch, decodeAudioData, fine-tuning, gapless
// scheduling — and record the voice bus sample by sample with an AudioWorklet, so the pipeline can
// check that the packed sprites play and that a composed statement is one continuous voice.
import { audioGraph } from '../audio/engine'
import { debugLastPlan, preloadSpeech, speak, voiceAvailable, voiceStatus } from '../audio/voice'
import type { SpeechPart } from '../engine/types'
import { compile } from '../speech/compile'

const RECORDER = `
class LytRecorder extends AudioWorkletProcessor {
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
    if (this.on) this.chunks.push(ch ? ch.slice(0) : new Float32Array(128))
    return true
  }
}
registerProcessor('lyt-recorder', LytRecorder)
`

export interface SpokenResult {
  text: string
  clips: string[]
  /** Clip ids of the plan the engine actually scheduled (empty: it fell back to the device voice). */
  planned: string[]
  plannedMs: number
}

export interface Recording extends Record<string, unknown> {
  sampleRate: number
  /** 16-bit PCM, little endian, base64. */
  pcm16: string
  statements: SpokenResult[]
  /** Where each statement starts in the recording (ms). */
  startsMs: number[]
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function say(parts: SpeechPart[]): Promise<SpokenResult> {
  const before = debugLastPlan()
  const c = compile(parts)
  const h = speak(parts)
  await h.ended
  const plan = debugLastPlan()
  const fresh = plan && plan !== before ? plan : null
  return { text: c.text, clips: c.clips, planned: fresh ? fresh.plan.clips.map((x) => x.id) : [], plannedMs: fresh ? fresh.plan.totalMs : 0 }
}

async function running() {
  const graph = audioGraph()
  if (!graph) throw new Error('Ingen Web Audio')
  await graph.ctx.resume()
  if (graph.ctx.state !== 'running') throw new Error(`AudioContext kører ikke (${graph.ctx.state})`)
  return graph
}

/** Plays the statements one after another and records the voice bus. */
async function record(statements: SpeechPart[][], pauseMs = 700): Promise<Recording> {
  const graph = await running()
  const { ctx, voiceBus } = graph
  await preloadSpeech(statements)
  const url = URL.createObjectURL(new Blob([RECORDER], { type: 'text/javascript' }))
  await ctx.audioWorklet.addModule(url)
  const node = new AudioWorkletNode(ctx, 'lyt-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] })
  const sink = ctx.createGain()
  sink.gain.value = 0
  voiceBus.connect(node)
  node.connect(sink).connect(ctx.destination)
  node.port.postMessage('start')
  const t0 = ctx.currentTime
  await wait(200)
  const results: SpokenResult[] = []
  const startsMs: number[] = []
  for (const parts of statements) {
    startsMs.push((ctx.currentTime - t0) * 1000)
    results.push(await say(parts))
    await wait(pauseMs)
  }
  const chunks = await new Promise<Float32Array[]>((resolve) => {
    node.port.onmessage = (e) => resolve(e.data as Float32Array[])
    node.port.postMessage('stop')
  })
  voiceBus.disconnect(node)
  node.disconnect()
  const length = chunks.reduce((n, c) => n + c.length, 0)
  const bytes = new Uint8Array(length * 2)
  const view = new DataView(bytes.buffer)
  let at = 0
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      view.setInt16(at, Math.max(-32768, Math.min(32767, Math.round(c[i] * 32767))), true)
      at += 2
    }
  }
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { sampleRate: ctx.sampleRate, pcm16: btoa(bin), statements: results, startsMs }
}

declare global {
  interface Window {
    __lyt?: {
      ready(): Promise<boolean>
      say(parts: SpeechPart[]): Promise<SpokenResult>
      record(statements: SpeechPart[][], pauseMs?: number): Promise<Recording>
      status(): ReturnType<typeof voiceStatus>
    }
  }
}

export function installE2E(): void {
  window.__lyt = {
    ready: () => voiceAvailable(),
    say: async (parts) => {
      await running()
      return say(parts)
    },
    record,
    status: () => voiceStatus(),
  }
}
