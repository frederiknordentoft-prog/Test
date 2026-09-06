import { UI, getComponent } from '../content/model'
import { BEAT_COUNT, BEAT_ORDER, FIRST_BEAT, LAST_BEAT } from '../lib/beats'
import { pipLayout } from '../lib/cube'
import { blurIfPointer } from '../lib/motion'
import { useModelStore } from '../store/useModelStore'

/** Styring i bunden: samlet/eksploderet, komponenter, frem/tilbage. */
export function Controls() {
  const stage = useModelStore((s) => s.stage)
  const beat = useModelStore((s) => s.beat)
  const openComponent = useModelStore((s) => s.openComponent)
  const bottleneck = useModelStore((s) => s.bottleneck)
  const setStage = useModelStore((s) => s.setStage)
  const toggleOpen = useModelStore((s) => s.toggleOpen)
  const next = useModelStore((s) => s.next)
  const prev = useModelStore((s) => s.prev)

  return (
    <nav className="controls" aria-label={UI.ariaControls}>
      <div className="controls-row">
        <button
          type="button"
          className="chip"
          data-active={stage === 'assembled'}
          aria-pressed={stage === 'assembled'}
          onClick={(e) => {
            blurIfPointer(e)
            setStage('assembled')
          }}
        >
          {UI.assemble}
        </button>
        <button
          type="button"
          className="chip"
          data-active={stage === 'exploded' && openComponent === null}
          aria-pressed={stage === 'exploded' && openComponent === null}
          onClick={(e) => {
            blurIfPointer(e)
            setStage('exploded')
          }}
        >
          {UI.explode}
        </button>

        <span className="controls-divider" aria-hidden="true" />

        {BEAT_ORDER.map((id) => {
          const c = getComponent(id)
          const active = openComponent === id
          return (
            <button
              key={id}
              type="button"
              className="chip"
              data-active={active}
              data-bottleneck={bottleneck === id}
              aria-pressed={active}
              onClick={(e) => {
                blurIfPointer(e)
                toggleOpen(id)
              }}
              title={c.title}
            >
              {c.pips === null ? (
                <span className="chip-core" aria-hidden="true" />
              ) : (
                <span className="chip-pips" aria-hidden="true">
                  {pipLayout(c.pips).map(([row, col]) => (
                    <i key={`${row}-${col}`} style={{ gridRow: row + 1, gridColumn: col + 1 }} />
                  ))}
                </span>
              )}
              <span>{c.title}</span>
            </button>
          )
        })}

        <span className="controls-divider" aria-hidden="true" />

        <button
          type="button"
          className="chip"
          onClick={(e) => {
            blurIfPointer(e)
            prev()
          }}
          aria-disabled={beat === FIRST_BEAT}
          aria-label={UI.prev}
        >
          ‹ {UI.prev}
        </button>
        <span className="beat-counter" aria-live="polite">
          {UI.beatOf(beat + 1, BEAT_COUNT)}
        </span>
        <button
          type="button"
          className="chip"
          onClick={(e) => {
            blurIfPointer(e)
            next()
          }}
          aria-disabled={beat === LAST_BEAT}
          aria-label={UI.next}
        >
          {UI.next} ›
        </button>
      </div>
      <p className="hints">{UI.hints}</p>
    </nav>
  )
}
