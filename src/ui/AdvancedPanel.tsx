// Advanced panel: Cd, Cl, Re, Strouhal, blockage and diagnostics + honesty notes.

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
          <tr><td>{da.blockageLabel}</td><td>{m.blockagePct.toFixed(0)} %</td></tr>
          {m.flowHints.strouhal !== undefined && (
            <tr><td>{da.stLabel}</td><td>St ≈ {m.flowHints.strouhal.toFixed(2)}</td></tr>
          )}
          {m.flowHints.shedHzReal !== undefined && (
            <tr><td>{da.stRealLabel}</td><td>~{m.flowHints.shedHzReal.toFixed(0)} Hz</td></tr>
          )}
          <tr><td>{da.deflectLabel}</td><td>{m.thetaDeg.toFixed(1)}°</td></tr>
          <tr><td>{da.gridLabel}</td><td>{m.gridW}×{m.gridH}</td></tr>
          <tr><td>{da.fpsLabel}</td><td>{m.fps}</td></tr>
          <tr><td>{da.backendLabel}</td><td>{m.backend.toUpperCase()}{m.resets > 0 ? ` · resets: ${m.resets}` : ''}</td></tr>
        </tbody>
      </table>
      <p className="honesty">{da.reHonesty}</p>
      <p className="honesty">{da.blockageHonesty}</p>
      <p className="honesty">{da.honesty}</p>
    </div>
  );
}
