// Overlays of the round: the pause card behind ✕ (two equal buttons, neither has focus: SPEC §13.7),
// "Tryk for at fortsætte" after the app comes back from the background (SPEC §10.5: the tap also
// wakes the audio), and the "Perfekt tur!" banner.
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { DUR, fade, isCalm, springInY } from '../../../design/motion'
import { useSpeech } from '../../../design/speech'

function Layer({ children, className }: { children: ReactNode; className: string }) {
  if (typeof document === 'undefined') return null
  return createPortal(<div className={`tv-roundlayer ${className} tv-touch`}>{children}</div>, document.body)
}

export function PauseOverlay({ onResume, onLeave }: { onResume(): void; onLeave(): void }) {
  const speech = useSpeech()
  const card = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (scrim.current) fade(scrim.current, 0, 1, DUR.base)
    if (card.current) {
      if (isCalm()) fade(card.current, 0, 1, DUR.fast)
      else springInY(card.current, '40px')
    }
  }, [])
  // the card says what it is, for a child who cannot read it (review r1 P3-17)
  useEffect(() => {
    speech.speak([{ clip: 's.round.pause.title' }, { clip: 's.round.pause.body' }])
    // once, when the card opens
  }, [])
  return (
    <Layer className="tv-pause">
      <div ref={scrim} className="tv-pause__scrim" onClick={onResume} />
      <div ref={card} className="tv-pause__card" role="dialog" aria-modal="true" data-pause="">
        <span className="tv-pause__badge" aria-hidden>
          <Icon name="pause" size={34} strokeWidth={2.6} solid />
        </span>
        <SpokenText as="h2" clip="s.round.pause.title" className="tv-pause__title" />
        <SpokenText as="p" clip="s.round.pause.body" className="tv-pause__body" />
        <div className="tv-pause__actions">
          <Button clip="s.round.pause.resume" icon="play" variant="primary" block onClick={onResume} data-resume="" />
          <Button clip="s.ui.toMap" icon="map" variant="secondary" block onClick={onLeave} data-leave="" />
        </div>
      </div>
    </Layer>
  )
}

export function ContinueOverlay({ onContinue }: { onContinue(): void }) {
  return (
    <Layer className="tv-continue">
      <button type="button" className="tv-continue__hit" onClick={onContinue} data-continue="">
        <span className="tv-continue__btn" aria-hidden>
          <Icon name="play" size="56%" strokeWidth={2.4} solid />
        </span>
        <SpokenText clip="s.round.continue" silent className="tv-continue__text" />
      </button>
    </Layer>
  )
}

export function PerfectBanner() {
  return (
    <Layer className="tv-perfect">
      <div className="tv-perfect__ribbon" data-perfect="">
        <Icon name="star" size={40} solid className="tv-perfect__star" />
        <SpokenText clip="s.round.perfect" silent className="tv-perfect__text" />
        <Icon name="star" size={40} solid className="tv-perfect__star" />
      </div>
    </Layer>
  )
}
