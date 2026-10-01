// A plain tap target for tiles and chips (≥ 60 px in the stylesheets) with the design system's press
// feedback (data-pressed → the face moves down, transform only) and a spoken/accessible name.
import { useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import './shared.css'

export interface TapProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'children'> {
  /** Accessible name (the clip text of what the tile shows). */
  label: string
  onTap(): void
  children?: ReactNode
}

export function Tap({ label, onTap, className, disabled, children, ...rest }: TapProps) {
  const { pressProps } = usePress(disabled)
  return (
    <button type="button" aria-label={label} className={cx('tv-wr-tap', 'tv-touch', className)} disabled={disabled} onClick={onTap} {...pressProps} {...rest}>
      {children}
    </button>
  )
}

/** The last value that was not null: a closing sheet keeps showing what it showed while it slides away. */
export function useLastShown<T>(value: T | null): T | null {
  const last = useRef<T | null>(value)
  if (value !== null) last.current = value
  return value ?? last.current
}
