// Sound effects (SPEC §10.5 "Lyd uden stemme"), ported from V1's sfx.ts onto the shared sfxBus.
// Everything is synthesised: FM voices (a sine modulator on the carrier's frequency, with the
// modulation index decaying like a struck bell), filtered noise, and a generated room reverb
// (ConvolverNode with a decaying-noise impulse response). No files, nothing to load.
//
// A wrong answer is a soft, low "hmm" — never a buzzer. Noise comes from the seeded PRNG, so the
// sounds are the same every time and game code never touches Math.random().
import { hashSeed, makeRng } from '../engine/rng'
import { existingAudioGraph, sfxEnabled } from './engine'

export const SFX_NAMES = [
  'tryk', 'klik', 'rigtigt', 'hmm', 'stjerne', 'perle', 'level-up', 'klaek', 'whoosh', 'pop', 'ding',
  'guld', 'fanfare', 'moent', 'koeb', 'medalje', 'vaekst', 'klaed-paa', 'kiste', 'glimmer', 'snap',
  'tik', 'boble', 'side', 'stempel', 'trofae', 'varme', 'laas-op', 'taage', 'ven', 'flyv', 'land',
  'fjern', 'lyspaere',
] as const
export type SfxName = (typeof SFX_NAMES)[number]

export interface SfxOptions {
  /** Correct answers in a row; 'rigtigt' rises with it. */
  streak?: number
}

// ─── Building blocks ────────────────────────────────────────────────────────

interface Ctx {
  ctx: AudioContext
  out: AudioNode
  send: AudioNode
  t0: number
}

interface FmVoice {
  freq: number
  /** Glide the pitch to this frequency over the note. */
  to?: number
  /** Modulator frequency = freq × ratio. */
  ratio?: number
  /** Peak modulation index (brightness). */
  index?: number
  dur?: number
  attack?: number
  gain?: number
  delay?: number
  carrier?: OscillatorType
  /** Share sent to the reverb. */
  wet?: number
}

let reverb: { ctx: AudioContext; node: ConvolverNode } | null = null

function reverbFor(ctx: AudioContext, sfxBus: AudioNode): AudioNode {
  if (reverb?.ctx === ctx) return reverb.node
  const seconds = 1.3
  const length = Math.floor(ctx.sampleRate * seconds)
  const ir = ctx.createBuffer(2, length, ctx.sampleRate)
  const rng = makeRng(hashSeed('talvennerne2.reverb'))
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      const t = i / length
      data[i] = (rng.next() * 2 - 1) * Math.pow(1 - t, 3) * (i < 40 ? i / 40 : 1)
    }
  }
  const node = ctx.createConvolver()
  node.buffer = ir
  const level = ctx.createGain()
  level.gain.value = 0.5
  node.connect(level).connect(sfxBus)
  reverb = { ctx, node }
  return node
}

