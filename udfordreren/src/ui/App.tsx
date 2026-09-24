import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import TitleScreen from './screens/TitleScreen';
import GameScreen from './screens/GameScreen';

export default function App() {
  const harSpil = useGame((s) => s.game !== null);
  const settings = useGame((s) => s.settings);
  useEffect(() => {
    void useGame.getState().indlaesSettings();
  }, []);
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.tekst = settings.tekstStoerrelse;
    r.dataset.reduceret = settings.reduceretBevaegelse ? '1' : '0';
  }, [settings.tekstStoerrelse, settings.reduceretBevaegelse]);
  return harSpil ? <GameScreen /> : <TitleScreen />;
}
