// Pictures of answer values (SPEC §3.4, Task.optionView): what a choice card, a sortOrder card, a
// multiSelect item, a fillSlots token, the struck answer and the confirm button show. Numbers,
// clocks, coins, shapes and fractions are what a task tests, so they are never read aloud here;
// words (units, relations, tokens) carry a pictogram and are read by the round screen from
// Task.optionClips.
import type { CSSProperties, ReactNode } from 'react'
import type { AnswerValue, ShapeId, SolidId, Task } from '../../engine/types'
import { AnalogClock, Banknote, COIN_MM, Coin, DigitalClock, NOTE_MM, Shape2D, Solid3D, Thing, THING_IDS } from '../../art/materials'
import type { CoinOre, NoteKr } from '../../art/materials'
import { SHAPE_IDS } from '../../art/materials/Shapes'
import { SOLID_IDS } from '../../art/materials/Solids'
import { HIGHLIGHT, MAT } from '../../art/materials/palette'
import type { Tone } from '../../art/materials/palette'
import { circle, ellipse, lune } from '../../art/materials/geom'
import { Icon } from '../design/Icon'
import type { IconName } from '../design/icons'
import { SpokenText } from '../design/SpokenText'
import { cx } from '../design/cx'
import { ObjectIcon, LongArt, isLong, knownObject } from '../scenes/objects'
import type { FaceSize } from './types'
import { formatMoney, formatNumber, splitTokens } from './answers'
import { COIN_PIECES, NOTE_PIECES, fewestPieces, isCoinPiece, isPiece, pieceOfToken } from './pay/logic'
import type { Piece } from './pay/logic'

/** Picture size per face size, in CSS px. */
export const FACE_PX: Record<FaceSize, number> = { sm: 46, md: 78, lg: 104 }

export interface OptionFaceProps {
  task: Task
  value: AnswerValue
  size: FaceSize
  className?: string
}

const isShape = (s: string): s is ShapeId => (SHAPE_IDS as readonly string[]).includes(s)
const isSolid = (s: string): s is SolidId => (SOLID_IDS as readonly string[]).includes(s)

/** One answer value drawn the way the task's option view says. */
export function OptionFace({ task, value, size, className }: OptionFaceProps) {
  return <span className={cx('tv-face', `tv-face--${size}`, className)}>{face(task, value, size)}</span>
}

/**
 * Word cards (SPEC §3.4: unitWord, relation, token) show the option's word; the voice reads it. A
 * thing to measure (unitChoice's `mt:<thing>`) shows its picture with the word.
 */
const WORD_VIEWS = new Set(['token', 'relation'])

