// Shared movement for the task kinds: things hop from where they were to where they land (FLIP:
// render at the destination, then animate from the old box). Transform and opacity only; calm mode
// and reduced motion get a short fade instead of the flight.
import { isCalm } from '../design/motion'

/** A hop from one box to another: up and over, landing with a little squash. */
export function hop(el: HTMLElement, from: DOMRect, to: DOMRect): void {
  if (isCalm()) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 })
    return
  }
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const k = from.width / Math.max(1, to.width)
  const lift = Math.min(90, 30 + Math.abs(dx) * 0.25)
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) scale(${(k + 1) / 2 + 0.08})`, offset: 0.5 },
      { transform: 'translate(0, 0) scale(1.08, 0.92)', offset: 0.86 },
      { transform: 'translate(0, 0) scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(.3,.7,.4,1)' },
  )
}
