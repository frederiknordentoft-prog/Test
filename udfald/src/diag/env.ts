import * as React from 'react';
import { setCheck } from './store';

/** Snapshot of the host environment: iframe, origin, viewport, storage, ViewTransition. */
export function checkEnv(): void {
  let inIframe = true;
  try {
    inIframe = window.top !== window.self;
  } catch {
    inIframe = true;
  }
  const vv = window.visualViewport;
  setCheck('env', {
    status: 'ok',
    detail: `${inIframe ? 'I iframe' : 'Ikke i iframe'} · origin ${location.origin} · ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    data: {
      ua: navigator.userAgent,
      origin: location.origin,
      secure: window.isSecureContext,
      inIframe,
      viewport: [window.innerWidth, window.innerHeight],
      visualViewport: vv ? [Math.round(vv.width), Math.round(vv.height)] : null,
      dpr: window.devicePixelRatio,
      cores: navigator.hardwareConcurrency,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      audioSession: 'audioSession' in navigator,
    },
  });
  const hasReactVT = 'ViewTransition' in React;
  const hasDocVT = typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';
  setCheck('view-transition', {
    status: hasReactVT && hasDocVT ? 'ok' : 'advarsel',
    detail: `React <ViewTransition>: ${hasReactVT ? 'ja' : 'nej'} · document.startViewTransition: ${hasDocVT ? 'ja' : 'nej'}`,
  });
  let storage = 'virker';
  try {
    localStorage.setItem('__udfald', '1');
    localStorage.removeItem('__udfald');
  } catch (err) {
    storage = `blokeret (${(err as Error).name})`;
  }
  setCheck('storage', { status: storage === 'virker' ? 'ok' : 'advarsel', detail: `localStorage ${storage} (appen bruger det ikke)` });
}
