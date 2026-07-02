import type { Stars } from '../types'

type Props = {
  stars: Stars
  size?: 'sm' | 'lg'
  /** Staggered pop-in for the result panel count-up. */
  animate?: boolean
}

/** ★★☆ — the one way stars are drawn everywhere. */
export function StarRow({ stars, size = 'sm', animate = false }: Props) {
  return (
    <span className={['inline-flex', size === 'lg' ? 'gap-1.5 text-3xl' : 'gap-0.5 text-sm'].join(' ')} aria-label={`${stars} af 3 stjerner`}>
      {[1, 2, 3].map((i) => {
        const earned = stars >= i
        return (
          <span
            key={i}
            className={[
              earned ? 'text-amber-400' : 'text-slate-600',
              animate && earned ? 'animate-star-pop opacity-0' : '',
            ].join(' ')}
            style={animate && earned ? { animationDelay: `${(i - 1) * 0.45 + 0.2}s` } : undefined}
          >
            ★
          </span>
        )
      })}
    </span>
  )
}
