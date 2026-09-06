import { memo, type KeyboardEvent, type MouseEvent } from 'react'
import { UI, getComponent, type ComponentId } from '../content/model'
import { SWING_DEG, faceTransform, pipLayout, type FaceDef } from '../lib/cube'
import { blurIfPointer } from '../lib/motion'
import { useModelStore } from '../store/useModelStore'

type Props = {
  face: FaceDef
  componentId: ComponentId
  open: boolean
  dim: boolean
  bottleneck: boolean
}

function CubeFaceImpl({ face, componentId, open, dim, bottleneck }: Props) {
  const toggleOpen = useModelStore((s) => s.toggleOpen)
  const toggleBottleneck = useModelStore((s) => s.toggleBottleneck)
  const component = getComponent(componentId)

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    blurIfPointer(e)
    toggleOpen(componentId)
  }
  const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    blurIfPointer(e)
    toggleBottleneck(componentId)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.repeat) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleOpen(componentId)
    }
  }

  const transform = faceTransform(face)

  return (
    <div
      className="face"
      role="button"
      tabIndex={0}
      aria-label={open ? UI.ariaCloseFace(component.title) : UI.ariaOpenFace(component.title)}
      aria-pressed={open}
      data-side={face.side}
      data-pips={face.pips}
      data-component={componentId}
      data-open={open}
      data-dim={dim}
      data-bottleneck={bottleneck}
      style={{ transform, '--swing': `${open ? SWING_DEG : 0}deg` } as React.CSSProperties}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <div className="face-front">
        <div className="plate">
          <div className="pips" aria-hidden="true">
            {pipLayout(face.pips).map(([row, col]) => (
              <span key={`${row}-${col}`} className="pip" style={{ gridRow: row + 1, gridColumn: col + 1 }} />
            ))}
          </div>
          <div className="face-label">{component.title}</div>
        </div>
        {bottleneck && (
          <div className="bottleneck-tag" aria-hidden="true">
            {UI.bottleneckTag}
          </div>
        )}
      </div>
      <div className="face-back" aria-hidden="true">
        {bottleneck && <div className="bottleneck-tag">{UI.bottleneckTag}</div>}
      </div>
    </div>
  )
}

export const CubeFace = memo(CubeFaceImpl)
