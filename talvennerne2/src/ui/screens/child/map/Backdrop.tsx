// What stands behind the map. A world's scene is drawn elsewhere (src/art/scenes/<world>.tsx, default
// export a component taking MapSceneProps); until it exists the map uses this calm placeholder: the
// sky, a soft sun, a few clouds and three layers of hills with a path winding into the distance,
// tinted per world with the tokens. The placeholder stands still; only the clouds drift.
import { Suspense, lazy } from 'react'
import type { ComponentType } from 'react'
import type { RegionId, WorldId } from '../../../../engine/types'
import type { RegionTier } from '../../../../meta/rewards'
import { cx } from '../../../design/cx'

export interface MapSceneProps {
  world: WorldId
  /** How far each region's colour has come back (SPEC §5.6). */
  tiers: Partial<Record<RegionId, RegionTier>>
  className?: string
}

const SCENES = import.meta.glob<{ default: ComponentType<MapSceneProps> }>('../../../../art/scenes/*.tsx')
const loaded = new Map<WorldId, ComponentType<MapSceneProps>>()

function sceneFor(world: WorldId): ComponentType<MapSceneProps> | null {
  const load = SCENES[`../../../../art/scenes/${world}.tsx`]
  if (!load) return null
  let scene = loaded.get(world)
  if (!scene) {
    scene = lazy(load)
    loaded.set(world, scene)
  }
  return scene
}

const r1 = (v: number) => Math.round(v * 10) / 10

/** A soft ridge across the 400-wide canvas: a cosine wave with a little second harmonic, closed below. */
function ridge(base: number, amp: number, waves: number, phase: number, bottom = 300): string {
  const steps = 16
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 400
    const t = (i / steps) * Math.PI * 2 * waves + phase
    pts.push([x, base - amp * (0.75 * Math.cos(t) + 0.25 * Math.cos(2.3 * t + 1))])
  }
  let d = `M0 ${r1(pts[0][1])}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = (x0 + x1) / 2
    d += `C${r1(mx)} ${r1(y0)} ${r1(mx)} ${r1(y1)} ${r1(x1)} ${r1(y1)}`
  }
  return `${d}V${bottom}H0Z`
}

function cloud(x: number, y: number, k: number): string {
  const c = (cx: number, cy: number, r: number) =>
    `M${r1(x + (cx - r) * k)} ${r1(y + cy * k)}a${r1(r * k)} ${r1(r * k)} 0 1 0 ${r1(2 * r * k)} 0a${r1(r * k)} ${r1(r * k)} 0 1 0 ${r1(-2 * r * k)} 0z`
  return [c(0, 0, 9), c(12, -6, 12), c(26, -2, 10), c(36, 2, 7)].join('') + `M${r1(x - 9 * k)} ${r1(y)}h${r1(52 * k)}v${r1(8 * k)}h${r1(-52 * k)}z`
}

/** The far path: a ribbon from the front hill to the horizon. */
function farPath(): string {
  return 'M196 300C188 268 236 252 226 232S170 214 184 198S232 186 214 176'
}

const HILLS = {
  far: ridge(176, 14, 1.4, 0.6),
  mid: ridge(214, 18, 1.1, 2.2),
  near: ridge(256, 16, 0.9, 4.1),
}
const CLOUDS = [cloud(30, 58, 1.1), cloud(250, 40, 0.8), cloud(150, 96, 0.55)]

function Placeholder() {
  return (
    <svg className="tv-backdrop__art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <circle className="tv-backdrop__sun" cx="322" cy="64" r="26" />
      <g className="tv-backdrop__clouds tv-drift">
        {CLOUDS.map((d, i) => (
          <path key={i} d={d} className={cx('tv-backdrop__cloud', i === 2 && 'is-far')} />
        ))}
      </g>
      <path className="tv-backdrop__hill is-far" d={HILLS.far} />
      <path className="tv-backdrop__hill is-mid" d={HILLS.mid} />
      <path className="tv-backdrop__trail" d={farPath()} />
      <path className="tv-backdrop__hill is-near" d={HILLS.near} />
    </svg>
  )
}

export function Backdrop({ world, tiers, className }: MapSceneProps) {
  const Scene = sceneFor(world)
  return (
    <div className={cx('tv-backdrop', `tv-backdrop--${world}`, className)} aria-hidden>
      <div className="tv-backdrop__sky" />
      {Scene ? (
        <Suspense fallback={<Placeholder />}>
          <Scene world={world} tiers={tiers} className="tv-backdrop__scene" />
        </Suspense>
      ) : (
        <Placeholder />
      )}
    </div>
  )
}
