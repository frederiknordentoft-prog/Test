import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lyt.css'
import { LytApp } from './LytApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LytApp />
  </StrictMode>,
)

// Test hooks for scripts/voice/e2e.mjs (Chromium): only with ?e2e=1, loaded as its own chunk.
if (new URLSearchParams(location.search).get('e2e') === '1') void import('./e2e').then((m) => m.installE2E())
