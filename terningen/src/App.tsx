import { useEffect } from 'react'
import { ComponentPanel } from './components/ComponentPanel'
import { Controls } from './components/Controls'
import { Cube } from './components/Cube'
import { StageOverlay } from './components/StageOverlay'
import { FIRST_BEAT, LAST_BEAT } from './lib/beats'
import { restoreFocusAfterClose } from './lib/motion'
import { startHashSync, useModelStore } from './store/useModelStore'

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function isActivatable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.tagName === 'BUTTON' || t.tagName === 'A' || t.getAttribute('role') === 'button'
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End'])

/** Står fokus i et panel, der faktisk kan scrolle, må scrolltasterne styre panelet. */
function isInsideScrollablePanel(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return false
  const card = t.closest('.panel-card')
  return card instanceof HTMLElement && card.scrollHeight > card.clientHeight + 1
}

export default function App() {
  const openComponent = useModelStore((s) => s.openComponent)

  useEffect(() => startHashSync(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      if (SCROLL_KEYS.has(e.key) && isInsideScrollablePanel(e.target)) return
      const s = useModelStore.getState()
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault()
          s.next()
          break
        case ' ':
        case 'Enter':
          // Lad knapper og flader selv håndtere aktivering.
          if (isActivatable(e.target)) return
          e.preventDefault()
          s.next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          s.prev()
          break
        case 'Home':
          e.preventDefault()
          s.goToBeat(FIRST_BEAT)
          break
        case 'End':
          e.preventDefault()
          s.goToBeat(LAST_BEAT)
          break
        case 'Escape': {
          // Esc uden noget åbent er bevidst en no-op.
          const id = s.openComponent
          if (id) {
            e.preventDefault()
            restoreFocusAfterClose(id) // læses FØR panelet forsvinder
            s.close()
          }
          break
        }
        case 'b':
        case 'B':
          if (s.openComponent) {
            e.preventDefault()
            s.toggleBottleneck(s.openComponent)
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="app">
      <StageOverlay />
      <div className="stage">
        <div className="scene" data-shifted={openComponent !== null}>
          <Cube />
        </div>
      </div>
      <ComponentPanel />
      <Controls />
    </main>
  )
}
