// buildBase (SPEC §3.2): buttons for flat (100), rod (10) and unit cube (1) put blocks on the work
// mat; a tap on a pile takes one block off it. Nothing is ever regrouped by itself: ten units stay
// ten units, because seeing that they make a rod is the child's job. Then the tick.
import { useState } from 'react'
import { playSfx } from '../../../audio/sfx'
import { Base10Block, Base10Group } from '../../../art/materials'
import type { Base10Kind } from '../../../art/materials'
import { usePress } from '../../design/usePress'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { baseKinds, baseValue, formatNumber } from '../answers'
import { CheckButton } from '../CheckButton'
import { NumText } from '../faces'
import type { FaceProps, TaskViewProps } from '../types'

type Pieces = { h: number; t: number; o: number }
const KEY: Record<Base10Kind, keyof Pieces> = { flat: 'h', rod: 't', unit: 'o' }
const NAME_CLIP: Record<Base10Kind, string> = { flat: 's.kind.buildBase.flat', rod: 's.kind.buildBase.rod', unit: 's.kind.buildBase.unit' }
/** Most blocks of one kind on the mat (no regrouping, so 19 units is a fair answer for 19). */
const MAX_PER_KIND = 19

export function BuildBaseView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const kinds = baseKinds(task)
  const [pieces, setPieces] = useState<Pieces>({ h: 0, t: 0, o: 0 })
  const input = mode === 'input'
  const total = pieces.h + pieces.t + pieces.o
  const shown: Pieces = mode !== 'input' && mode !== 'idle' && typeof given === 'number' && total === 0 ? split(given) : pieces
  const state = mode === 'correct' ? 'good' : mode === 'wrong' ? 'oops' : 'idle'

  const add = (k: Base10Kind) => {
    if (!input || pieces[KEY[k]] >= MAX_PER_KIND) return
    onActivity()
    playSfx('klik')
    setPieces((p) => ({ ...p, [KEY[k]]: p[KEY[k]] + 1 }))
  }
  const remove = (k: Base10Kind) => {
    if (!input || pieces[KEY[k]] === 0) return
    onActivity()
    playSfx('fjern')
    setPieces((p) => ({ ...p, [KEY[k]]: p[KEY[k]] - 1 }))
  }

  return (
    <div className={cx('tv-base', `is-${mode}`)} data-kind="buildBase">
      <div className={cx('tv-base__mat', `is-${state}`, total === 0 && mode === 'input' && 'is-empty')}>
        {kinds.map((k) =>
          shown[KEY[k]] > 0 ? (
            <Pile key={k} kind={k} count={shown[KEY[k]]} disabled={!input} onPress={() => remove(k)} label={speech.text(NAME_CLIP[k])} />
          ) : null,
        )}
        {mode === 'wrong' && <span className="tv-strike" aria-hidden />}
      </div>
      <div className="tv-base__tray">
        {kinds.map((k) => (
          <Source key={k} kind={k} disabled={!input} onPress={() => add(k)} label={speech.text(NAME_CLIP[k])} />
        ))}
        <CheckButton valid={total > 0} stateKey={`${pieces.h}.${pieces.t}.${pieces.o}`} enabled={input} taskId={task.id} onCheck={() => onSubmit(baseValue(pieces))} />
      </div>
    </div>
  )
}

const split = (v: number): Pieces => ({ h: Math.floor(v / 100), t: Math.floor((v % 100) / 10), o: v % 10 })

function Pile({ kind, count, disabled, onPress, label }: { kind: Base10Kind; count: number; disabled: boolean; onPress(): void; label: string }) {
  const { pressProps } = usePress(disabled)
  const props = kind === 'flat' ? { h: count, o: 0 } : kind === 'rod' ? { t: count, o: 0 } : { o: count }
  return (
    <button type="button" className={cx('tv-base__pile tv-touch', `is-${kind}`)} disabled={disabled} onClick={onPress} aria-label={label} data-pile={kind} {...pressProps}>
      <span className="tv-base__pileface">
        <Base10Group {...props} unit={kind === 'flat' ? 7 : 10} />
      </span>
    </button>
  )
}

function Source({ kind, disabled, onPress, label }: { kind: Base10Kind; disabled: boolean; onPress(): void; label: string }) {
  const { pressProps } = usePress(disabled)
  return (
    <button type="button" className={cx('tv-base__src tv-touch', `is-${kind}`)} disabled={disabled} onClick={onPress} aria-label={label} data-source={kind} {...pressProps}>
      <span className="tv-base__srcface">
        <Base10Block kind={kind} unit={kind === 'flat' ? 4.2 : kind === 'rod' ? 4.6 : 16} />
        <span className="tv-base__plus" aria-hidden>
          +
        </span>
      </span>
    </button>
  )
}

/** The blocks of a number, laid out tens and ones (the struck answer, the confirm button). */
export function BuildBaseFace({ value, size }: FaceProps) {
  const v = typeof value === 'number' ? value : 0
  const p = split(v)
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-baseface')}>
      <Base10Group h={p.h} t={p.t} o={p.o} unit={size === 'lg' ? 5 : size === 'md' ? 4.2 : 3} />
      <NumText small>{formatNumber(v)}</NumText>
    </span>
  )
}
