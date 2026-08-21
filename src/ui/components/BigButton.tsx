import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'

interface Props {
  children: ReactNode
  onPress: (event: ReactPointerEvent<HTMLButtonElement>) => void
  tone?: 'primary' | 'soft' | 'ghost' | 'gold'
  className?: string
  disabled?: boolean
  label?: string
  silent?: boolean
}

const TONES: Record<NonNullable<Props['tone']>, string> = {
  primary: 'bg-white/95 text-[#1b1233] shadow-[0_8px_0_rgba(0,0,0,0.28)]',
  soft: 'bg-white/12 text-white ring-1 ring-white/25 backdrop-blur-sm',
  ghost: 'bg-transparent text-white/80 ring-1 ring-white/20',
  gold: 'bg-gradient-to-b from-amber-200 to-amber-400 text-[#3b2410] shadow-[0_8px_0_rgba(120,70,0,0.4)]',
}

/**
 * Every tappable thing in the app. Feedback fires on pointer-down, before the
 * action resolves — a button that waits for the logic before acknowledging the
 * touch feels broken even when it is working.
 */
export function BigButton({ children, onPress, tone = 'primary', className = '', disabled, label, silent }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={`tap-target rounded-3xl px-5 font-extrabold disabled:opacity-40 ${TONES[tone]} ${className}`}
      onPointerDown={() => {
        if (disabled) return
        if (!silent) sfx.tap()
        haptics.tap()
      }}
      onClick={(e) => {
        if (disabled) return
        onPress(e as unknown as ReactPointerEvent<HTMLButtonElement>)
      }}
    >
      {children}
    </button>
  )
}
