// Mounts the Engine into a container div and wires store ↔ engine.
// The engine owns its own canvas + rAF loop; React never touches sim internals.

import { useEffect, useRef } from 'react';
import { Engine } from '../engine/Engine';
import { selectSimParams, useStore } from '../state/store';
import { da } from '../i18n/da';

export function TunnelCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const store = useStore;
    const engine = new Engine(container, {
      onMeasure: (m) => store.getState().setMeasure(m),
      onToast: () => store.getState().showToast(da.flowReset),
    });
    engineRef.current = engine;
    if (engine.backendKind === 'cpu') store.getState().showToast(da.cpuFallback);

    engine.setParams(selectSimParams(store.getState()));
    if (store.getState().committedShape) engine.setShape(store.getState().committedShape);

    let lastShape = store.getState().committedShape;
    const unsub = store.subscribe((s) => {
      engine.setParams(selectSimParams(s));
      if (s.committedShape !== lastShape) {
        lastShape = s.committedShape;
        engine.setShape(s.committedShape);
      }
    });

    const onResize = () => engine.resizeCanvas(container);
    const ro = new ResizeObserver(onResize);
    ro.observe(container);
    engine.start();

    return () => {
      unsub();
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return <div ref={ref} className="tunnel-canvas" aria-label="Vindtunnel-simulering" role="img" />;
}
