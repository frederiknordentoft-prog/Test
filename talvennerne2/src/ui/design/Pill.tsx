// Pill: a small rounded label with an optional icon ("Ny", a domain tag, a source badge). Not a tap
// target on its own; wrap it in a button of ≥ 60 px when it must be tappable.
import type { CSSProperties, ReactNode } from 'react'
import type { DomainId } from '../../engine/types'
import { Icon } from './Icon'
import type { IconName } from './icons'
import { cx } from './cx'

export type PillTone = 'neutral' | 'primary' | 'good' | 'oops' | 'star' | 'glass'

export interface PillProps {
  tone?: PillTone
  /** Domain colouring (soft background, deep text) – overrides `tone`. */
  domain?: DomainId
  icon?: IconName
  size?: 'sm' | 'md'
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function Pill({ tone = 'neutral', domain, icon, size = 'md', className, style, children }: PillProps) {
  const domainStyle = domain
    ? ({ '--pill-bg': `var(--color-d-${domain}-soft)`, '--pill-fg': `var(--color-d-${domain}-deep)`, '--pill-edge': 'transparent' } as CSSProperties)
    : undefined
  return (
    <span className={cx('tv-pill', `tv-pill--${domain ? 'domain' : tone}`, `tv-pill--${size}`, className)} style={{ ...domainStyle, ...style }}>
      {icon && <Icon name={icon} size="1.25em" strokeWidth={2.4} className="tv-pill__icon" />}
      {children}
    </span>
  )
}
