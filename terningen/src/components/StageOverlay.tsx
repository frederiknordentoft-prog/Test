import { HEADLINE, UI } from '../content/model'
import { useModelStore } from '../store/useModelStore'

/** Overskriften AI VALUE CREATION — fader ind i beat 0 og ud derefter. */
export function StageOverlay() {
  const beat = useModelStore((s) => s.beat)
  const visible = beat === 0
  return (
    <>
      <div className="brand" aria-hidden="true">
        <strong>{UI.appTitle}</strong>
        <span>{UI.appSubtitle}</span>
      </div>
      <header className="headline" data-visible={visible} aria-hidden={!visible}>
        <h1>{HEADLINE.title}</h1>
        <p>{HEADLINE.subtitle}</p>
      </header>
    </>
  )
}
