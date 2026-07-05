import type { OverlayMode } from '../engine/types';
import { useStore } from '../state/store';
import { da } from '../i18n/da';

const MODES: { id: OverlayMode; label: string }[] = [
  { id: 'none', label: da.overlayNone },
  { id: 'speed', label: da.overlaySpeed },
  { id: 'vorticity', label: da.overlayVorticity },
  { id: 'pressure', label: da.overlayPressure },
  { id: 'streamlines', label: da.overlayStreamlines },
];

export function OverlayPicker() {
  const overlay = useStore((s) => s.overlay);
  const set = useStore((s) => s.set);
  const showBubble = useStore((s) => s.showBubble);
  const advanced = useStore((s) => s.advanced);
  const labels = useStore((s) => s.labels);

  return (
    <div className="overlay-picker">
      <select
        value={overlay}
        aria-label={da.overlayLabel}
        onChange={(e) => {
          const v = e.target.value as OverlayMode;
          set({ overlay: v });
          if (v === 'pressure') showBubble('pressure');
          if (v === 'vorticity') showBubble('vorticity');
        }}
      >
        {MODES.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
      <button className={labels ? 'btn small active' : 'btn small'} onClick={() => set({ labels: !labels })}>
        {da.labelsToggle}
      </button>
      <button className={advanced ? 'btn small active' : 'btn small'} onClick={() => set({ advanced: !advanced })}>
        {da.advanced}
      </button>
    </div>
  );
}
