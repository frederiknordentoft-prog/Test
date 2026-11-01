import { useEffect, useMemo, useState } from 'react';
import { useRoute, type Route } from './router';
import { Gate } from './Gate';
import { Lobby } from './Lobby';
import { Spike } from '../spike/Spike';
import { Hud } from './Hud';
import { Kampen } from './kamp/Kampen';
import { Byg } from './byg/Byg';
import { Portefolje } from './portefolje/Portefolje';
import { Afregning } from './afregning/Afregning';
import { MatchStore } from '../state/match';
import { FREE_PLAY } from '../engine/director/timeline';
import { DEMO90, demoSegments } from '../engine/director/demo90';
import { DemoThumb } from './demo/DemoThumb';
import { HallenScreen } from './hallen/Hallen';
import { HallenStore } from '../state/hallen';

declare global {
  interface Window {
    __ORE_BOOT?: { skipGate?: boolean; hud?: boolean; mc?: 'auto' | 'main' };
    __ore?: { derby: MatchStore; demo: MatchStore | null; hallen: HallenStore };
  }
}

const MATCH_ROUTES: Route[] = ['kamp', 'byg', 'portefolje', 'afregning'];

export default function App() {
  const route = useRoute();
  const boot = window.__ORE_BOOT ?? {};
  const [open, setOpen] = useState(Boolean(boot.skipGate));
  const [hud, setHud] = useState(Boolean(boot.hud));
  const derby = useMemo(() => new MatchStore(FREE_PLAY, { mc: boot.mc }), [boot.mc]);
  const hallen = useMemo(() => new HallenStore(), []);
  const [demo, setDemo] = useState<MatchStore | null>(null);
  // Which match the Byg / Portefølje / Afregning screens show: the demo while it runs.
  const [active, setActive] = useState<'derby' | 'demo'>('derby');

  useEffect(() => {
    window.__ore = { derby, demo, hallen };
  }, [derby, demo, hallen]);

  // The derby and the hall run from the first tap: the lobby shows them live.
  useEffect(() => {
    if (!open) return;
    derby.start();
    hallen.start();
  }, [open, derby, hallen]);

  useEffect(() => {
    if (route === 'demo' && open) {
      const s = new MatchStore(DEMO90, { mc: boot.mc });
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
    return undefined;
  }, [route, open, boot.mc]);

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
      {route === 'demo' && demo && <DemoThumb store={demo} />}
      {route === 'byg' && <Byg store={store} />}
      {route === 'portefolje' && <Portefolje store={store} />}
      {route === 'afregning' && <Afregning store={store} />}
      {(route === 'hallen' || route === 'demo-hallen') && <HallenScreen store={hallen} demo={route === 'demo-hallen'} />}
      {hud && <Hud extra={isMatch || route === 'demo' ? `${store.mc.mode} · MC ${store.mc.lastMs.toFixed(0)} ms` : undefined} />}
      {!open && <Gate demo={route === 'demo' || route === 'demo-hallen'} onOpen={() => setOpen(true)} />}
    </>
  );
}