function face(task: Task, value: AnswerValue, size: FaceSize): ReactNode {
  const px = FACE_PX[size]
  const view = task.optionView
  if (typeof value === 'string' && WORD_VIEWS.has(view) && !value.startsWith('cmp:')) {
    const i = task.options.indexOf(value)
    const clip = i >= 0 ? task.optionClips?.[i] : undefined
    if (clip && pictured(task, value)) return <ThingFace id={value.slice(3)} clip={clip} size={size} />
    if (clip) return <SpokenText clip={clip} silent className={cx('tv-face__word', 'tv-face__word--card')} />
  }
  if (typeof value === 'number') {
    if (view === 'clock' || (task.answerType === 'minutes' && view !== 'clockDigital')) return <AnalogClock minutes={value} size={px * 1.05} />
    if (view === 'clockDigital') return <DigitalClock minutes={value} h24={task.modulo === 1440} size={px * 1.5} />
    if (view === 'coin' && isPiece(value)) return <MoneyFace piece={value} px={px} />
    if (task.answerType === 'ore' || view === 'amount') return <NumText small>{task.answerType === 'ore' ? formatMoney(value) : formatNumber(value)}</NumText>
    const text = formatNumber(value)
    // every card of a task gets the size of its longest number: a smaller 30045 must not stand out
    const chars = Math.max(text.length, ...task.options.map((o) => (typeof o === 'number' ? formatNumber(o).length : 0)))
    return (
      <NumText chars={chars + (task.unit ? 1 : 0)}>
        {text}
        {task.unit && <UnitSuffix unit={task.unit} />}
      </NumText>
    )
  }
  if (value === 'yes' || value === 'no') return <YesNoGlyph yes={value === 'yes'} size={px} />
  if (value.includes('|')) {
    return (
      <span className="tv-face__row">
        {splitTokens(value).map((v, i) => (
          <OptionFace key={i} task={task} value={v} size="sm" />
        ))}
      </span>
    )
  }
  const cut = value.indexOf(':')
  const prefix = cut > 0 ? value.slice(0, cut) : ''
  const body = cut > 0 ? value.slice(cut + 1) : value
  switch (prefix) {
    case 'shape': {
      // 'shape:triangle:3' — the figure in its variant (SK1 convention)
      const [id, variant] = body.split(':')
      if (isShape(id)) return <Shape2D shape={id} variant={Number(variant) || 0} size={px} />
      break
    }
    case 'solid':
      if (isSolid(body)) return <Solid3D solid={body} size={px} />
      break
    case 'frac': {
      const [nn, dd] = body.split('/')
      return <FracText n={nn} d={dd} />
    }
    case 'unit':
      return <UnitFace unit={body} size={size} />
    case 'cmp':
      return <span className="tv-face__glyph">{body === '<' ? '<' : body === '>' ? '>' : '='}</span>
    case 'obj':
      return <ObjectFace id={body} px={px} />
    case 'pat':
      return <PatternToken token={body} px={px} />
  }
  const ref = promptItem(task, value, px)
  if (ref) return ref
  // a coin or note token ('c500', 'c5000', and repeats with leading zeros: 'c010000' is a 100-krone note)
  const piece = pieceOfToken(value)
  if (piece !== null) return <MoneyFace piece={piece} px={px} />
  const i = task.options.indexOf(value)
  const clip = i >= 0 ? task.optionClips?.[i] : undefined
  if (clip) return <SpokenText clip={clip} silent className="tv-face__word" />
  return <span className="tv-face__glyph tv-face__glyph--small">{value}</span>
}

const canDraw = new Map<string, boolean>()
const drawable = (o: AnswerValue) => {
  const v = String(o)
  if (!canDraw.has(v)) canDraw.set(v, v.startsWith('mt:') && knownObject(v.slice(3)))
  return canDraw.get(v) === true
}

/**
 * A thing card gets its picture when every thing on the task's cards has one (all the length things
 * do), so no card of a set stands out; a thing without a picture keeps the word card.
 */
const pictured = (task: Task, value: string) => value.startsWith('mt:') && task.options.every(drawable)

/**
 * A thing to measure (QA2 P3-8): its picture with its word, so a child who cannot read yet sees what
 * the voice names. md and lg: the picture over the word; sm (the struck answer, the confirm button):
 * beside a smaller word. task.css sizes both (.tv-face__thing).
 */
function ThingFace({ id, clip, size }: { id: string; clip: string; size: FaceSize }) {
  return (
    <span className={cx('tv-face__thing', `is-${size}`)}>
      <ObjectIcon id={id} size={FACE_PX[size]} />
      <SpokenText clip={clip} silent className="tv-face__thingword" />
    </span>
  )
}

