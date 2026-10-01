// The woven basket of countTap: a handle, a back rim and a body that grows a row at a time. The
// things inside sit in rows of five. Drawn in CSS from the wood tokens (task.css), so it stretches
// cleanly with the number of rows.
import type { CSSProperties, ReactNode } from 'react'

export function Basket({ rows, children }: { rows: number; children?: ReactNode }) {
  return (
    <span className="tv-basket" style={{ '--rows': rows } as CSSProperties}>
      <span className="tv-basket__handle" aria-hidden />
      <span className="tv-basket__body" aria-hidden />
      <span className="tv-basket__items">{children}</span>
      <span className="tv-basket__lip" aria-hidden />
    </span>
  )
}
