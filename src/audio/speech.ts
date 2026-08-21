/**
 * Danish text-to-speech.
 *
 * Most children in 0.–1. klasse cannot read the question, so this is how the task
 * is actually delivered — not a convenience. iOS Safari makes that awkward in
 * three specific ways, all handled here: voices arrive asynchronously and the
 * list is empty on first call, nothing is spoken before a user gesture, and a
 * queued utterance blocks everything after it. If no Danish voice exists the app
 * goes quiet rather than reading Danish sums in an English accent.
 */

let danishVoice: SpeechSynthesisVoice | null = null
let resolved = false
let enabled = true

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
}

function pickVoice(): void {
  const s = synth()
  if (!s) return
  const voices = s.getVoices()
  if (voices.length === 0) return
  danishVoice =
    voices.find((v) => v.lang === 'da-DK' && v.localService) ??
    voices.find((v) => v.lang === 'da-DK') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('da')) ??
    null
  resolved = true
}

export function initSpeech(): void {
  const s = synth()
  if (!s) {
    resolved = true
    return
  }
  pickVoice()
  s.addEventListener('voiceschanged', pickVoice)
  // Safari sometimes never fires voiceschanged; give up on waiting after a beat
  window.setTimeout(() => {
    if (!resolved) pickVoice()
    resolved = true
  }, 1200)
}

export function hasDanishVoice(): boolean {
  return danishVoice !== null
}

export function setSpeechEnabled(on: boolean): void {
  enabled = on
  if (!on) stopSpeech()
}

export function speak(text: string): void {
  const s = synth()
  if (!s || !enabled || !text) return
  if (!resolved) pickVoice()
  if (!danishVoice) return // no Danish voice — stay silent rather than mangle it
  try {
    s.cancel() // never let utterances queue up behind each other
    const u = new SpeechSynthesisUtterance(text)
    u.voice = danishVoice
    u.lang = 'da-DK'
    u.rate = 0.95
    u.pitch = 1.1
    s.speak(u)
  } catch {
    // speech is a bonus; never let it break the game
  }
}

export function stopSpeech(): void {
  try {
    synth()?.cancel()
  } catch {
    // ignore
  }
}
