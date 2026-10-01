// A plain tap target for tiles and chips (≥ 60 px in the stylesheets) with the design system's press
// feedback (data-pressed → the face moves down, transform only) and a spoken/accessible name.
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
    <button type="button" aria-label={label} className={cx('tv-tap', 'tv-touch', className)} disabled={disabled} onClick={onTap} {...pressProps} {...rest}>
      {children}
    </button>
  )
}
