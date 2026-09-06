import { useState } from 'react'
import { CORE_ID, UI } from '../content/model'
import {
  CLOCK_SCALE_ASSEMBLED,
  EXPLODE_FACTOR,
  FACES,
  componentForPips,
  nearestAngle,
  viewFor,
  type View,
} from '../lib/cube'
import { useModelStore } from '../store/useModelStore'
import { Clockwork } from './Clockwork'
import { CubeFace } from './CubeFace'

/**
 * Terningen: én container med preserve-3d og seks flader placeret med
 * rotateX/rotateY + translateZ. Eksplosion = større translateZ.
 */
export function Cube() {
  const stage = useModelStore((s) => s.stage)
  const openComponent = useModelStore((s) => s.openComponent)
  const bottleneck = useModelStore((s) => s.bottleneck)

  const target = viewFor(stage, openComponent)
  const [prevTarget, setPrevTarget] = useState<View>(target)
  const [view, setView] = useState<View>(target)
  if (prevTarget.rx !== target.rx || prevTarget.ry !== target.ry) {
    // Afledt tilstand under render (Reacts anbefalede mønster): drej altid korteste vej.
    setPrevTarget(target)
    setView({ rx: target.rx, ry: nearestAngle(target.ry, view.ry) })
  }

  const exploded = stage === 'exploded'
  const anyFocus = openComponent !== null || bottleneck !== null
  const isDim = (id: string) => exploded && anyFocus && id !== openComponent && id !== bottleneck

  return (
    <div className="scene-perspective">
      <div
        className="cube"
        role="group"
        aria-label={UI.ariaCube}
        data-stage={stage}
        style={
          {
            transform: `rotateX(${view.rx}deg) rotateY(${view.ry}deg)`,
            '--tz': exploded ? `calc(var(--half) * ${EXPLODE_FACTOR})` : 'var(--half)',
          } as React.CSSProperties
        }
      >
        <Clockwork
          view={view}
          scale={exploded ? 1 : CLOCK_SCALE_ASSEMBLED}
          visible={exploded}
          dim={isDim(CORE_ID)}
          open={openComponent === CORE_ID}
          bottleneck={bottleneck === CORE_ID}
          braking={bottleneck !== null}
        />
        {FACES.map((face) => {
          const id = componentForPips(face.pips)
          return (
            <CubeFace
              key={face.side}
              face={face}
              componentId={id}
              open={openComponent === id}
              dim={isDim(id)}
              bottleneck={bottleneck === id}
            />
          )
        })}
      </div>
    </div>
  )
}
