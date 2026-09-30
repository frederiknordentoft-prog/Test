// How design components reach the voice. Production uses the frozen `speak()`/`hush()` from
// src/audio/voice.ts and `clipText()` from src/speech/catalog.ts directly; a provider can wrap a
// subtree to observe or redirect speech (the design harness shows a caption, tests record calls).
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { hush, speak } from '../../audio/voice'
import type { SpeakHandle, SpeakOptions } from '../../audio/voice'
import { clipText } from '../../speech/catalog'
import type { ClipId, SpeechPart } from '../../engine/types'

export interface SpeechEnv {
  text(id: ClipId): string
  speak(parts: SpeechPart[], opts?: SpeakOptions): SpeakHandle
  hush(): void
}

const DEFAULT_ENV: SpeechEnv = { text: clipText, speak, hush }
const SpeechContext = createContext<SpeechEnv>(DEFAULT_ENV)

export function SpeechProvider({ env, children }: { env: Partial<SpeechEnv>; children: ReactNode }) {
  return <SpeechContext.Provider value={{ ...DEFAULT_ENV, ...env }}>{children}</SpeechContext.Provider>
}

export function useSpeech(): SpeechEnv {
  return useContext(SpeechContext)
}
