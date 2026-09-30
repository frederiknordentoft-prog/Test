// Tactile buttons (SPEC §11). The coloured "lip" is a separate layer that stays put while the face
// moves 4 px down on press, so only transform animates. Every button with a label speaks it when
// tapped; icon buttons always carry a spoken/accessible name from the clip catalogue.
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import type { ClipId } from '../../engine/types'
import { Icon } from './Icon'
import type { IconName } from './icons'
import { useSpeech } from './speech'
import { usePress } from './usePress'
import { cx } from './cx'

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'>

export type ButtonVariant = 'primary' | 'secondary' | 'good' | 'star' | 'quiet'

export interface ButtonProps extends NativeButton {
  variant?: ButtonVariant
  /** lg: 72/88 px (phone/iPad), md: 60/64 px. Nothing smaller exists for children. */
  size?: 'lg' | 'md'
  /** Label from the clip catalogue; read aloud on tap unless `silent`. */
  clip?: ClipId
  icon?: IconName
  iconEnd?: IconName
  silent?: boolean
  /** Stretch to the container width. */
  block?: boolean
  type?: 'button' | 'submit'
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'lg',
  clip,
  icon,
  iconEnd,
  silent,
  block,
  type = 'button',
  className,
  disabled,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const speech = useSpeech()
  const { pressProps } = usePress(disabled)
  const label = clip !== undefined ? speech.text(clip) : undefined
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    if (clip !== undefined && !silent) speech.speak([{ clip }])
    onClick?.(e)
  }
  return (
    <button
      type={type}
      className={cx('tv-btn', `tv-btn--${variant}`, `tv-btn--${size}`, block && 'tv-btn--block', 'tv-touch', className)}
      disabled={disabled}
      onClick={handle}
      {...pressProps}
      {...rest}
    >
      <span className="tv-btn__face">
        {icon && <Icon name={icon} className="tv-btn__icon" strokeWidth={2.4} />}
        {label !== undefined && <span className="tv-btn__label">{label}</span>}
        {children}
        {iconEnd && <Icon name={iconEnd} className="tv-btn__icon" strokeWidth={2.4} />}
      </span>
    </button>
  )
}

export type IconButtonVariant = 'card' | 'glass' | 'primary' | 'good' | 'quiet'

export interface IconButtonProps extends NativeButton {
  icon: IconName
  /** Accessible name (and spoken when `sayLabel`). Required: no icon is ever unnamed. */
  clip: ClipId
  variant?: IconButtonVariant
  /** md: 60/64 px, lg: 72/80 px. */
  size?: 'md' | 'lg'
  /** Read the name aloud on tap (dock, toolbars). Off for buttons that start their own speech. */
  sayLabel?: boolean
  /** Solid icon body instead of duotone. */
  solid?: boolean
  /** Gentle attention pulse (e.g. the bulb after 10 s, the check after 3 s). */
  pulse?: boolean
  type?: 'button' | 'submit'
}

export function IconButton({
  icon,
  clip,
  variant = 'card',
  size = 'md',
  sayLabel,
  solid,
  pulse,
  type = 'button',
  className,
  disabled,
  onClick,
  ...rest
}: IconButtonProps) {
  const speech = useSpeech()
  const { pressProps } = usePress(disabled)
  const handle = (e: MouseEvent<HTMLButtonElement>) => {
    if (sayLabel) speech.speak([{ clip }])
    onClick?.(e)
  }
  return (
    <button
      type={type}
      aria-label={speech.text(clip)}
      className={cx('tv-ibtn', `tv-ibtn--${variant}`, `tv-ibtn--${size}`, pulse && 'tv-pulse', 'tv-touch', className)}
      disabled={disabled}
      onClick={handle}
      data-clip={clip}
      {...pressProps}
      {...rest}
    >
      <span className="tv-ibtn__face">
        <Icon name={icon} className="tv-ibtn__icon" solid={solid} strokeWidth={2.3} />
      </span>
    </button>
  )
}
