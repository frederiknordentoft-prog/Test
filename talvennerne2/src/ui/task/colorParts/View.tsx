// colorParts (SPEC §3.2): a circle, rectangle, bar or square cut into equal parts, with the asked
// fraction written above it (it is read aloud too). A tap colours a part, another tap takes the
// colour away; a finger drawn across several parts colours (or clears) them all in one go. The cuts
// are drawn bold so "equal parts" is plain to see. Then the tick: the answer is the fraction
// coloured, 'frac:3/4' (logic.ts).
import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { playSfx } from '../../../audio/sfx'
import { MAT } from '../../../art/materials/palette'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { CheckButton } from '../CheckButton'
import { FracText } from '../faces'
import type { FaceProps, FaceSize, TaskViewProps } from '../types'
import { partsGeometry, partsOfValue, partsSetup, partsValue, rememberColouring, rememberedColouring } from './logic'
import type { PartsGeometry } from './logic'
import './colorParts.css'

/** The figure: white parts with their colour laid over (it fades in and out), bold cuts on top. */
export function PartsArt({ geo, on, interactive }: { geo: PartsGeometry; on: readonly number[]; interactive?: (i: number) => object }) {
  return (
    <>
      {geo.parts.map((d, i) => (
        <path key={i} d={d} className="tv-parts__part" fill={MAT.fracEmpty.fill} data-part={i} {...interactive?.(i)} />
      ))}
      {geo.parts.map((d, i) => (
        <path key={`c${i}`} d={d} className={cx('tv-parts__colour', on.includes(i) && 'is-on')} fill={MAT.frac.fill} />
      ))}
      <path d={geo.shine} className="tv-parts__shine" />
      {geo.cuts && <path d={geo.cuts} className="tv-parts__cuts" stroke={MAT.frac.outline} />}
      <path d={geo.outline} className="tv-parts__outline" stroke={MAT.frac.outline} />
    </>
  )
}

export function ColorPartsView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const setup = useMemo(() => partsSetup(task), [task])
  const geo = useMemo(() => partsGeometry(setup.shape, setup.parts, setup.equal), [setup])
  const [on, setOn] = useState<number[]>([])
  const onRef = useRef<number[]>([])
  const svg = useRef<SVGSVGElement>(null)
  const paint = useRef<{ colour: boolean; pointer: number } | null>(null)
  const input = mode === 'input'
  const settled = mode === 'correct' || mode === 'wrong'
  const shown = settled && given !== null && on.length === 0 ? (rememberedColouring(task.id, given) ?? partsOfValue(given, setup.parts)) : on

  /** Colours (or clears) one part; nothing when it already is. */
  const apply = (i: number, colour: boolean) => {
    const cur = onRef.current
    if (cur.includes(i) === colour) return
    const next = colour ? [...cur, i] : cur.filter((x) => x !== i)
    onRef.current = next
    setOn(next)
    playSfx(colour ? 'pop' : 'fjern')
  }

  const partAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-part]')
    return el && svg.current?.contains(el) ? Number(el.getAttribute('data-part')) : null
  }

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!input || paint.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const own = (e.target as Element).closest?.('[data-part]')
    const i = own ? Number(own.getAttribute('data-part')) : partAt(e.clientX, e.clientY)
    if (i === null || Number.isNaN(i)) return
    onActivity()
    const colour = !onRef.current.includes(i)
    paint.current = { colour, pointer: e.pointerId }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // synthetic events in tests have no capture target
    }
    apply(i, colour)
  }
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = paint.current
    if (!p || p.pointer !== e.pointerId) return
    const i = partAt(e.clientX, e.clientY)
    if (i !== null) apply(i, p.colour)
  }
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (paint.current?.pointer === e.pointerId) paint.current = null
  }

  const keyFor = (i: number) => (e: ReactKeyboardEvent) => {
    if (!input || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    onActivity()
    apply(i, !onRef.current.includes(i))
  }

  const submit = () => {
    const value = partsValue(task, on, setup.parts)
    rememberColouring(task.id, value, on)
    onSubmit(value)
  }

  const label = speech.text('s.kind.colorParts.part')
  return (
    <div className={cx('tv-parts', `tv-parts--${setup.shape}`, `is-${mode}`)} data-kind="colorParts">
      {setup.target && (
        <span className="tv-parts__ask">
          <FracText n={setup.target.n} d={setup.target.d} />
        </span>
      )}
      <div className={cx('tv-parts__figure', mode === 'correct' && 'is-good')}>
        <svg
          ref={svg}
          className="tv-parts__svg tv-drag"
          viewBox={`-4 -4 ${geo.w + 8} ${geo.h + 8}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          data-parts={setup.parts}
        >
          <PartsArt
            geo={geo}
            on={shown}
            interactive={(i) => ({
              role: 'button',
              tabIndex: input ? 0 : -1,
              'aria-pressed': shown.includes(i),
              'aria-label': label,
              onKeyDown: keyFor(i),
            })}
          />
        </svg>
        {mode === 'wrong' && <span className="tv-strike tv-strike--wide" aria-hidden />}
      </div>
      <div className="tv-parts__foot">
        <CheckButton valid={on.length > 0} stateKey={[...on].sort((a, b) => a - b).join(',')} enabled={input} taskId={task.id} onCheck={submit} />
      </div>
    </div>
  )
}

const FACE_W: Record<FaceSize, number> = { sm: 64, md: 92, lg: 120 }

/** The figure with the parts of an answer coloured (the struck answer is the child's own colouring). */
export function ColorPartsFace({ task, value, size }: FaceProps) {
  const setup = partsSetup(task)
  const geo = partsGeometry(setup.shape, setup.parts, setup.equal)
  const on = rememberedColouring(task.id, value) ?? partsOfValue(value, setup.parts)
  // a long bar gets more width than a round figure of the same height
  const w = FACE_W[size] * Math.min(1.8, Math.max(1, geo.w / geo.h) * 0.8)
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-partsface')}>
      <svg viewBox={`-4 -4 ${geo.w + 8} ${geo.h + 8}`} width={Math.round(w)} height={Math.round((w * (geo.h + 8)) / (geo.w + 8))} aria-hidden>
        <PartsArt geo={geo} on={on} />
      </svg>
    </span>
  )
}
