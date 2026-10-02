// pay demo: an apple costs 7 kr. The hand taps the 5-krone and the 2-krone in the purse, they land
// in the tray, then the tick (3,6 s). When the child's own task is 7 kr, the apple costs 12 kr and
// the hand pays 10 + 2 instead: the film is never the task.
import { useState } from 'react'
import { Thing } from '../../../art/materials'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { formatMoney } from '../answers'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'
import { amountOf } from './logic'
import type { Piece } from './logic'
import { PieceArt, Piles } from './View'

const PURSE: Piece[] = [1000, 500, 200]

export function PayDemo({ onDone, task }: DemoProps) {
  const alt = !!task && amountOf(task) === 700
  const price = alt ? 1200 : 700
  const pay: Piece[] = alt ? [1000, 200] : [500, 200]
  const [tray, setTray] = useState<Piece[]>([])
  const [done, setDone] = useState(false)
  return (
    <DemoStage
      duration={3600}
      onDone={onDone}
      steps={[
        { at: 500, to: `p${pay[0]}`, tap: true, run: () => setTray(pay.slice(0, 1)) },
        { at: 1400, to: `p${pay[1]}`, tap: true, run: () => setTray(pay) },
        { at: 2400, to: 'ok', tap: true, run: () => setDone(true) },
        { at: 3300, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini tv-pay tv-pay-demo">
        <div className="tv-pay-demo__shop">
          <Thing id="apple" size={58} />
          <span className="tv-pay-demo__tag">{formatMoney(price)}</span>
        </div>
        <div className="tv-pay__purse">
          {PURSE.map((piece) => (
            <span key={piece} className="tv-pay__src" data-demo={`p${piece}`}>
              <span className="tv-pay__face">
                <PieceArt piece={piece} />
              </span>
            </span>
          ))}
        </div>
        <div className="tv-demo__row">
          <div className={cx('tv-pay__tray', tray.length === 0 && 'is-empty', done && 'is-good')}>
            <Piles pieces={tray} />
          </div>
          <span className={cx('tv-demo__key is-ok', tray.length > 0 && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
