import { useRef } from 'react';
import { useChecks } from '../diag/store';

/** Debug HUD: fps, worker mode, fonts, CSP. Opened by a long press on the Ø. */
export function Hud({ extra }: { extra?: string }) {
  const c = useChecks();
  const fps = c['fps']?.data as { hz?: number; p95?: number } | undefined;
  const csp = c['csp'];
  return (
    <div className="hud" aria-hidden="true">
      <span>fps</span><b>{fps?.hz ?? '–'} Hz · p95 {fps?.p95?.toFixed(1) ?? '–'}</b>
      <span>worker</span><b className={c['worker-mode']?.status === 'ok' ? '' : 'bad'}>{c['worker-mode']?.detail ?? 'ikke testet'}</b>
      <span>fonts</span><b className={c['fonts']?.status === 'ok' ? '' : 'bad'}>{c['fonts']?.detail ?? '…'}</b>
      <span>CSP</span><b className={csp?.status === 'ok' ? '' : 'bad'}>{csp?.detail ?? '…'}</b>
      {extra ? (<><span>vifte</span><b>{extra}</b></>) : null}
    </div>
  );
}

/** Long-press helper (600 ms) for the logo. The timer lives in a ref, so re-renders cannot lose it. */
export function useLongPress(onLong: () => void, ms = 600) {
  const timer = useRef<number | undefined>(undefined);
  const clear = () => window.clearTimeout(timer.current);
  return {
    onPointerDown: () => {
      clear();
      timer.current = window.setTimeout(onLong, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}
