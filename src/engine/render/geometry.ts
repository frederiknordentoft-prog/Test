export type SceneGeometry = {
  w: number
  h: number
  pivotX: number
  pivotY: number
  beamHalf: number
  chainLen: number
  panRx: number
  panRy: number
}

export function computeGeometry(w: number, h: number): SceneGeometry {
  const beamHalf = Math.min(w * 0.36, 330)
  return {
    w,
    h,
    pivotX: w / 2,
    pivotY: h * 0.24,
    beamHalf,
    chainLen: h * 0.3,
    panRx: Math.min(beamHalf * 0.52, w * 0.2),
    panRy: Math.max(10, h * 0.032),
  }
}

/** Bjælkens ophængspunkter ved en given vinkel (positiv = højre nede). */
export function attachPoints(g: SceneGeometry, angle: number) {
  const dx = Math.cos(angle) * g.beamHalf
  const dy = Math.sin(angle) * g.beamHalf
  return {
    left: { x: g.pivotX - dx, y: g.pivotY - dy },
    right: { x: g.pivotX + dx, y: g.pivotY + dy },
  }
}

/** Skålens centrum (dish) under et ophængspunkt. */
export function panCenter(g: SceneGeometry, attach: { x: number; y: number }) {
  return { x: attach.x, y: attach.y + g.chainLen }
}
