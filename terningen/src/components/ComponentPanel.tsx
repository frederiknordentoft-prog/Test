import { UI, getComponent } from '../content/model'
import { pipLayout } from '../lib/cube'
import { blurIfPointer, restoreFocusAfterClose } from '../lib/motion'
import { useModelStore } from '../store/useModelStore'

/** Tekstpanelet, der folder ind ved siden af terningen. */
export function ComponentPanel() {
  const openComponent = useModelStore((s) => s.openComponent)
  const bottleneck = useModelStore((s) => s.bottleneck)
  const close = useModelStore((s) => s.close)
  const toggleBottleneck = useModelStore((s) => s.toggleBottleneck)

  if (!openComponent) return <aside className="panel" aria-hidden="true" />

  const c = getComponent(openComponent)
  const isBottleneck = bottleneck === c.id

  return (
    <aside className="panel" aria-live="polite">
      <section key={c.id} className="panel-card" aria-labelledby="panel-title">
        <div className="panel-top">
          <div className="panel-eyebrow">
            {c.pips === null ? (
              <span className="mini-core" aria-hidden="true" />
            ) : (
              <span className="mini-die" aria-hidden="true">
                {pipLayout(c.pips).map(([row, col]) => (
                  <i key={`${row}-${col}`} style={{ gridRow: row + 1, gridColumn: col + 1 }} />
                ))}
              </span>
            )}
            <span>{c.pips === null ? UI.coreLabel : `${c.pips}`}</span>
          </div>
          <button
            type="button"
            className="chip"
            onClick={(e) => {
              if (e.detail === 0) restoreFocusAfterClose(c.id) // tastatur: fokus tilbage til fladen
              blurIfPointer(e)
              close()
            }}
            aria-label={UI.ariaCloseFace(c.title)}
          >
            {UI.close}
          </button>
        </div>

        <h2 id="panel-title" className="panel-title">
          {c.title}
        </h2>
        <p className="panel-kicker">{c.kicker}</p>

        <h3 className="panel-questions-heading">{UI.questionsHeading}</h3>
        <ol className="questions">
          {c.questions.map((q, i) => (
            <li key={q}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <span>{q}</span>
            </li>
          ))}
        </ol>

        <div className="panel-actions">
          <button
            type="button"
            className="chip chip-amber"
            data-active={isBottleneck}
            aria-pressed={isBottleneck}
            onClick={(e) => {
              blurIfPointer(e)
              toggleBottleneck(c.id)
            }}
          >
            {isBottleneck ? UI.clearBottleneck : UI.setBottleneck}
          </button>
        </div>
      </section>
    </aside>
  )
}
