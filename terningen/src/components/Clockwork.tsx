import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { CORE_ID, UI, getComponent } from '../content/model'
import type { View } from '../lib/cube'
import { TRAIN } from '../lib/gearTrain'
import { blurIfPointer, easeInOutCubic, easeOutCubic } from '../lib/motion'
import { useModelStore } from '../store/useModelStore'
import { Gear } from './Gear'

type Props = {
  view: View
  scale: number
  visible: boolean
  dim: boolean
  open: boolean
  bottleneck: boolean
  /** true når en flaskehals er sat et hvilket som helst sted — maskinen står stille */
  braking: boolean
}

const BRAKE_MS = 1200
const RESUME_MS = 900

function isGearAnimation(a: Animation): a is CSSAnimation {
  return 'animationName' in a && (a as CSSAnimation).animationName === 'gear-spin'
}

function setRate(a: Animation, rate: number) {
  // updatePlaybackRate er sømløs (ingen hop); ældre WebKit har kun setteren.
  if (typeof a.updatePlaybackRate === 'function') a.updatePlaybackRate(rate)
  else a.playbackRate = rate
}

/**
 * Urværket: SVG-tandhjul i terningens centrum, drejet ind i 3D-rummet så det
 * altid vender mod kameraet (billboard). Rotationen er ren CSS-animation;
 * bremsning sker ved at rampe animationernes playbackRate — ikke et JS-loop.
 */
export function Clockwork({ view, scale, visible, dim, open, bottleneck, braking }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const rateRef = useRef(1)
  const targetRef = useRef(braking ? 0 : 1)
  const firstRunRef = useRef(true)
  const toggleOpen = useModelStore((s) => s.toggleOpen)
  const toggleBottleneck = useModelStore((s) => s.toggleBottleneck)
  const core = getComponent(CORE_ID)

  const gearAnimations = useCallback((): Animation[] => {
    const root = rootRef.current
    if (!root || typeof root.getAnimations !== 'function') return []
    return root.getAnimations({ subtree: true }).filter(isGearAnimation)
  }, [])

  useEffect(() => {
    const target = braking ? 0 : 1
    targetRef.current = target
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    const anims = gearAnimations()
    const first = firstRunRef.current
    firstRunRef.current = false

    // Første kørsel (deep-link): snap til tilstanden — samme resultat uden ventetid.
    if (first || anims.length === 0) {
      rateRef.current = target
      anims.forEach((a) => setRate(a, target))
      return
    }

    const from = rateRef.current
    if (from === target) return
    const duration = braking ? BRAKE_MS : RESUME_MS
    const ease = braking ? easeOutCubic : easeInOutCubic
    let start: number | null = null

    const step = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / duration)
      const rate = from + (target - from) * ease(t)
      rateRef.current = rate
      anims.forEach((a) => setRate(a, rate))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else rafRef.current = null
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [braking, gearAnimations])

  // Animationer, der starter senere (fx prefers-reduced-motion slået fra midt i en session),
  // skal straks arve den aktuelle hastighed — ellers ville en bremset maskine begynde at køre.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onStart = (e: AnimationEvent) => {
      if (e.animationName !== 'gear-spin') return
      const el = e.target as Element | null
      if (!el || typeof el.getAnimations !== 'function') return
      el.getAnimations().filter(isGearAnimation).forEach((a) => setRate(a, rateRef.current))
    }
    root.addEventListener('animationstart', onStart)
    return () => root.removeEventListener('animationstart', onStart)
  }, [])

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    blurIfPointer(e)
    toggleOpen(CORE_ID)
  }
  const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    blurIfPointer(e)
    toggleBottleneck(CORE_ID)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleOpen(CORE_ID)
    }
  }

  return (
    <div
      ref={rootRef}
      className="clockwork"
      role="button"
      tabIndex={visible ? 0 : -1}
      aria-label={open ? UI.ariaCloseFace(core.title) : UI.ariaOpenFace(core.title)}
      aria-pressed={open}
      data-visible={visible}
      data-dim={dim}
      data-open={open}
      data-bottleneck={bottleneck}
      style={{ transform: `rotateY(${-view.ry}deg) rotateX(${-view.rx}deg) translateZ(0) scale(${scale})` }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <div className="core-glow" aria-hidden="true" />
      <div className="core-plate" aria-hidden="true" />
      {TRAIN.filter((g) => g.layer === 'back').map((g) => (
        <Gear key={g.id} spec={g} />
      ))}
      {TRAIN.filter((g) => g.layer === 'front').map((g) => (
        <Gear key={g.id} spec={g} />
      ))}
      <div className="core-label" aria-hidden="true">
        {core.title}
      </div>
      {bottleneck && visible && (
        <div className="core-bottleneck-tag" aria-hidden="true">
          {UI.bottleneckTag}
        </div>
      )}
    </div>
  )
}
