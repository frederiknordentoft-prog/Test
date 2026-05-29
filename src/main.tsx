import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useGame } from './store/gameStore';
import { useConfig } from './store/configStore';

// Initialise the deal pool on boot.
useGame.getState().init();

// Refill / reset the deal pool whenever the solvable-only setting changes.
let lastSolvableOnly = useConfig.getState().solvableOnly;
useConfig.subscribe((cfg) => {
  if (cfg.solvableOnly !== lastSolvableOnly) {
    lastSolvableOnly = cfg.solvableOnly;
    useGame.getState().resetPool();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
