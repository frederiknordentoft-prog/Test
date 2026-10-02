// pay (SPEC §3.2): the shop shows the price; the child pays it exactly. The purse holds one of each
// coin and note the task allows, with an endless supply; a tap (or a drag down) lays one in the tray,
// a tap on a pile in the tray (or dragging a coin out) takes one back. Coins keep their real relative
// sizes. The tray shows no sum — adding up is the task — except as support on a new key
// (Task.scaffold), where the sum stands under the tray and is read aloud when tapped. Then the tick.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { playSfx } from '../../../audio/sfx'
import { Banknote, COIN_MM, Coin, NOTE_MM } from '../../../art/materials'
import type { CoinOre, NoteKr } from '../../../art/materials'
import { coinClip, isDenomination } from '../../../speech/money'
import { SpokenText } from '../../design/SpokenText'
import { useSpeech } from '../../design/speech'
import { usePress } from '../../design/usePress'
import { cx } from '../../design/cx'
import { formatMoney } from '../answers'
import { CheckButton } from '../CheckButton'
import { hop } from '../motion'
import { inside, usePointerDrag } from '../usePointerDrag'
import type { FaceProps, FaceSize, TaskViewProps } from '../types'
import { MAX_TRAY, groupPieces, isCoinPiece, payValue, piecesOf, purseOf, rememberTray, rememberedTray } from './logic'
import type { Piece } from './logic'
import './pay.css'

/** A coin or a note, sized in CSS from its real millimetres (--d) and the layout's scale. */
export function PieceArt({ piece, className }: { piece: Piece; className?: string }) {
  if (isCoinPiece(piece)) {
    return <Coin ore={piece as CoinOre} className={cx('tv-piece tv-piece--coin', className)} style={{ '--d': COIN_MM[piece as CoinOre] } as CSSProperties} />
  }
  const kr = (piece / 100) as NoteKr
  return <Banknote kr={kr} className={cx('tv-piece tv-piece--note', className)} style={{ '--d': NOTE_MM[kr] } as CSSProperties} />
}

/** The pieces in the tray (or on a face): one pile per kind, largest first, the coins overlapping. */
export function Piles({ pieces, dragging }: { pieces: readonly Piece[]; dragging?: { piece: Piece; dx: number; dy: number } | null }) {
  return (
    <>
      {groupPieces(pieces).map(({ piece, n }) => (
        <span
          key={piece}
          className={cx('tv-pay__pile', isCoinPiece(piece) ? 'is-coin' : 'is-note', n > 8 ? 'is-tight' : n > 4 && 'is-close')}
          style={{ '--d': isCoinPiece(piece) ? COIN_MM[piece as CoinOre] : NOTE_MM[(piece / 100) as NoteKr] } as CSSProperties}
          data-tray-group={piece}
        >
          {Array.from({ length: n }, (_, i) => {
            const lifted = dragging && dragging.piece === piece && i === n - 1
            return (
              <span
                key={i}
                className={cx('tv-pay__piece', lifted && 'is-lifted')}
                data-tray-piece=""
                style={lifted ? { transform: `translate(${dragging.dx}px, ${dragging.dy}px) scale(1.08)` } : undefined}
              >
                <PieceArt piece={piece} />
              </span>
            )
          })}
        </span>
      ))}
    </>
  )
}

type DragId = `purse:${number}` | `tray:${number}`
const pieceOf = (id: DragId) => Number(id.slice(id.indexOf(':') + 1))

interface Flight {
  selector: string
  from: DOMRect
}

