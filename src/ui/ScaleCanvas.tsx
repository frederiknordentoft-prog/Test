import { useEffect, useRef } from 'react'
import { unlockAudio } from '../audio/sound'
import { engine } from '../engine/instance'
import { useGameStore } from '../state/store'

/** Holder til canvas-elementet så Tray kan hit-teste drops mod engine. */
export const canvasHolder: { el: HTMLCanvasElement | null } = { el: null }

export function ScaleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    canvasHolder.el = canvas
    engine.attach(canvas, {
      onBeamState: (bs) => useGameStore.getState().handleBeamState(bs),
      onCelebrate: () => useGameStore.getState().handleCelebrate(),
      onTileLanded: (tile) => useGameStore.getState().handleTileLanded(tile),
    })

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width < 10 || height < 10) return
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      engine.setSize(width, height, Math.min(window.devicePixelRatio || 1, 2))
    })
    ro.observe(wrap)

    // iOS/Android: pausér rent når fanen skjules, og resumér uden dt-spring
    const onVisibility = () => {
      if (document.hidden) engine.pause()
      else engine.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      engine.detach()
      canvasHolder.el = null
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio()
    const rect = e.currentTarget.getBoundingClientRect()
    const hit = engine.tileAt(e.clientX - rect.left, e.clientY - rect.top)
    if (hit) useGameStore.getState().removeTile(hit.side, hit.id)
  }

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        className="block touch-none select-none"
        aria-label="Skålvægt — tap på en brik i en skål for at fjerne den"
      />
    </div>
  )
}
