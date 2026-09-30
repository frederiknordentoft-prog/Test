// Answer card (svarkort): at least 80 × 80 px, white with a 3 px ink/10 edge and a lip. States follow
// the locked error flow (SPEC §3.5): a wrong answer stays, struck through and untappable; the right
// one is then the "target" the child taps. Red is never used – "not quite" is amber.
import { useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { usePress } from './usePress'
import { pop } from './motion'
import { cx } from './cx'

export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'target' | 'dim'

export interface AnswerCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  state?: AnswerState
  /** Pulses while the voice names this option (SPEC §3.4). */
  speaking?: boolean
  /** md: numerals and small pictures; lg: clocks, coins, shapes. */
  size?: 'md' | 'lg'
  /** Accessible name when the content is a picture. */
  label?: string
  children: ReactNode
}

export function AnswerCard({ state = 'idle', speaking, size = 'md', label, className, disabled, children, ...rest }: AnswerCardProps) {
  const inert = disabled || state === 'wrong' || state === 'correct' || state === 'dim'
  const { pressProps } = usePress(inert)
  const face = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (state === 'correct' && face.current) pop(face.current, 1.07)
  }, [state])
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={state === 'selected' ? true : undefined}
      aria-disabled={inert || undefined}
      disabled={disabled}
      className={cx('tv-answer', `tv-answer--${size}`, `is-${state}`, speaking && 'is-speaking', 'tv-touch', className)}
      {...(inert ? {} : pressProps)}
      {...rest}
      onClick={inert ? undefined : rest.onClick}
    >
      <span ref={face} className="tv-answer__face">
        <span className="tv-answer__content">{children}</span>
        {state === 'wrong' && <span className="tv-answer__strike" aria-hidden />}
        {(state === 'selected' || state === 'correct') && (
          <span className="tv-answer__badge" aria-hidden>
            <Icon name="check" size="70%" strokeWidth={3.2} />
          </span>
        )}
      </span>
    </button>
  )
}
