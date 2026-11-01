import type { MatchStore } from '../../state/match';
import { go } from '../router';

/** Instruktørpanelet: fire events, change speed, open the demo and diagnostics. */
export function Director({ store, onClose, onLogoLong }: { store: MatchStore; onClose: () => void; onLogoLong: () => void }) {
  const b = (label: string, fn: () => void) => <button onClick={() => { fn(); onClose(); }}>{label}</button>;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet director" role="dialog" aria-label="Instruktørpanel">
        <h2>Instruktør</h2>
        <p className="tray-note">Hændelser sker ved næste kampsekund. Alt er fiktivt.</p>
        <div className="dir-grid">
          {b('Mål FCK', () => store.fire('goalF'))}
          {b('Mål BIF', () => store.fire('goalB'))}
          {b('Mål FCK + VAR', () => store.fire('var'))}
          {b('Rødt kort BIF', () => store.fire('red'))}
          {b('Hval 25.000 kr', () => store.fire('whale'))}
        </div>
        <h3>Hastighed</h3>
        <div className="dir-grid">
          {[1, 4, 16].map((s) => <button key={s} className={store.speed === s ? 'on' : ''} onClick={() => { store.speed = s; store.publish(); onClose(); }}>×{s}</button>)}
        </div>
        <div className="dir-grid">
          {b('Demo 90 sek.', () => go('demo'))}
          {b('Diagnose', () => go('spike'))}
          {b('Debug-HUD', onLogoLong)}
        </div>
      </div>
    </>
  );
}
