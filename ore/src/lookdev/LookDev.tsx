import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTable, computeFrame, DERBY, END, SCENARIOS, type FanFrame } from './model';
import { FrameClient } from './frameClient';
import { VARIANTS, type Variant } from './FanRenderer';
import { FanView } from './FanView';
import { Andelsbar, Bundbjaelke, Instrumenthoved, Kampbaand, Maalvejret, PositionCard } from '../ui/kamp/Bands';

declare global {
  interface Window {
    __lookdev?: { set: (s: { variant?: Variant; scenario?: string; chrome?: boolean; now?: number }) => void; state: () => unknown };
  }
}

export function LookDev({ onLogoLong, onHudExtra }: { onLogoLong: () => void; onHudExtra: (s: string) => void }) {
  const tab = useMemo(() => buildTable(DERBY), []);
  const [variant, setVariant] = useState<Variant>('lyn');
  const [scId, setScId] = useState('27');
  const [now, setNow] = useState(27);
  const [playing, setPlaying] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [swaps, setSwaps] = useState<number | null>(null);
  const sc = SCENARIOS.find((s) => s.id === scId) ?? SCENARIOS[0];
  // First frame synchronously (one-off), later frames from the worker when one is available.
  const [frame, setFrame] = useState<FanFrame>(() => computeFrame(DERBY, tab, SCENARIOS[0], 27));
  const client = useRef<FrameClient | null>(null);
  const [mode, setMode] = useState('…');
  const latest = useRef(0);
  useEffect(() => {
    const c = new FrameClient();
    client.current = c;
    void c.init().then(setMode);
    return () => c.dispose();
  }, []);
  useEffect(() => {
    const c = client.current;
    if (!c || mode === '…') return;
    const ticket = ++latest.current;
    void c.compute(scId, now).then((f) => {
      if (ticket === latest.current) setFrame(f);
    });
  }, [scId, now, mode]);
  const prevIds = useRef<Set<number> | null>(null);
  const buildMs = useRef(0);

  // Index stability: how many of the 100 strands changed since the last refresh.
  useEffect(() => {
    const ids = new Set(frame.strands.map((s) => s.id));
    if (prevIds.current) {
      let changed = 0;
      ids.forEach((id) => {
        if (!prevIds.current?.has(id)) changed++;
      });
      setSwaps(changed);
    }
    prevIds.current = ids;
  }, [frame]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setNow((n) => (n + 1 >= END ? (setPlaying(false), END - 0.25) : n + 1)), 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  const onBuild = useCallback(
    (ms: number) => {
      buildMs.current = ms;
      onHudExtra(`${mode} · MC ${client.current?.lastMs.toFixed(0) ?? '–'} ms · lag ${ms.toFixed(1)} ms · skift ${swaps ?? '–'}/100`);
    },
    [onHudExtra, swaps, mode],
  );

  useEffect(() => {
    window.__lookdev = {
      set: (s) => {
        if (s.variant) setVariant(s.variant);
        if (s.scenario) {
          const n = SCENARIOS.find((x) => x.id === s.scenario);
          if (n) {
            setScId(n.id);
            setNow(n.now);
          }
        }
        if (typeof s.now === 'number') setNow(s.now);
        if (typeof s.chrome === 'boolean') setChrome(s.chrome);
        setPlaying(false);
      },
      state: () => ({ variant, scId, now, frameNow: frame.now, mode, mcMs: client.current?.lastMs, counts: frame.counts, ask: frame.asks[0], buildMs: buildMs.current, swaps }),
    };
  }, [variant, scId, now, frame, swaps, mode]);

  const cycleVariant = () => setVariant(VARIANTS[(VARIANTS.findIndex((v) => v.id === variant) + 1) % VARIANTS.length].id);
  const cycleScenario = () => {
    const n = SCENARIOS[(SCENARIOS.findIndex((s) => s.id === scId) + 1) % SCENARIOS.length];
    setScId(n.id);
    setNow(n.now);
    setPlaying(false);
  };
  const ask = Math.round(frame.asks[0]);
  const pnl = (510 * Math.max(1, ask - 2)) / 100 - (510 * 49) / 100;

  return (
    <div className="screen kamp">
      <Kampbaand frame={frame} onLogoLong={onLogoLong} />
      <Instrumenthoved frame={frame} />
      <div className="fan-slot">
        <FanView frame={frame} variant={variant} onBuild={onBuild} />
        {chrome && (
          <div className="ld-ctl">
            <button onClick={cycleVariant} aria-label="Skift variant">{VARIANTS.find((v) => v.id === variant)?.label}</button>
            <button onClick={cycleScenario} aria-label="Skift tidspunkt">{sc.id === scId && now === sc.now ? sc.label : `${Math.floor(now)}′`}</button>
            <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Afspil'}>{playing ? '❚❚' : '▶'}</button>
            {playing && swaps !== null && <span className="ld-swaps num">skift {swaps}/100</span>}
          </div>
        )}
      </div>
      <Andelsbar frame={frame} />
      <Maalvejret frame={frame} />
      <PositionCard frame={frame} />
      <Bundbjaelke pnl={pnl} />
    </div>
  );
}
