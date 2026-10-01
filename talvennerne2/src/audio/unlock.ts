// Audio unlock and iOS audio session (SPEC §10.5).
//
// 1. Unlock runs on `touchend`/`click` — iOS only counts those as activating gestures, never
//    `pointerdown` — and resumes the context, plays one silent frame and primes the device voice.
// 2. Children cannot read, so speech must be heard even with the silent switch on: the audio session
//    is set to 'playback' where `navigator.audioSession` exists (iOS 17+). Older iOS gets the same
//    effect from a looping, silent `<audio playsinline>` started inside the gesture. Both are skipped
//    when the device setting "Følg lydløs-knappen" is on. The setting lives in `talvennerne2.boot`
//    (`device.followSilentSwitch`), written only by useSession.setDevice(); it is re-read at every
//    gesture, and setFollowSilentSwitch() applies a change at once.
// 3. After `visibilitychange → visible` (and when iOS interrupts the context) the app must show
//    "Tryk for at fortsætte": the next tap resumes audio. Subscribe with onResumeNeeded().
import { readBoot } from '../data/namespace'
import { audioGraph, existingAudioGraph } from './engine'
import { primeDeviceTts } from './deviceTts'

type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
interface AudioSessionLike {
  type: AudioSessionType
}

let installed = false
let unlocked = false
let resumeNeeded = false
let silentLoop: HTMLAudioElement | null = null
const listeners = new Set<(needed: boolean) => void>()

export function audioSession(): AudioSessionLike | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as unknown as { audioSession?: AudioSessionLike }).audioSession ?? null
}

/** Device setting "Følg lydløs-knappen": when on, the silent switch mutes the app. Default off. */
export function followSilentSwitch(): boolean {
  return readBoot().device.followSilentSwitch
}

/**
 * Applies a new value of the setting now (call it next to useSession.setDevice, which stores it);
 * without the call the next tap applies it.
 */
export function setFollowSilentSwitch(on: boolean): void {
  applyAudioSession(on)
  if (on) stopSilentLoop()
}

/** Sets the audio session type where the API exists. Returns the type in effect, or null. */
export function applyAudioSession(follow = followSilentSwitch()): AudioSessionType | null {
  const session = audioSession()
  if (!session) return null
  try {
    session.type = follow ? 'auto' : 'playback'
  } catch {
    // unsupported value on this build
  }
  return session.type
}

function isAppleTouch(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** One second of 8 kHz, 8-bit silence as a WAV data URI. */
function silentWavUri(): string {
  const rate = 8000
  const n = rate
  const bytes = new Uint8Array(44 + n)
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + n, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, n, true)
  bytes.fill(128, 44) // 8-bit PCM silence is the midpoint
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:audio/wav;base64,${btoa(binary)}`
}

/** Older iOS: a playing media element switches the session to playback, so Web Audio ignores the switch. */
function startSilentLoop(follow: boolean): void {
  if (follow || audioSession() || !isAppleTouch()) return
  try {
    if (!silentLoop) {
      const el = document.createElement('audio')
      el.setAttribute('playsinline', '')
      el.setAttribute('webkit-playsinline', '')
      el.loop = true
      el.preload = 'auto'
      el.src = silentWavUri()
      silentLoop = el
    }
    void silentLoop.play().catch(() => undefined)
  } catch {
    // never let the workaround break the game
  }
}

function stopSilentLoop(): void {
  silentLoop?.pause()
}

function setResumeNeeded(needed: boolean): void {
  if (resumeNeeded === needed) return
  resumeNeeded = needed
  for (const cb of listeners) cb(needed)
}

/**
 * Unlocks audio. Must run inside a touchend/click handler; installAudioUnlock() does this for every
 * tap, and "Tryk for at fortsætte" can call it directly.
 */
export function unlockAudio(): void {
  const follow = followSilentSwitch()
  applyAudioSession(follow)
  startSilentLoop(follow)
  primeDeviceTts()
  const g = audioGraph()
  if (!g) {
    setResumeNeeded(false)
    return
  }
  watchState(g.ctx)
  const { ctx } = g
  // One silent frame from inside the gesture is what WebKit counts as starting audio.
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    // ignore
  }
  if (ctx.state !== 'running') {
    void ctx.resume().then(
      () => {
        unlocked = ctx.state === 'running'
        if (unlocked) setResumeNeeded(false)
      },
      () => undefined,
    )
  } else {
    unlocked = true
    setResumeNeeded(false)
  }
}

/** True once the context has run after a gesture. */
export function isAudioUnlocked(): boolean {
  return unlocked && existingAudioGraph()?.ctx.state === 'running'
}

/** Whether "Tryk for at fortsætte" should be shown now. */
export function isResumeNeeded(): boolean {
  return resumeNeeded
}

/** Called with true when the app must ask for a tap to continue, and false once audio runs again. */
export function onResumeNeeded(cb: (needed: boolean) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function onGesture(): void {
  unlockAudio()
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') {
    stopSilentLoop()
    return
  }
  // Back from the home screen or another app: iOS has suspended or interrupted the context.
  if (unlocked) setResumeNeeded(true)
}

const watched = new WeakSet<AudioContext>()

/** Follows iOS interruptions: 'interrupted' is WebKit's state for a call, Siri or another app. */
function watchState(ctx: AudioContext): void {
  if (watched.has(ctx)) return
  watched.add(ctx)
  ctx.addEventListener('statechange', () => {
    const state = ctx.state as string
    if (state === 'running') setResumeNeeded(false)
    else if (unlocked && (state === 'suspended' || state === 'interrupted') && document.visibilityState === 'visible') {
      setResumeNeeded(true)
    }
  })
}

/**
 * Installs the gesture and visibility listeners once. The AudioContext itself is created by the
 * first gesture, so no browser ever sees a context that tries to start without one.
 */
export function installAudioUnlock(): () => void {
  if (installed || typeof document === 'undefined') return () => {}
  installed = true
  const opts: AddEventListenerOptions = { capture: true, passive: true }
  document.addEventListener('touchend', onGesture, opts)
  document.addEventListener('click', onGesture, opts)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    installed = false
    document.removeEventListener('touchend', onGesture, opts)
    document.removeEventListener('click', onGesture, opts)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
