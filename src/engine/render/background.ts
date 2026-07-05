import type { SceneGeometry } from './geometry'

/**
 * Statisk baggrund: pergament m. nister og vignet, valnød-søjle og fod,
 * graveret bueskala under pivot. Tegnes én gang i et offscreen-canvas
 * og blittes hver frame.
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  g: SceneGeometry,
  rng: () => number,
): void {
  const { w, h, pivotX, pivotY } = g

  // Pergament
  const paper = ctx.createLinearGradient(0, 0, 0, h)
  paper.addColorStop(0, '#f2e7cd')
  paper.addColorStop(0.5, '#ecdfc0')
  paper.addColorStop(1, '#e3d2ac')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, w, h)

  // Nister
  for (let i = 0; i < 700; i++) {
    const x = rng() * w
    const y = rng() * h
    const a = rng() * 0.05
    ctx.fillStyle = rng() > 0.5 ? `rgba(90,70,40,${a})` : `rgba(255,250,235,${a})`
    ctx.fillRect(x, y, rng() * 2 + 0.5, rng() * 2 + 0.5)
  }

  // Valnød-søjle
  const baseY = h * 0.94
  const colW = Math.max(14, w * 0.02)
  const wood = ctx.createLinearGradient(pivotX - colW, 0, pivotX + colW, 0)
  wood.addColorStop(0, '#3a2717')
  wood.addColorStop(0.35, '#6b4a2b')
  wood.addColorStop(0.55, '#7d5a36')
  wood.addColorStop(1, '#402a18')
  ctx.fillStyle = wood
  roundRect(ctx, pivotX - colW, pivotY, colW * 2, baseY - pivotY, 6)
  ctx.fill()

  // Årer i træet
  ctx.strokeStyle = 'rgba(40,25,12,0.25)'
  ctx.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    const x = pivotX - colW + colW * 0.4 * (i + 0.6)
    ctx.beginPath()
    ctx.moveTo(x, pivotY + 10)
    ctx.bezierCurveTo(
      x + 3,
      pivotY + (baseY - pivotY) * 0.3,
      x - 3,
      pivotY + (baseY - pivotY) * 0.7,
      x + 1,
      baseY - 8,
    )
    ctx.stroke()
  }

  // Fod
  const footW = Math.min(w * 0.3, 260)
  const foot = ctx.createLinearGradient(0, baseY - 8, 0, baseY + 26)
  foot.addColorStop(0, '#6b4a2b')
  foot.addColorStop(1, '#2e1d0f')
  ctx.fillStyle = foot
  roundRect(ctx, pivotX - footW / 2, baseY - 6, footW, 24, 8)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,235,200,0.12)'
  roundRect(ctx, pivotX - footW / 2 + 4, baseY - 4, footW - 8, 5, 3)
  ctx.fill()

  // Graveret bueskala under pivot (nålen tegnes dynamisk ovenpå)
  const scaleR = Math.min(64, g.beamHalf * 0.3)
  ctx.save()
  ctx.translate(pivotX, pivotY)
  ctx.strokeStyle = 'rgba(90,70,40,0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, scaleR, Math.PI * 0.5 - 0.55, Math.PI * 0.5 + 0.55)
  ctx.stroke()
  for (let i = -4; i <= 4; i++) {
    const a = Math.PI * 0.5 + (i / 4) * 0.5
    const inner = i === 0 ? scaleR - 12 : scaleR - 7
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
    ctx.lineTo(Math.cos(a) * (scaleR - 2), Math.sin(a) * (scaleR - 2))
    ctx.lineWidth = i === 0 ? 2 : 1
    ctx.stroke()
  }
  ctx.restore()

  // Vignet
  const vig = ctx.createRadialGradient(
    w / 2,
    h * 0.45,
    Math.min(w, h) * 0.35,
    w / 2,
    h * 0.5,
    Math.max(w, h) * 0.75,
  )
  vig.addColorStop(0, 'rgba(58,44,24,0)')
  vig.addColorStop(1, 'rgba(58,44,24,0.22)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
