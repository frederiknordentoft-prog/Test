// The voice's control flow without Web Audio (Node has none): every statement falls back to the
// device voice, which is silent here, so `ended` must still resolve on the estimated time. The
// sample-accurate Web Audio path is covered by src/audio/timing/run-timing.mjs in Chromium.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compile } from '../speech/compile'
import { estimateSpeechMs } from './deviceTts'
import type { VoiceManifest } from './manifest'
import { FALLBACK_AFTER_MS, configureVoice, hush, setSpeechEnabled, speak, voiceAvailable } from './voice'

const SUM = [{ clip: 'frag.hvad_er' }, { num: 3, form: 'mid' }, { clip: 'op.plus' }, { num: 4, form: 'end' }] as const
const parts = () => SUM.map((p) => ({ ...p })) as Parameters<typeof speak>[0]

function tracker(p: Promise<void>) {
  const state = { done: false }
  void p.then(() => {
    state.done = true
  })
  return state
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  configureVoice({ manifest: null })
  setSpeechEnabled(true)
})

afterEach(() => {
  hush()
  vi.useRealTimers()
})

describe('speak without recordings', () => {
  it('reads the statement with the (silent) device voice and ends when it would have been spoken', async () => {
    const h = speak(parts())
    const state = tracker(h.ended)
    const ms = estimateSpeechMs(compile(parts()).text)
    await vi.advanceTimersByTimeAsync(ms - 50)
    expect(state.done).toBe(false)
    expect(h.durationMs).toBe(ms)
    await vi.advanceTimersByTimeAsync(100)
    expect(state.done).toBe(true)
  })

  it('cancels the previous statement by default, and cancel resolves ended at once', async () => {
    const first = speak(parts())
    const s1 = tracker(first.ended)
    await vi.advanceTimersByTimeAsync(10)
    const second = speak([{ clip: 'q.add:3+4' }])
    const s2 = tracker(second.ended)
    await vi.advanceTimersByTimeAsync(0)
    expect(s1.done).toBe(true)
    expect(s2.done).toBe(false)
    second.cancel()
    await vi.advanceTimersByTimeAsync(0)
    expect(s2.done).toBe(true)
  })

  it('queues after the current statement with interrupt: false', async () => {
    const first = speak(parts())
    const s1 = tracker(first.ended)
    const second = speak([{ clip: 'q.add:3+4' }], { interrupt: false })
    const s2 = tracker(second.ended)
    const ms1 = estimateSpeechMs(compile(parts()).text)
    const ms2 = estimateSpeechMs('Hvad er tre plus fire?')
    await vi.advanceTimersByTimeAsync(ms1 + 20)
    expect(s1.done).toBe(true)
    expect(s2.done).toBe(false)
    await vi.advanceTimersByTimeAsync(ms2 + 20)
    expect(s2.done).toBe(true)
  })

  it('is silent and ends at once when the parent turned reading off', async () => {
    setSpeechEnabled(false)
    const h = speak(parts())
    expect(h.durationMs).toBe(0)
    const state = tracker(h.ended)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.done).toBe(true)
  })

  it('hush() ends everything', async () => {
    const a = tracker(speak(parts()).ended)
    const b = tracker(speak(parts(), { interrupt: false }).ended)
    hush()
    await vi.advanceTimersByTimeAsync(0)
    expect(a.done && b.done).toBe(true)
  })
})

describe('speak with a manifest', () => {
  const manifest: VoiceManifest = {
    version: 1,
    voice: 'test',
    sampleRate: 24000,
    sprites: {
      core: { file: 'core.mp3', pinned: true, clips: { 'frag.hvad_er': [0, 600], 'op.plus': [720, 500] } },
      n: { file: 'n.mp3', clips: { 'n.mid.3': [0, 500], 'n.end.4': [620, 500] } },
    },
  }

  it('estimates the duration from the manifest before anything is decoded', async () => {
    configureVoice({ manifest, resolveUrl: (f) => `/voice/${f}` })
    expect(await voiceAvailable()).toBe(true)
    const h = speak(parts())
    // four clips of (span − 20 − 40) ms plus the gaps 40 + 120 + 40 and 4 + 8 ms of margins
    expect(h.durationMs).toBe(540 + 440 + 440 + 440 + 200 + 12)
  })

  it('falls back to the device voice when a clip has no recording', async () => {
    configureVoice({ manifest, resolveUrl: (f) => `/voice/${f}` })
    const h = speak([{ clip: 'frag.hvad_er' }, { num: 5, form: 'end' }])
    await vi.advanceTimersByTimeAsync(0)
    expect(h.durationMs).toBe(estimateSpeechMs('Hvad er fem?'))
  })

  it('falls back when the sprites cannot be decoded in time', async () => {
    configureVoice({ manifest, resolveUrl: (f) => `/voice/${f}` })
    const h = speak(parts())
    const state = tracker(h.ended)
    await vi.advanceTimersByTimeAsync(FALLBACK_AFTER_MS + 10)
    expect(h.durationMs).toBe(estimateSpeechMs(compile(parts()).text))
    await vi.advanceTimersByTimeAsync(h.durationMs)
    expect(state.done).toBe(true)
  })
})
