import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './App'

const root = document.getElementById('root')!

if (document.documentElement.hasAttribute('data-unsupported')) {
  document.body.insertAdjacentHTML(
    'beforeend',
    '<p style="font:600 18px/1.5 system-ui;padding:24px;max-width:36em">Talvennerne 2 kræver iOS/iPadOS 16.4 eller nyere. Opdatér enheden i Indstillinger → Generelt → Softwareopdatering.</p>',
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
