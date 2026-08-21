import { useState } from 'react'
import { CHILD_AVATARS } from '../../content/names'
import { useProfile } from '../../state/useProfile'
import { Backdrop } from '../components/Backdrop'
import { BigButton } from '../components/BigButton'
import { Creature } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { sfx } from '../../audio/sfx'
import { speak } from '../../audio/speech'

/** First run. Two taps at most — a six-year-old should be playing within seconds. */
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const setChild = useProfile((s) => s.setChild)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string>(CHILD_AVATARS[0])

  return (
    <div className="app-height relative overflow-hidden">
      <Backdrop palette={{ skyFrom: '#1b1233', skyTo: '#4c2f8a', ground: '#150e29', accent: '#ffd166', glow: '#f9a8d4' }} seed="velkommen" />

      <div className="safe-top safe-x safe-bottom relative z-10 flex h-full flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-end gap-2">
          {['skov-ugle', 'eng-bi', 'hule-drys'].map((id, i) => (
            <Creature key={id} look={lookFor(id, i, [140, 60, 45][i])} size={i === 1 ? 108 : 84} />
          ))}
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-black">Talvennerne</h1>
          <p className="mt-1 text-base opacity-80">Regn og saml små væsener</p>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 12))}
          placeholder="Hvad hedder du?"
          aria-label="Dit navn"
          className="w-full max-w-xs rounded-2xl bg-black/30 px-4 py-4 text-center text-xl font-bold ring-1 ring-white/20 outline-none placeholder:opacity-55 focus:ring-white/55"
        />

        <div className="flex max-w-xs flex-wrap justify-center gap-2">
          {CHILD_AVATARS.map((emoji) => (
            <button key={emoji} type="button"
              onClick={() => { sfx.pop(); setAvatar(emoji) }}
              className={`tap-target grid h-14 w-14 min-h-0 place-items-center rounded-2xl text-3xl ring-1 transition-colors ${
                avatar === emoji ? 'bg-white/90 ring-white' : 'bg-white/10 ring-white/20'
              }`}>
              {emoji}
            </button>
          ))}
        </div>

        <BigButton tone="gold" className="h-16 w-full max-w-xs text-2xl"
          onPress={() => {
            setChild(name.trim(), avatar)
            speak(name.trim() ? `Hej ${name.trim()}! Så spiller vi.` : 'Så spiller vi!')
            onDone()
          }}>
          Kom i gang
        </BigButton>
      </div>
    </div>
  )
}
