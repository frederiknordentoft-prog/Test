import type { PlacedPiece, Slot } from '../types'
import { degreeLabel, PIECE_SPECS, ROTATION_DOMAINS, ROTATION_TABLE } from '../physics/constants'
import { UI } from '../game/strings'

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
 * EXACTLY the piece's valid angles — one tap selects. The ring centre is
 * clamped so every button stays on the board, even for slots near an edge.
 */
export function RadialPicker({ slot, piece, scale, boardW, boardH, onSelect, onRemove, onClose }: Props) {
  const domain = ROTATION_DOMAINS[piece.type]
  const spec = PIECE_SPECS[piece.type]
  const many = domain.length > 8
  const ringR = many ? 74 : 62
  const btn = many ? 30 : 34

  const dispW = boardW * scale
  const dispH = boardH * scale
  const rawX = slot.position.x * scale
  const rawY = slot.position.y * scale
  const pad = ringR + btn / 2 + 4
  const cx = Math.min(Math.max(rawX, pad), dispW - pad)
  const cy = Math.min(Math.max(rawY, pad), dispH - pad)

  return (
    <>
      {/* Backdrop: any outside tap closes the picker. */}
      <button
        type="button"
        aria-label="Luk vinkelvælgeren"
        className="pointer-events-auto absolute inset-0 z-10 cursor-default bg-slate-950/45"
        onClick={onClose}
      />
      <div className="pointer-events-none absolute z-20" style={{ left: cx, top: cy }}>
        {/* ring outline */}
        <div
          className="absolute rounded-full border border-slate-500/50"
          style={{ left: -ringR, top: -ringR, width: ringR * 2, height: ringR * 2 }}
        />
        {domain.map((rot) => {
          const a = ROTATION_TABLE[rot] ?? 0
          const bx = Math.cos(a) * ringR
          const by = Math.sin(a) * ringR
          const active = piece.rotation === rot
          return (
            <button
              key={rot}
              type="button"
              aria-label={`Vinkel ${degreeLabel(rot)} i felt ${slot.id}`}
              onClick={() => onSelect(rot)}
              className={[
                'pointer-events-auto absolute flex items-center justify-center rounded-full text-base font-bold shadow-lg transition active:scale-90 touch-manipulation',
                active ? 'z-10 ring-2 ring-white' : 'ring-1 ring-slate-500/70',
              ].join(' ')}
              style={{
                left: bx - btn / 2,
                top: by - btn / 2,
                width: btn,
                height: btn,
                backgroundColor: active ? spec.color : '#1e293bee',
                color: active ? '#0f172a' : spec.color,
              }}
            >
              <span style={{ transform: `rotate(${a}rad)`, display: 'inline-block' }}>{spec.glyph}</span>
            </button>
          )
        })}
        {/* centre: remove */}
        <button
          type="button"
          aria-label={`Fjern brikken i felt ${slot.id}`}
          title={UI.remove}
          onClick={onRemove}
          className="pointer-events-auto absolute flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/90 text-xl font-bold text-white shadow-lg ring-2 ring-rose-300/60 transition active:scale-90 touch-manipulation"
          style={{ left: -22, top: -22 }}
        >
          ×
        </button>
      </div>
    </>
  )
}
