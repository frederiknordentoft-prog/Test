// "Aha" labels positioned in tunnel coords: stagnation point + vortex street.

import { ASPECT } from '../engine/types';
import { useStore } from '../state/store';
import { da } from '../i18n/da';

export function LabelsOverlay() {
  const labels = useStore((s) => s.labels);
  const m = useStore((s) => s.measure);
  const shape = useStore((s) => s.committedShape);
  if (!labels || !m || !shape) return null;

  const stag = m.flowHints.stagnation;
  const shed = m.flowHints.shedFreqHz;

  return (
    <div className="labels-overlay" aria-hidden>
      {stag && (
        <div className="flow-label" style={{ left: `${(stag[0] / ASPECT) * 100}%`, top: `${(1 - stag[1]) * 100}%` }}>
          <span className="flow-dot" />
          <span className="flow-text">{da.labelStagnation}</span>
        </div>
      )}
      {shed !== undefined && (
        <div
          className="flow-label street"
          style={{ left: `${Math.min(92, ((shape.pivot[0] + 0.45) / ASPECT) * 100)}%`, top: `${(1 - shape.pivot[1]) * 100}%` }}
        >
          <span className="flow-text">{da.labelVortexStreet} · {shed.toFixed(1)} Hz</span>
        </div>
      )}
    </div>
  );
}
