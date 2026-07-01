import Matter from 'matter-js'
import type { LevelDef, RunResult, Vec2 } from '../types'
import type { World } from '../physics/simulate'
import { BALL_RADIUS, PIECE_SPECS } from '../physics/constants'

// The renderer draws the exact Matter.js bodies produced by buildWorld (so what
// you see is what the deterministic simulation used), plus the level's zones and
// the ball. It draws in *board coordinates*; the caller passes the scale (board
// px → CSS px) and devicePixelRatio for crispness. Physics stepping happens
// elsewhere — this only paints.

export type RenderState = {
  level: LevelDef
  world: World
  ballPos: Vec2
  trail: Vec2[]
  runResult: RunResult
  scale: number
  dpr: number
}

const COLORS = {
  boardTop: '#111c33',
  boardBottom: '#0b1424',
  border: '#1e293b',
  obstacle: '#64748b',
  obstacleEdge: '#94a3b8',
  slotRing: '#334155',
  slotRingActive: '#475569',
  target: '#22c55e',
  fail: '#ef4444',
  ball: '#f8fafc',
  trail: '#fbbf24',
  drop: '#38bdf8',
}

function drawBody(ctx: CanvasRenderingContext2D, body: Matter.Body, fill: string, edge?: string): void {
  const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts
  for (const part of parts) {
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
    ctx.fillStyle = fill
    ctx.fill()
    if (edge) {
      ctx.lineWidth = 1.5
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

function drawZone(ctx: CanvasRenderingContext2D, c: Vec2, radius: number, color: string, filled: number): void {
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

export function renderScene(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { level, world, ballPos, trail, runResult, scale, dpr } = s
  const W = level.boardWidth
  const H = level.boardHeight

  // Device pixels → board coordinates.
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
  ctx.clearRect(0, 0, W, H)

  // Board background.
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, COLORS.boardTop)
  grad.addColorStop(1, COLORS.boardBottom)
  roundRect(ctx, 0, 0, W, H, 16)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = COLORS.border
  ctx.stroke()
  ctx.save()
  roundRect(ctx, 0, 0, W, H, 16)
  ctx.clip()

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

  // Fail zones (behind everything active).
  for (const fz of level.failZones ?? []) drawZone(ctx, fz.position, fz.radius, COLORS.fail, 0.14)

  // Target zone with a soft pulse when the run has been won.
  const targetAlpha = runResult === 'won' ? 0.45 : 0.2
  drawZone(ctx, level.targetZone.position, level.targetZone.radius, COLORS.target, targetAlpha)
  // bullseye
  ctx.beginPath()
  ctx.arc(level.targetZone.position.x, level.targetZone.position.y, Math.max(4, level.targetZone.radius * 0.28), 0, Math.PI * 2)
  ctx.fillStyle = COLORS.target
  ctx.globalAlpha = 0.7
  ctx.fill()
  ctx.globalAlpha = 1

  // Static obstacles.
  for (const o of world.obstacles) drawBody(ctx, o, COLORS.obstacle, COLORS.obstacleEdge)

  // Empty slot markers (dashed rings). Filled slots are covered by their piece.
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

  // Placed pieces, coloured by type.
  for (const piece of world.pieces) {
    const spec = PIECE_SPECS[piece.type]
    drawBody(ctx, piece.body, spec.color, '#0f172a')
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

  // Ball.
  const ballGrad = ctx.createRadialGradient(
    ballPos.x - 3,
    ballPos.y - 3,
    1,
    ballPos.x,
    ballPos.y,
    BALL_RADIUS,
  )
  ballGrad.addColorStop(0, '#ffffff')
  ballGrad.addColorStop(1, runResult === 'failed' ? '#fca5a5' : COLORS.ball)
  ctx.beginPath()
  ctx.arc(ballPos.x, ballPos.y, BALL_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = ballGrad
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#cbd5e1'
  ctx.stroke()

  ctx.restore()
}
