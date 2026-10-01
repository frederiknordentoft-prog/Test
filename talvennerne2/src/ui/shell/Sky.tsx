// The default backdrop: the sky gradient (SPEC himmel #BFE6FF → #FFF3D6) with a few soft clouds and
// distant hills. Clouds drift slowly (transform only) and stand still in calm mode.
import { blob, join } from '../../art/materials/geom'
import type { V2 } from '../../art/materials/geom'

const cloud = (x: number, y: number, k: number) => {
  const pts: V2[] = [
    [0, 10], [8, 2], [20, 0], [30, -10], [46, -12], [58, -4], [70, -6], [82, 2], [86, 12],
  ].map(([px, py]) => [x + px * k, y + py * k] as V2)
  return blob([...pts, [x + 70 * k, y + 16 * k], [x + 40 * k, y + 18 * k], [x + 12 * k, y + 17 * k]], 0.9)
}

export function Sky() {
  return (
    <div className="tv-sky">
      <svg className="tv-sky__clouds tv-drift" viewBox="0 0 400 300" preserveAspectRatio="xMidYMin slice" aria-hidden>
        <path d={join(cloud(-14, 46, 1.1), cloud(250, 30, 0.8))} className="tv-sky__cloud" />
        <path d={cloud(150, 92, 0.55)} className="tv-sky__cloud tv-sky__cloud--far" />
      </svg>
      <svg className="tv-sky__hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
        <path d="M0 70C60 40 120 46 180 64S300 92 400 52V120H0Z" className="tv-sky__hill tv-sky__hill--far" />
        <path d="M0 96C80 70 150 76 230 92S340 108 400 86V120H0Z" className="tv-sky__hill" />
      </svg>
    </div>
  )
}
