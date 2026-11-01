import { go } from './router';
import { useLongPress } from './Hud';

export function Lobby({ onLogoLong }: { onLogoLong: () => void }) {
  const lp = useLongPress(onLogoLong);
  return (
    <div className="screen">
      <div className="scroll">
        <div className="lobby">
          <div className="lobby-head">
            <button className="logo no-touch-ui" aria-label="ØRE. Hold for debug-HUD" {...lp}>Ø<span>RE</span></button>
            <span className="phase-pill">Fase 0 · spike og look-dev</span>
          </div>
          <p className="lead">Det her er første fase. Se Fremtidsviften i tre varianter, og kør diagnosen, så vi ved, hvad Claude-appen tillader.</p>
          <button className="card" onClick={() => go('lookdev')}>
            <h2>Fremtidsviften · look-dev</h2>
            <p>FCK–Brøndby i en skitse af hele kampskærmen. Skift variant (A, B, C) og tidspunkt (27′ eller 70′), og tryk ▶ for at se viften leve.</p>
            <span className="go">Åbn look-dev ›</span>
          </button>
          <button className="card" onClick={() => go('spike')}>
            <h2>Diagnose</h2>
            <p>Tester worker, fonte, lyd, fps, CSP og gestusser i Claude-appen. Tryk "Kopiér rapport" og send den til mig i chatten.</p>
            <span className="go">Åbn diagnose ›</span>
          </button>
          <p className="foot">Prototype · fiktive kurser · ingen rigtige penge · hold på Ø for debug-HUD</p>
        </div>
      </div>
    </div>
  );
}
