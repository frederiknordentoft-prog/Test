// Rod: titelskærm eller spilskærm. Indlæser indstillinger, sætter tekststørrelse/bevægelse på <html>
// og låser lyden op ved første tryk. En fejlgrænse omkring spilskærmen fanger fejl (fx en beskadiget save),
// så spillet aldrig ender som en tom skærm.
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useGame } from '../store/gameStore';
import { useUi } from '../store/uiStore';
import { hent } from '../store/persistence';
import { installerLydUnlock } from '../audio/sfx';
import TitleScreen from './screens/TitleScreen';
import GameScreen from './screens/GameScreen';
import { Btn, Ikon } from './components/kit';

function FejlSkaerm({ onNulstil }: { onNulstil: () => void }) {
  const [besked, setBesked] = useState<string | null>(null);
  const [travl, setTravl] = useState(false);
  const tilTitel = () => {
    useUi.setState({ dialog: null });
    useGame.getState().lukSpil();
    onNulstil();
  };
  const autosave = async () => {
    setTravl(true);
    const g = await hent('auto');
    setTravl(false);
    if (!g) {
      setBesked('Der er ingen brugbar autosave. Gå til titelskærmen og start forfra eller indlæs en anden fil.');
      return;
    }
    useUi.setState({ dialog: null });
    useGame.getState().indlaes(g);
    onNulstil();
  };
  return (
    <main className="flex min-h-full items-center justify-center bg-bg p-4" data-testid="fejlskaerm" role="alert">
      <div className="w-full max-w-md rounded-xl border-2 border-line bg-panel p-4 pixel-kant">
        <h1 className="flex items-center gap-2 font-pixel text-lg font-black uppercase text-bad">
          <Ikon navn="advarsel" farve="var(--color-bad)" indre="var(--color-line)" str={22} /> Noget gik galt med spillet
        </h1>
        <p className="mt-2 text-sm text-muted">
          Spillet stødte på data, det ikke kunne vise — måske en beskadiget eller for gammel gemt fil. Intet er slettet.
        </p>
        {besked && <p className="mt-2 text-sm font-bold text-warn">{besked}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn variant="primaer" onClick={tilTitel} testId="fejl-til-titel">
            <Ikon navn="doer" /> Til titelskærm
          </Btn>
          <Btn onClick={() => void autosave()} disabled={travl} testId="fejl-autosave">
            <Ikon navn="gem" /> Indlæs autosave
          </Btn>
        </div>
      </div>
    </main>
  );
}

class Fejlgraense extends Component<{ children: ReactNode }, { fejl: boolean }> {
  override state = { fejl: false };
  static getDerivedStateFromError(): { fejl: boolean } {
    return { fejl: true };
  }
  override componentDidCatch(e: Error, info: ErrorInfo): void {
    console.warn('Spillet fangede en fejl:', e, info.componentStack);
    // Stop tiden, så simulationen ikke kører videre bag fejlskærmen
    useGame.setState({ paused: true });
  }
  override render(): ReactNode {
    if (this.state.fejl) return <FejlSkaerm onNulstil={() => this.setState({ fejl: false })} />;
    return this.props.children;
  }
}

export default function App() {
  const harSpil = useGame((s) => s.game !== null);
  const tekst = useGame((s) => s.settings.tekstStoerrelse);
  const reduceret = useGame((s) => s.settings.reduceretBevaegelse);

  useEffect(() => {
    void useGame.getState().indlaesSettings();
    installerLydUnlock();
  }, []);

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.tekst = tekst;
    r.dataset.reduceret = reduceret ? '1' : '0';
  }, [tekst, reduceret]);

  // Nyt eller lukket spil: start med en ren brugerflade (ingen hængende dialog, første fane)
  useEffect(() => {
    useUi.setState({ dialog: null, panel: 'projekter' });
  }, [harSpil]);

  return harSpil ? (
    <Fejlgraense>
      <GameScreen />
    </Fejlgraense>
  ) : (
    <TitleScreen />
  );
}
