import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FanRenderer, type Variant } from './FanRenderer';
import type { FanFrame } from './model';

/**
 * Hosts the fan. Two stacked canvases: a new picture is drawn into the hidden one and
 * cross-faded by CSS (compositor), so nothing redraws while data is unchanged.
 * The live head is a DOM element with a CSS breathing animation.
 */
export function FanView({ frame, variant, onBuild }: { frame: FanFrame; variant: Variant; onBuild?: (ms: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const a = useRef<HTMLCanvasElement>(null);
  const b = useRef<HTMLCanvasElement>(null);
  const r = useRef(new FanRenderer());
  const [front, setFront] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [head, setHead] = useState<{ x: number; y: number } | null>(null);
  const frontRef = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setSize({ w: Math.round(box.width), h: Math.round(box.height) });
    });
    ro.observe(el);
    const onFonts = () => setSize((s) => ({ ...s }));
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
    };
  }, []);

  useLayoutEffect(() => {
    const rr = r.current;
    if (size.w < 2) return;
    rr.setSize(size.w, size.h);
    rr.setFrame(frame);
    rr.setVariant(variant);
    const back = 1 - frontRef.current;
    const target = back === 0 ? a.current : b.current;
    if (!target) return;
    rr.renderTo(target);
    frontRef.current = back;
    setFront(back);
    setHead(rr.head());
    onBuild?.(rr.lastBuildMs);
  }, [frame, variant, size, onBuild]);

  return (
    <div ref={wrap} className="fan-wrap">
      <canvas ref={a} className={`fan no-touch-ui ${front === 0 ? 'on' : ''}`} aria-hidden={front !== 0} />
      <canvas ref={b} className={`fan no-touch-ui ${front === 1 ? 'on' : ''}`} aria-hidden={front !== 1} />
      {head && <span className="fan-head" style={{ transform: `translate(${head.x}px, ${head.y}px)` }} aria-hidden="true" />}
      <span className="sr-only" role="img" aria-label={`Fremtidsviften. FCK vinder koster ${Math.round(frame.asks[0])} øre. Af 100 simulerede fremtider ender ${frame.counts[0]} med FCK-sejr, ${frame.counts[1]} uafgjort og ${frame.counts[2]} med Brøndby-sejr.`} />
    </div>
  );
}
