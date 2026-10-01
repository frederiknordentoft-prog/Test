// Small pieces shared by the listening page's sections.
import { createContext, useContext } from 'react'
import { speak } from '../audio/voice'
import type { SpeechPart } from '../engine/types'
import { compile } from '../speech/compile'
import { Icon } from '../ui/design/Icon'

/** Clip ids that have a recording (from the manifest); null while it loads. */
export const RecordedContext = createContext<ReadonlySet<string> | null>(null)

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
  const recorded = useContext(RecordedContext)
  if (c.utterances.length === 0) return null
  const unrecorded = recorded ? c.clips.filter((id) => !recorded.has(id)) : []
  const titleOf = (id: string) =>
    c.missing.includes(id) ? 'Findes ikke i kataloget' : unrecorded.includes(id) ? 'Ikke optaget endnu' : undefined
  const classOf = (id: string) => (c.missing.includes(id) ? 'lyt-missing' : unrecorded.includes(id) ? 'lyt-unrecorded' : undefined)
  return (
    <div className="lyt-line">
      <PlayButton parts={parts} label={`Afspil: ${c.text}`} />
      <div>
        {label ? <div className="lyt-sub">{label}</div> : null}
        <div className="lyt-line__text">{c.text}</div>
        <div className="lyt-line__clips">
          {c.clips.map((id, i) => (
            <code key={`${id}-${i}`} className={classOf(id)} title={titleOf(id)}>
              {id}
            </code>
          ))}
        </div>
        {unrecorded.length > 0 || c.missing.length > 0 ? (
          <div className="lyt-sub">Ikke alle klip er optaget: hele udsagnet læses af enhedens stemme.</div>
        ) : null}
      </div>
    </div>
  )
}
