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

/** Long-press helper (600 ms) for the logo. */
export function useLongPress(onLong: () => void, ms = 600) {
  let timer: number | undefined;
  return {
    onPointerDown: () => {
      timer = window.setTimeout(onLong, ms);
    },
    onPointerUp: () => window.clearTimeout(timer),
    onPointerLeave: () => window.clearTimeout(timer),
    onPointerCancel: () => window.clearTimeout(timer),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}
