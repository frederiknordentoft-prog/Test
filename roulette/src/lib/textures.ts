import * as THREE from 'three'
import { POCKET_SEQUENCE, POCKET_STEP, TWO_PI, colorOf, normalizeAngle } from './wheel'
import type { PocketColor } from './wheel'

/**
 * Both the conical number ring and the flat pocket floor are LatheGeometry,
 * whose UVs are cylindrical: u = revolution angle / 2PI, v = along the profile.
 * So one horizontal strip canvas paints either ring; pocket i's band is centered
 * at u = normalizeAngle(-i * POCKET_STEP) / 2PI.
 */

const RING_COLORS: Record<PocketColor, string> = {
  green: '#0c8a45',
  red: '#a8112a',
  black: '#15151a',
}

const POCKET_COLORS: Record<PocketColor, string> = {
  green: '#0a6b37',
  red: '#871022',
  black: '#101014',
}

function bandX(i: number, width: number): number {
  return (normalizeAngle(-i * POCKET_STEP) / TWO_PI) * width
}

function makeStripCanvas(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  paint(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

/** Draw something for every pocket band, repeated at x-W and x+W to survive the UV seam. */
function eachBand(
  width: number,
  draw: (xCenter: number, n: number, i: number) => void,
): void {
  POCKET_SEQUENCE.forEach((n, i) => {
    const x = bandX(i, width)
    for (const shift of [-width, 0, width]) draw(x + shift, n, i)
  })
}

/** Conical ring with colored segments and the numbers. v=0 is the inner edge. */
export function makeNumberRingTexture(width = 4096, height = 256): THREE.CanvasTexture {
  return makeStripCanvas(width, height, (ctx) => {
    const bandW = width / POCKET_SEQUENCE.length

    ctx.fillStyle = RING_COLORS.black
    ctx.fillRect(0, 0, width, height)
    eachBand(width, (x, n) => {
      ctx.fillStyle = RING_COLORS[colorOf(n)]
      ctx.fillRect(x - bandW / 2 - 0.5, 0, bandW + 1, height)
    })

    // Thin metallic separator lines at the band edges (visually continue the frets).
    ctx.strokeStyle = '#c8c8ce'
    ctx.lineWidth = 3
    eachBand(width, (x) => {
      ctx.beginPath()
      ctx.moveTo(x - bandW / 2, 0)
      ctx.lineTo(x - bandW / 2, height)
      ctx.stroke()
    })

    // Numbers: elongated radially, top of the glyph toward the wheel center.
    // The lathe surface seen from above shows the canvas vertically flipped
    // (canvas bottom = v0 = inner edge), so draw with a vertical flip only —
    // rotate(PI) would also mirror the glyphs horizontally.
    ctx.fillStyle = '#f2f0e8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    eachBand(width, (x, n) => {
      ctx.save()
      ctx.translate(x, height * 0.5)
      ctx.scale(0.85, -1.7)
      ctx.font = `700 ${Math.round(height * 0.34)}px Arial, sans-serif`
      ctx.fillText(String(n), 0, 0)
      ctx.restore()
    })
  })
}

/** Flat pocket-floor ring: colored segments only (frets are real geometry). */
export function makePocketFloorTexture(width = 2048, height = 64): THREE.CanvasTexture {
  return makeStripCanvas(width, height, (ctx) => {
    const bandW = width / POCKET_SEQUENCE.length
    ctx.fillStyle = POCKET_COLORS.black
    ctx.fillRect(0, 0, width, height)
    eachBand(width, (x, n) => {
      ctx.fillStyle = POCKET_COLORS[colorOf(n)]
      ctx.fillRect(x - bandW / 2 - 0.5, 0, bandW + 1, height)
    })
  })
}
