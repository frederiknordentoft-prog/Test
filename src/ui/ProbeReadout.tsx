// Probe marker + local readout. Speaks both everyday units (m/s, Pa) and the
// transferable dimensionless ones (u/U∞, Cp — stagnation reads Cp ≈ 1).

import { ASPECT } from '../engine/types';
import { useStore } from '../state/store';
import { da } from '../i18n/da';

export function ProbeReadout() {
  const probe = useStore((s) => s.probe);
  const m = useStore((s) => s.measure);
  const activeTool = useStore((s) => s.activeTool);

  if (activeTool === 'probe' && !probe) {
    return <div className="probe-hint">{da.probeHint}</div>;
  }
  if (!probe) return null;

  const xFrac = probe[0] / ASPECT;
  const left = `${xFrac * 100}%`;
  const top = `${(1 - probe[1]) * 100}%`;
  const flip = xFrac > 0.78; // keep the box inside the tunnel near the right edge

  return (
    <div className="probe-marker" style={{ left, top }}>
      <div className="probe-dot" />
      {m?.probe && (
        <div className={`probe-box ${flip ? 'flip' : ''}`}>
          <div>{da.probeSpeed}: <strong>{m.probe.speed.toFixed(1)} m/s</strong></div>
          <div>{da.probePressure}: <strong>{m.probe.pressure >= 0 ? '+' : ''}{m.probe.pressure.toFixed(0)} Pa</strong></div>
          <div className="probe-dimless">u/U∞ = <strong>{m.probe.uRatio.toFixed(2)}</strong> · Cp = <strong>{m.probe.cp.toFixed(2)}</strong></div>
        </div>
      )}
    </div>
  );
}
