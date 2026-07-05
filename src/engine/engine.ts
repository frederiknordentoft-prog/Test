import { MICRO } from '../data/elements'
import { mulberry32 } from '../game/rng'
import type { BeamState, PanSide, Tile } from '../game/types'
import { tileMass } from '../game/types'
import {
  CALM_PHYSICS,
  DEFAULT_PHYSICS,
  FIXED_DT,
  dropImpulse,
  isSettled,
  stepPhysics,
  type PhysState,
  type PhysicsParams,
} from './physics'
import { renderBackground } from './render/background'
import { drawBeam, drawPanAssembly, drawReferenceWeight } from './render/beam'
import {
  attachPoints,
  computeGeometry,
  panCenter,
  type SceneGeometry,
} from './render/geometry'
import { ParticleSystem } from './render/particles'
import { baseTileRadius, drawTileDisc, layoutPanTiles } from './render/tiles'

export type EngineEvents = {
  /** Kaldes KUN når settled/balanced/masser skifter — aldrig pr. frame. */
  onBeamState?: (bs: BeamState) => void
  onTileLanded?: (tile: Tile, side: PanSide) => void
  onCelebrate?: () => void
}

type VisualTile = {
  tile: Tile
  offsetX: number
  offsetY: number
  radius: number
  spawnTime: number
  landTime: number
  landed: boolean
  dropHeight: number
}

const FLY_DUR = 0.16
const SQUASH_DUR = 0.26

/**
 * Spil-loop + render. Kører på requestAnimationFrame med fixed
 * timestep-accumulator (dt = 1/120) mod ét canvas. React rører aldrig loopet.
 */
