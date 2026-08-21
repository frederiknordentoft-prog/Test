/**
 * Vibration where the browser offers it. iOS Safari does not expose the
 * Vibration API at all, so on iPhone and iPad this is silently a no-op — every
 * action is also carried by sound and motion, so nothing is lost there.
 */
let enabled = true

export function setHapticsEnabled(on: boolean): void {
  enabled = on
}

function buzz(pattern: number | number[]): void {
  if (!enabled) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore
  }
}

export const haptics = {
  tap: () => buzz(8),
  correct: () => buzz([10, 30, 18]),
  wrong: () => buzz(28),
  hatch: () => buzz([14, 40, 14, 40, 30]),
}
