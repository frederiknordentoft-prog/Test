import { useEffect, useRef } from 'react'
import { stepAndDraw } from './particles'

/**
 * One full-screen canvas above everything, driven by its own rAF loop. It never
 * re-renders through React — React owns the UI, this owns the frames.
 */
export function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let w = 0
    let h = 0
    const resize = () => {
      // capping the pixel ratio keeps the fill rate sane on an older iPad
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      // clamp dt so a backgrounded tab does not fling every particle off screen
      const dt = Math.min((now - last) / 1000, 1 / 20)
      last = now
      stepAndDraw(ctx, dt, w, h)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" aria-hidden="true" />
}
