/**
 * Hold to stake (borrowed from voice notes): hold an outcome, the stake steps up every 280 ms,
 * glide up to buy, glide left to cancel. Releasing without a glide opens the tray at that stake.
 */
export const STEPS = [10, 25, 50, 100, 250, 500, 1000];

export interface HoldState { x: number; y: number; step: number; dy: number; dx: number; label: string; ask: number }

export function HoldOverlay({ h }: { h: HoldState }) {
  const kr = STEPS[h.step];
  const shares = Math.floor((100 * kr) / Math.max(1, h.ask));
  const armed = h.dy < -40;
  const cancel = h.dx < -40;
  // The ring stays under the finger; the card slides inward so it never leaves the screen.
  const HALF = 136;
  const vw = typeof window === 'undefined' ? 390 : window.innerWidth;
  const shift = Math.max(HALF + 8 - h.x, Math.min(0, vw - HALF - 8 - h.x));
  return (
    <div className="hold" style={{ left: h.x, top: h.y }} role="status" aria-live="polite">
      <span className={`hold-ring ${armed ? 'armed' : ''}`} style={{ ['--p' as string]: (h.step + 1) / STEPS.length }} />
      <span className="hold-card" style={{ transform: `translateX(${shift}px)` }}>
        <b className="num">{kr} kr</b> på {h.label}
        <small className="num">{shares} andele · udbetaling {shares} kr</small>
        <small>{cancel ? 'Slip for at annullere' : armed ? 'Slip for at købe' : 'Glid op for at købe · venstre for at annullere'}</small>
      </span>
    </div>
  );
}
