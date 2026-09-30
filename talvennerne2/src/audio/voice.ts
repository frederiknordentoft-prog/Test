// Spoken output (SPEC §10.5). The signatures are frozen by the integrator: screens and SpokenText
// call `speak()`; W3 (speech/audio) replaces this placeholder with the pre-recorded voice engine.
import type { SpeechPart } from '../engine/types'

export interface SpeakHandle {
  /** Resolves at the scheduled end — also when the device is muted — so answer timers can start. */
  ended: Promise<void>
  /** Fades the voice out within ~30 ms. A new task or answer always cancels what is playing. */
  cancel(): void
  /** Planned duration in ms (0 when unknown). */
  durationMs: number
}

export interface SpeakOptions {
  /** Cancel whatever is playing first (default true). */
  interrupt?: boolean
}

export function speak(parts: SpeechPart[], opts: SpeakOptions = {}): SpeakHandle {
  void parts
  void opts
  return { ended: Promise.resolve(), cancel() {}, durationMs: 0 }
}

/** Stop all speech. */
export function hush(): void {}
