import Matter from 'matter-js'
import type { BallType, LevelDef, RunResult, Vec2 } from '../types'
import type { BallFrame, PreviewResult, SimResult, World } from '../physics/simulate'
import { BALL_SPECS, PIECE_SPECS, PORTAL_RADIUS } from '../physics/constants'

// The renderer draws the exact Matter.js bodies produced by buildWorld (so what
// you see is what the deterministic simulation used), plus the level's zones,
// coins, portal, the ghost preview and the ball — all procedural canvas art,
// crisp at any DPI, no image assets, and fully deterministic (no randomness).
// It draws in *board coordinates*; the caller passes the scale (board px →
// CSS px) and devicePixelRatio for crispness. Physics stepping happens
// elsewhere — this only paints.

export type RenderState = {
  level: LevelDef
  world: World
  ballType: BallType
  ball: BallFrame
  trail: BallFrame[]
  runResult: RunResult
  scale: number
  dpr: number
  /** Current replay tick (trajectory index). -1 while editing. */
  frameIndex: number
  /** The run being replayed / just finished; null while editing. */
  sim: SimResult | null
  /** Ghost preview of the ball's arrival; only while editing. */
  preview: PreviewResult | null
}

const COLORS = {
  boardTop: '#12233f',
  boardMid: '#0d1a30',
  boardBottom: '#091120',
  frame: '#2c4468',
  frameHi: '#48679a',
  dot: 'rgba(148,163,184,0.10)',
  obstacle: '#5b6b82',
  obstacleEdge: '#8ea1bd',
  breakable: '#b45309',
  slotRing: '#3b4d66',
  target: '#22c55e',
  fail: '#ef4444',
  trail: '#fbbf24',
  drop: '#38bdf8',
  coin: '#fbbf24',
  portal: '#2dd4bf',
  preview: 'rgba(125,211,252,0.9)',
}

/** Lighten (amt>0) or darken (amt<0) a #rrggbb colour by a 0..1 amount. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const f = amt < 0 ? 1 + amt : 1
  const t = amt < 0 ? 0 : 255 * amt
  return `rgb(${clamp(r * f + t)},${clamp(g * f + t)},${clamp(b * f + t)})`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function bodyParts(body: Matter.Body): Matter.Body[] {
  return body.parts.length > 1 ? body.parts.slice(1) : body.parts
}

/** Generic body: soft drop shadow + top-lit vertical gradient (walls, plates). */
function drawBody(ctx: CanvasRenderingContext2D, body: Matter.Body, color: string, edge?: string): void {
  const parts = bodyParts(body)

  const trace = (part: Matter.Body) => {
    ctx.beginPath()
    if (part.circleRadius) {
      ctx.arc(part.position.x, part.position.y, part.circleRadius, 0, Math.PI * 2)
    } else {
      const vs = part.vertices
      const first = vs[0]!
      ctx.moveTo(first.x, first.y)
      for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i]!.x, vs[i]!.y)
      ctx.closePath()
    }
  }

  ctx.save()
  ctx.translate(0, 2.5)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  for (const part of parts) {
    trace(part)
    ctx.fill()
  }
  ctx.restore()

  for (const part of parts) {
    const { min, max } = part.bounds
    const grad = ctx.createLinearGradient(0, min.y, 0, max.y)
    grad.addColorStop(0, shade(color, 0.25))
    grad.addColorStop(0.45, color)
    grad.addColorStop(1, shade(color, -0.25))
    trace(part)
    ctx.fillStyle = grad
    ctx.fill()
    if (edge) {
      ctx.lineWidth = 1.25
      ctx.strokeStyle = edge
      ctx.stroke()
    }
  }
}

/** A little dome-headed bolt/rivet with a specular glint. */
function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2): void {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.2, x, y, r)
  g.addColorStop(0, '#e2e8f0')
  g.addColorStop(0.6, '#94a3b8')
  g.addColorStop(1, '#475569')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
}

// ─────────────────────────────── player pieces ───────────────────────────────
// Dimensions mirror pieces.ts exactly so the art IS the collision silhouette.

