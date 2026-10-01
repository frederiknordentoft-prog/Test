// Every piece of text a child can see goes through SpokenText (SPEC §3.4): it shows the clip's
// Danish text from the catalogue and reads it aloud when tapped, so nothing depends on reading.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ElementType } from 'react'
import type { ClipId, SpeechPart } from '../../engine/types'
import { useSpeech } from './speech'
import { cx } from './cx'

type Source = { clip: ClipId; parts?: never; text?: never } | { parts: SpeechPart[]; text: string; clip?: never }

export type SpokenTextProps = Source & {
  as?: ElementType
  className?: string
  style?: CSSProperties
  /** Show the text without making it tappable (e.g. inside a button that speaks for itself). */
  silent?: boolean
  /** Highlight while the voice says this text (used when a sequence reads options aloud). */
  active?: boolean
}

/** Minimum time the "speaking" highlight stays on, so a tap always gives visible feedback. */
const MIN_FEEDBACK_MS = 450

export function SpokenText(props: SpokenTextProps) {
  const { as: Tag = 'span', className, style, silent, active } = props
  const speech = useSpeech()
  const [speaking, setSpeaking] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const text = props.clip !== undefined ? speech.text(props.clip) : props.text
  const parts: SpeechPart[] = props.clip !== undefined ? [{ clip: props.clip }] : props.parts

  const say = () => {
    const started = performance.now()
    const handle = speech.speak(parts)
    setSpeaking(true)
    void handle.ended.then(() => {
      const wait = Math.max(0, MIN_FEEDBACK_MS - (performance.now() - started))
      window.setTimeout(() => {
        if (alive.current) setSpeaking(false)
      }, wait)
    })
  }

  if (silent) {
    return (
      <Tag className={cx('tv-spoken', active && 'is-speaking', className)} style={style}>
        {text}
      </Tag>
    )
  }
  return (
    <Tag
      className={cx('tv-spoken tv-spoken--tap', (speaking || active) && 'is-speaking', className)}
      style={style}
      onClick={say}
      data-clip={props.clip}
    >
      {text}
    </Tag>
  )
}
