import type { PlacedPiece, Slot } from '../types'
import { degreeLabel, PIECE_SPECS, ROTATION_DOMAINS, ROTATION_TABLE } from '../physics/constants'
import { UI } from '../game/strings'
import { PieceIcon } from './PieceIcon'

type Props = {
  slot: Slot
  piece: PlacedPiece
  scale: number
  boardW: number
  boardH: number
  onSelect: (rotation: number) => void
  onRemove: () => void
  onClose: () => void
}

/**
 * The radial angle picker (kravspec §7): a ring around the placed piece with
 * EXACTLY the piece's valid angles — one tap selects. Every button shows the
 * piece's true silhouette at that exact angle, so what you tap is what you
 * get. The ring centre is clamped so every button stays on the board, even
 * for slots near an edge.
 */
export function RadialPicker({ slot, piece, scale, boardW, boardH, onSelect, onRemove, onClose }: Props) {
  const domain = ROTATION_DOMAINS[piece.type]
  const spec = PIECE_SPECS[piece.type]
  const many = domain.length > 8
  const ringR = many ? 78 : 68
  const btn = many ? 32 : 38
  // Neighbouring angles are only 22.5° apart — stagger alternate buttons onto
  // an inner/outer ring so they never overlap, on any screen size.
  const radiusFor = (rot: number) => ringR + (rot % 2 === 0 ? 12 : -14)

  const dispW = boardW * scale
  const dispH = boardH * scale
  const rawX = slot.position.x * scale
  const rawY = slot.position.y * scale
  const pad = ringR + 12 + btn / 2 + 4
  const cx = Math.min(Math.max(rawX, pad), dispW - pad)
  const cy = Math.min(Math.max(rawY, pad), dispH - pad)

  return (
    <>
      {/* Backdrop: any outside tap closes the picker. */}
      <button
        type="button"
        aria-label="Luk vinkelvælgeren"
        className="pointer-events-auto absolute inset-0 z-10 cursor-default bg-slate-950/55 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="pointer-events-none absolute z-20" style={{ left: cx, top: cy }}>
        {/* ring outline */}
        <div
          className="absolute rounded-full border-2 border-slate-400/30"
          style={{ left: -ringR, top: -ringR, width: ringR * 2, height: ringR * 2 }}
        />
        {domain.map((rot) => {
          const a = ROTATION_TABLE[rot] ?? 0
          const r = radiusFor(rot)
          const bx = Math.cos(a) * r
          const by = Math.sin(a) * r
          const active = piece.rotation === rot
          return (
            <button
              key={rot}
              type="button"
              aria-label={`Vinkel ${degreeLabel(rot)} i felt ${slot.id}`}
              onClick={() => onSelect(rot)}
              className={[
                'pointer-events-auto absolute flex items-center justify-center rounded-full shadow-lg transition',
                'hover:scale-110 active:scale-90 touch-manipulation',
                active ? 'z-10 ring-[2.5px] ring-white' : 'ring-1 ring-slate-400/60 hover:ring-slate-200',
              ].join(' ')}
              style={{
                left: bx - btn / 2,
                top: by - btn / 2,
                width: btn,
                height: btn,
                backgroundColor: active ? spec.color : '#0f172af0',
              }}
            >
              <PieceIcon type={piece.type} rotation={rot} size={btn - 8} color={active ? '#0f172a' : spec.color} />
            </button>
          )
        })}
        {/* centre: remove */}
        <button
          type="button"
          aria-label={`Fjern brikken i felt ${slot.id}`}
          title={UI.remove}
          onClick={onRemove}
          className="pointer-events-auto absolute flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-rose-400 to-rose-600 text-xl font-black text-white shadow-lg ring-2 ring-rose-200/70 transition hover:scale-110 active:scale-90 touch-manipulation"
          style={{ left: -22, top: -22 }}
        >
          ×
        </button>
      </div>
    </>
  )
}
