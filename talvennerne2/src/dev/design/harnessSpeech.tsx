// Harness-only speech: resolves demo clip texts that other areas own, and shows what is spoken as a
// caption (the voice itself plays through the real speak()). Never imported by the app.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SpeechProvider } from '../../ui/design/speech'
import { clipText, hasClip } from '../../speech/catalog'
import { speak as realSpeak } from '../../audio/voice'
import type { ClipId, SpeechPart } from '../../engine/types'
import { DEMO_CLIPS } from './demoClips'

export const harnessText = (id: ClipId) => (hasClip(id) ? clipText(id) : (DEMO_CLIPS[id] ?? id))

type Listener = (text: string) => void
const listeners = new Set<Listener>()

function describe(parts: SpeechPart[]): string {
  return parts
    .map((p) => {
      if ('clip' in p) return harnessText(p.clip)
      if ('num' in p) return String(p.num)
      if ('free' in p) return p.free
      return '…'
    })
    .join(' ')
}

export function HarnessSpeech({ children }: { children: ReactNode }) {
  return (
    <SpeechProvider
      env={{
        text: harnessText,
        speak(parts, opts) {
          const said = describe(parts)
          listeners.forEach((l) => l(said))
          return realSpeak(parts, opts)
        },
      }}
    >
      {children}
      <Caption />
    </SpeechProvider>
  )
}

function Caption() {
  const [said, setSaid] = useState<{ text: string; key: number } | null>(null)
  useEffect(() => {
    let timer = 0
    const l: Listener = (text) => {
      setSaid({ text, key: Date.now() })
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setSaid(null), 2200)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
      window.clearTimeout(timer)
    }
  }, [])
  if (!said) return null
  return (
    <div className="h-caption" key={said.key} role="status">
      <span className="h-caption__dot" />
      {said.text}
    </div>
  )
}
