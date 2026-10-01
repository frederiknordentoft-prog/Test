import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as catalog from '../speech/catalog'
import './lyt.css'
import { LytApp } from './LytApp'

// The clip catalogue may load lazily (loadAllClips() before the first lookup); render once it has.
const loadAllClips = Reflect.get(catalog, 'loadAllClips') as (() => Promise<void>) | undefined

void (typeof loadAllClips === 'function' ? loadAllClips() : Promise.resolve()).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LytApp />
    </StrictMode>,
  )
  // Test hooks for scripts/voice/e2e.mjs (Chromium): only with ?e2e=1, loaded as its own chunk.
  if (new URLSearchParams(location.search).get('e2e') === '1') void import('./e2e').then((m) => m.installE2E())
})
