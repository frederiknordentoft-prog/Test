// choice (SPEC §3.2): 2–4 big cards, one tap is the answer. Cards with words (units, relations,
// tokens) pulse while the voice names them; numbers, clocks, coins, shapes and fractions are never
// read, because they are what the task tests.
import type { AnswerValue, OptionView, Task } from '../../../engine/types'
import { playSfx } from '../../../audio/sfx'
import { AnswerCard } from '../../design/AnswerCard'
import type { AnswerState } from '../../design/AnswerCard'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { OptionFace } from '../faces'
import type { FaceProps, TaskViewProps, ViewMode } from '../types'

/** Option views drawn as pictures get the tall card. */
const PICTURE_VIEWS: ReadonlySet<OptionView> = new Set<OptionView>([
  'clock', 'clockDigital', 'coin', 'coins', 'shape', 'solid', 'fraction', 'picture', 'patternToken', 'unitWord', 'yesNo',
])

export const isPictureView = (t: Task) => PICTURE_VIEWS.has(t.optionView) || t.answerType === 'minutes'

export function cardState(mode: ViewMode, option: AnswerValue, given: AnswerValue | null): AnswerState {
  if (mode === 'correct') return option === given ? 'correct' : 'dim'
  if (mode === 'wrong') return option === given ? 'wrong' : 'dim'
  return 'idle'
}

export function ChoiceView({ task, mode, given, onSubmit, onActivity, speaking }: TaskViewProps) {
  const speech = useSpeech()
  const picture = isPictureView(task)
  const n = task.options.length
  return (
    <div className={cx('tv-choice', `tv-choice--n${n}`, picture && 'tv-choice--pictures')} data-kind="choice">
      {task.options.map((option, i) => {
        const clip = task.optionClips?.[i]
        return (
          <AnswerCard
            key={String(option)}
            size={picture ? 'lg' : 'md'}
            state={cardState(mode, option, given)}
            speaking={speaking === i}
            disabled={mode === 'idle'}
            label={clip ? speech.text(clip) : String(option)}
            data-option={String(option)}
            onClick={() => {
              if (mode !== 'input') return
              onActivity()
              playSfx('tryk')
              onSubmit(option)
            }}
          >
            <OptionFace task={task} value={option} size="md" />
          </AnswerCard>
        )
      })}
    </div>
  )
}

export function ChoiceFace({ task, value, size }: FaceProps) {
  return <OptionFace task={task} value={value} size={size} />
}
