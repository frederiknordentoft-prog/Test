import type { Vec2 } from '../types'

// ---------------------------------------------------------------------------
// Deterministic particle bursts. Spawn parameters (direction, speed, size,
// colour pick) come from a PRNG seeded by (level id, trajectory tick), so the
// same run always bursts the same way — never Math.random(). Motion is an
// analytic function of age, integrated over display time only.
// ---------------------------------------------------------------------------

export type Particle = {
  origin: Vec2
  vx: number
  vy: number
  size: number
  color: string
  /** Seconds the particle lives. */
  life: number
  /** Display timestamp (performance.now()/1000) when spawned. */
  bornAt: number
}

/** mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFrom(levelId: string, tick: number): number {
  let h = 2166136261
  for (let i = 0; i < levelId.length; i++) {
    h ^= levelId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h ^ (tick * 2654435761)) >>> 0
}

export function spawnBurst(
  origin: Vec2,
  colors: string[],
  count: number,
  seed: number,
  bornAt: number,
  speed = 90,
): Particle[] {
  const rnd = mulberry32(seed)
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2
    const v = speed * (0.4 + rnd() * 0.9)
    out.push({
      origin: { x: origin.x, y: origin.y },
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - speed * 0.35,
      size: 1.6 + rnd() * 2.6,
      color: colors[Math.floor(rnd() * colors.length)] ?? '#fff',
      life: 0.45 + rnd() * 0.4,
      bornAt,
    })
  }
  return out
}

const GRAVITY = 300 // px/s² in board space — display flavour only

/** Draw live particles; returns the ones still alive. */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], nowSec: number): Particle[] {
  const alive: Particle[] = []
  for (const p of particles) {
    const age = nowSec - p.bornAt
    if (age < 0 || age > p.life) continue
    const k = age / p.life
    const x = p.origin.x + p.vx * age
    const y = p.origin.y + p.vy * age + 0.5 * GRAVITY * age * age
    ctx.globalAlpha = 1 - k
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(x, y, p.size * (1 - k * 0.5), 0, Math.PI * 2)
    ctx.fill()
    alive.push(p)
  }
  ctx.globalAlpha = 1
  return alive
}

export const COIN_COLORS = ['#fde68a', '#fbbf24', '#f59e0b', '#fffbeb']
export const BREAK_COLORS = ['#a16207', '#d97706', '#78350f', '#facc15']
export const WIN_COLORS = ['#4ade80', '#22c55e', '#bbf7d0', '#86efac']
