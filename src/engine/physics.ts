/**
 * Ren bjælke-fysik — ingen DOM, 100 % testbar.
 *
 * Modellen er en underdampet vinkelfjeder mod et mål-udslag:
 *   θ_target = θ_max · tanh(Δm / S),  S = s0 + sK · (mL + mR)
 *   θ'' = −ω²(θ − θ_target) − 2ζω·θ'
 *
 * tanh giver streng monotoni i |Δm| og mætter blødt mod θ_max, og
 * S vokser med totalmassen så både 4 u og 238 u i skålene føles levende.
 * Positiv vinkel = højre skål nede.
 */

export type PhysicsParams = {
  thetaMax: number // maks. udslag (rad)
  omega: number // naturlig frekvens (rad/s)
  zeta: number // dæmpningsforhold; <1 = wobble
  s0: number // tanh-skala, grundled (u)
  sK: number // tanh-skalaens vækst pr. u totalmasse
  settleVel: number // |θ'| under denne → i ro (rad/s)
  settleAngle: number // |θ − θ_target| under denne → i ro (rad)
}

export const DEFAULT_PHYSICS: PhysicsParams = {
  thetaMax: 0.3,
  omega: 4.8,
  zeta: 0.22,
  s0: 9,
  sK: 0.05,
  settleVel: 0.012,
  settleAngle: 0.008,
}

/** Næsten kritisk dæmpet variant til prefers-reduced-motion. */
export const CALM_PHYSICS: PhysicsParams = {
  ...DEFAULT_PHYSICS,
  zeta: 0.9,
}

export type PhysState = {
  angle: number
  angularVel: number
}

export const REST_STATE: PhysState = { angle: 0, angularVel: 0 }

export const FIXED_DT = 1 / 120

export function targetAngle(
  leftMass: number,
  rightMass: number,
  p: PhysicsParams = DEFAULT_PHYSICS,
): number {
  const dm = rightMass - leftMass
  const s = p.s0 + p.sK * (leftMass + rightMass)
  return p.thetaMax * Math.tanh(dm / s)
}

/** Ét fysik-skridt med semi-implicit Euler (stabil ved fixed dt). */
export function stepPhysics(
  state: PhysState,
  leftMass: number,
  rightMass: number,
  dt: number = FIXED_DT,
  p: PhysicsParams = DEFAULT_PHYSICS,
): PhysState {
  const target = targetAngle(leftMass, rightMass, p)
  const acc =
    -p.omega * p.omega * (state.angle - target) -
    2 * p.zeta * p.omega * state.angularVel
  const angularVel = state.angularVel + acc * dt
  const angle = state.angle + angularVel * dt
  return { angle, angularVel }
}

export function isSettled(
  state: PhysState,
  leftMass: number,
  rightMass: number,
  p: PhysicsParams = DEFAULT_PHYSICS,
): boolean {
  const target = targetAngle(leftMass, rightMass, p)
  return (
    Math.abs(state.angularVel) < p.settleVel &&
    Math.abs(state.angle - target) < p.settleAngle
  )
}

/**
 * Vinkel-impuls når en brik lander i en skål — bjælken "mærker" slaget.
 * Skaleres med brikkens andel af totalmassen og klampes så U ikke smadrer alt.
 */
export function dropImpulse(
  tileMass: number,
  side: 'left' | 'right',
  totalMass: number,
  p: PhysicsParams = DEFAULT_PHYSICS,
): number {
  const share = tileMass / Math.max(totalMass, tileMass, 1)
  const magnitude = Math.min(0.9, 0.25 + share * 0.9) * p.thetaMax * 3.2
  return side === 'right' ? magnitude : -magnitude
}

/** Kør fysikken til ro (til tests og forudsigelser). */
export function settle(
  leftMass: number,
  rightMass: number,
  p: PhysicsParams = DEFAULT_PHYSICS,
  start: PhysState = REST_STATE,
  maxSteps = 20_000,
): PhysState {
  let s = start
  for (let i = 0; i < maxSteps; i++) {
    s = stepPhysics(s, leftMass, rightMass, FIXED_DT, p)
    if (isSettled(s, leftMass, rightMass, p)) break
  }
  return s
}
