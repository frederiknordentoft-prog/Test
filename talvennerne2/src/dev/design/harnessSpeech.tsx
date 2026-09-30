// Harness-only speech: resolves UI and demo clip texts before the real catalogue exists, and shows
// what would be spoken as a caption (voice.ts is still a stub). Never imported by the app.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SpeechProvider } from '../../ui/design/speech'
import { UI_CLIPS } from '../../ui/design/clips'
import { clipText } from '../../speech/catalog'
import { speak as realSpeak } from '../../audio/voice'
import type { ClipId, SpeechPart } from '../../engine/types'
import { DEMO_CLIPS } from './demoClips'

const TABLE: Record<string, string> = { ...UI_CLIPS, ...DEMO_CLIPS }
export const harnessText = (id: ClipId) => TABLE[id] ?? clipText(id)

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
