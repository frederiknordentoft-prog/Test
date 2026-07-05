/**
 * Al lyd er syntetiseret med Web Audio — ingen eksterne filer.
 * AudioContext skabes/genoptages først ved en brugerinteraktion (iOS-krav).
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

/** Kald ved første pointerdown/keydown — låser lyd op på iOS Safari. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

export function setMuted(m: boolean): void {
  muted = m
}

export function isMuted(): boolean {
  return muted
}

function withCtx(fn: (c: AudioContext, out: GainNode) => void): void {
  if (muted || !ctx || !master || ctx.state !== 'running') return
  fn(ctx, master)
}

function tone(
  c: AudioContext,
  out: GainNode,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak: number,
): void {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(gain).connect(out)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

/** Kort metallisk "klink" når en brik lander. Tungere brik → dybere klang. */
export function playClink(mass: number): void {
  withCtx((c, out) => {
    const t = c.currentTime
    // 1 u ≈ 1500 Hz, 238 u ≈ 320 Hz — logaritmisk mapning
    const f = 1500 / Math.pow(mass, 0.28)
    tone(c, out, f, t, 0.12, 'triangle', 0.35)
    tone(c, out, f * 2.76, t, 0.07, 'sine', 0.12) // metallisk overtone
  })
}

/** Lille "tik" når en brik fjernes. */
export function playRemove(): void {
  withCtx((c, out) => {
    tone(c, out, 520, c.currentTime, 0.06, 'square', 0.08)
  })
}

/** Skinnende arpeggio + akkord når vægten står lige. */
export function playBalance(): void {
  withCtx((c, out) => {
    const t = c.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    notes.forEach((f, i) => {
      tone(c, out, f, t + i * 0.07, 0.5, 'triangle', 0.22)
      tone(c, out, f * 2, t + i * 0.07, 0.35, 'sine', 0.06)
    })
  })
}

/** Sejrsfanfare (lidt rigere end balance-klangen). */
export function playVictory(): void {
  withCtx((c, out) => {
    const t = c.currentTime
    const chord = [392, 493.88, 587.33, 783.99] // G4 B4 D5 G5
    chord.forEach((f, i) => {
      tone(c, out, f, t + i * 0.05, 0.9, 'triangle', 0.2)
    })
    tone(c, out, 1567.98, t + 0.28, 0.6, 'sine', 0.1) // G6-glimmer
  })
}

/** Haptisk feedback hvor det understøttes (Android m.fl.). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignorér — haptik er ren bonus
  }
}