/** Option ids that point into the prompt: shapes by item id, objects as o0, o1 … */
function promptItem(task: Task, value: string, px: number): ReactNode | null {
  const p = task.prompt
  if (p.scene === 'shapes') {
    const item = p.items.find((it) => it.id === value)
    if (item) return <Shape2D shape={item.shape} variant={item.variant} cut={item.cut} size={px} />
  }
  if (p.scene === 'compareObjects') {
    const m = /^o(\d+)$/.exec(value)
    if (m) {
      // reference objects (the teddy in "heavier than the teddy") come first in the prompt
      const offset = Math.max(0, p.objects.length - task.options.length)
      const i = Number(m[1]) + offset
      const id = p.objects[i]
      if (id) {
        const max = Math.max(...p.sizes, 1)
        const k = 0.55 + 0.45 * ((p.sizes[i] ?? max) / max)
        return <ObjectFace id={id} px={px * k} />
      }
    }
  }
  return null
}

// ─── Money ──────────────────────────────────────────────────────────────────
// One coin or note in its real relative size (SPEC §11), shared by the pay view, the answer cards
// (coinNames, payExact's coin sets), the coin-sum hint and the shop scene (the note the child paid
// with). It lives here, not in the pay chunk, so a card draws a note without loading the purse.
// Sizing is CSS: the piece's real millimetres (--d) times the scale of where it lies (--mm for
// coins, --mm-note for notes; .tv-piece in src/ui/scenes/scenes.css).

/** A coin or a note, sized in CSS from its real millimetres (--d) and the layout's scale. */
export function PieceArt({ piece, className }: { piece: Piece; className?: string }) {
  if (isCoinPiece(piece)) {
    return <Coin ore={piece as CoinOre} className={cx('tv-piece tv-piece--coin', className)} style={{ '--d': COIN_MM[piece as CoinOre] } as CSSProperties} />
  }
  const kr = (piece / 100) as NoteKr
  return <Banknote kr={kr} className={cx('tv-piece tv-piece--note', className)} style={{ '--d': NOTE_MM[kr] } as CSSProperties} />
}

/** The largest coin (5 kr, 28.5 mm) and the largest note (500 kr, 155 mm). */
const BIGGEST_COIN_MM = 28.5
const BIGGEST_NOTE_MM = 155

/**
 * The scale for pieces on a face of `px` (FACE_PX): the 5-krone is 0.9 px across and the 500-krone
 * note 0.95 px long, so a card's coins keep their real sizes among themselves (the 5-krone is the
 * biggest silver coin, as the hint says), and so do its notes.
 */
export function pieceScale(px: number): CSSProperties {
  return {
    '--mm': `${((px * 0.9) / BIGGEST_COIN_MM).toFixed(3)}px`,
    '--mm-note': `${((px * 0.95) / BIGGEST_NOTE_MM).toFixed(3)}px`,
  } as CSSProperties
}

/** An amount as it lies on the counter: one note or coin when there is one, else the fewest pieces. */
export function piecesForAmount(ore: number): Piece[] {
  return fewestPieces(ore, [...COIN_PIECES, ...NOTE_PIECES]) ?? []
}

/** A coin or note on a card, in its real size among the card's other coins or notes. */
function MoneyFace({ piece, px }: { piece: number; px: number }) {
  return (
    <span className="tv-face__money" style={pieceScale(px)}>
      <PieceArt piece={piece} />
    </span>
  )
}

function ObjectFace({ id, px }: { id: string; px: number }) {
  if (isLong(id)) {
    return (
      <svg viewBox="0 0 96 24" width={px * 1.4} height={px * 0.35} aria-hidden overflow="visible">
        <LongArt id={id} length={92} x={2} y={12} />
      </svg>
    )
  }
  if ((THING_IDS as readonly string[]).includes(id)) return <Thing id={id} size={px} />
  return <ObjectIcon id={id} size={px} />
}

/**
 * A number on a card. `chars`: how long it is written — four and five digits (1004, 30045: what a
 * child wrote, UI-fund 6) get a smaller size, so the whole number stays on a phone's card.
 */
export function NumText({ children, small, chars = 0 }: { children: ReactNode; small?: boolean; chars?: number }) {
  return <span className={cx('tv-face__num', small && 'tv-face__num--small', chars >= 5 ? 'tv-face__num--xlong' : chars === 4 && 'tv-face__num--long')}>{children}</span>
}

