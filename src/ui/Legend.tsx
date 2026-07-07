// Colorbar legend for the active field overlay — color without a scale teaches nothing.
// Gradient is sampled from the SAME LUT data the shaders use.

import { useMemo } from 'react';
import { seqLutData, divLutData } from '../render/colormaps';
import { useStore } from '../state/store';
import { da } from '../i18n/da';

function lutGradient(data: Uint8Array): string {
  const stops: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const idx = Math.min(255, Math.round((i / 8) * 255)) * 4;
    stops.push(`rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]}) ${(i / 8) * 100}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function Legend() {
  const overlay = useStore((s) => s.overlay);
  const seq = useMemo(() => lutGradient(seqLutData()), []);
  const div = useMemo(() => lutGradient(divLutData()), []);

  if (overlay === 'none' || overlay === 'streamlines') return null;

  const cfg = overlay === 'speed'
    ? { g: seq, title: da.legendSpeed, lo: '0', hi: '1,6×' }
    : overlay === 'pressure'
      ? { g: div, title: da.legendPressure, lo: '−3', hi: '+1' }
      : { g: div, title: da.legendVorticity, lo: '−', hi: '+' };

  return (
    <div className="legend" aria-hidden>
      <span className="legend-title">{cfg.title}</span>
      <span className="legend-lo">{cfg.lo}</span>
      <span className="legend-bar" style={{ background: cfg.g }} />
      <span className="legend-hi">{cfg.hi}</span>
    </div>
  );
}
