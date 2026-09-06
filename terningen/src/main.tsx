import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { UI } from './content/model'

document.title = UI.documentTitle

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root mangler i index.html')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
