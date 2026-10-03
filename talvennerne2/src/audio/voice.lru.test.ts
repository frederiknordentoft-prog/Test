// The sprite cache under pressure (review app-w2-r1 P2-3). A statement waits for its sprites; while
// it waits, other sprites finish decoding (the background preload of the UI's voice) and the LRU
// makes room. A sprite the statement is about to play must never be the one that goes: before the
// fix, `boundsFor` then read a sprite that was no longer in the cache, threw "Cannot read properties
// of undefined (reading 'bounds')", and the sentence was silent. A fake loader with delays and a
// cache of one and a half sprites recreate the race; Node has no Web Audio, so a statement played
// from sprites is silent but takes its planned time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeechPart } from '../engine/types'
import { compile } from '../speech/compile'
import { estimateSpeechMs } from './deviceTts'
import type { VoiceManifest } from './manifest'
import { configureVoice, hush, preloadSpeech, setSpeechEnabled, speak, voiceAvailable, voiceStatus, type SpriteLoader } from './voice'

const RATE = 24000
/** Every fake sprite holds 2 s of mono audio: 48 000 samples of 4 bytes. */
const SPRITE_BYTES = 2 * RATE * 4
const LIMIT = SPRITE_BYTES * 1.5

const manifest: VoiceManifest = {
  version: 1,
  voice: 'test',
  sampleRate: RATE,
  sprites: {
    a: { file: 'a.mp3', clips: { 'frag.hvad_er': [0, 600], 'op.plus': [720, 500] } },
    b: { file: 'b.mp3', clips: { 'n.mid.3': [0, 500], 'n.end.4': [620, 500] } },
    c: { file: 'c.mp3', clips: { 'q.add:3+4': [0, 900] } },
  },
}

/** "Hvad er tre plus fire?": sprites a and b. */
const SUM: SpeechPart[] = [{ clip: 'frag.hvad_er' }, { num: 3, form: 'mid' }, { clip: 'op.plus' }, { num: 4, form: 'end' }]
/** Only sprite b. */
const NUMBERS: SpeechPart[] = [{ clip: 'n.mid.3' }, { clip: 'n.end.4' }]
/** Only sprite c: what the background preload decodes meanwhile. */
const OTHER: SpeechPart[][] = [[{ clip: 'q.add:3+4' }]]

function fakeBuffer(seconds: number, channels = 1): AudioBuffer {
  const length = Math.round(seconds * RATE)
  const samples = new Float32Array(length)
  return {
    length,
    numberOfChannels: channels,
    sampleRate: RATE,
    duration: seconds,
    getChannelData(channel: number) {
      // what an AudioBuffer does for a channel it does not have (IndexSizeError)
      if (channel >= channels) throw new RangeError(`channel ${channel} of ${channels}`)
      return samples
    },
  } as unknown as AudioBuffer
}

/** Decodes each file after its delay (ms). */
function fakeLoader(delays: Record<string, number>, make: Record<string, () => AudioBuffer> = {}): SpriteLoader {
  return (file) =>
    new Promise((resolve) => {
      setTimeout(() => resolve((make[file] ?? (() => fakeBuffer(2)))()), delays[file] ?? 10)
    })
}

function tracker(p: Promise<void>) {
  const state = { done: false }
  void p.then(() => {
    state.done = true
  })
  return state
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  setSpeechEnabled(true)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  hush()
  configureVoice({ manifest: null })
  consoleError.mockRestore()
  vi.useRealTimers()
})

describe('the sprite cache while a statement waits for its sprites', () => {
  it('keeps a decoded sprite the statement needs while another one is still loading', async () => {
    configureVoice({ manifest, loadSprite: fakeLoader({ 'a.mp3': 10, 'b.mp3': 400, 'c.mp3': 50 }), lruLimitBytes: LIMIT })
    // sprite a was decoded for an earlier statement and is the oldest in the cache
    void preloadSpeech([SUM.slice(0, 1)])
    await vi.advanceTimersByTimeAsync(1000)

    const h = speak(SUM)
    const state = tracker(h.ended)
    // the background preload decodes sprite c while b is still on its way
    void preloadSpeech(OTHER)
    await vi.advanceTimersByTimeAsync(450)

    expect(consoleError).not.toHaveBeenCalled()
    // played from the sprites: the statement takes its planned time instead of ending silently
    expect(state.done).toBe(false)
    expect(h.durationMs).toBe(540 + 440 + 440 + 440 + 200 + 12)
    await vi.advanceTimersByTimeAsync(h.durationMs + 50)
    expect(state.done).toBe(true)
    // once nothing holds them, the cache is back under its limit
    expect(voiceStatus().decodedBytes).toBeLessThanOrEqual(LIMIT)
  })

  it('holds a sprite from the moment it is decoded, before the cache makes room', async () => {
    configureVoice({ manifest, loadSprite: fakeLoader({ 'b.mp3': 400, 'c.mp3': 50 }), lruLimitBytes: LIMIT })
    expect(await voiceAvailable()).toBe(true)

    const h = speak(NUMBERS)
    const state = tracker(h.ended)
    await vi.advanceTimersByTimeAsync(10)
    // c is newer in the cache than b, so b itself would be the oldest when it arrives
    void preloadSpeech(OTHER)
    await vi.advanceTimersByTimeAsync(440)

    expect(consoleError).not.toHaveBeenCalled()
    expect(state.done).toBe(false)
    await vi.advanceTimersByTimeAsync(h.durationMs + 50)
    expect(state.done).toBe(true)
    expect(voiceStatus().decodedBytes).toBeLessThanOrEqual(LIMIT)
  })

  it('reads the statement with the device voice instead of throwing when the sprite cannot be played', async () => {
    // decoded without a channel to read: the clip bounds cannot be found
    configureVoice({ manifest, loadSprite: fakeLoader({ 'b.mp3': 20 }, { 'b.mp3': () => fakeBuffer(2, 0) }) })
    const h = speak(NUMBERS)
    const state = tracker(h.ended)
    await vi.advanceTimersByTimeAsync(100)

    expect(consoleError).not.toHaveBeenCalled()
    const ms = estimateSpeechMs(compile(NUMBERS).text)
    expect(h.durationMs).toBe(ms)
    expect(state.done).toBe(false)
    await vi.advanceTimersByTimeAsync(ms)
    expect(state.done).toBe(true)
  })
})