function fm(c: Ctx, v: FmVoice): void {
  const { ctx } = c
  const t = c.t0 + (v.delay ?? 0)
  const dur = v.dur ?? 0.2
  const attack = v.attack ?? 0.006
  const peak = v.gain ?? 0.16
  const ratio = v.ratio ?? 2
  const index = v.index ?? 1.2

  const car = ctx.createOscillator()
  car.type = v.carrier ?? 'sine'
  car.frequency.setValueAtTime(v.freq, t)
  if (v.to !== undefined) car.frequency.exponentialRampToValueAtTime(Math.max(20, v.to), t + dur)

  const mod = ctx.createOscillator()
  mod.frequency.setValueAtTime(v.freq * ratio, t)
  if (v.to !== undefined) mod.frequency.exponentialRampToValueAtTime(Math.max(20, v.to * ratio), t + dur)
  const depth = ctx.createGain()
  const dev = index * v.freq * ratio
  depth.gain.setValueAtTime(dev, t)
  depth.gain.exponentialRampToValueAtTime(Math.max(0.01, dev * 0.15), t + dur)
  mod.connect(depth).connect(car.frequency)

  const amp = ctx.createGain()
  // quick attack, smooth tail: a hard stop clicks
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(peak, t + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  car.connect(amp)
  amp.connect(c.out)
  const wet = v.wet ?? 0.25
  if (wet > 0) {
    const send = ctx.createGain()
    send.gain.value = wet
    amp.connect(send).connect(c.send)
  }
  car.start(t)
  mod.start(t)
  car.stop(t + dur + 0.05)
  mod.stop(t + dur + 0.05)
}

interface Noise {
  dur?: number
  gain?: number
  hz?: number
  /** Sweep the filter to this frequency. */
  to?: number
  q?: number
  filter?: BiquadFilterType
  delay?: number
  attack?: number
  wet?: number
  seed?: string
}

function noise(c: Ctx, n: Noise): void {
  const { ctx } = c
  const t = c.t0 + (n.delay ?? 0)
  const dur = n.dur ?? 0.25
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  const rng = makeRng(hashSeed(n.seed ?? 'noise'))
  for (let i = 0; i < frames; i++) data[i] = rng.next() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = n.filter ?? 'bandpass'
  filter.frequency.setValueAtTime(n.hz ?? 1400, t)
  if (n.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(40, n.to), t + dur)
  filter.Q.value = n.q ?? 1
  const amp = ctx.createGain()
  const peak = n.gain ?? 0.1
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(peak, t + (n.attack ?? 0.01))
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(amp)
  amp.connect(c.out)
  const wet = n.wet ?? 0.15
  if (wet > 0) {
    const send = ctx.createGain()
    send.gain.value = wet
    amp.connect(send).connect(c.send)
  }
  src.start(t)
  src.stop(t + dur + 0.02)
}

const semi = (root: number, steps: number) => root * Math.pow(2, steps / 12)
const arp = (c: Ctx, root: number, steps: readonly number[], every: number, v: Omit<FmVoice, 'freq' | 'delay'> = {}, from = 0) =>
  steps.forEach((s, i) => fm(c, { ...v, freq: semi(root, s), delay: from + i * every }))

const MAJOR = [0, 4, 7, 12, 16, 19, 24]
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16]

// ─── The sounds ─────────────────────────────────────────────────────────────

