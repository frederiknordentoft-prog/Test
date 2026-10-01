// Small pieces shared by the listening page's sections.
import { speak } from '../audio/voice'
import type { SpeechPart } from '../engine/types'
import { compile } from '../speech/compile'
import { Icon } from '../ui/design/Icon'

export function PlayButton({ parts, label }: { parts: SpeechPart[]; label: string }) {
  return (
    <button type="button" className="lyt-play" onClick={() => speak(parts)} aria-label={label} title={label}>
      <Icon name="play" size={20} solid />
    </button>
  )
}

/** A statement with its play button, its Danish text and the clips it is made of. */
export function SpeechLine({ parts, label }: { parts: SpeechPart[]; label?: string }) {
  const c = compile(parts)
  if (c.utterances.length === 0) return null
  return (
    <div className="lyt-line">
      <PlayButton parts={parts} label={`Afspil: ${c.text}`} />
      <div>
        {label ? <div className="lyt-sub">{label}</div> : null}
        <div className="lyt-line__text">{c.text}</div>
        <div className="lyt-line__clips">
          {c.clips.map((id, i) => (
            <code key={`${id}-${i}`} className={c.missing.includes(id) ? 'lyt-missing' : undefined} title={c.missing.includes(id) ? 'Findes ikke i kataloget' : undefined}>
              {id}
            </code>
          ))}
        </div>
      </div>
    </div>
  )
}
