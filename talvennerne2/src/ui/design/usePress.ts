// Pressed state for tactile buttons. iOS Safari does not reliably apply :active without a touch
// listener, so the press is tracked with pointer events and exposed as `data-pressed`; CSS moves
// the face 4 px down on 80 ms and springs it back on release (transform only).
import { useCallback, useState } from 'react'
import type { PointerEvent } from 'react'

export function usePress(disabled = false) {
  const [pressed, setPressed] = useState(false)
  const down = useCallback(
    (e: PointerEvent) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
      setPressed(true)
    },
    [disabled],
  )
  const up = useCallback(() => setPressed(false), [])
  return {
    pressed,
    pressProps: {
      onPointerDown: down,
      onPointerUp: up,
      onPointerCancel: up,
      onPointerLeave: up,
      'data-pressed': pressed ? '' : undefined,
    },
  }
}
