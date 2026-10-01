// Small building blocks of the parent dashboard: sections, stat tiles, switches, the dot legend.
// Grown-up screens: plain text, no read-aloud, every tap target ≥ 60 px.
import type { ReactNode } from 'react'
import { DOT_LABEL, DOT_ORDER } from '../../../../parent/format'
import { StatusDot } from './charts'

export const KAN_SELV_NOTE = 'Kan selv kræver, at barnet skriver svaret selv på to forskellige dage.'

export function Section({ title, sub, children, className }: { title: string; sub?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`tv-dsec${className ? ` ${className}` : ''}`}>
      <h2 className="tv-dsec__title">{title}</h2>
      {sub && <p className="tv-dsec__sub">{sub}</p>}
      {children}
    </section>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`tv-dpanel${className ? ` ${className}` : ''}`}>{children}</div>
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="tv-dstat">
      <span className="tv-dstat__value">{value}</span>
      <span className="tv-dstat__label">{label}</span>
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="tv-dnote">{children}</p>
}

/** A setting: the whole row is the switch. */
export function Toggle({ label, hint, checked, onChange, disabled }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="tv-dtoggle" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="tv-dtoggle__text">
        <span className="tv-dtoggle__label">{label}</span>
        {hint && <span className="tv-dtoggle__hint">{hint}</span>}
      </span>
      <span className="tv-dtoggle__track" aria-hidden>
        <span className="tv-dtoggle__knob" />
      </span>
    </button>
  )
}

/** A plain text button for the grown-ups' screens. */
export function DashButton({ children, onClick, tone = 'plain', disabled, className }: {
  children: ReactNode; onClick?: () => void; tone?: 'plain' | 'primary' | 'quiet'; disabled?: boolean; className?: string
}) {
  return (
    <button type="button" className={`tv-dbtn tv-dbtn--${tone}${className ? ` ${className}` : ''}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

export function DotLegend() {
  return (
    <ul className="tv-dlegend" aria-label="Forklaring">
      {DOT_ORDER.map((k) => (
        <li key={k}>
          <StatusDot kind={k} size={16} label={null} />
          {DOT_LABEL[k]}
        </li>
      ))}
    </ul>
  )
}
