// Card (SPEC §11): radius 28, padding 20 (28 on iPad), soft two-step shadow.
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { cx } from './cx'

export interface CardProps {
  as?: ElementType
  /** card: white; paper: warm off-white; glass: translucent over the sky; soft: primary tint. */
  tone?: 'card' | 'paper' | 'glass' | 'soft'
  pad?: 'none' | 'sm' | 'md' | 'lg'
  /** Raised (default) or flat, e.g. inside another card. */
  flat?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function Card({ as: Tag = 'div', tone = 'card', pad = 'md', flat, className, style, children }: CardProps) {
  return (
    <Tag className={cx('tv-card', `tv-card--${tone}`, `tv-card--pad-${pad}`, flat && 'tv-card--flat', className)} style={style}>
      {children}
    </Tag>
  )
}
