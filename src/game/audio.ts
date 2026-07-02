import type { BallType } from '../types'

// ---------------------------------------------------------------------------
// Deterministic juice: a tiny Web Audio engine built ONLY from oscillators —
// no asset files. Sounds are driven by trajectory-derived events (impact
// speed, coin ticks, break ticks, run outcome), so the audio is as
// reproducible as the physics. iOS requires the context to be created/resumed
// inside a user gesture — call unlockAudio() from the drop button handler.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null
let muted = false

export function setMuted(m: boolean): void {
  muted = m
}

/** Create/resume the context inside a user gesture (required on iOS). */
export function unlockAudio(): void {
  if (muted) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null // audio unsupported — the game plays silently
  }
}

type ToneOpts = {
  freq: number
  endFreq?: number
  type: OscillatorType
  duration: number
  volume: number
  attack?: number
}

function tone(o: ToneOpts): void {
  if (muted || !ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.endFreq), t0 + o.duration)
  const attack = o.attack ?? 0.004
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(o.volume, t0 + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + o.duration + 0.02)
}

/**
 * A collision: pitch and volume scale with impact speed; the timbre is the
 * ball's material — metallic click (iron), wooden tok, rubbery boing.
 */
export function playImpact(speed: number, ball: BallType): void {
  const s = Math.min(1, speed / 16)
  const volume = 0.04 + s * 0.16
  if (ball === 'iron') {
    tone({ freq: 1500 + s * 900, endFreq: 700, type: 'square', duration: 0.045, volume: volume * 0.7 })
  } else if (ball === 'wood') {
    tone({ freq: 320 + s * 260, endFreq: 180, type: 'triangle', duration: 0.07, volume })
  } else {
    tone({ freq: 190 + s * 130, endFreq: 80, type: 'sine', duration: 0.16, volume })
  }
}

/** Pentatonic pling, one step higher for every coin taken in the same run. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0] // C D E G A (C5…)

export function playCoin(indexInRun: number): void {
  const freq = (PENTATONIC[indexInRun % 5] ?? 523.25) * (1 + Math.floor(indexInRun / 5))
  tone({ freq, type: 'sine', duration: 0.22, volume: 0.16 })
  tone({ freq: freq * 2, type: 'sine', duration: 0.12, volume: 0.05 })
}

/** A plank shatters: short detuned saw burst falling in pitch. */
export function playBreak(): void {
  tone({ freq: 400, endFreq: 90, type: 'sawtooth', duration: 0.18, volume: 0.14 })
  tone({ freq: 631, endFreq: 130, type: 'sawtooth', duration: 0.14, volume: 0.09 })
}

/** The booster fires: rising whoosh. */
export function playBoost(): void {
  tone({ freq: 220, endFreq: 880, type: 'sawtooth', duration: 0.16, volume: 0.09 })
}

/** Portal swallow/spit: shimmering fifth. */
export function playPortal(): void {
  tone({ freq: 660, endFreq: 1320, type: 'sine', duration: 0.2, volume: 0.1 })
  tone({ freq: 990, endFreq: 495, type: 'sine', duration: 0.2, volume: 0.07 })
}

/** Win arpeggio — one note per star earned (the count-up you can hear). */
export function playWin(stars: number): void {
  const notes = [523.25, 659.25, 783.99, 1046.5].slice(0, Math.max(1, stars + 1))
  notes.forEach((freq, i) => {
    setTimeout(() => tone({ freq, type: 'triangle', duration: 0.3, volume: 0.16 }), i * 220)
  })
}

/** Fail: a short low thud. */
export function playFail(): void {
  tone({ freq: 140, endFreq: 55, type: 'sine', duration: 0.3, volume: 0.18 })
}
