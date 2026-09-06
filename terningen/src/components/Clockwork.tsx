import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { CORE_ID, UI, getComponent } from '../content/model'
import { CLOCK_TILT, type View } from '../lib/cube'
import { TRAIN } from '../lib/gearTrain'
import {
  BRAKE_MS,
  EASE_IN,
  EASE_OUT,
  RESUME_MS,
  WAAPI_ID,
  angleFromTransform,
  coastAngle,
  delayForAngle,
} from '../lib/clockworkMotion'
import { blurIfPointer, prefersReducedMotion } from '../lib/motion'
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


/**
 * Urværket: SVG-tandhjul i terningens centrum, drejet ind i 3D-rummet: det følger
 * kameraet (billboard) med en fast resthældning, så hjulene viser ægte perspektiv
 * uden nogensinde at stå på kant.
 *
 * Rotationen er ren CSS-animation. Bremsning og genstart er én compositor-drevet
 * Web Animations-overgang per hjul (ease-out til stilstand / ease-in tilbage), der
 * starter i hjulets aktuelle vinkel og afleverer til CSS-animationen i samme vinkel —
 * ingen JS-loop, ingen hop. Tilstanden ligger i `data-motion` på urværket, så
 * CSS-animationen er slået fra, så længe maskinen er bremset — også hvis
 * prefers-reduced-motion slås fra midt i en session.
 */
export function Clockwork({ view, scale, visible, dim, open, bottleneck, braking }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const genRef = useRef(0)
  const firstRunRef = useRef(true)
  const toggleOpen = useModelStore((s) => s.toggleOpen)
  const toggleBottleneck = useModelStore((s) => s.toggleBottleneck)
  const core = getComponent(CORE_ID)
  const baseLabel = open ? UI.ariaCloseFace(core.title) : UI.ariaOpenFace(core.title)
  const ariaLabel = bottleneck ? UI.ariaWithBottleneck(baseLabel) : baseLabel

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const gears = Array.from(root.querySelectorAll<SVGSVGElement>('.gear-spin'))
    const gen = ++genRef.current
    const first = firstRunRef.current
    firstRunRef.current = false
    const reduced = prefersReducedMotion()
    const canAnimate = typeof Element.prototype.animate === 'function'

    const cancelWaapi = (el: Element) => {
      if (typeof el.getAnimations !== 'function') return
      el.getAnimations().forEach((a) => {
        if (a.id === WAAPI_ID) a.cancel()
      })
    }
    const currentAngle = (el: Element) => angleFromTransform(getComputedStyle(el).transform)
    const specOf = (el: SVGSVGElement) => ({
      period: Number(el.dataset.period ?? '16'),
      dir: (el.dataset.dir === '-1' ? -1 : 1) as 1 | -1,
    })

    if (braking) {
      // Allerede bremset/bremsende (fx StrictMode kører effekten to gange): intet at gøre.
      if (root.dataset.motion === 'stopped' || root.dataset.motion === 'braking') return
      // Deep-link, reduceret bevægelse eller ingen WAAPI: stå stille med det samme.
      if (first || reduced || !canAnimate || gears.length === 0) {
        gears.forEach(cancelWaapi)
        root.dataset.motion = 'stopped'
        return
      }
      const angles = gears.map(currentAngle) // læs FØR CSS-animationen fjernes
      root.dataset.motion = 'braking'
      const anims = gears.map((el, i) => {
        cancelWaapi(el)
        const from = angles[i] ?? 0
        const { period, dir } = specOf(el)
        const to = from + coastAngle(period, dir, BRAKE_MS)
        return el.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }], {
          id: WAAPI_ID,
          duration: BRAKE_MS,
          easing: EASE_OUT,
          fill: 'forwards',
        })
      })
      Promise.all(anims.map((a) => a.finished))
        .then(() => {
          if (gen === genRef.current) root.dataset.motion = 'stopped'
        })
        .catch(() => {})
      return
    }

    // Genstart (kører allerede eller er allerede på vej: intet at gøre)
    if (root.dataset.motion === undefined || root.dataset.motion === 'resuming') return
    if (first || reduced || !canAnimate || gears.length === 0) {
      gears.forEach((el) => {
        cancelWaapi(el)
        el.style.animationDelay = ''
      })
      delete root.dataset.motion
      return
    }
    const angles = gears.map(currentAngle) // inkl. den holdte bremsevinkel
    root.dataset.motion = 'resuming'
    const anims = gears.map((el, i) => {
      cancelWaapi(el)
      const from = angles[i] ?? 0
      const { period, dir } = specOf(el)
      const to = from + coastAngle(period, dir, RESUME_MS)
      return el.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }], {
        id: WAAPI_ID,
        duration: RESUME_MS,
        easing: EASE_IN,
        fill: 'forwards',
      })
    })
    Promise.all(anims.map((a) => a.finished))
      .then(() => {
        if (gen !== genRef.current) return
        // Aflevér til CSS-animationen i præcis samme vinkel og med samme hastighed.
        gears.forEach((el) => {
          const { period, dir } = specOf(el)
          el.style.animationDelay = `${delayForAngle(currentAngle(el), period, dir)}s`
        })
        delete root.dataset.motion
        gears.forEach(cancelWaapi)
      })
      .catch(() => {})
  }, [braking])

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
    if (e.repeat) return
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
      aria-label={ariaLabel}
      aria-pressed={open}
      data-component={CORE_ID}
      data-visible={visible}
      data-dim={dim}
      data-open={open}
      data-bottleneck={bottleneck}
      style={{
        transform: `rotateY(${-view.ry}deg) rotateX(${-view.rx}deg) rotateY(${CLOCK_TILT.ry}deg) rotateX(${CLOCK_TILT.rx}deg) translateZ(0) scale(${scale})`,
      }}
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
