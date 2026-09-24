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

// Procedural pixel-favicon (et guld "U" på mørk baggrund) — ingen eksterne filer.
(function favicon() {
  const U = ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'];
  let d = '';
  U.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === '#') d += `M${x + 1.5} ${y + 1}h1v1h-1z`;
    }),
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 9" shape-rendering="crispEdges"><rect width="8" height="9" rx="1" fill="#171a2b"/><path d="${d}" fill="#ffd23f"/></svg>`;
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  document.head.appendChild(link);
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
