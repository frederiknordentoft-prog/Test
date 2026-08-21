import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/index.css'
import { initSpeech } from './audio/speech'
import { requestPersistence } from './state/storage'
import { useRound } from './state/useRound'
import { useProfile } from './state/useProfile'

initSpeech()
requestPersistence()

// Opened with ?e2e=1 the automated playthrough can read which task is on screen,
// so it can click the real buttons a child would. Off in normal use.
if (new URLSearchParams(location.search).has('e2e')) {
  void import('./content/islands').then(({ ISLANDS }) =>
    Object.assign(window, { __round: useRound, __profile: useProfile, __islands: ISLANDS }),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
