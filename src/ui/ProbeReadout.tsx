// Probe marker + local speed/pressure readout at the tapped point.

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

  const left = `${(probe[0] / ASPECT) * 100}%`;
  const top = `${(1 - probe[1]) * 100}%`;

  return (
    <div className="probe-marker" style={{ left, top }}>
      <div className="probe-dot" />
      {m?.probe && (
        <div className="probe-box">
          <div>{da.probeSpeed}: <strong>{m.probe.speed.toFixed(1)} m/s</strong></div>
          <div>{da.probePressure}: <strong>{m.probe.pressure >= 0 ? '+' : ''}{m.probe.pressure.toFixed(0)} Pa</strong></div>
        </div>
      )}
    </div>
  );
}
