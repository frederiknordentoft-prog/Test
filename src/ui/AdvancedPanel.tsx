// Advanced panel: Cd, Cl, Re, shedding frequency, grid/fps diagnostics + honesty note.

import { useStore } from '../state/store';
import { da } from '../i18n/da';

export function AdvancedPanel() {
  const advanced = useStore((s) => s.advanced);
  const m = useStore((s) => s.measure);
  if (!advanced || !m) return null;

  return (
    <div className="advanced-panel">
      <table>
        <tbody>
          <tr><td>{da.cdLabel}</td><td>{m.cd.toFixed(2)}</td></tr>
          <tr><td>{da.clLabel}</td><td>{m.cl.toFixed(2)}</td></tr>
          <tr><td>{da.reLabel}</td><td>{m.reynolds.toFixed(0)}</td></tr>
          {m.flowHints.shedFreqHz !== undefined && (
            <tr><td>{da.shedLabel}</td><td>{m.flowHints.shedFreqHz.toFixed(1)} Hz</td></tr>
          )}
          <tr><td>{da.deflectLabel}</td><td>{m.thetaDeg.toFixed(1)}°</td></tr>
          <tr><td>{da.gridLabel}</td><td>{m.gridW}×{m.gridH}</td></tr>
          <tr><td>{da.fpsLabel}</td><td>{m.fps}</td></tr>
          <tr><td>{da.backendLabel}</td><td>{m.backend.toUpperCase()}{m.resets > 0 ? ` · resets: ${m.resets}` : ''}</td></tr>
        </tbody>
      </table>
      <p className="honesty">{da.honesty}</p>
    </div>
  );
}