const SOUNDS: Readonly<Record<SfxName, (c: Ctx, o: SfxOptions) => void>> = {
  tryk: (c) => fm(c, { freq: 620, ratio: 3, index: 0.6, dur: 0.07, gain: 0.08, wet: 0.05 }),
  klik: (c) => fm(c, { freq: 900, ratio: 1.5, index: 0.8, dur: 0.045, gain: 0.07, wet: 0 }),

  /** Rises with the streak, so the tenth right answer sounds different from the first. */
  rigtigt: (c, o) => {
    const root = semi(523.25, Math.min((o.streak ?? 1) - 1, 8))
    arp(c, root, MAJOR.slice(0, 3), 0.06, { ratio: 2, index: 1.4, dur: 0.22, gain: 0.13 })
  },

  /** Soft and low, like a thoughtful "hmm" — a mistake must never sound like a buzzer. */
  hmm: (c) => {
    fm(c, { freq: 294, to: 262, ratio: 1, index: 0.3, dur: 0.28, attack: 0.04, gain: 0.1, wet: 0.2 })
    fm(c, { freq: 262, to: 247, ratio: 1, index: 0.2, dur: 0.34, attack: 0.05, gain: 0.07, delay: 0.16, wet: 0.2 })
  },

  stjerne: (c) => arp(c, 1046.5, [0, 7, 12, 16, 19], 0.05, { ratio: 3.5, index: 2, dur: 0.5, gain: 0.08, wet: 0.4 }),
  perle: (c) => fm(c, { freq: 1568, ratio: 2.76, index: 1.6, dur: 0.35, gain: 0.08, wet: 0.35 }),

  'level-up': (c) => {
    arp(c, 392, [0, 4, 7, 12, 16, 19, 24], 0.07, { ratio: 2, index: 1.5, dur: 0.3, gain: 0.11 })
    noise(c, { dur: 0.7, gain: 0.03, hz: 5000, to: 9000, filter: 'highpass', delay: 0.3, seed: 'level-up', wet: 0.4 })
  },

  klaek: (c) => {
    noise(c, { dur: 0.08, gain: 0.12, hz: 2200, q: 3, seed: 'crack-1' })
    noise(c, { dur: 0.1, gain: 0.1, hz: 1600, q: 3, delay: 0.14, seed: 'crack-2' })
    arp(c, 523.25, [0, 4, 7, 12], 0.09, { ratio: 2, index: 1.2, dur: 0.35, gain: 0.13 }, 0.3)
  },

  whoosh: (c) => noise(c, { dur: 0.35, gain: 0.07, hz: 400, to: 2400, q: 0.8, attack: 0.12, seed: 'whoosh' }),
  pop: (c) => fm(c, { freq: 600, to: 1300, ratio: 1, index: 0.4, dur: 0.1, gain: 0.12, wet: 0.1 }),
  ding: (c) => fm(c, { freq: 1318.5, ratio: 3.5, index: 1.8, dur: 0.8, gain: 0.09, wet: 0.35 }),

  guld: (c) => {
    arp(c, 880, [0, 7, 12, 19, 24], 0.05, { ratio: 3.5, index: 2.2, dur: 0.5, gain: 0.08, wet: 0.45 })
    noise(c, { dur: 0.6, gain: 0.025, hz: 8000, filter: 'highpass', delay: 0.1, seed: 'guld', wet: 0.5 })
  },

  fanfare: (c) => {
    arp(c, 392, [0, 4, 7, 12, 7, 12, 16], 0.11, { ratio: 1, index: 2.5, dur: 0.32, gain: 0.1, carrier: 'triangle' })
    noise(c, { dur: 0.6, gain: 0.03, hz: 2400, delay: 0.5, seed: 'fanfare', wet: 0.3 })
  },

  moent: (c) => {
    fm(c, { freq: 1975.5, ratio: 1.41, index: 1.4, dur: 0.25, gain: 0.07, wet: 0.2 })
    fm(c, { freq: 2637, ratio: 1.41, index: 1.2, dur: 0.4, gain: 0.07, delay: 0.07, wet: 0.3 })
  },

  koeb: (c) => {
    SOUNDS.moent(c, {})
    arp(c, 659.25, [0, 4, 7], 0.08, { ratio: 2, index: 1, dur: 0.3, gain: 0.1 }, 0.2)
  },

  medalje: (c) => {
    for (const s of [0, 4, 7, 12]) fm(c, { freq: semi(523.25, s), ratio: 3.5, index: 1.8, dur: 1.2, gain: 0.055, wet: 0.45 })
  },

  vaekst: (c) => arp(c, 261.6, PENTA, 0.11, { ratio: 2, index: 1.1, dur: 0.4, gain: 0.1, wet: 0.3 }),

  'klaed-paa': (c) => {
    noise(c, { dur: 0.18, gain: 0.06, hz: 3000, q: 0.7, attack: 0.03, seed: 'rustle-1' })
    noise(c, { dur: 0.16, gain: 0.05, hz: 2200, q: 0.7, attack: 0.03, delay: 0.12, seed: 'rustle-2' })
  },

  kiste: (c) => {
    fm(c, { freq: 180, to: 240, ratio: 5.1, index: 3, dur: 0.3, attack: 0.05, gain: 0.05, wet: 0.2 })
    arp(c, 783.99, [0, 4, 7, 12, 16], 0.06, { ratio: 3.5, index: 1.8, dur: 0.5, gain: 0.07, wet: 0.4 }, 0.3)
  },

  glimmer: (c) => {
    const rng = makeRng(hashSeed('glimmer'))
    for (let i = 0; i < 7; i++) {
      fm(c, { freq: semi(1760, rng.pick(PENTA)), ratio: 3.5, index: 1.5, dur: 0.3, gain: 0.04, delay: i * 0.045 + rng.next() * 0.02, wet: 0.5 })
    }
  },

  snap: (c) => {
    fm(c, { freq: 1200, ratio: 2.3, index: 2, dur: 0.035, gain: 0.08, wet: 0 })
    noise(c, { dur: 0.03, gain: 0.05, hz: 4000, q: 2, seed: 'snap', wet: 0 })
  },

  tik: (c) => fm(c, { freq: 2000, ratio: 1.5, index: 1, dur: 0.025, gain: 0.05, wet: 0 }),

  boble: (c) => fm(c, { freq: 400, to: 900, ratio: 1, index: 0.3, dur: 0.14, attack: 0.02, gain: 0.1, wet: 0.2 }),

  side: (c) => noise(c, { dur: 0.22, gain: 0.05, hz: 1800, to: 4200, q: 0.6, attack: 0.05, seed: 'page' }),

  stempel: (c) => {
    fm(c, { freq: 110, to: 70, ratio: 1, index: 1.5, dur: 0.18, gain: 0.18, wet: 0.1 })
    noise(c, { dur: 0.06, gain: 0.06, hz: 900, q: 1, seed: 'stamp', wet: 0.1 })
  },

  trofae: (c) => {
    arp(c, 523.25, [0, 4, 7, 12], 0.1, { ratio: 3.5, index: 1.6, dur: 0.6, gain: 0.08, wet: 0.4 })
    for (const s of [12, 16, 19]) fm(c, { freq: semi(523.25, s), ratio: 3.5, index: 1.4, dur: 1.2, gain: 0.04, delay: 0.45, wet: 0.5 })
  },

  varme: (c) => {
    fm(c, { freq: 220, ratio: 1, index: 0.6, dur: 0.7, attack: 0.25, gain: 0.08, wet: 0.3 })
    fm(c, { freq: 330, ratio: 1, index: 0.4, dur: 0.7, attack: 0.3, gain: 0.05, wet: 0.3 })
  },

  'laas-op': (c) => {
    fm(c, { freq: 1500, ratio: 2.3, index: 1.5, dur: 0.05, gain: 0.07, wet: 0 })
    arp(c, 659.25, [0, 7, 12], 0.08, { ratio: 3, index: 1.5, dur: 0.45, gain: 0.08, wet: 0.35 }, 0.1)
  },

  taage: (c) => noise(c, { dur: 1.4, gain: 0.05, hz: 300, to: 6000, q: 0.5, attack: 0.5, seed: 'fog', wet: 0.5 }),

  ven: (c) => arp(c, 587.33, [0, 4, 7, 9, 12], 0.09, { ratio: 2, index: 1.3, dur: 0.3, gain: 0.11, wet: 0.3 }),

  flyv: (c) => noise(c, { dur: 0.18, gain: 0.05, hz: 700, to: 3000, q: 0.9, attack: 0.05, seed: 'fly' }),
  land: (c) => fm(c, { freq: 180, to: 130, ratio: 1, index: 0.8, dur: 0.1, gain: 0.12, wet: 0.05 }),
  fjern: (c) => fm(c, { freq: 700, to: 450, ratio: 1, index: 0.4, dur: 0.1, gain: 0.08, wet: 0.05 }),
  lyspaere: (c) => fm(c, { freq: 987.77, ratio: 2, index: 0.9, dur: 0.5, attack: 0.08, gain: 0.06, wet: 0.35 }),
}

/** Plays a named effect on the sfx bus (quiet when effects are off or audio is locked). */
export function playSfx(name: SfxName, opts: SfxOptions = {}): void {
  if (!sfxEnabled()) return
  // Never creates the context: that is the unlock gesture's job (unlock.ts).
  const graph = existingAudioGraph()
  if (!graph || graph.ctx.state !== 'running') return
  try {
    const { ctx, sfxBus } = graph
    SOUNDS[name]({ ctx, out: sfxBus, send: reverbFor(ctx, sfxBus), t0: ctx.currentTime + 0.005 }, opts)
  } catch {
    // effects are decoration; never let them break the game
  }
}

/** V1's names, for code ported from V1. */
export const sfx = {
  tap: () => playSfx('tryk'),
  correct: (streak = 1) => playSfx('rigtigt', { streak }),
  wrong: () => playSfx('hmm'),
  golden: () => playSfx('guld'),
  hatch: () => playSfx('klaek'),
  fanfare: () => playSfx('fanfare'),
  whoosh: () => playSfx('whoosh'),
  pop: () => playSfx('pop'),
}
