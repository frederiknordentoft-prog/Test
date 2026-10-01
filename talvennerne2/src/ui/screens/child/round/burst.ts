// Combo juice (SPEC §5.7: effects only, never numbers): a burst of stars and sparks from where the
// right answer was given, and confetti for "Perfekt tur!". Plain DOM nodes in a fixed layer,
// animated with WAAPI (transform and opacity only) and removed when done. Calm mode and reduced
// motion get nothing — the green card and the sound already say it.
import { poly, starPoints } from '../../../../art/materials/geom'
import { isCalm } from '../../../design/motion'

const STAR = poly(starPoints(12, 12.5, 11, 4.8, 5))

function layer(): HTMLElement {
  let el = document.querySelector<HTMLElement>('.tv-fx')
  if (!el) {
    el = document.createElement('div')
    el.className = 'tv-fx'
    el.setAttribute('aria-hidden', 'true')
    document.body.appendChild(el)
  }
  return el
}

function piece(kind: 'star' | 'dot' | 'confetti', tone: number): HTMLElement {
  const el = document.createElement('span')
  el.className = `tv-fx__p tv-fx__p--${kind} tv-fx__p--t${tone}`
  if (kind === 'star') el.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="${STAR}"/></svg>`
  return el
}

/** Deterministic spread (no Math.random in game code): golden-angle directions. */
const angle = (i: number, n: number, turn = 0) => turn + (i * 2.39996) % (Math.PI * 2) + (i / n) * 0.3

export function burst(x: number, y: number, opts: { count?: number; big?: boolean } = {}): void {
  if (typeof document === 'undefined' || isCalm()) return
  const host = layer()
  const n = opts.count ?? (opts.big ? 18 : 12)
  for (let i = 0; i < n; i++) {
    const el = piece(i % 3 === 0 ? 'star' : 'dot', i % 4)
    host.appendChild(el)
    const a = angle(i, n)
    const dist = (opts.big ? 90 : 60) + (i % 5) * 14
    const dx = Math.cos(a) * dist
    const dy = Math.sin(a) * dist - 20
    const spin = (i % 2 ? 1 : -1) * (90 + (i % 4) * 40)
    const anim = el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.3) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${x + dx * 0.8}px, ${y + dy * 0.8}px) scale(1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x + dx}px, ${y + dy + 26}px) scale(0.6) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 700 + (i % 4) * 90, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    anim.onfinish = () => el.remove()
  }
}

/** Confetti over the whole screen ("Perfekt tur!"). */
export function confetti(): void {
  if (typeof document === 'undefined' || isCalm()) return
  const host = layer()
  const w = window.innerWidth
  const n = 46
  for (let i = 0; i < n; i++) {
    const el = piece('confetti', i % 4)
    host.appendChild(el)
    const x0 = ((i * 97) % 100) / 100 * w
    const drift = ((i % 7) - 3) * 18
    const fall = window.innerHeight * (0.7 + (i % 5) * 0.08)
    const anim = el.animate(
      [
        { transform: `translate(${x0}px, -30px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${x0 + drift}px, ${fall}px) rotate(${(i % 2 ? 1 : -1) * 540}deg)`, opacity: 0.9, offset: 0.92 },
        { transform: `translate(${x0 + drift}px, ${fall + 30}px) rotate(${(i % 2 ? 1 : -1) * 600}deg)`, opacity: 0 },
      ],
      { duration: 1900 + (i % 6) * 160, delay: (i % 9) * 60, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'backwards' },
    )
    anim.onfinish = () => el.remove()
  }
}
