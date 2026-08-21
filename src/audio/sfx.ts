/**
 * Every sound in the app is synthesised here. No audio files, nothing to load,
 * and the pitch can follow the streak — which is most of why a run of correct
 * answers feels like it is building to something.
 */

let ctx: AudioContext | null = null
let enabled = true

function audio(): AudioContext | null {
  if (!enabled) return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  return ctx
}

/** iOS starts every AudioContext suspended. Call this from the first real tap. */
export function unlockAudio(): void {
  const a = audio()
  if (a && a.state === 'suspended') void a.resume().catch(() => undefined)
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  if (!on && ctx) void ctx.suspend().catch(() => undefined)
  if (on) unlockAudio()
}

interface ToneOptions {
  freq: number
  /** slide to this frequency across the note */
  to?: number
  dur?: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

function tone({ freq, to, dur = 0.18, type = 'sine', gain = 0.18, delay = 0 }: ToneOptions): void {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + delay
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur)
  // quick attack, smooth tail — a hard stop clicks
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(amp).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noise(dur = 0.25, gain = 0.12, hz = 1400): void {
  const a = audio()
  if (!a) return
  const frames = Math.floor(a.sampleRate * dur)
  const buffer = a.createBuffer(1, frames, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = hz
  const amp = a.createGain()
  amp.gain.value = gain
  src.connect(filter).connect(amp).connect(a.destination)
  src.start()
}

const MAJOR = [0, 4, 7, 12, 16, 19, 24]
const semitone = (root: number, steps: number) => root * Math.pow(2, steps / 12)

export const sfx = {
  tap: () => tone({ freq: 520, dur: 0.06, type: 'triangle', gain: 0.09 }),

  /** rises with the streak, so the tenth right answer sounds different from the first */
  correct: (streak = 1) => {
    const root = 440 * Math.pow(2, Math.min(streak - 1, 8) / 12)
    MAJOR.slice(0, 3).forEach((step, i) =>
      tone({ freq: semitone(root, step), dur: 0.16, type: 'triangle', gain: 0.15, delay: i * 0.055 }),
    )
  },

  /** soft and low — a mistake must never sound like a buzzer */
  wrong: () => {
    tone({ freq: 300, to: 220, dur: 0.22, type: 'sine', gain: 0.13 })
    tone({ freq: 200, to: 160, dur: 0.26, type: 'sine', gain: 0.08, delay: 0.03 })
  },

  golden: () => {
    ;[0, 7, 12, 19].forEach((step, i) =>
      tone({ freq: semitone(880, step), dur: 0.12, type: 'sine', gain: 0.12, delay: i * 0.05 }),
    )
  },

  hatch: () => {
    noise(0.18, 0.08, 900)
    ;[0, 4, 7, 12].forEach((step, i) =>
      tone({ freq: semitone(523, step), dur: 0.3, type: 'triangle', gain: 0.16, delay: 0.1 + i * 0.09 }),
    )
  },

  fanfare: () => {
    ;[0, 4, 7, 12, 7, 12, 16].forEach((step, i) =>
      tone({ freq: semitone(392, step), dur: 0.26, type: 'triangle', gain: 0.15, delay: i * 0.11 }),
    )
    noise(0.5, 0.05, 2400)
  },

  whoosh: () => noise(0.3, 0.06, 700),

  pop: () => tone({ freq: 700, to: 1200, dur: 0.1, type: 'sine', gain: 0.12 }),
}
