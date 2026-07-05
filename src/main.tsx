import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { useGameStore } from './state/store'
import './index.css'

registerSW({ immediate: true })

// Test-hook: giver røgtests (og nysgerrige) læseadgang til spiltilstanden.
;(window as unknown as { __vaegt?: typeof useGameStore }).__vaegt = useGameStore

const rootEl = document.getElementById('root')
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
