// The device voice (speechSynthesis) as the reserve (SPEC §10.5), developed from V1's speech.ts.
// It reads free text (names) and whole statements whose clips are missing or not loaded in time,
// always as words — never digits.
//
// iOS Safari needs care in four places, all handled here: the voice list arrives asynchronously
// (and may never fire voiceschanged), nothing is spoken before a first speak() inside a gesture,
// an utterance that is garbage-collected never fires onend (so a strong reference is kept), and
// onend is sometimes lost anyway (so a timeout resolves it). Without a Danish voice the reserve
// stays silent rather than reading Danish in an English accent; `ended` still resolves on time.

export interface TtsHandle {
  /** Resolves when the utterance ends, is cancelled, or its time runs out. */
  ended: Promise<void>
  cancel(): void
  /** Estimated duration in ms. */
  estimatedMs: number
  /** False when no Danish voice exists and nothing is spoken. */
  audible: boolean
}

export const TTS_RATE = 0.9

let voice: SpeechSynthesisVoice | null = null
let resolved = false
let initialised = false
/** Utterances in flight; WebKit drops onend for utterances it garbage-collects. */
const live = new Set<SpeechSynthesisUtterance>()
let current: { cancel(): void } | null = null

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
}

function pickVoice(): void {
  const s = synth()
  if (!s) return
  const voices = s.getVoices()
  if (voices.length === 0) return
  const danish = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('da'))
  const dk = danish.filter((v) => v.lang.replace('_', '-').toLowerCase() === 'da-dk')
  voice =
    dk.find((v) => v.localService && /sara/i.test(v.name)) ??
    dk.find((v) => v.localService) ??
    dk[0] ??
    danish[0] ??
    null
  resolved = true
}

/** Starts listening for the voice list. Safe to call more than once. */
export function initDeviceTts(): void {
  if (initialised) return
  initialised = true
  const s = synth()
  if (!s) {
    resolved = true
    return
  }
  pickVoice()
  s.addEventListener?.('voiceschanged', pickVoice)
  // Safari sometimes never fires voiceschanged; stop waiting after a beat.
  setTimeout(() => {
    if (!resolved) pickVoice()
    resolved = true
  }, 1200)
}

export function hasDeviceTts(): boolean {
  return synth() !== null
}

/** The chosen Danish voice, or null. */
export function danishVoice(): SpeechSynthesisVoice | null {
  initDeviceTts()
  if (!voice) pickVoice()
  return voice
}

/** Every voice the device reports (for the diagnosis page). */
export function deviceVoices(): SpeechSynthesisVoice[] {
  return synth()?.getVoices() ?? []
}

/** Rough duration of Danish speech at the reserve's rate: ~13 characters a second at rate 1. */
export function estimateSpeechMs(text: string, rate = TTS_RATE): number {
  return Math.round((text.length / 13 / rate) * 1000) + 300
}

/**
 * iOS only speaks after a speak() inside a user gesture. Call from the unlock gesture: it speaks
 * an empty, silent utterance once.
 */
let primed = false
export function primeDeviceTts(): void {
  const s = synth()
  if (!s || primed) return
  primed = true
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    u.lang = 'da-DK'
    s.speak(u)
  } catch {
    // speech is a reserve; never let it break the game
  }
}

/** Speaks `text` with the Danish device voice. Cancels whatever the device voice is saying. */
export function ttsSpeak(text: string, opts: { rate?: number } = {}): TtsHandle {
  const rate = opts.rate ?? TTS_RATE
  const estimatedMs = estimateSpeechMs(text, rate)
  const s = synth()
  const v = danishVoice()
  current?.cancel()

  let finish: () => void = () => {}
  const ended = new Promise<void>((resolve) => {
    finish = resolve
  })
  let done = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let utterance: SpeechSynthesisUtterance | null = null
  const complete = () => {
    if (done) return
    done = true
    if (timer !== undefined) clearTimeout(timer)
    if (utterance) live.delete(utterance)
    if (current === handle) current = null
    finish()
  }

  const audible = !!(s && v && text.trim())
  const handle: TtsHandle = {
    ended,
    estimatedMs,
    audible,
    cancel() {
      if (done) return
      if (audible) {
        try {
          s?.cancel()
        } catch {
          // ignore
        }
      }
      complete()
    },
  }
  current = handle

  if (!audible) {
    // Silent: resolve when the words would have been spoken, so answer timers still line up.
    timer = setTimeout(complete, estimatedMs)
    return handle
  }

  try {
    const u = new SpeechSynthesisUtterance(text)
    utterance = u
    u.voice = v
    u.lang = v!.lang || 'da-DK'
    u.rate = rate
    u.pitch = 1.05
    u.onend = complete
    u.onerror = complete
    live.add(u)
    // A cancel immediately followed by speak() can swallow the new utterance on WebKit.
    const busy = s!.speaking || s!.pending
    if (busy) s!.cancel()
    if (busy) setTimeout(() => !done && s!.speak(u), 60)
    else s!.speak(u)
    // Reserve for a lost onend: generous, since a slow device voice must not be cut short.
    timer = setTimeout(complete, estimatedMs * 2 + 2000)
  } catch {
    timer = setTimeout(complete, estimatedMs)
  }
  return handle
}

/** Stops the device voice. */
export function ttsCancel(): void {
  current?.cancel()
  try {
    synth()?.cancel()
  } catch {
    // ignore
  }
}
