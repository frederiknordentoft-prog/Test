import type { SceneGeometry } from './geometry'
import { roundRect } from './background'

/** Børstet messing-gradient på tværs af bjælken. */
function brassGradient(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
): CanvasGradient {
  const grad = ctx.createLinearGradient(0, y0, 0, y1)
  grad.addColorStop(0, '#e9cf8a')
  grad.addColorStop(0.25, '#d8b96a')
  grad.addColorStop(0.55, '#b08d3f')
  grad.addColorStop(0.8, '#8a6d3b')
  grad.addColorStop(1, '#6e5528')
  return grad
}

export function drawBeam(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  angle: number,
): void {
  const { pivotX, pivotY, beamHalf } = g
  const beamH = Math.max(10, beamHalf * 0.045)

  ctx.save()
  ctx.translate(pivotX, pivotY)

  // Nål over den graverede skala — spejler bjælkens vinkel
  const scaleR = Math.min(64, beamHalf * 0.3)
  ctx.save()
  ctx.rotate(angle)
  ctx.strokeStyle = '#7a3b1e'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, 6)
  ctx.lineTo(0, scaleR - 4)
  ctx.stroke()
  ctx.restore()

  ctx.rotate(angle)

  // Bjælke m. brushed-look
  ctx.fillStyle = brassGradient(ctx, -beamH / 2, beamH / 2)
  roundRect(ctx, -beamHalf, -beamH / 2, beamHalf * 2, beamH, beamH / 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(80,55,20,0.55)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Highlight-strøg (børstet metal)
  ctx.strokeStyle = 'rgba(255,244,210,0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-beamHalf + beamH, -beamH * 0.18)
  ctx.lineTo(beamHalf - beamH, -beamH * 0.18)
  ctx.stroke()

  // Endefinialer
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(s * beamHalf, 0, beamH * 0.75, 0, Math.PI * 2)
    const fin = ctx.createRadialGradient(
      s * beamHalf - 2,
      -2,
      1,
      s * beamHalf,
      0,
      beamH * 0.75,
    )
    fin.addColorStop(0, '#f0dba0')
    fin.addColorStop(1, '#8a6d3b')
    ctx.fillStyle = fin
    ctx.fill()
    ctx.strokeStyle = 'rgba(80,55,20,0.55)'
    ctx.stroke()
  }
  ctx.restore()

  // Pivot-boss (roterer ikke)
  const bossR = beamH * 1.15
  const boss = ctx.createRadialGradient(
    pivotX - 3,
    pivotY - 3,
    2,
    pivotX,
    pivotY,
    bossR,
  )
  boss.addColorStop(0, '#f4e2ab')
  boss.addColorStop(0.6, '#c49a4a')
  boss.addColorStop(1, '#71592c')
  ctx.fillStyle = boss
  ctx.beginPath()
  ctx.arc(pivotX, pivotY, bossR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(70,50,20,0.6)'
  ctx.stroke()
  ctx.fillStyle = 'rgba(60,42,18,0.8)'
  ctx.beginPath()
  ctx.arc(pivotX, pivotY, 2.5, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Kæder + skål under et ophængspunkt. Skålen hænger i lod.
 * Returnerer skålens dish-centrum.
 */
export function drawPanAssembly(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  attach: { x: number; y: number },
  highlight: boolean,
): { x: number; y: number } {
  const cx = attach.x
  const cy = attach.y + g.chainLen
  const { panRx, panRy } = g

  // Tre kæder til skålens kant
  ctx.strokeStyle = 'rgba(120,95,45,0.9)'
  ctx.lineWidth = 1.6
  for (const t of [-0.78, 0, 0.78]) {
    const ex = cx + panRx * t
    ctx.beginPath()
    ctx.moveTo(attach.x, attach.y)
    // let buet kæde for organisk look
    ctx.quadraticCurveTo((attach.x + ex) / 2 + t * 4, (attach.y + cy) / 2, ex, cy - panRy * 0.4)
    ctx.stroke()
  }
  // Kædeled-prikker
  ctx.fillStyle = 'rgba(150,120,60,0.8)'
  for (const t of [-0.78, 0, 0.78]) {
    const ex = cx + panRx * t
    for (let i = 1; i <= 3; i++) {
      const px = attach.x + ((ex - attach.x) * i) / 4 + t * 2
      const py = attach.y + ((cy - panRy * 0.4 - attach.y) * i) / 4
      ctx.beginPath()
      ctx.arc(px, py, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Skål-dish (set let fra oven): ydre ellipse + indre skygge
  const dish = ctx.createLinearGradient(cx - panRx, cy, cx + panRx, cy)
  dish.addColorStop(0, '#8a6d3b')
  dish.addColorStop(0.25, '#d8b96a')
  dish.addColorStop(0.5, '#efd898')
  dish.addColorStop(0.75, '#c49a4a')
  dish.addColorStop(1, '#71592c')
  ctx.fillStyle = dish
  ctx.beginPath()
  ctx.ellipse(cx, cy, panRx, panRy, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = highlight ? 'rgba(0,114,178,0.9)' : 'rgba(70,50,20,0.6)'
  ctx.lineWidth = highlight ? 3 : 1.2
  ctx.stroke()

  // Indre bund (mørkere) hvor brikkerne ligger
  ctx.fillStyle = 'rgba(90,66,25,0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + panRy * 0.15, panRx * 0.86, panRy * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()

  if (highlight) {
    ctx.fillStyle = 'rgba(0,114,178,0.12)'
    ctx.beginPath()
    ctx.ellipse(cx, cy, panRx * 1.08, panRy * 2.6, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  return { x: cx, y: cy }
}

/** Klassisk messinglod med knop — bruges som mål-reference i 'ram'-mode. */
export function drawReferenceWeight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
): void {
  const w = 58
  const h = 40
  ctx.save()
  ctx.translate(x, y)

  const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  body.addColorStop(0, '#71592c')
  body.addColorStop(0.35, '#d8b96a')
  body.addColorStop(0.6, '#efd898')
  body.addColorStop(1, '#8a6d3b')
  ctx.fillStyle = body

  // Keglestub-krop
  ctx.beginPath()
  ctx.moveTo(-w * 0.32, -h)
  ctx.lineTo(w * 0.32, -h)
  ctx.lineTo(w * 0.5, 0)
  ctx.lineTo(-w * 0.5, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(70,50,20,0.7)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  // Knop
  ctx.beginPath()
  ctx.arc(0, -h - 6, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#c49a4a'
  ctx.fill()
  ctx.stroke()

  // Graveret label
  ctx.fillStyle = 'rgba(58,40,14,0.9)'
  ctx.font = `700 12px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 0, -h * 0.45)
  ctx.restore()
}