export class ScaleEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private bgCanvas: HTMLCanvasElement | null = null
  private geometry: SceneGeometry = computeGeometry(800, 420)
  private dpr = 1

  private phys: PhysState = { angle: 0, angularVel: 0 }
  private params: PhysicsParams = DEFAULT_PHYSICS
  private reducedMotion = false

  private pans: Record<PanSide, VisualTile[]> = { left: [], right: [] }
  private virtualLeft: { massMicro: number; label: string } | null = null
  private toleranceMicro = 60_000

  private particles = new ParticleSystem(mulberry32(1234))
  private events: EngineEvents = {}
  private dropPreview: PanSide | null = null

  private rafId = 0
  private running = false
  private lastNow = 0
  private accumulator = 0
  private time = 0
  private shake = 0

  private lastPushed: BeamState | null = null
  private celebrated = false

  // ---- livscyklus ----

  attach(canvas: HTMLCanvasElement, events: EngineEvents): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.events = events
    this.resume()
  }

  detach(): void {
    this.pause()
    this.canvas = null
    this.ctx = null
  }

  pause(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  resume(): void {
    if (this.running || !this.canvas) return
    this.running = true
    this.lastNow = performance.now()
    this.accumulator = 0
    const loop = (now: number) => {
      if (!this.running) return
      const dt = Math.min(0.25, (now - this.lastNow) / 1000)
      this.lastNow = now
      this.accumulator += dt
      while (this.accumulator >= FIXED_DT) {
        this.step()
        this.accumulator -= FIXED_DT
      }
      this.render()
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  setSize(cssW: number, cssH: number, dpr: number): void {
    if (!this.canvas) return
    this.dpr = dpr
    this.canvas.width = Math.round(cssW * dpr)
    this.canvas.height = Math.round(cssH * dpr)
    this.geometry = computeGeometry(cssW, cssH)
    this.bgCanvas = null // gentegn cached baggrund
    this.relayout()
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
    this.params = reduced ? CALM_PHYSICS : DEFAULT_PHYSICS
    if (reduced) this.particles.clear()
  }

  // ---- spiltilstand ----

  /**
   * Spejl skål-indholdet fra store. Nye brikker (ukendte id'er) får
   * drop-animation; fjernede forsvinder. Store er source of truth.
   */
  syncPans(left: readonly Tile[], right: readonly Tile[]): void {
    this.syncSide('left', left)
    this.syncSide('right', right)
    this.relayout()
    this.celebrated = false
  }

  private syncSide(side: PanSide, tiles: readonly Tile[]): void {
    const existing = new Map(this.pans[side].map((v) => [v.tile.id, v]))
    const next: VisualTile[] = []
    for (const tile of tiles) {
      const found = existing.get(tile.id)
      if (found) {
        next.push(found)
      } else {
        const instant = this.reducedMotion
        next.push({
          tile,
          offsetX: 0,
          offsetY: 0,
          radius: baseTileRadius(tile),
          spawnTime: this.time,
          landTime: instant ? this.time : this.time + FLY_DUR,
          landed: instant,
          dropHeight: this.geometry.chainLen * 0.9,
        })
        if (instant) this.applyLanding(tile, side)
      }
    }
    this.pans[side] = next
  }

  setVirtualLeft(massMicro: number, label: string): void {
    this.virtualLeft = { massMicro, label }
    this.celebrated = false
  }

  clearVirtualLeft(): void {
    this.virtualLeft = null
  }

  setTolerance(toleranceMicro: number): void {
    this.toleranceMicro = toleranceMicro
  }

  /** Nulstil bjælken til ro (ny udfordring / mode-skift). */
  reset(): void {
    this.pans = { left: [], right: [] }
    this.virtualLeft = null
    this.phys = { angle: 0, angularVel: 0 }
    this.particles.clear()
    this.celebrated = false
    this.lastPushed = null
    this.shake = 0
  }

  setDropPreview(side: PanSide | null): void {
    this.dropPreview = side
  }

  // ---- hit-testing (CSS-px koordinater rel. canvas) ----

  panAt(x: number, y: number): PanSide | null {
    const g = this.geometry
    const at = attachPoints(g, this.phys.angle)
    for (const side of ['left', 'right'] as const) {
      const c = panCenter(g, at[side])
      if (
        Math.abs(x - c.x) < g.panRx * 1.35 &&
        y > c.y - g.chainLen * 0.85 &&
        y < c.y + g.panRy * 3 + 30
      ) {
        return side
      }
    }
    return null
  }

  tileAt(x: number, y: number): { side: PanSide; id: string } | null {
    const g = this.geometry
    const at = attachPoints(g, this.phys.angle)
    for (const side of ['left', 'right'] as const) {
      const c = panCenter(g, at[side])
      const list = this.pans[side]
      for (let i = list.length - 1; i >= 0; i--) {
        const v = list[i]
        if (!v || !v.landed) continue
        const dx = x - (c.x + v.offsetX)
        const dy = y - (c.y + v.offsetY)
        const hitR = Math.max(v.radius, 14)
        if (dx * dx + dy * dy <= hitR * hitR) return { side, id: v.tile.id }
      }
    }
    return null
  }

  // ---- intern ----

  private massMicro(side: PanSide, landedOnly = true): number {
    let sum = side === 'left' && this.virtualLeft ? this.virtualLeft.massMicro : 0
    for (const v of this.pans[side]) {
      if (!landedOnly || v.landed) sum += Math.round(tileMass(v.tile) * MICRO)
    }
    return sum
  }

  private relayout(): void {
    for (const side of ['left', 'right'] as const) {
      const list = this.pans[side]
      const { offsets, radius } = layoutPanTiles(
        list.map((v) => v.tile),
        this.geometry.panRx,
      )
      list.forEach((v, i) => {
        const o = offsets[i]
        if (o) {
          v.offsetX = o.x
          v.offsetY = o.y
          v.radius = radius
        }
      })
    }
  }

  private applyLanding(tile: Tile, side: PanSide): void {
    const total =
      (this.massMicro('left') + this.massMicro('right')) / MICRO || tileMass(tile)
    if (!this.reducedMotion) {
      this.phys = {
        ...this.phys,
        angularVel:
          this.phys.angularVel +
          dropImpulse(tileMass(tile), side, total, this.params),
      }
      this.shake = Math.min(1, tileMass(tile) / 240) * 0.8
    }
    this.events.onTileLanded?.(tile, side)
  }

  private step(): void {
    this.time += FIXED_DT

    // Landings-events
    for (const side of ['left', 'right'] as const) {
      for (const v of this.pans[side]) {
        if (!v.landed && this.time >= v.landTime) {
          v.landed = true
          this.applyLanding(v.tile, side)
        }
      }
    }

    const leftMicro = this.massMicro('left')
    const rightMicro = this.massMicro('right')
    const left = leftMicro / MICRO
    const right = rightMicro / MICRO

    this.phys = stepPhysics(this.phys, left, right, FIXED_DT, this.params)
    this.particles.update(FIXED_DT)
    this.shake = Math.max(0, this.shake - FIXED_DT * 3)

    const settled = isSettled(this.phys, left, right, this.params)
    const balanced = Math.abs(rightMicro - leftMicro) <= this.toleranceMicro
    const hasLeft = this.pans.left.length > 0 || this.virtualLeft !== null
    const hasRight = this.pans.right.length > 0

    if (balanced && settled && hasLeft && hasRight && !this.celebrated) {
      this.celebrated = true
      if (!this.reducedMotion) {
        const g = this.geometry
        const at = attachPoints(g, this.phys.angle)
        this.particles.burst(g.pivotX, g.pivotY - 10, 50)
        this.particles.burst(panCenter(g, at.left).x, panCenter(g, at.left).y, 30)
        this.particles.burst(panCenter(g, at.right).x, panCenter(g, at.right).y, 30)
      }
      this.events.onCelebrate?.()
    }
    if (!balanced) this.celebrated = false

    const bs: BeamState = {
      angle: this.phys.angle,
      angularVel: this.phys.angularVel,
      leftMass: left,
      rightMass: right,
      settled,
      balanced,
    }
    const last = this.lastPushed
    if (
      !last ||
      last.settled !== settled ||
      last.balanced !== balanced ||
      last.leftMass !== left ||
      last.rightMass !== right
    ) {
      this.lastPushed = bs
      this.events.onBeamState?.(bs)
    }
  }

  private ensureBackground(): HTMLCanvasElement {
    if (this.bgCanvas) return this.bgCanvas
    const g = this.geometry
    const off = document.createElement('canvas')
    off.width = Math.round(g.w * this.dpr)
    off.height = Math.round(g.h * this.dpr)
    const octx = off.getContext('2d')
    if (octx) {
      octx.scale(this.dpr, this.dpr)
      renderBackground(octx, g, mulberry32(42))
    }
    this.bgCanvas = off
    return off
  }

  private render(): void {
    const ctx = this.ctx
    if (!ctx || !this.canvas) return
    const g = this.geometry

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, g.w, g.h)
    ctx.drawImage(this.ensureBackground(), 0, 0, g.w, g.h)

    // Diskret kamera-dirren ved tunge drop
    if (this.shake > 0.01 && !this.reducedMotion) {
      const s = this.shake
      ctx.translate(
        Math.sin(this.time * 90) * s * 2.5,
        Math.cos(this.time * 70) * s * 1.5,
      )
    }

    const balanced = this.lastPushed?.balanced ?? false
    if (balanced && (this.pans.right.length > 0 || this.pans.left.length > 0)) {
      const glow = ctx.createRadialGradient(
        g.pivotX,
        g.pivotY,
        4,
        g.pivotX,
        g.pivotY,
        g.beamHalf * 1.1,
      )
      glow.addColorStop(0, 'rgba(240,210,120,0.35)')
      glow.addColorStop(1, 'rgba(240,210,120,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, g.w, g.h)
    }

    const at = attachPoints(g, this.phys.angle)
    drawBeam(ctx, g, this.phys.angle)

    for (const side of ['left', 'right'] as const) {
      const c = drawPanAssembly(ctx, g, at[side], this.dropPreview === side)

      if (side === 'left' && this.virtualLeft) {
        drawReferenceWeight(ctx, c.x, c.y - g.panRy * 0.3, this.virtualLeft.label)
      }

      for (const v of this.pans[side]) {
        const x = c.x + v.offsetX
        let y = c.y + v.offsetY
        let sx = 1
        let sy = 1
        if (!v.landed) {
          const p = Math.min(1, (this.time - v.spawnTime) / FLY_DUR)
          y -= v.dropHeight * (1 - p * p)
        } else if (!this.reducedMotion) {
          const p = (this.time - v.landTime) / SQUASH_DUR
          if (p < 1) {
            const k = Math.sin(Math.PI * Math.min(1, Math.max(0, p)))
            sy = 1 - 0.32 * k
            sx = 1 + 0.26 * k
          }
        }
        drawTileDisc(ctx, x, y, v.radius, v.tile, sx, sy)
      }
    }

    this.particles.draw(ctx)
  }
}
