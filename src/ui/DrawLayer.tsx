// Transparent pointer layer over the tunnel: freehand drawing, probe taps.
// Coordinates: screen px → tunnel coords (x ∈ [0,ASPECT], y ∈ [0,1], y up).

import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ASPECT } from '../engine/types';
import { buildFreehand, clampToTunnel, massProperties } from '../engine/shape/polygon';
import { useStore } from '../state/store';
import { da } from '../i18n/da';

export function DrawLayer() {
  const activeTool = useStore((s) => s.activeTool);
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);
  const showBubble = useStore((s) => s.showBubble);
  const [draft, setDraft] = useState<number[]>([]);
  const drawing = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const toTunnel = (e: PointerEvent): [number, number] => {
    const rect = ref.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * ASPECT, 1 - (e.clientY - rect.top) / rect.height];
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activeTool === 'probe') {
      set({ probe: toTunnel(e) });
      return;
    }
    if (activeTool !== 'freehand') return;
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const [x, y] = toTunnel(e);
    setDraft([x, y]);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drawing.current) return;
    const [x, y] = toTunnel(e);
    setDraft((d) => {
      const lx = d[d.length - 2];
      const ly = d[d.length - 1];
      if (Math.hypot(x - lx, y - ly) < 0.008) return d;
      return [...d, x, y];
    });
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setDraft((d) => {
      const result = buildFreehand(d);
      if (!result.ok) {
        showToast(result.reason === 'too-small' ? da.drawHintTooSmall : da.drawHintClosed);
        return [];
      }
      const points = clampToTunnel(result.points);
      const mp = massProperties(points, [0, 0]);
      set({ committedShape: { points, kind: 'freehand', pivot: mp.centroid }, probe: null });
      showBubble('firstShape');
      return [];
    });
  };

  // draft preview as SVG polyline in tunnel viewBox (y flipped)
  let path = '';
  if (draft.length >= 4) {
    const segs: string[] = [];
    for (let i = 0; i < draft.length; i += 2) segs.push(`${draft[i].toFixed(3)},${(1 - draft[i + 1]).toFixed(3)}`);
    path = `M${segs.join(' L')}`;
  }

  return (
    <div
      ref={ref}
      className={`draw-layer ${activeTool === 'freehand' ? 'draw-cursor' : activeTool === 'probe' ? 'probe-cursor' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {path && (
        <svg className="draft-svg" viewBox={`0 0 ${ASPECT} 1`} preserveAspectRatio="none">
          <path d={path} fill="rgba(125,211,252,0.15)" stroke="#7dd3fc" strokeWidth="0.008" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
