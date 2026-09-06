import { HEADLINE, UI } from '../content/model'
import { useModelStore } from '../store/useModelStore'

/** Overskriften AI VALUE CREATION — fader ind i beat 0 og ud derefter. */
export function StageOverlay() {
  const beat = useModelStore((s) => s.beat)
  const visible = beat === 0
  return (
    <>
      {/* Sidens varige overskrift (app-navnet); AI VALUE CREATION er scenens overskrift i beat 0. */}
      <h1 className="brand">
        <strong>{UI.appTitle}</strong>
        <span>{UI.appSubtitle}</span>
      </h1>
      <header className="headline" data-visible={visible} aria-hidden={!visible}>
        <h2>{HEADLINE.title}</h2>
        <p>{HEADLINE.subtitle}</p>
      </header>
    </>
  )
}