export function PayView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const purse = useMemo(() => purseOf(task), [task])
  const [tray, setTray] = useState<Piece[]>([])
  const [drag, setDrag] = useState<{ id: DragId; dx: number; dy: number } | null>(null)
  /** A coin from the purse hovers over the tray ('in'), or one from the tray is dragged out ('out'). */
  const [hover, setHover] = useState<'in' | 'out' | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const flight = useRef<Flight | null>(null)
  const input = mode === 'input'
  const settled = mode === 'correct' || mode === 'wrong'
  const shown = settled && given !== null && tray.length === 0 ? piecesOf(task, given) : tray
  const sum = tray.reduce((s, v) => s + v, 0)

  useLayoutEffect(() => {
    const f = flight.current
    flight.current = null
    if (!f || !root.current) return
    const el = root.current.querySelector<HTMLElement>(f.selector)
    if (el) hop(el, f.from, el.getBoundingClientRect())
  }, [tray])

  const faceOf = (piece: Piece) => root.current?.querySelector<HTMLElement>(`[data-source="${piece}"] .tv-pay__face`) ?? null
  const topOf = (piece: Piece) =>
    root.current?.querySelector<HTMLElement>(`[data-tray-group="${piece}"] [data-tray-piece]:last-child`) ?? null

  const add = (piece: Piece, from: DOMRect | null) => {
    if (!input || tray.length >= MAX_TRAY) return
    onActivity()
    playSfx('moent')
    flight.current = from ? { selector: `[data-tray-group="${piece}"] [data-tray-piece]:last-child`, from } : null
    setTray((t) => [...t, piece])
  }

  const remove = (piece: Piece, from: DOMRect | null) => {
    if (!input || !tray.includes(piece)) return
    onActivity()
    playSfx('fjern')
    flight.current = from ? { selector: `[data-source="${piece}"] .tv-pay__face`, from } : null
    setTray((t) => {
      const next = [...t]
      next.splice(next.lastIndexOf(piece), 1)
      return next
    })
  }

  const { bind } = usePointerDrag<DragId>({
    onStart: (id) => {
      if (!input) return false
      onActivity()
      setDrag({ id, dx: 0, dy: 0 })
    },
    onMove: (id, s) => {
      setDrag({ id, dx: s.dx, dy: s.dy })
      if (id.startsWith('purse')) setHover(inside(trayRef.current, s.x, s.y, 24) ? 'in' : null)
      else setHover(inside(trayRef.current, s.x, s.y, 0) ? null : 'out')
    },
    onEnd: (id, s, tap) => {
      const piece = pieceOf(id)
      const fromPurse = id.startsWith('purse')
      const held = fromPurse ? faceOf(piece) : topOf(piece)
      const box = held ? held.getBoundingClientRect() : null
      setDrag(null)
      setHover(null)
      if (fromPurse) {
        if (tap || inside(trayRef.current, s.x, s.y, 24)) {
          // the dragged coin becomes the one in the tray: the purse's coin is back at once, no glide
          if (held && !tap) {
            held.style.transition = 'none'
            requestAnimationFrame(() => requestAnimationFrame(() => (held.style.transition = '')))
          }
          add(piece, box)
        }
      } else if (tap || !inside(trayRef.current, s.x, s.y, 0)) {
        remove(piece, box)
      }
    },
    onCancel: () => {
      setDrag(null)
      setHover(null)
    },
  })

  const keys = (fn: () => void) => (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    fn()
  }

  const submit = () => {
    const value = payValue(task, tray)
    rememberTray(task.id, value, tray)
    onSubmit(value)
  }

  const dragging = drag && drag.id.startsWith('tray') ? { piece: pieceOf(drag.id), dx: drag.dx, dy: drag.dy } : null
  return (
    <div ref={root} className={cx('tv-pay', `is-${mode}`, purse.some((p) => !isCoinPiece(p)) && 'has-notes')} data-kind="pay">
      <div className="tv-pay__purse" role="group" aria-label={speech.text('s.kind.pay.purse')}>
        {purse.map((piece) => (
          <Source
            key={piece}
            piece={piece}
            disabled={!input}
            label={isDenomination(piece) ? speech.text(coinClip(piece, 'indef', 'end')) : formatMoney(piece)}
            lifted={drag?.id === `purse:${piece}` ? drag : null}
            bindProps={bind(`purse:${piece}`)}
            onKeyDown={keys(() => add(piece, faceOf(piece)?.getBoundingClientRect() ?? null))}
          />
        ))}
      </div>
      <div className="tv-pay__bottom">
        <div
          ref={trayRef}
          className={cx('tv-pay__tray', hover && `is-${hover}`, shown.length === 0 && 'is-empty', mode === 'correct' && 'is-good', mode === 'wrong' && 'is-oops')}
          role="group"
          aria-label={speech.text('s.kind.pay.tray')}
          data-tray=""
        >
          {groupPieces(shown).map(({ piece }) => (
            <button
              key={piece}
              type="button"
              className="tv-pay__take tv-drag tv-touch"
              disabled={!input}
              aria-label={speech.text('s.kind.pay.back')}
              data-take={piece}
              {...bind(`tray:${piece}`)}
              onKeyDown={keys(() => remove(piece, topOf(piece)?.getBoundingClientRect() ?? null))}
            >
              <Piles pieces={shown.filter((p) => p === piece)} dragging={dragging} />
            </button>
          ))}
          {mode === 'wrong' && <span className="tv-strike tv-strike--wide" aria-hidden />}
        </div>
        <CheckButton valid={tray.length > 0} stateKey={tray.join(',')} enabled={input} taskId={task.id} onCheck={submit} />
      </div>
      {task.scaffold && sum > 0 && (
        <SpokenText
          parts={[{ clip: 's.kind.pay.inTray' }, { money: { ore: sum, form: 'end' } }]}
          text={formatMoney(sum)}
          className="tv-pay__sum"
        />
      )}
    </div>
  )
}

interface SourceProps {
  piece: Piece
  disabled: boolean
  label: string
  lifted: { dx: number; dy: number } | null
  bindProps: ReturnType<ReturnType<typeof usePointerDrag<DragId>>['bind']>
  onKeyDown(e: ReactKeyboardEvent): void
}

function Source({ piece, disabled, label, lifted, bindProps, onKeyDown }: SourceProps) {
  const { pressProps } = usePress(disabled)
  return (
    <button
      type="button"
      className={cx('tv-pay__src tv-drag tv-touch', isCoinPiece(piece) ? 'is-coin' : 'is-note')}
      disabled={disabled}
      aria-label={label}
      data-source={piece}
      onKeyDown={onKeyDown}
      data-pressed={pressProps['data-pressed']}
      onPointerDown={(e) => {
        pressProps.onPointerDown(e)
        bindProps.onPointerDown(e)
      }}
      onPointerMove={bindProps.onPointerMove}
      onPointerUp={(e) => {
        pressProps.onPointerUp()
        bindProps.onPointerUp(e)
      }}
      onPointerCancel={(e) => {
        pressProps.onPointerCancel()
        bindProps.onPointerCancel(e)
      }}
      onPointerLeave={pressProps.onPointerLeave}
    >
      <span
        className={cx('tv-pay__face', lifted && 'is-lifted')}
        style={lifted ? { transform: `translate(${lifted.dx}px, ${lifted.dy}px) scale(1.1)` } : undefined}
      >
        <PieceArt piece={piece} />
      </span>
    </button>
  )
}

/** The coins of an answer in a small tray (the struck answer is the child's own coins). */
export function PayFace({ task, value, size }: FaceProps) {
  const pieces = rememberedTray(task.id, value) ?? piecesOf(task, value)
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-payface', `tv-payface--${size satisfies FaceSize}`)}>
      <span className="tv-payface__tray">
        <Piles pieces={pieces} />
      </span>
    </span>
  )
}
