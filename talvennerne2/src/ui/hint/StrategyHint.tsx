// StrategyHint (SPEC §3.5): the strategy after a mistake — a picture and the words the voice reads,
// side by side on one card. The words are tappable to hear them again. The round screen does the
// reading, so the card itself stays quiet and can also be shown in the design harness.
import { useSpeech } from '../design/speech'
import { SpokenText } from '../design/SpokenText'
import { cx } from '../design/cx'
import { displayText } from './displayText'
import { HintVisual } from './HintVisual'
import type { ResolvedHint } from './hintFor'

export function StrategyHint({ hint, className }: { hint: ResolvedHint; className?: string }) {
  const speech = useSpeech()
  const text = displayText(hint.speech, speech.text)
  const hasPicture = hint.visual.scene !== 'none'
  return (
    <div className={cx('tv-hint', hint.animated && 'is-animated', !hasPicture && 'is-words', className)} data-hint={hint.misconception ?? 'standard'}>
      {hasPicture && (
        <div className="tv-hint__visual">
          <HintVisual visual={hint.visual} />
        </div>
      )}
      {text && <SpokenText parts={hint.speech} text={text} className="tv-hint__text" />}
    </div>
  )
}
