import { describe, expect, it } from 'vitest'
import { POST_MS, PRE_MS, findBounds, planSequence, renderSequence } from './sequence'

const SR = 24000

/** A buffer of `ms` silence with a tone from `onMs` to `offMs` at amplitude `amp`. */
function tone(totalMs: number, onMs: number, offMs: number, amp = 0.3, hz = 440): Float32Array {
  const out = new Float32Array(Math.round((totalMs * SR) / 1000))
  const a = Math.round((onMs * SR) / 1000)
  const b = Math.round((offMs * SR) / 1000)
  for (let i = a; i < b; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * (i - a)) / SR + Math.PI / 2)
  return out
}

/** First and last index at or above −45 dBFS. */
function audible(samples: Float32Array): [number, number] {
  const thr = Math.pow(10, -45 / 20)
  let first = -1
  let last = -1
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= thr) {
      if (first < 0) first = i
      last = i
    }
  }
  return [(first * 1000) / SR, ((last + 1) * 1000) / SR]
}

describe('planSequence', () => {
  it('lays clips back to back with the gaps between audible content', () => {
    const plan = planSequence(
      ['a', 'b', 'c'],
      [
        { onsetMs: 20, offsetMs: 520 },
        { onsetMs: 1000, offsetMs: 1300 },
        { onsetMs: 2000, offsetMs: 2100 },
      ],
      [20, 250],
    )
    const [a, b, c] = plan.clips
    expect(a).toMatchObject({ startMs: 0, onsetMs: PRE_MS, offsetMs: PRE_MS + 500, bufferOffsetMs: 20 - PRE_MS })
    expect(b.onsetMs).toBe(a.offsetMs + 20)
    expect(c.onsetMs).toBe(b.offsetMs + 250)
    expect(b.startMs).toBe(b.onsetMs - PRE_MS)
    expect(c.durMs).toBe(PRE_MS + 100 + POST_MS)
    expect(plan.totalMs).toBe(c.offsetMs + POST_MS)
  })

  it('never reads before the start of a buffer', () => {
    const plan = planSequence(['a'], [{ onsetMs: 1, offsetMs: 101 }], [])
    expect(plan.clips[0]).toMatchObject({ startMs: 0, bufferOffsetMs: 0, onsetMs: 1 })
  })
})

describe('findBounds', () => {
  it('finds the audible bounds inside the nominal span', () => {
    // nominal span 100–700 ms with 20 ms lead and 40 ms tail → audible 120–660
    const buf = tone(1000, 120, 660)
    const b = findBounds(buf, SR, 100, 700)
    expect(b.onsetMs).toBeCloseTo(120, 0)
    expect(b.offsetMs).toBeCloseTo(660, 0)
  })

  it('follows a decoder delay of up to 60 ms in either direction', () => {
    for (const shift of [-50, -20, 0, 25, 47, 58]) {
      const buf = tone(1200, 220 + shift, 760 + shift)
      const b = findBounds(buf, SR, 200, 800)
      expect(b.onsetMs, `shift ${shift}`).toBeCloseTo(220 + shift, 0)
      expect(b.offsetMs, `shift ${shift}`).toBeCloseTo(760 + shift, 0)
    }
  })

  it('ignores the neighbouring clips of a sprite', () => {
    // previous clip ends at 160, ours is 300–700 (audible 320–660), next starts at 820
    const buf = tone(1200, 0, 160)
    const ours = tone(1200, 320, 660)
    const next = tone(1200, 840, 1150)
    for (let i = 0; i < buf.length; i++) buf[i] += ours[i] + next[i]
    const b = findBounds(buf, SR, 300, 700)
    expect(b.onsetMs).toBeCloseTo(320, 0)
    expect(b.offsetMs).toBeCloseTo(660, 0)
  })

  it('falls back to the nominal bounds for a silent clip', () => {
    expect(findBounds(new Float32Array(SR), SR, 100, 700)).toEqual({ onsetMs: 120, offsetMs: 660 })
  })
})

describe('renderSequence', () => {
  it('places every onset exactly where the plan says', () => {
    const sources: Record<string, Float32Array> = {
      a: tone(800, 20, 520, 0.3, 300),
      b: tone(800, 20, 320, 0.3, 500),
      c: tone(800, 20, 120, 0.3, 700),
    }
    // nominal spans end 40 ms after the audible end (the manifest tail)
    const nominalEnd: Record<string, number> = { a: 560, b: 360, c: 160 }
    const bounds = ['a', 'b', 'c'].map((id) => findBounds(sources[id], SR, 0, nominalEnd[id]))
    const plan = planSequence(['a', 'b', 'c'], bounds, [20, 120])
    const out = renderSequence(plan, (id) => sources[id], SR)
    // Each clip alone in the mix: check its onset and offset.
    for (let k = 0; k < 3; k++) {
      const solo = renderSequence({ clips: [plan.clips[k]], totalMs: plan.totalMs }, (id) => sources[id], SR)
      const [on, off] = audible(solo)
      expect(on).toBeCloseTo(plan.clips[k].onsetMs, 0)
      expect(off).toBeCloseTo(plan.clips[k].offsetMs, 0)
    }
    const [first, last] = audible(out)
    expect(first).toBeCloseTo(plan.clips[0].onsetMs, 0)
    expect(last).toBeCloseTo(plan.clips[2].offsetMs, 0)
    // the silences between clips are the requested gaps
    expect(plan.clips[1].onsetMs - plan.clips[0].offsetMs).toBeCloseTo(20, 6)
    expect(plan.clips[2].onsetMs - plan.clips[1].offsetMs).toBeCloseTo(120, 6)
  })
})
