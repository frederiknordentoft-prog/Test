import { CATEGORY_COLORS, CATEGORY_SHAPES } from '../../data/elements'
import type { Tile } from '../../game/types'
import { tileMass } from '../../game/types'

/** Grundradius vokser med kubikroden af massen — tungere atomer ER større. */
export function baseTileRadius(tile: Tile): number {
  const m = tileMass(tile)
  return Math.min(26, 9 + 3 * Math.cbrt(m))
}

/**
 * Læg brikker i skålen i rækker. Ved mange brikker skrumpes radius,
 * så selv 238 brint kan være der (og netop DET er pointen).
 */
export function layoutPanTiles(
  tiles: readonly Tile[],
  panRx: number,
): { offsets: { x: number; y: number }[]; radius: number } {
  const n = tiles.length
  if (n === 0) return { offsets: [], radius: 0 }

  const maxBase = Math.max(...tiles.map(baseTileRadius))
  let radius = maxBase
  let perRow = Math.max(1, Math.floor((panRx * 1.7) / (radius * 1.9)))
  // Skrump til det kan være der i maks ~7 synlige rækker
  while (radius > 5.5 && Math.ceil(n / perRow) > 7) {
    radius *= 0.88
    perRow = Math.max(1, Math.floor((panRx * 1.7) / (radius * 1.9)))
  }

  const offsets: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const inRow = Math.min(perRow, n - row * perRow)
    const x = (col - (inRow - 1) / 2) * radius * 1.9
    const y = -row * radius * 0.95 - radius * 0.4
    offsets.push({ x, y })
  }
  return { offsets, radius }
}

function shapePath(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath()
  switch (shape) {
    case 'diamant':
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r, y)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r, y)
      break
    case 'trekant':
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r * 0.9, y + r * 0.7)
      ctx.lineTo(x - r * 0.9, y + r * 0.7)
      break
    case 'firkant':
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7)
      break
    case 'sekskant':
    case 'femkant': {
      const sides = shape === 'sekskant' ? 6 : 5
      for (let i = 0; i < sides; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / sides
        const px = x + Math.cos(a) * r
        const py = y + Math.sin(a) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      break
    }
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2)
  }
  ctx.closePath()
}

/**
 * Graveret grundstof-disk. squashX/squashY er skala-faktorer til drop-squash.
 */
export function drawTileDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tile: Tile,
  squashX = 1,
  squashY = 1,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(squashX, squashY)

  const color =
    tile.kind === 'element' ? CATEGORY_COLORS[tile.element.category] : '#5a4520'

  // Diskkrop — messing m. kategorifarvet rand
  const face = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r)
  face.addColorStop(0, '#f4e4b1')
  face.addColorStop(0.65, '#d9bd77')
  face.addColorStop(1, '#a9873f')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.lineWidth = Math.max(2, r * 0.16)
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(70,50,20,0.5)'
  ctx.beginPath()
  ctx.arc(0, 0, r - Math.max(2, r * 0.16) * 0.5 - 1, 0, Math.PI * 2)
  ctx.stroke()

  // Graveret symbol
  const label = tile.kind === 'element' ? tile.element.symbol : tile.molecule.formula
  const fontSize = Math.max(7, Math.min(r * 0.95, (r * 2.4) / Math.max(2, label.length)))
  ctx.font = `700 ${fontSize}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,246,220,0.55)'
  ctx.fillText(label, 0, 1 - r * 0.05 + 1)
  ctx.fillStyle = 'rgba(58,40,14,0.92)'
  ctx.fillText(label, 0, -r * 0.05)

  // Form-cue (kategoriform) nederst på disken — kun når der er plads
  if (tile.kind === 'element' && r >= 11) {
    const shape = CATEGORY_SHAPES[tile.element.category]
    const sr = r * 0.2
    shapePath(ctx, shape, 0, r * 0.52, sr)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = 'rgba(58,40,14,0.5)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  ctx.restore()
}
