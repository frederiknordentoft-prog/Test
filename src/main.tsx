import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { HarnessPage } from './harness/HarnessPage';
import './styles.css';

registerSW({ immediate: true });

const isHarness = new URLSearchParams(location.search).get('harness') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isHarness ? <HarnessPage /> : <App />}</StrictMode>,
);
