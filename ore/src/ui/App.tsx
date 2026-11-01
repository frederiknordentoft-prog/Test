import { useEffect, useState } from 'react';
import { useRoute } from './router';
import { Gate } from './Gate';
import { Lobby } from './Lobby';
import { Spike } from '../spike/Spike';
import { LookDev } from '../lookdev/LookDev';
import { Hud } from './Hud';

declare global {
  interface Window { __ORE_BOOT?: { skipGate?: boolean; hud?: boolean } }
}

export default function App() {
  const route = useRoute();
  const boot = window.__ORE_BOOT ?? {};
  const [open, setOpen] = useState(Boolean(boot.skipGate));
  const [hud, setHud] = useState(Boolean(boot.hud));
  const [hudExtra, setHudExtra] = useState<string | undefined>();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const toggleHud = () => setHud((h) => !h);
  return (
    <>
      {route === 'lobby' && <Lobby onLogoLong={toggleHud} />}
      {route === 'spike' && <Spike />}
      {route === 'lookdev' && <LookDev onLogoLong={toggleHud} onHudExtra={setHudExtra} />}
      {hud && <Hud extra={route === 'lookdev' ? hudExtra : undefined} />}
      {!open && <Gate onOpen={() => setOpen(true)} />}
    </>
  );
}
