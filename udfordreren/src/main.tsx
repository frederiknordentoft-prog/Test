import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './ui/App';
import { useGame } from './store/gameStore';
import { useUi, erDebug } from './store/uiStore';

// Testkrog: i udvikling eller med ?debug=1 kan Playwright og debug-værktøjer nå stores.
if (import.meta.env.DEV || erDebug()) {
  (window as unknown as { __udfordreren: unknown }).__udfordreren = { useGame, useUi };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
