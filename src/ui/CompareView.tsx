// Compare mode: two tunnels, same wind, drag bars side by side.

import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/Engine';
import type { Measurements, ShapeKind, ShapeSpec } from '../engine/types';
import { makePrimitive } from '../engine/shape/primitives';
import { selectSimParams, useStore } from '../state/store';
import { da } from '../i18n/da';

const PICKS: { kind: ShapeKind | 'drawing'; label: string }[] = [
  { kind: 'circle', label: da.toolCircle },
  { kind: 'square', label: da.toolSquare },
  { kind: 'plate', label: da.toolPlate },
  { kind: 'teardrop', label: da.toolTeardrop },
  { kind: 'drawing', label: da.yourDrawing },
];

function Pane({ title, defaultKind, slot }: { title: string; defaultKind: ShapeKind; slot: 'A' | 'B' }) {
  const ref = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [kind, setKind] = useState<ShapeKind | 'drawing'>(defaultKind);
  const [m, setM] = useState<Measurements | null>(null);
  const drawing = useStore((s) => s.committedShape);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const engine = new Engine(container, { onMeasure: setM });
    engineRef.current = engine;
    engine.setParams(selectSimParams(useStore.getState()));
    const unsub = useStore.subscribe((s) => engine.setParams({ ...selectSimParams(s), smoke: false, overlay: 'speed', probe: null }));
    const ro = new ResizeObserver(() => engine.resizeCanvas(container));
    ro.observe(container);
    engine.start();
    return () => {
      unsub();
      ro.disconnect();
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    let shape: ShapeSpec | null;
    if (kind === 'drawing') {
      shape = drawing && drawing.kind === 'freehand' ? drawing : null;
    } else {
      shape = makePrimitive(kind as Exclude<ShapeKind, 'freehand'>);
    }
    engine.setShape(shape);
  }, [kind, drawing]);

  void slot;

  return (
    <div className="compare-pane">
      <div className="compare-head">
        <span>{title}</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as ShapeKind | 'drawing')}>
          {PICKS.filter((p) => p.kind !== 'drawing' || (drawing && drawing.kind === 'freehand')).map((p) => (
            <option key={p.kind} value={p.kind}>{p.label}</option>
          ))}
        </select>
      </div>
      <div ref={ref} className="compare-canvas" />
      <div className="compare-stats">
        <div className="gauge">
          <span className="gauge-name">{da.drag}</span>
          <div className="gauge-bar"><div className="gauge-fill drag" style={{ width: `${Math.min(100, Math.abs(m?.dragN ?? 0) * 8)}%` }} /></div>
          <span className="gauge-val">{(m?.dragN ?? 0).toFixed(2)} <em>{da.perMeter}</em> · Cd {(m?.cd ?? 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export function CompareView() {
  return (
    <div className="compare-view">
      <Pane title={da.compareA} defaultKind="plate" slot="A" />
      <Pane title={da.compareB} defaultKind="teardrop" slot="B" />
    </div>
  );
}
