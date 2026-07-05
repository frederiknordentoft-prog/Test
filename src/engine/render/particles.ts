type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  spin: number
  rot: number
}

const COLORS = ['#e9cf8a', '#d8b96a', '#f4e2ab', '#0072B2', '#009E73', '#D55E00']

export class ParticleSystem {
  private particles: Particle[] = []
  private rng: () => number

  constructor(rng: () => number) {
    this.rng = rng
  }

  burst(x: number, y: number, count = 40): void {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2
      const speed = 60 + this.rng() * 220
      const life = 0.7 + this.rng() * 0.9
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life,
        maxLife: life,
        size: 2.5 + this.rng() * 4,
        color: COLORS[Math.floor(this.rng() * COLORS.length)] ?? '#e9cf8a',
        spin: (this.rng() - 0.5) * 10,
        rot: this.rng() * Math.PI,
      })
    }
  }

  get active(): boolean {
    return this.particles.length > 0
  }

  clear(): void {
    this.particles.length = 0
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 420 * dt
      p.vx *= 1 - 0.9 * dt
      p.rot += p.spin * dt
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.min(1, (p.life / p.maxLife) * 1.6)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7)
      ctx.restore()
    }
  }
}
