/**
 * A fixed-size particle pool drawn on one canvas above the UI.
 *
 * Everything lives in typed arrays and the update loop allocates nothing per
 * frame — object churn is the usual reason a web game stutters on an older iPad,
 * and this is the part of the app that runs every frame.
 */

export type BurstKind = 'spark' | 'star' | 'confetti' | 'ring'

export interface BurstOptions {
  count?: number
  hue?: number
  hueSpread?: number
  speed?: number
  gravity?: number
  size?: number
  life?: number
  kind?: BurstKind
  /** direction in radians; omit for a full circle */
  angle?: number
  spread?: number
}

const MAX = 520
const KIND_INDEX: Record<BurstKind, number> = { spark: 0, star: 1, confetti: 2, ring: 3 }

const px = new Float32Array(MAX)
const py = new Float32Array(MAX)
const vx = new Float32Array(MAX)
const vy = new Float32Array(MAX)
const life = new Float32Array(MAX)
const maxLife = new Float32Array(MAX)
const size = new Float32Array(MAX)
const rot = new Float32Array(MAX)
const vrot = new Float32Array(MAX)
const hue = new Float32Array(MAX)
const grav = new Float32Array(MAX)
const kind = new Uint8Array(MAX)

let cursor = 0
let intensity = 1

export function setEffectIntensity(value: number): void {
  intensity = Math.max(0, Math.min(1, value))
}

export function burst(x: number, y: number, o: BurstOptions = {}): void {
  if (intensity === 0) return
  const count = Math.round((o.count ?? 18) * intensity)
  const baseHue = o.hue ?? 45
  const spread = o.spread ?? Math.PI * 2
  const angle = o.angle ?? 0
  const speed = o.speed ?? 320
  const k = KIND_INDEX[o.kind ?? 'spark']

  for (let i = 0; i < count; i++) {
    const idx = cursor
    cursor = (cursor + 1) % MAX
    const dir = o.spread === undefined ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * spread
    const v = speed * (0.45 + Math.random() * 0.75)
    px[idx] = x
    py[idx] = y
    vx[idx] = Math.cos(dir) * v
    vy[idx] = Math.sin(dir) * v
    const l = (o.life ?? 0.75) * (0.7 + Math.random() * 0.6)
    life[idx] = l
    maxLife[idx] = l
    size[idx] = (o.size ?? 7) * (0.6 + Math.random() * 0.9)
    rot[idx] = Math.random() * Math.PI * 2
    vrot[idx] = (Math.random() - 0.5) * 12
    hue[idx] = baseHue + (Math.random() - 0.5) * (o.hueSpread ?? 50)
    grav[idx] = o.gravity ?? 900
    kind[idx] = k
  }
}

export function stepAndDraw(ctx: CanvasRenderingContext2D, dt: number, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < MAX; i++) {
    if (life[i] <= 0) continue
    life[i] -= dt
    if (life[i] <= 0) continue

    vy[i] += grav[i] * dt
    vx[i] *= 0.985
    vy[i] *= 0.985
    px[i] += vx[i] * dt
    py[i] += vy[i] * dt
    rot[i] += vrot[i] * dt

    const t = life[i] / maxLife[i]
    const alpha = t < 0.25 ? t / 0.25 : 1
    const s = size[i] * (0.5 + t * 0.5)
    ctx.fillStyle = `hsla(${hue[i]}, 95%, ${58 + t * 22}%, ${alpha})`

    switch (kind[i]) {
      case 1: { // star
        ctx.save()
        ctx.translate(px[i], py[i])
        ctx.rotate(rot[i])
        ctx.beginPath()
        for (let p = 0; p < 10; p++) {
          const r = p % 2 === 0 ? s : s * 0.42
          const a = (p / 10) * Math.PI * 2
          p === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        ctx.closePath()
        ctx.fill()
        ctx.restore()
        break
      }
      case 2: { // confetti
        ctx.save()
        ctx.translate(px[i], py[i])
        ctx.rotate(rot[i])
        ctx.fillRect(-s * 0.5, -s * 0.9, s, s * 1.8)
        ctx.restore()
        break
      }
      case 3: { // expanding ring
        ctx.strokeStyle = ctx.fillStyle
        ctx.lineWidth = Math.max(1, s * 0.25)
        ctx.beginPath()
        ctx.arc(px[i], py[i], s * (1 + (1 - t) * 6), 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      default: {
        ctx.beginPath()
        ctx.arc(px[i], py[i], s, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

export function clearParticles(): void {
  life.fill(0)
}

/** Convenience bursts used across the app, so the feel stays consistent. */
export const fx = {
  correct(x: number, y: number, hueBase = 45): void {
    burst(x, y, { count: 22, hue: hueBase, kind: 'spark', speed: 340, size: 6, life: 0.7 })
    burst(x, y, { count: 6, hue: hueBase, kind: 'star', speed: 260, size: 11, life: 0.85 })
    burst(x, y, { count: 1, hue: hueBase, kind: 'ring', speed: 0, gravity: 0, size: 8, life: 0.42 })
  },
  gentle(x: number, y: number): void {
    burst(x, y, { count: 8, hue: 250, kind: 'spark', speed: 130, size: 5, life: 0.45, gravity: 300 })
  },
  golden(x: number, y: number): void {
    burst(x, y, { count: 34, hue: 48, hueSpread: 22, kind: 'star', speed: 430, size: 12, life: 1 })
  },
  celebrate(w: number, h: number): void {
    for (let i = 0; i < 5; i++)
      burst(w * (0.15 + Math.random() * 0.7), h * 0.28, {
        count: 20, hue: Math.random() * 360, hueSpread: 90, kind: 'confetti',
        speed: 520, size: 9, life: 1.9, gravity: 620,
      })
  },
}
