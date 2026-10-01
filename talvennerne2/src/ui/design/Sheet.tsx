// Bottom sheet with a spring (stiffness 380, damping 32) via WAAPI. Stays mounted while it animates
// out. Calm mode and reduced motion: a plain crossfade. Rendered in a portal so screen transitions
// (transforms on ancestors) never move it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ClipId } from '../../engine/types'
import { IconButton } from './Button'
import { SpokenText } from './SpokenText'
import { DUR, EASE, EASE_IN, fade, isCalm, springInY } from './motion'
import { cx } from './cx'

export interface SheetProps {
  open: boolean
  onClose: () => void
  /** Heading, read aloud on tap. */
  title?: ClipId
  /** Clip for the ✕ button's name (default s.ui.close). */
  closeClip?: ClipId
  /** auto: as tall as the content (max 88 %); tall: fixed 88 %. */
  height?: 'auto' | 'tall'
  className?: string
  children?: ReactNode
}

export function Sheet({ open, onClose, title, closeClip = 's.ui.close', height = 'auto', className, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setMounted(true)
  }
  const panel = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)

  // Enter.
  useLayoutEffect(() => {
    if (!open || !mounted || !panel.current || !scrim.current) return
    fade(scrim.current, 0, 1, DUR.base)
    if (isCalm()) fade(panel.current, 0, 1, DUR.fast)
    else springInY(panel.current, '100%')
  }, [open, mounted])

  // Exit, then unmount.
  useEffect(() => {
    if (open || !mounted || !panel.current || !scrim.current) return
    const calm = isCalm()
    fade(scrim.current, 1, 0, DUR.base)
    const out = calm
      ? fade(panel.current, 1, 0, DUR.fast)
      : panel.current.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], {
          duration: DUR.base,
          easing: EASE_IN,
          fill: 'both',
        })
    let done = false
    out.onfinish = () => {
      done = true
      setMounted(false)
    }
    return () => {
      if (!done) out.cancel()
    }
  }, [open, mounted])

  // Escape closes (keyboard users, the parent dashboard).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(
    <div className="tv-sheet-root" role="presentation">
      <div ref={scrim} className="tv-sheet-scrim" onClick={onClose} style={{ transition: `opacity ${DUR.base}ms ${EASE}` }} />
      <div
        ref={panel}
        className={cx('tv-sheet', height === 'tall' && 'tv-sheet--tall', 'tv-touch', className)}
        role="dialog"
        aria-modal="true"
      >
        <div className="tv-sheet__grabber" aria-hidden />
        <div className="tv-sheet__head">
          {title ? <SpokenText as="h2" clip={title} className="tv-sheet__title" /> : <span />}
          <IconButton icon="close" clip={closeClip} variant="card" onClick={onClose} />
        </div>
        <div className="tv-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