const UNIT_CLIP: Record<string, string> = {
  cm: 'noun.unit.cm.end', m: 'noun.unit.m.end', g: 'noun.unit.g.end', kg: 'noun.unit.kg.end', kr: 'noun.unit.kroner.end',
}

/** "cm", "m", "kr" after a typed or shown number; read as the whole word when tapped. */
export function UnitSuffix({ unit }: { unit: string }) {
  const clip = UNIT_CLIP[unit]
  return clip ? <SpokenText parts={[{ clip }]} text={unit} className="tv-face__unit" /> : null
}

const UNIT_ICON: Record<string, IconName> = { cm: 'ruler', m: 'ruler', mm: 'ruler', g: 'scale', kg: 'scale', kr: 'coin', l: 'cube', min: 'clock', t: 'clock' }

/** A unit word with its pictogram (unitWord view). */
export function UnitFace({ unit, size }: { unit: string; size: FaceSize }) {
  const icon = UNIT_ICON[unit] ?? 'ruler'
  return (
    <span className={cx('tv-face__unitword', `is-${size}`)}>
      <Icon name={icon} size={size === 'sm' ? 20 : size === 'md' ? 30 : 38} className="tv-face__unitpic" />
      <span className="tv-face__unittext">{unit}</span>
    </span>
  )
}

/** "3/4" set as a school fraction: numerator over a bar over the denominator. */
export function FracText({ n, d, style }: { n: ReactNode; d: ReactNode; style?: CSSProperties }) {
  return (
    <span className="tv-frac" style={style} role="math">
      <span className="tv-frac__n">{n}</span>
      <span className="tv-frac__bar" aria-hidden />
      <span className="tv-frac__d">{d}</span>
    </span>
  )
}

/** Green tick (yes) or coral cross (no); no words (SPEC §3.2 trueFalse). */
export function YesNoGlyph({ yes, size }: { yes: boolean; size: number }) {
  return (
    <span className={cx('tv-yesno', yes ? 'is-yes' : 'is-no')} style={{ width: size, height: size }}>
      <Icon name={yes ? 'check' : 'close'} size="64%" strokeWidth={3.4} />
    </span>
  )
}

const PATTERN_TONES: Record<string, Tone> = {
  red: MAT.apple, blue: MAT.fish, yellow: MAT.star, green: MAT.leafGreen, purple: MAT.counterA,
  orange: MAT.counterB, pink: MAT.petal, white: MAT.frame, brown: MAT.chestnut,
}

/**
 * Pattern tokens `pat:<name>` (SK1): a colour is a glass bead (red, blue, yellow …), a shape is a
 * figure (circle, triangle, square), anything else a countable thing; 'red-triangle' is both.
 */
export function PatternToken({ token, px }: { token: string; px: number }) {
  const [color, shape] = token.split('-')
  const tone = PATTERN_TONES[color]
  if (!tone) {
    if (isShape(token)) return <Shape2D shape={token} tone={MAT.shapeB} size={px * 0.72} />
    if ((THING_IDS as readonly string[]).includes(token)) return <Thing id={token} size={px * 0.8} />
    return <ObjectIcon id={token} size={px * 0.8} />
  }
  if (shape && isShape(shape)) return <Shape2D shape={shape} tone={tone} size={px * 0.78} />
  const r = 20
  return (
    <svg viewBox="0 0 48 48" width={px * 0.62} height={px * 0.62} aria-hidden>
      <path d={circle(24, 24, r)} fill={tone.fill} />
      <path d={lune(24, 24, r - 1.5, 5, 5)} fill={tone.shade} />
      <path d={ellipse(17, 16, 5, 3)} fill={HIGHLIGHT} />
      <path d={circle(24, 24, r)} fill="none" stroke={tone.outline} strokeWidth={3} />
    </svg>
  )
}
