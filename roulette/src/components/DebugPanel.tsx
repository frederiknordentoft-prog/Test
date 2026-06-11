import { useState } from 'react'
import {
  POCKET_COUNT,
  indexOfNumber,
  pocketAngleDeg,
  pocketAtWorldAngle,
  rotorAngleForNumber,
} from '../lib/wheel'
import { useWheelStore } from '../store'

/**
 * Phase 0 debug tool: type a number, the rotor rotates so that number sits
 * exactly under the red reference marker (world angle 0). The panel also
 * inverts the math (pocketAtWorldAngle) as a live self-check.
 */
export function DebugPanel() {
  const [input, setInput] = useState('0')
  const [result, setResult] = useState<{
    n: number
    index: number
    angleDeg: number
    check: number
  } | null>(null)
  const setRotorAngle = useWheelStore((s) => s.setRotorAngle)

  const align = () => {
    const n = Number(input)
    if (!Number.isInteger(n) || n < 0 || n >= POCKET_COUNT) return
    const phi = rotorAngleForNumber(n, 0)
    setRotorAngle(phi)
    const check = pocketAtWorldAngle(0, phi)
    if (check !== n) console.warn(`Mapping self-check FAILED: asked ${n}, inverse says ${check}`)
    setResult({ n, index: indexOfNumber(n), angleDeg: pocketAngleDeg(n), check })
  }

  return (
    <div className="debug-panel">
      <strong>Debug: number → marker</strong>
      <div className="row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && align()}
          inputMode="numeric"
        />
        <button onClick={align}>Align</button>
      </div>
      {result && (
        <div className="info">
          <div>number {result.n} · index {result.index}</div>
          <div>pocketAngle {result.angleDeg.toFixed(2)}°</div>
          <div>
            under marker: {result.check}{' '}
            {result.check === result.n ? '✓' : '✗ MISMATCH'}
          </div>
        </div>
      )}
    </div>
  )
}
