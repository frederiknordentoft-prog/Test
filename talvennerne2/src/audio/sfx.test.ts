// QA1/QA2 P3-1: no effect sets an oscillator's or a filter's frequency past half the sample rate,
// which Chrome reports as "Oscillator.frequency … outside nominal range" — once at every celebration.
import { describe, expect, it } from 'vitest'
import { SFX_NAMES, playable, scheduleSfx } from './sfx'

/** An AudioContext that records every frequency it is asked for (24 kHz, as engine.ts opens it). */
function recordingContext(sampleRate = 24000) {
  const frequencies: { node: string; hz: number }[] = []
  const param = (node: string, record: boolean) => {
    const put = (v: number) => {
      if (record) frequencies.push({ node, hz: v })
    }
    let value = 0
    return {
      get value() {
        return value
      },
      set value(v: number) {
        value = v
        put(v)
      },
      setValueAtTime: (v: number) => put(v),
      linearRampToValueAtTime: (v: number) => put(v),
      exponentialRampToValueAtTime: (v: number) => put(v),
      setTargetAtTime: (v: number) => put(v),
      cancelScheduledValues: () => undefined,
    }
  }
  const node = <T extends object>(extra: T) => ({ connect: (to: unknown) => to, disconnect: () => undefined, ...extra })
  const ctx = {
    sampleRate,
    currentTime: 0,
    state: 'running',
    createOscillator: () => node({ type: 'sine', frequency: param('oscillator', true), detune: param('detune', false), start() {}, stop() {} }),
    createGain: () => node({ gain: param('gain', false) }),
    createBiquadFilter: () => node({ type: 'bandpass', frequency: param('filter', true), Q: param('q', false), gain: param('gain', false) }),
    createBufferSource: () => node({ buffer: null, playbackRate: param('rate', false), start() {}, stop() {} }),
    createBuffer: (_ch: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createConvolver: () => node({ buffer: null }),
    createStereoPanner: () => node({ pan: param('pan', false) }),
    createDynamicsCompressor: () => node({ threshold: param('t', false), ratio: param('r', false), knee: param('k', false), attack: param('a', false), release: param('l', false) }),
  }
  return { ctx: ctx as unknown as AudioContext, out: node({}) as unknown as AudioNode, frequencies }
}

describe('effects stay within what the context can play (P3-1)', () => {
  it('never asks an oscillator or a filter for more than half the sample rate, in any effect', () => {
    let n = 0
    for (const name of SFX_NAMES) {
      for (const streak of [1, 3, 5, 10, 20]) {
        const { ctx, out, frequencies } = recordingContext()
        scheduleSfx(ctx, out, name, { streak })
        for (const f of frequencies) {
          expect(f.hz, `${name} (streak ${streak}): ${f.node} ${f.hz} Hz`).toBeLessThanOrEqual(12000)
          expect(f.hz, `${name}: ${f.node}`).toBeGreaterThan(0)
        }
        n += frequencies.length
      }
    }
    expect(n).toBeGreaterThan(100)
  })

  it('leaves every frequency below it as it was', () => {
    const ctx = { sampleRate: 24000 }
    expect(playable(ctx, 440)).toBe(440)
    expect(playable(ctx, 11000)).toBe(11000)
    expect(playable(ctx, 12320)).toBeLessThan(12000)
    expect(playable({ sampleRate: 48000 }, 12320)).toBe(12320)
  })
})
