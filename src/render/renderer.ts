import Matter from 'matter-js'
import type { BallType, LevelDef, RunResult, Vec2 } from '../types'
import type { BallFrame, PreviewResult, SimResult, World } from '../physics/simulate'
import { BALL_SPECS, PIECE_SPECS, PORTAL_RADIUS } from '../physics/constants'

// The renderer draws the exact Matter.js bodies produced by buildWorld (so what
// you see is what the deterministic simulation used), plus the level's zones,
// coins, portal, the ghost preview and the ball. It draws in *board
// coordinates*; the caller passes the scale (board px → CSS px) and
// devicePixelRatio for crispness. Physics stepping happens elsewhere — this
// only paints.

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
  boardTop: '#0d1a30',
  boardBottom: '#0a1120',
  grid: 'rgba(148,163,184,0.06)',
  border: '#243247',
  obstacle: '#5b6b82',
  obstacleEdge: '#8ea1bd',
  breakable: '#a16207',
  breakableEdge: '#facc15',
  slotRing: '#334155',
  target: '#22c55e',
  fail: '#ef4444',
  trail: '#fbbf24',
  drop: '#38bdf8',
  coin: '#fbbf24',
  portal: '#2dd4bf',
  preview: 'rgba(125,211,252,0.85)',
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

function bodyParts(body: Matter.Body): Matter.Body[] {
  return body.parts.length > 1 ? body.parts.slice(1) : body.parts
}

