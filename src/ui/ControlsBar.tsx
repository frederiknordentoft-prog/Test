// Bottom controls: wind, weight, angle-of-attack, lock, pause, reset. One-hand friendly.

import { useStore } from '../state/store';
import { da } from '../i18n/da';
import { windSliderToMs } from '../engine/units';

export function ControlsBar() {
  const windSpeed = useStore((s) => s.windSpeed);
  const density = useStore((s) => s.density);
  const restAngleDeg = useStore((s) => s.restAngleDeg);
  const timeScale = useStore((s) => s.timeScale);
  const pivotLocked = useStore((s) => s.pivotLocked);
  const paused = useStore((s) => s.paused);
  const smoke = useStore((s) => s.smoke);
  const set = useStore((s) => s.set);
  const showBubble = useStore((s) => s.showBubble);

  return (
    <div className="controls">
      <label className="slider-group wind">
        <span className="slider-label">
          {da.windLabel} <strong>{windSliderToMs(windSpeed).toFixed(0)} {da.windUnit}</strong>
        </span>
        <input
          type="range" min={0} max={1} step={0.01} value={windSpeed}
          onChange={(e) => set({ windSpeed: Number(e.target.value) })}
          aria-label={da.windLabel}
        />
      </label>

      <label className={`slider-group ${pivotLocked ? 'dimmed' : ''}`} title={pivotLocked ? da.weightLockedHint : undefined}>
        <span className="slider-label">
          {da.weightLabel} <strong>{density < 0.5 ? da.weightLight : density > 3 ? da.weightHeavy : `${density.toFixed(1)}×`}</strong>
        </span>
        <input
          type="range" min={-1} max={1} step={0.02} value={Math.log10(density)}
          onChange={(e) => {
            // Dragging Vægt while the pivot is locked is an unambiguous intent — unlock it.
            set({ density: Math.pow(10, Number(e.target.value)), pivotLocked: false });
            showBubble('weight');
          }}
          aria-label={da.weightLabel}
        />
        {pivotLocked && <span className="slider-caption">{da.weightLockedHint}</span>}
      </label>

      <label className="slider-group">
        <span className="slider-label">
          {da.angleLabel} <strong>{restAngleDeg.toFixed(0)}°</strong>
        </span>
        <input
          type="range" min={-35} max={35} step={1} value={restAngleDeg}
          onChange={(e) => {
            set({ restAngleDeg: Number(e.target.value) });
            showBubble('angle');
          }}
          aria-label={da.angleLabel}
        />
      </label>

      <label className="slider-group" title={da.tempoHint}>
        <span className="slider-label">
          {da.tempoLabel} <strong>{timeScale < 1 ? `${timeScale.toFixed(2).replace(/0$/, '')}×` : `${timeScale.toFixed(0)}×`}</strong>
        </span>
        <input
          type="range" min={-2} max={2} step={1} value={Math.log2(timeScale)}
          onChange={(e) => set({ timeScale: Math.pow(2, Number(e.target.value)) })}
          aria-label={da.tempoLabel}
        />
      </label>

      <div className="button-row">
        <button className={pivotLocked ? 'btn active' : 'btn'} onClick={() => set({ pivotLocked: !pivotLocked })} title={pivotLocked ? da.lockedHint : da.freeHint}>
          {pivotLocked ? '🔒' : '🔓'} {da.lockLabel}
        </button>
        <button className={smoke ? 'btn active' : 'btn'} onClick={() => set({ smoke: !smoke })}>
          {da.smokeLabel}
        </button>
        <button className="btn" onClick={() => set({ paused: !paused })}>
          {paused ? `▶ ${da.play}` : `⏸ ${da.pause}`}
        </button>
        <button className="btn" onClick={() => set({ resetFlowNonce: useStore.getState().resetFlowNonce + 1 })}>
          ↺ {da.resetFlow}
        </button>
      </div>
    </div>
  );
}
