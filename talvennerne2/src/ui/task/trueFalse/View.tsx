// trueFalse (SPEC §3.2): the statement is the prompt; two big buttons answer it — a green tick for
// "ja" and a coral cross for "nej", no words. The buttons say their name when the voice reads the
// choices, so a child who cannot read knows which is which.
import { playSfx } from '../../../audio/sfx'
import { AnswerCard } from '../../design/AnswerCard'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { cardState } from '../choice/View'
import { YesNoGlyph } from '../faces'
import type { FaceProps, TaskViewProps } from '../types'

const CHOICES = ['yes', 'no'] as const

export function TrueFalseView({ mode, given, onSubmit, onActivity, speaking }: TaskViewProps) {
  const speech = useSpeech()
  return (
    <div className="tv-tf" data-kind="trueFalse">
      {CHOICES.map((v, i) => (
        <AnswerCard
          key={v}
          size="lg"
          className={cx('tv-tf__btn', v === 'yes' ? 'is-yes' : 'is-no')}
          state={cardState(mode, v, given)}
          speaking={speaking === i}
          disabled={mode === 'idle'}
          label={speech.text(v === 'yes' ? 's.ui.yes' : 's.ui.no')}
          data-option={v}
          onClick={() => {
            if (mode !== 'input') return
            onActivity()
            playSfx('tryk')
            onSubmit(v)
          }}
        >
          <YesNoGlyph yes={v === 'yes'} size={92} />
        </AnswerCard>
      ))}
    </div>
  )
}

export function TrueFalseFace({ value, size }: FaceProps) {
  return (
    <span className={cx('tv-face', `tv-face--${size}`)}>
      <YesNoGlyph yes={value === 'yes'} size={size === 'lg' ? 72 : size === 'md' ? 60 : 40} />
    </span>
  )
}
