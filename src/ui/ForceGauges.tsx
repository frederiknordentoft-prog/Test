// Live drag/lift readout below the tunnel: mean value ± vortex-shedding fluctuation band.
// Bar lengths are Cd/Cl-normalized so shapes stay comparable across the whole wind range.

import { useStore } from '../state/store';
import { da } from '../i18n/da';

export function ForceGauges() {
  const m = useStore((s) => s.measure);
  const hasShape = useStore((s) => !!s.committedShape);
  if (!m || !hasShape) return null;

  // Cd 0..3.5 → 0..100 %; fluctuation band derived from the N/m ratio (same scaling).
  const dragPct = Math.min(100, (m.cd / 3.5) * 100);
  const dragBand = m.dragN !== 0 ? Math.min(100, (m.dragFluctN / Math.abs(m.dragN)) * dragPct) : 0;
  const liftPct = Math.min(50, (Math.abs(m.cl) / 3) * 100);
  const liftBand = Math.min(50, m.cl !== 0 ? (m.liftFluctN / Math.max(Math.abs(m.liftN), 1e-6)) * liftPct : (m.liftFluctN > 0 ? 12 : 0));

  return (
    <div className="gauges" aria-live="off" title={da.fluctTitle}>
      <div className="gauge">
        <span className="gauge-name">{da.drag} →</span>
        <div className="gauge-bar">
          <div className="gauge-fill drag" style={{ width: `${dragPct}%` }} />
          <div className="gauge-band" style={{ left: `${Math.max(0, dragPct - dragBand / 2)}%`, width: `${dragBand}%` }} />
        </div>
        <span className="gauge-val">
          {fmt(m.dragN)} <span className="pm">± {fmt(m.dragFluctN)}</span> <em>{da.perMeter}</em>
        </span>
      </div>
      <div className="gauge">
        <span className="gauge-name">{da.lift} ↑</span>
        <div className="gauge-bar center">
          <div className="gauge-tick" />
          <div className={`gauge-fill lift ${m.liftN >= 0 ? 'pos' : 'neg'}`} style={{ width: `${liftPct}%` }} />
          <div className="gauge-band" style={{ left: `${50 + (m.liftN >= 0 ? liftPct : -liftPct) - liftBand / 2}%`, width: `${liftBand}%` }} />
        </div>
        <span className="gauge-val">
          {fmt(m.liftN)} <span className="pm">± {fmt(m.liftFluctN)}</span> <em>{da.perMeter}</em>
        </span>
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