function drawRamp(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  // colored under-glow
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  // body 92×11
  const g = ctx.createLinearGradient(0, -5.5, 0, 5.5)
  g.addColorStop(0, shade(color, 0.35))
  g.addColorStop(0.5, color)
  g.addColorStop(1, shade(color, -0.35))
  roundRect(ctx, -46, -5.5, 92, 11, 5)
  ctx.fillStyle = g
  ctx.fill()
  ctx.shadowBlur = 0
  // glossy top strip
  roundRect(ctx, -43, -4.5, 86, 3, 1.5)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fill()
  // grip notches
  ctx.strokeStyle = 'rgba(2,6,23,0.35)'
  ctx.lineWidth = 1
  for (let i = -30; i <= 30; i += 15) {
    ctx.beginPath()
    ctx.moveTo(i, -2)
    ctx.lineTo(i, 3.5)
    ctx.stroke()
  }
  drawBolt(ctx, -40, 0)
  drawBolt(ctx, 40, 0)
  ctx.restore()
}

function drawBouncer(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  // base 66×13
  const g = ctx.createLinearGradient(0, -6.5, 0, 6.5)
  g.addColorStop(0, shade(color, 0.2))
  g.addColorStop(1, shade(color, -0.4))
  roundRect(ctx, -33, -6.5, 66, 13, 6)
  ctx.fillStyle = g
  ctx.fill()
  ctx.shadowBlur = 0
  // taut white membrane on top
  roundRect(ctx, -30, -6, 60, 4.5, 2.2)
  ctx.fillStyle = '#fff1f7'
  ctx.fill()
  ctx.strokeStyle = 'rgba(2,6,23,0.25)'
  ctx.lineWidth = 1
  ctx.stroke()
  // spring coils peeking out under the pad
  ctx.strokeStyle = shade(color, -0.5)
  ctx.lineWidth = 1.6
  for (const cx of [-18, 0, 18]) {
    ctx.beginPath()
    ctx.arc(cx, 4.5, 3, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
  ctx.restore()
}

function drawFunnel(ctx: CanvasRenderingContext2D, body: Matter.Body, color: string): void {
  // Compound: two tilted plates — style each plate as riveted metal.
  drawBody(ctx, body, color, shade(color, -0.45))
  for (const part of bodyParts(body)) {
    drawBolt(ctx, part.position.x, part.position.y, 1.8)
  }
}

function drawBooster(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  // hot glow
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  // capsule 46×16
  const g = ctx.createLinearGradient(0, -8, 0, 8)
  g.addColorStop(0, shade(color, 0.35))
  g.addColorStop(0.5, color)
  g.addColorStop(1, '#c2410c')
  roundRect(ctx, -23, -8, 46, 16, 8)
  ctx.fillStyle = g
  ctx.fill()
  ctx.shadowBlur = 0
  // glossy top
  roundRect(ctx, -19, -6.5, 38, 5, 2.5)
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  ctx.fill()
  // firing chevrons
  ctx.strokeStyle = '#fff7ed'
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  for (const off of [-8, 1]) {
    ctx.beginPath()
    ctx.moveTo(off - 4, -4.5)
    ctx.lineTo(off + 4, 0)
    ctx.lineTo(off - 4, 4.5)
    ctx.stroke()
  }
  // nozzle tip
  ctx.beginPath()
  ctx.moveTo(14, -6)
  ctx.lineTo(21.5, 0)
  ctx.lineTo(14, 6)
  ctx.closePath()
  ctx.fillStyle = '#fff7ed'
  ctx.globalAlpha = 0.85
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

/** Portal ring (entry = swirl, exit = ring + direction arrow). */
function drawPortalRing(ctx: CanvasRenderingContext2D, c: Vec2, rotation: number | null): void {
  const r = PORTAL_RADIUS
  const g = ctx.createRadialGradient(c.x, c.y, r * 0.1, c.x, c.y, r * 1.4)
  g.addColorStop(0, 'rgba(94,234,212,0.65)')
  g.addColorStop(0.6, 'rgba(45,212,191,0.18)')
  g.addColorStop(1, 'rgba(45,212,191,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(c.x, c.y, r * 1.4, 0, Math.PI * 2)
  ctx.fill()
  // main ring with glow
  ctx.save()
  ctx.shadowColor = COLORS.portal
  ctx.shadowBlur = 10
  ctx.lineWidth = 3.2
  ctx.strokeStyle = COLORS.portal
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  // inner swirl arcs
  ctx.strokeStyle = shade('#2dd4bf', 0.4)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(c.x, c.y, r * 0.62, 0.2, 2.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(c.x, c.y, r * 0.62, Math.PI + 0.2, Math.PI + 2.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(c.x, c.y, r * 0.3, 1.2, 4.6)
  ctx.stroke()
  if (rotation !== null) {
    // exit: show which way the ball is fired
    const ax = Math.cos(rotation)
    const ay = Math.sin(rotation)
    ctx.strokeStyle = COLORS.portal
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(c.x + ax * (r + 3), c.y + ay * (r + 3))
    ctx.lineTo(c.x + ax * (r + 13), c.y + ay * (r + 13))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(c.x + ax * (r + 17), c.y + ay * (r + 17))
    ctx.lineTo(c.x + ax * (r + 9) - ay * 5, c.y + ay * (r + 9) + ax * 5)
    ctx.lineTo(c.x + ax * (r + 9) + ay * 5, c.y + ay * (r + 9) - ax * 5)
    ctx.closePath()
    ctx.fillStyle = COLORS.portal
    ctx.fill()
  }
}

// ─────────────────────────────── level elements ──────────────────────────────

/** Breakable plank: warm wood, grain, straps — clearly "smashable". */
function drawBreakable(ctx: CanvasRenderingContext2D, body: Matter.Body, halfX: number, halfY: number): void {
  const { x, y } = body.position
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(body.angle)
  // shadow
  ctx.save()
  ctx.translate(0, 2.5)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, -halfX, -halfY, halfX * 2, halfY * 2, 3)
  ctx.fill()
  ctx.restore()
  // wood body
  const g = ctx.createLinearGradient(0, -halfY, 0, halfY)
  g.addColorStop(0, '#d97706')
  g.addColorStop(0.5, COLORS.breakable)
  g.addColorStop(1, '#78350f')
  roundRect(ctx, -halfX, -halfY, halfX * 2, halfY * 2, 3)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 1.2
  ctx.stroke()
  // grain lines along the long axis
  ctx.strokeStyle = 'rgba(69,26,3,0.5)'
  ctx.lineWidth = 1
  const long = Math.max(halfX, halfY)
  const across = Math.min(halfX, halfY)
  const horizontal = halfX >= halfY
  for (const t of [-0.4, 0.15, 0.5]) {
    ctx.beginPath()
    if (horizontal) {
      ctx.moveTo(-long + 6, t * across)
      ctx.lineTo(long - 6, t * across * 0.6)
    } else {
      ctx.moveTo(t * across, -long + 6)
      ctx.lineTo(t * across * 0.6, long - 6)
    }
    ctx.stroke()
  }
  // crack marks
  ctx.strokeStyle = 'rgba(2,6,23,0.55)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  if (horizontal) {
    ctx.moveTo(-6, -across)
    ctx.lineTo(0, 0)
    ctx.lineTo(-3, across)
    ctx.moveTo(7, -across * 0.7)
    ctx.lineTo(4, 0.5)
  } else {
    ctx.moveTo(-across, -6)
    ctx.lineTo(0, 0)
    ctx.lineTo(across, -3)
    ctx.moveTo(-across * 0.7, 7)
    ctx.lineTo(0.5, 4)
  }
  ctx.stroke()
  // metal straps near the ends
  ctx.fillStyle = '#64748b'
  if (horizontal) {
    ctx.fillRect(-halfX + 3, -halfY, 3, halfY * 2)
    ctx.fillRect(halfX - 6, -halfY, 3, halfY * 2)
  } else {
    ctx.fillRect(-halfX, -halfY + 3, halfX * 2, 3)
    ctx.fillRect(-halfX, halfY - 6, halfX * 2, 3)
  }
  ctx.restore()
}

/** The goal: glowing ring with a gold star at its heart. */
function drawTarget(ctx: CanvasRenderingContext2D, c: Vec2, radius: number, won: boolean): void {
  const glow = ctx.createRadialGradient(c.x, c.y, radius * 0.2, c.x, c.y, radius * 2)
  glow.addColorStop(0, COLORS.target)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = won ? 0.55 : 0.3
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius * 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // dish
  const dish = ctx.createRadialGradient(c.x, c.y - radius * 0.3, radius * 0.1, c.x, c.y, radius)
  dish.addColorStop(0, 'rgba(34,197,94,0.4)')
  dish.addColorStop(1, 'rgba(34,197,94,0.12)')
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = dish
  ctx.fill()
  ctx.save()
  ctx.shadowColor = COLORS.target
  ctx.shadowBlur = won ? 16 : 8
  ctx.lineWidth = 3.5
  ctx.strokeStyle = COLORS.target
  ctx.stroke()
  ctx.restore()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(187,247,208,0.7)'
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius - 4, 0, Math.PI * 2)
  ctx.stroke()
  // gold star
  const sr = Math.max(6, radius * 0.34)
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? sr : sr * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const px = c.x + Math.cos(a) * rr
    const py = c.y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  const star = ctx.createLinearGradient(c.x, c.y - sr, c.x, c.y + sr)
  star.addColorStop(0, '#fde68a')
  star.addColorStop(1, '#f59e0b')
  ctx.fillStyle = star
  ctx.fill()
  ctx.strokeStyle = '#92400e'
  ctx.lineWidth = 1
  ctx.stroke()
}

/** Fail zone: red hazard ring with warning teeth. */
function drawFailZone(ctx: CanvasRenderingContext2D, c: Vec2, radius: number): void {
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(239,68,68,0.13)'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = 'rgba(239,68,68,0.85)'
  ctx.stroke()
  // inward teeth
  ctx.fillStyle = 'rgba(239,68,68,0.55)'
  const teeth = Math.max(8, Math.round(radius / 4))
  for (let i = 0; i < teeth; i++) {
    const a = (i * Math.PI * 2) / teeth
    const ax = Math.cos(a)
    const ay = Math.sin(a)
    const bx = Math.cos(a + 0.12)
    const by = Math.sin(a + 0.12)
    ctx.beginPath()
    ctx.moveTo(c.x + ax * radius, c.y + ay * radius)
    ctx.lineTo(c.x + bx * radius, c.y + by * radius)
    ctx.lineTo(c.x + Math.cos(a + 0.06) * (radius - 6), c.y + Math.sin(a + 0.06) * (radius - 6))
    ctx.closePath()
    ctx.fill()
  }
}

/** A star-coin: golden disc, embossed star, sparkle. */
function drawCoin(ctx: CanvasRenderingContext2D, c: Vec2, radius: number): void {
  ctx.save()
  ctx.shadowColor = COLORS.coin
  ctx.shadowBlur = 8
  const g = ctx.createRadialGradient(c.x - radius * 0.3, c.y - radius * 0.3, radius * 0.2, c.x, c.y, radius * 1.05)
  g.addColorStop(0, '#fef3c7')
  g.addColorStop(0.55, COLORS.coin)
  g.addColorStop(1, '#b45309')
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#92400e'
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
  ctx.stroke()
  // embossed mini star
  const sr = radius * 0.58
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? sr : sr * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const px = c.x + Math.cos(a) * rr
    const py = c.y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = '#fffbeb'
  ctx.fill()
}

/** The ball: a top-lit sphere plus a per-type texture that rotates with spin. */
function drawBall(ctx: CanvasRenderingContext2D, frame: BallFrame, ballType: BallType): void {
  const spec = BALL_SPECS[ballType]
  const r = spec.radius
  const { x, y, a } = frame

  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.7, r * 1.05, r * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(x, y)

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = spec.color
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.rotate(a)
  ctx.lineCap = 'round'
  if (ballType === 'basketball') {
    ctx.strokeStyle = spec.accent
    ctx.lineWidth = r * 0.13
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(0, r)
    ctx.moveTo(-r, 0)
    ctx.lineTo(r, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(-r * 0.62, 0, r * 0.5, r, 0, -Math.PI / 2, Math.PI / 2)
    ctx.ellipse(r * 0.62, 0, r * 0.5, r, 0, Math.PI / 2, (3 * Math.PI) / 2)
    ctx.stroke()
  } else if (ballType === 'wood') {
    ctx.strokeStyle = shade(spec.color, -0.28)
    ctx.lineWidth = 1.1
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(-r * 0.25, -r * 0.15, (r * i) / 3.2, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(-r, r * 0.4)
    ctx.lineTo(r, r * 0.15)
    ctx.stroke()
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    const pits: Vec2[] = [
      { x: r * 0.35, y: -r * 0.2 },
      { x: -r * 0.3, y: r * 0.35 },
      { x: r * 0.05, y: r * 0.5 },
    ]
    for (const p of pits) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, r * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()

  const hl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, -r * 0.2, -r * 0.2, r * 1.3)
  hl.addColorStop(0, 'rgba(255,255,255,0.7)')
  hl.addColorStop(0.5, 'rgba(255,255,255,0.05)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hl
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  const vg = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vg
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = shade(spec.accent, 0)
  ctx.stroke()

  ctx.restore()
}

export function renderScene(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { level, world, ballType, ball, trail, runResult, scale, dpr, frameIndex, sim, preview } = s
  const W = level.boardWidth
  const H = level.boardHeight

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
  ctx.clearRect(0, 0, W, H)

  // Board background: deep gradient with a soft spotlight from the drop.
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, COLORS.boardTop)
  grad.addColorStop(0.4, COLORS.boardMid)
  grad.addColorStop(1, COLORS.boardBottom)
  roundRect(ctx, 0, 0, W, H, 18)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  roundRect(ctx, 0, 0, W, H, 18)
  ctx.clip()

  const spot = ctx.createRadialGradient(level.dropPoint.x, 40, 20, level.dropPoint.x, 60, H * 0.9)
  spot.addColorStop(0, 'rgba(125,211,252,0.10)')
  spot.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, W, H)

  // dot grid
  ctx.fillStyle = COLORS.dot
  for (let gx = 40; gx < W; gx += 40) {
    for (let gy = 40; gy < H; gy += 40) {
      ctx.beginPath()
      ctx.arc(gx, gy, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Drop dispenser: metal housing with a dark mouth.
  const dw = 44
  const dg = ctx.createLinearGradient(level.dropPoint.x - dw / 2, 0, level.dropPoint.x + dw / 2, 0)
  dg.addColorStop(0, '#334155')
  dg.addColorStop(0.5, '#64748b')
  dg.addColorStop(1, '#334155')
  roundRect(ctx, level.dropPoint.x - dw / 2, -8, dw, 34, 8)
  ctx.fillStyle = dg
  ctx.fill()
  ctx.strokeStyle = COLORS.frameHi
  ctx.lineWidth = 1.5
  ctx.stroke()
  roundRect(ctx, level.dropPoint.x - 13, 14, 26, 8, 4)
  ctx.fillStyle = '#020617'
  ctx.fill()
  drawBolt(ctx, level.dropPoint.x - 16, 4, 2)
  drawBolt(ctx, level.dropPoint.x + 16, 4, 2)
  ctx.beginPath()
  ctx.moveTo(level.dropPoint.x - 5, 26)
  ctx.lineTo(level.dropPoint.x + 5, 26)
  ctx.lineTo(level.dropPoint.x, 34)
  ctx.closePath()
  ctx.fillStyle = COLORS.drop
  ctx.fill()

  // Fail zones.
  for (const fz of level.failZones ?? []) drawFailZone(ctx, fz.position, fz.radius)

  // Target zone, glowing brighter on a win.
  drawTarget(ctx, level.targetZone.position, level.targetZone.radius, runResult === 'won')

  // Portal exit is part of the level — always visible.
  if (level.portalExit) drawPortalRing(ctx, level.portalExit.position, level.portalExit.rotation)

  // Static obstacles: stone walls and domed pegs.
  for (const o of world.obstacles) {
    if (o.circleRadius) {
      const { x, y } = o.position
      const r = o.circleRadius
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r)
      g.addColorStop(0, '#cbd5e1')
      g.addColorStop(0.55, COLORS.obstacle)
      g.addColorStop(1, '#334155')
      ctx.save()
      ctx.translate(0, 2)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = COLORS.obstacleEdge
      ctx.lineWidth = 1.25
      ctx.stroke()
    } else {
      drawBody(ctx, o, COLORS.obstacle, COLORS.obstacleEdge)
      // top highlight edge for walls
      const vs = o.vertices
      if (vs.length === 4) {
        ctx.strokeStyle = 'rgba(226,232,240,0.35)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(vs[0]!.x, vs[0]!.y)
        ctx.lineTo(vs[1]!.x, vs[1]!.y)
        ctx.stroke()
      }
    }
  }

  // Breakable planks — hidden once broken at the current replay tick.
  for (let i = 0; i < world.breakables.length; i++) {
    const b = world.breakables[i]!
    const def = (level.breakables ?? [])[i]
    if (sim && frameIndex >= 0 && def) {
      const at = sim.breakablesBroken.indexOf(def.id)
      if (at !== -1 && frameIndex >= (sim.breakTicks[at] ?? Infinity)) continue // shattered
    }
    drawBreakable(ctx, b.body, def?.size.x ?? 40, def?.size.y ?? 7)
  }

  // Star coins — hidden once collected at the current replay tick.
  for (const coin of level.coins ?? []) {
    if (sim && frameIndex >= 0) {
      const at = sim.coinsCollected.indexOf(coin.id)
      if (at !== -1 && frameIndex >= (sim.coinTicks[at] ?? Infinity)) continue // collected
    }
    drawCoin(ctx, coin.position, coin.radius)
  }

  // Empty slot markers: dashed sockets.
  const filledSlotIds = new Set(world.pieces.map((p) => p.slotId))
  for (const slot of level.slots) {
    if (filledSlotIds.has(slot.id)) continue
    const { x, y } = slot.position
    const g = ctx.createRadialGradient(x, y, 4, x, y, 24)
    g.addColorStop(0, 'rgba(56,189,248,0.10)')
    g.addColorStop(1, 'rgba(56,189,248,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 24, 0, Math.PI * 2)
    ctx.fill()
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(x, y, 22, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = COLORS.slotRing
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Placed pieces — each type gets its own hand-drawn art.
  for (const piece of world.pieces) {
    const color = PIECE_SPECS[piece.type].color
    const { x, y } = piece.body.position
    switch (piece.type) {
      case 'portal':
        drawPortalRing(ctx, piece.body.position, null)
        break
      case 'ramp':
        drawRamp(ctx, x, y, piece.body.angle, color)
        break
      case 'bouncer':
        drawBouncer(ctx, x, y, piece.body.angle, color)
        break
      case 'booster':
        drawBooster(ctx, x, y, piece.body.angle, color)
        break
      case 'funnel':
        drawFunnel(ctx, piece.body, color)
        break
    }
  }

  // Ghost preview: the ball's arrival, dashed — the heart of 2.0.
  if (preview && preview.frames.length > 1 && runResult !== 'running') {
    ctx.save()
    ctx.shadowColor = 'rgba(125,211,252,0.8)'
    ctx.shadowBlur = 6
    ctx.setLineDash([7, 7])
    ctx.strokeStyle = COLORS.preview
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const f0 = preview.frames[0]!
    ctx.moveTo(f0.x, f0.y)
    for (let i = 1; i < preview.frames.length; i++) ctx.lineTo(preview.frames[i]!.x, preview.frames[i]!.y)
    ctx.stroke()
    ctx.setLineDash([])
    const last = preview.frames[preview.frames.length - 1]!
    ctx.beginPath()
    ctx.arc(last.x, last.y, preview.cut ? 8 : 5, 0, Math.PI * 2)
    ctx.strokeStyle = COLORS.preview
    ctx.lineWidth = 2
    ctx.stroke()
    if (preview.cut) {
      ctx.beginPath()
      ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.preview
      ctx.fill()
    }
    ctx.restore()
  }

  // Ball trail: fades out toward the tail.
  if (trail.length > 1) {
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const n = trail.length
    const step = Math.max(1, Math.floor(n / 90)) // cap segment count
    for (let i = step; i < n; i += step) {
      const a = trail[i - step]!
      const b = trail[i]!
      ctx.globalAlpha = 0.08 + 0.4 * (i / n)
      ctx.strokeStyle = COLORS.trail
      ctx.lineWidth = 1.5 + 2 * (i / n)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  drawBall(ctx, ball, ballType)

  ctx.restore()

  // Machine frame around the board.
  ctx.lineWidth = 3
  ctx.strokeStyle = COLORS.frame
  roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 16)
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.strokeStyle = COLORS.frameHi
  roundRect(ctx, 3.5, 3.5, W - 7, H - 7, 14)
  ctx.stroke()
}
