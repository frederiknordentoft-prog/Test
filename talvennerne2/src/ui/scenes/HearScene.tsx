// Prompt 'hear' (hear20, hear100, hear1000): nothing to see but a big loudspeaker. It ripples while
// the number is read and reads it again when tapped.
import { Icon } from '../design/Icon'
import { usePress } from '../design/usePress'
import { useSpeech } from '../design/speech'
import { cx } from '../design/cx'

export function HearScene({ speaking, onHear }: { speaking: boolean; onHear?: () => void }) {
  const speech = useSpeech()
  const { pressProps } = usePress(!onHear)
  return (
    <button
      type="button"
      className={cx('tv-hear tv-touch', speaking && 'is-speaking')}
      onClick={onHear}
      disabled={!onHear}
      aria-label={speech.text('s.ui.replay')}
      data-hear=""
      {...pressProps}
    >
      <span className="tv-hear__wave tv-hear__wave--2" aria-hidden />
      <span className="tv-hear__wave" aria-hidden />
      <span className="tv-hear__face">
        <Icon name="soundOn" size="58%" strokeWidth={2.2} solid />
      </span>
    </button>
  )
}
