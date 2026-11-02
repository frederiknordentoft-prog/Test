import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute, type Route } from './router';
import { Gate } from './Gate';
import { Lobby } from './Lobby';
import { Spike } from '../spike/Spike';
import { Hud } from './Hud';
import { Kampen } from './kamp/Kampen';
import { Byg } from './byg/Byg';
import { Portefolje } from './portefolje/Portefolje';
import { Afregning } from './afregning/Afregning';
import { Maal } from './maal/Maal';
import { Pulje } from './pulje/Pulje';
import { MatchStore } from '../state/match';
import { McClient } from '../engine/mc/client';
import { FREE_PLAY } from '../engine/director/timeline';
import { DEMO90, demoSegments } from '../engine/director/demo90';
import { DemoThumb } from './demo/DemoThumb';
import { HallenScreen } from './hallen/Hallen';
import { HallenStore } from '../state/hallen';

declare global {
  interface Window {
    __UDFALD_BOOT?: { skipGate?: boolean; hud?: boolean; mc?: 'auto' | 'main' };
    __udfald?: { derby: MatchStore; demo: MatchStore | null; hallen: HallenStore };
  }
}

const MATCH_ROUTES: Route[] = ['kamp', 'byg', 'maal', 'pulje', 'portefolje', 'afregning'];

export default function App() {
  const route = useRoute();
  const boot = window.__UDFALD_BOOT ?? {};
  const [open, setOpen] = useState(Boolean(boot.skipGate));
  const [hud, setHud] = useState(Boolean(boot.hud));
  const derby = useMemo(() => new MatchStore(FREE_PLAY, new McClient(boot.mc ?? 'auto')), [boot.mc]);
  const hallen = useMemo(() => new HallenStore(derby.book), [derby]);
  const [hallDemo, setHallDemo] = useState<HallenStore | null>(null);
  const [demo, setDemo] = useState<MatchStore | null>(null);
  const demoRef = useRef<MatchStore | null>(null);
  const prevRoute = useRef<Route>(route);
  // Which match the Byg / Portefølje / Afregning screens show: the demo while it runs.
  const [active, setActive] = useState<'derby' | 'demo'>('derby');

  useEffect(() => {
    window.__udfald = { derby, demo, hallen };
  }, [derby, demo, hallen]);

  // The derby and the hall run from the first tap: the lobby shows them live.
  useEffect(() => {
    if (!open) return;
    derby.start();
    hallen.start();
  }, [open, derby, hallen]);

  useEffect(() => {
    const prev = prevRoute.current;
    prevRoute.current = route;
    if (route === 'demo' && open && (!demoRef.current || (demoRef.current.sim.phase === 'closed' && prev === 'lobby'))) {
      demoRef.current?.dispose();
      const s = new MatchStore(DEMO90, new McClient(boot.mc ?? 'auto'));
      demoRef.current = s;
      s.demo = true;
      s.segments = demoSegments();
      s.start();
      setDemo(s);
      setActive('demo');
      return () => {
        // keep the finished demo around for Afregning; stop its clock only
      };
    }
    if (route === 'kamp') setActive('derby');
    if (route === 'demo-hallen' && open) {
      const h = new HallenStore(derby.book, { demo: true });
      h.start();
      setHallDemo(h);
      return () => h.stop();
    }
    return undefined;
  }, [route, open, boot.mc, derby]);

  useEffect(() => () => {
    derby.dispose();
    hallen.stop();
  }, [derby, hallen]);

  const store = active === 'demo' && demo ? demo : derby;
  const toggleHud = () => setHud((h) => !h);
  const isMatch = MATCH_ROUTES.includes(route);
  return (
    <>
      {route === 'lobby' && <Lobby derby={derby} hallen={hallen} onLogoLong={toggleHud} />}
      {route === 'spike' && <Spike />}
      {route === 'kamp' && <Kampen store={derby} onLogoLong={toggleHud} />}
      {route === 'demo' && demo && <Kampen store={demo} onLogoLong={toggleHud} />}
      {demo && active === 'demo' && demo.sim.phase !== 'closed' && <DemoThumb store={demo} />}
      {route === 'byg' && <Byg store={store} />}
      {route === 'maal' && <Maal store={store} />}
      {route === 'pulje' && <Pulje store={store} />}
      {route === 'portefolje' && <Portefolje store={store} />}
      {route === 'afregning' && <Afregning store={store} />}
      {route === 'hallen' && <HallenScreen store={hallen} demo={false} />}
      {route === 'demo-hallen' && hallDemo && <HallenScreen store={hallDemo} demo />}
      {hud && <Hud extra={isMatch || route === 'demo' ? `${store.mc.mode} · MC ${store.mc.lastMs.toFixed(0)} ms` : undefined} />}
      {!open && <Gate demo={route === 'demo' || route === 'demo-hallen'} onOpen={() => setOpen(true)} />}
    </>
  );
}
