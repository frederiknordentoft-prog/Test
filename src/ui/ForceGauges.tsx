// Live drag/lift readout: arrows + numbers, top-right of the tunnel.

import { useStore } from '../state/store';
import { da } from '../i18n/da';

export function ForceGauges() {
  const m = useStore((s) => s.measure);
  const hasShape = useStore((s) => !!s.committedShape);
  if (!m || !hasShape) return null;

  const dragPct = Math.min(100, Math.abs(m.dragN) * 8);
  const liftPct = Math.min(100, Math.abs(m.liftN) * 8);

  return (
    <div className="gauges" aria-live="off">
      <div className="gauge">
        <span className="gauge-name">{da.drag} →</span>
        <div className="gauge-bar"><div className="gauge-fill drag" style={{ width: `${dragPct}%` }} /></div>
        <span className="gauge-val">{fmt(m.dragN)} <em>{da.perMeter}</em></span>
      </div>
      <div className="gauge">
        <span className="gauge-name">{da.lift} ↑</span>
        <div className="gauge-bar center">
          <div className={`gauge-fill lift ${m.liftN >= 0 ? 'pos' : 'neg'}`} style={{ width: `${liftPct / 2}%` }} />
        </div>
        <span className="gauge-val">{fmt(m.liftN)} <em>{da.perMeter}</em></span>
      </div>
    </div>
  );
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
