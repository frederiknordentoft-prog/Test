// Visual meter without numbers (SPEC §5.7: the map HUD shows egg, wish and buddy heart). The fill
// is a full-width bar translated into view, so it animates with transform only and keeps its
// rounded end at every value. Tapping it says what it measures.
import type { CSSProperties } from 'react'
import type { ClipId } from '../../engine/types'
import { Icon } from './Icon'
import type { IconName } from './icons'
import { useSpeech } from './speech'
import { cx } from './cx'

export type MeterKind = 'egg' | 'wish' | 'heart'

const KIND: Record<MeterKind, { icon: IconName; clip: ClipId }> = {
  egg: { icon: 'egg', clip: 's.ui.meter.egg' },
  wish: { icon: 'gift', clip: 's.ui.meter.wish' },
  heart: { icon: 'heart', clip: 's.ui.meter.heart' },
}

export interface MeterProps {
  kind: MeterKind
  /** 0…1. Values are clamped; nothing about the number is ever shown. */
  value: number
  /** sm: compact HUD (badge 38 px, track fills the space), md, lg. Always ≥ 60 px tall to tap. */
  size?: 'sm' | 'md' | 'lg'
  /** Override the spoken explanation. */
  clip?: ClipId
  className?: string
}

export function Meter({ kind, value, size = 'md', clip, className }: MeterProps) {
  const speech = useSpeech()
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const k = KIND[kind]
  const said = clip ?? k.clip
  const full = v >= 1
  return (
    <button
      type="button"
      className={cx('tv-meter', `tv-meter--${kind}`, `tv-meter--${size}`, full && 'is-full', 'tv-touch', className)}
      style={{ '--v': v } as CSSProperties}
      aria-label={speech.text(said)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Math.round(v * 100) / 100}
      onClick={() => speech.speak([{ clip: said }])}
    >
      <span className="tv-meter__badge">
        <Icon name={k.icon} solid strokeWidth={2.2} className="tv-meter__icon" />
      </span>
      <span className="tv-meter__track">
        <span className="tv-meter__fill" />
        <span className="tv-meter__shine" />
      </span>
    </button>
  )
}
