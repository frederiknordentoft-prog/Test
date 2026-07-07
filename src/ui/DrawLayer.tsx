// Transparent pointer layer over the tunnel: freehand drawing, probe taps and
// direct manipulation — pointer-down inside the committed shape drags it around.
// Coordinates: screen px → tunnel coords (x ∈ [0,ASPECT], y ∈ [0,1], y up).

import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ASPECT } from '../engine/types';
import { buildFreehand, clampToTunnel, massProperties } from '../engine/shape/polygon';
import { useStore } from '../state/store';
import { da } from '../i18n/da';

const EDGE_MARGIN = 0.04;

export function DrawLayer() {
  const activeTool = useStore((s) => s.activeTool);
  const committedShape = useStore((s) => s.committedShape);
  const set = useStore((s) => s.set);
  const showToast = useStore((s) => s.showToast);
  const showBubble = useStore((s) => s.showBubble);
  const [draft, setDraft] = useState<number[]>([]);
  const drawing = useRef(false);
  const dragging = useRef<{ startX: number; startY: number; points: Float32Array; pivot: [number, number] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const toTunnel = (e: PointerEvent): [number, number] => {
    const rect = ref.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * ASPECT, 1 - (e.clientY - rect.top) / rect.height];
  };

  /** Generous touch hit-test: within the shape's bounding circle around its pivot. */
  const hitsShape = (x: number, y: number): boolean => {
    if (!committedShape) return false;
    const { points, pivot } = committedShape;
    let r2max = 0;
    for (let i = 0; i < points.length; i += 2) {
      const dx = points[i] - pivot[0];
      const dy = points[i + 1] - pivot[1];
      const r2 = dx * dx + dy * dy;
      if (r2 > r2max) r2max = r2;
    }
    const dx = x - pivot[0];
    const dy = y - pivot[1];
    return dx * dx + dy * dy <= r2max * 1.15;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activeTool === 'probe') {
      set({ probe: toTunnel(e) });
      return;
    }
    const [x, y] = toTunnel(e);
    if (committedShape && hitsShape(x, y)) {
      dragging.current = {
        startX: x,
        startY: y,
        points: committedShape.points,
        pivot: [committedShape.pivot[0], committedShape.pivot[1]],
      };
      ref.current!.setPointerCapture(e.pointerId);
      return;
    }
    if (activeTool !== 'freehand') return;
    drawing.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    setDraft([x, y]);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current) {
      const [x, y] = toTunnel(e);
      const d = dragging.current;
      let dx = x - d.startX;
      let dy = y - d.startY;
      // Clamp the DELTA so the whole shape stays inside the tunnel (no distortion).
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < d.points.length; i += 2) {
        if (d.points[i] < minX) minX = d.points[i];
        if (d.points[i] > maxX) maxX = d.points[i];
        if (d.points[i + 1] < minY) minY = d.points[i + 1];
        if (d.points[i + 1] > maxY) maxY = d.points[i + 1];
      }
      dx = Math.min(ASPECT - EDGE_MARGIN - maxX, Math.max(EDGE_MARGIN - minX, dx));
      dy = Math.min(1 - EDGE_MARGIN - maxY, Math.max(EDGE_MARGIN - minY, dy));
      const moved = new Float32Array(d.points.length);
      for (let i = 0; i < d.points.length; i += 2) {
        moved[i] = d.points[i] + dx;
        moved[i + 1] = d.points[i + 1] + dy;
      }
      const shape = useStore.getState().committedShape;
      if (shape) {
        set({ committedShape: { ...shape, points: moved, pivot: [d.pivot[0] + dx, d.pivot[1] + dy] } });
      }
      return;
    }
    if (!drawing.current) return;
    const [x, y] = toTunnel(e);
    setDraft((dr) => {
      const lx = dr[dr.length - 2];
      const ly = dr[dr.length - 1];
      if (Math.hypot(x - lx, y - ly) < 0.008) return dr;
      return [...dr, x, y];
    });
  };

  const onPointerUp = () => {
    if (dragging.current) {
      dragging.current = null;
      return;
    }
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
      {!committedShape && !path && <div className="ghost-hint">{da.ghostHint}</div>}
      {path && (
        <svg className="draft-svg" viewBox={`0 0 ${ASPECT} 1`} preserveAspectRatio="none">
          <path d={path} fill="rgba(125,211,252,0.15)" stroke="#7dd3fc" strokeWidth="0.008" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