/** Draw a body with a soft drop shadow and a top-lit vertical gradient fill. */
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

  // shadow
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
    grad.addColorStop(0, shade(color, 0.22))
    grad.addColorStop(1, shade(color, -0.18))
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawZone(ctx: CanvasRenderingContext2D, c: Vec2, radius: number, color: string, filled: number, glow: number): void {
  if (glow > 0) {
    const g = ctx.createRadialGradient(c.x, c.y, radius * 0.2, c.x, c.y, radius * 1.9)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = glow
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c.x, c.y, radius * 1.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = filled
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.lineWidth = 3
  ctx.strokeStyle = color
  ctx.stroke()
}

/** A star-coin: golden disc with a four-point sparkle. */
function drawCoin(ctx: CanvasRenderingContext2D, c: Vec2, radius: number): void {
  const g = ctx.createRadialGradient(c.x - radius * 0.3, c.y - radius * 0.3, radius * 0.2, c.x, c.y, radius * 1.05)
  g.addColorStop(0, '#fef3c7')
  g.addColorStop(0.55, COLORS.coin)
  g.addColorStop(1, '#b45309')
  ctx.beginPath()
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#92400e'
  ctx.stroke()
  // sparkle
  ctx.strokeStyle = '#fffbeb'
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  const s = radius * 0.5
  ctx.beginPath()
  ctx.moveTo(c.x, c.y - s)
  ctx.lineTo(c.x, c.y + s)
  ctx.moveTo(c.x - s, c.y)
  ctx.lineTo(c.x + s, c.y)
  ctx.stroke()
}

/** Portal ring (entry = solid swirl, exit = ring + direction arrow). */
function drawPortalRing(ctx: CanvasRenderingContext2D, c: Vec2, rotation: number | null): void {
  const r = PORTAL_RADIUS
  const g = ctx.createRadialGradient(c.x, c.y, r * 0.15, c.x, c.y, r * 1.15)
  g.addColorStop(0, 'rgba(45,212,191,0.55)')
  g.addColorStop(0.75, 'rgba(45,212,191,0.15)')
  g.addColorStop(1, 'rgba(45,212,191,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(c.x, c.y, r * 1.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = COLORS.portal
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = shade('#2dd4bf', 0.35)
  ctx.beginPath()
  ctx.arc(c.x, c.y, r * 0.62, 0, Math.PI * 2)
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

/** The ball: a top-lit sphere plus a per-type texture that rotates with spin. */
function drawBall(ctx: CanvasRenderingContext2D, frame: BallFrame, ballType: BallType): void {
  const spec = BALL_SPECS[ballType]
  const r = spec.radius
  const { x, y, a } = frame

  // contact shadow
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

  // rotating texture, clipped to the ball
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
    // iron: a few pits so the spin reads
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

  // fixed top-left highlight (light source doesn't rotate)
  const hl = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, -r * 0.2, -r * 0.2, r * 1.3)
  hl.addColorStop(0, 'rgba(255,255,255,0.7)')
  hl.addColorStop(0.5, 'rgba(255,255,255,0.05)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hl
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  // edge vignette + rim
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

  // Board background.
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, COLORS.boardTop)
  grad.addColorStop(1, COLORS.boardBottom)
  roundRect(ctx, 0, 0, W, H, 18)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  roundRect(ctx, 0, 0, W, H, 18)
  ctx.clip()

  // subtle grid for depth
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 1
  for (let gx = 40; gx < W; gx += 40) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, H)
    ctx.stroke()
  }
  for (let gy = 40; gy < H; gy += 40) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(W, gy)
    ctx.stroke()
  }

  // Drop chute at the top.
  ctx.fillStyle = COLORS.drop
  ctx.globalAlpha = 0.25
  roundRect(ctx, level.dropPoint.x - 16, 0, 32, 26, 6)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(level.dropPoint.x - 6, 8)
  ctx.lineTo(level.dropPoint.x + 6, 8)
  ctx.lineTo(level.dropPoint.x, 18)
  ctx.closePath()
  ctx.fillStyle = COLORS.drop
  ctx.fill()

  // Fail zones.
  for (const fz of level.failZones ?? []) drawZone(ctx, fz.position, fz.radius, COLORS.fail, 0.16, 0.12)

  // Target zone, glowing brighter on a win.
  const won = runResult === 'won'
  drawZone(ctx, level.targetZone.position, level.targetZone.radius, COLORS.target, won ? 0.5 : 0.22, won ? 0.5 : 0.28)
  ctx.beginPath()
  ctx.arc(level.targetZone.position.x, level.targetZone.position.y, Math.max(4, level.targetZone.radius * 0.28), 0, Math.PI * 2)
  ctx.fillStyle = COLORS.target
  ctx.globalAlpha = 0.85
  ctx.fill()
  ctx.globalAlpha = 1

  // Portal exit is part of the level — always visible.
  if (level.portalExit) drawPortalRing(ctx, level.portalExit.position, level.portalExit.rotation)

  // Static obstacles.
  for (const o of world.obstacles) drawBody(ctx, o, COLORS.obstacle, COLORS.obstacleEdge)

  // Breakable planks — hidden once broken at the current replay tick.
  for (let i = 0; i < world.breakables.length; i++) {
    const b = world.breakables[i]!
    const def = (level.breakables ?? [])[i]
    if (sim && frameIndex >= 0 && def) {
      const at = sim.breakablesBroken.indexOf(def.id)
      if (at !== -1 && frameIndex >= (sim.breakTicks[at] ?? Infinity)) continue // shattered
    }
    drawBody(ctx, b.body, COLORS.breakable, COLORS.breakableEdge)
    // crack pattern so it reads as breakable
    const pos = b.body.position
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(b.body.angle)
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-6, -4)
    ctx.lineTo(0, 1)
    ctx.lineTo(-3, 5)
    ctx.moveTo(5, -5)
    ctx.lineTo(3, 0)
    ctx.lineTo(7, 4)
    ctx.stroke()
    ctx.restore()
  }

  // Star coins — hidden once collected at the current replay tick.
  for (const coin of level.coins ?? []) {
    if (sim && frameIndex >= 0) {
      const at = sim.coinsCollected.indexOf(coin.id)
      if (at !== -1 && frameIndex >= (sim.coinTicks[at] ?? Infinity)) continue // collected
    }
    drawCoin(ctx, coin.position, coin.radius)
  }

  // Empty slot markers.
  const filledSlotIds = new Set(world.pieces.map((p) => p.slotId))
  ctx.setLineDash([5, 5])
  for (const slot of level.slots) {
    if (filledSlotIds.has(slot.id)) continue
    ctx.beginPath()
    ctx.arc(slot.position.x, slot.position.y, 22, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = COLORS.slotRing
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Placed pieces. Portal entries render as rings; boosters get their arrow.
  for (const piece of world.pieces) {
    if (piece.type === 'portal') {
      drawPortalRing(ctx, piece.body.position, null)
      continue
    }
    drawBody(ctx, piece.body, PIECE_SPECS[piece.type].color, '#0b1220')
    if (piece.type === 'booster') {
      const { x, y } = piece.body.position
      const a = piece.body.angle
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a)
      ctx.strokeStyle = '#fff7ed'
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      for (const off of [-7, 2]) {
        ctx.beginPath()
        ctx.moveTo(off - 4, -5)
        ctx.lineTo(off + 4, 0)
        ctx.lineTo(off - 4, 5)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  // Ghost preview: the ball's arrival, dashed — the heart of 2.0.
  if (preview && preview.frames.length > 1 && runResult !== 'running') {
    ctx.save()
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
    // Arrival marker: ring where the ball meets the player's machine (or ends).
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

  // Ball trail.
  if (trail.length > 1) {
    ctx.beginPath()
    const p0 = trail[0]!
    ctx.moveTo(p0.x, p0.y)
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i]!.x, trail[i]!.y)
    ctx.strokeStyle = COLORS.trail
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  drawBall(ctx, ball, ballType)

  ctx.restore()
}
