import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installCspListener } from './diag/csp';
import { loadFonts } from './diag/fonts';
import { startFpsSampler } from './diag/fps';
import { checkEnv } from './diag/env';
import App from './ui/App';
import './styles/tokens.css';
import './styles/app.css';
import './styles/kamp.css';

installCspListener();
checkEnv();
void loadFonts();
startFpsSampler();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
