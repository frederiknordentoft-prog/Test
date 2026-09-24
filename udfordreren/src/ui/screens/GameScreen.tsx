// Hovedskærmen: HUD øverst, pixelkontoret, faner med paneler, nyhedsticker, dialoger og toasts.
// Laptop/iPad (landskab): kontor til venstre, paneler til højre. Mobil (portræt): kontor øverst, faner nederst.
import { useEffect } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi, erDebug } from '../../store/uiStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { PANELER } from '../panels';
import { SIGNAL_DIALOGER, UI_DIALOGER } from '../dialogs/registry';
import OfficeCanvas from '../components/OfficeCanvas';
import { Btn, Faner, Ikon, Stat } from '../components/kit';
import { datoTekst, ugeTekst } from '../../sim/time';
import { mioKort, heltal } from '../format';
import { spillerKunderTotal } from '../../sim/customers';

function Hud() {
  const g = useGame((s) => s.game)!;
  const speed = useGame((s) => s.speed);
  const paused = useGame((s) => s.paused);
  const { setSpeed, togglePause } = useGame.getState();
  const aabn = useUi((s) => s.aabn);
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-line bg-panel px-3 py-2" data-testid="hud">
      <div className="min-w-0">
        <div className="truncate font-pixel text-sm font-bold text-gold">{g.firmaNavn}</div>
        <div className="tal text-xs text-muted" data-testid="dato">{datoTekst(g.uge)} · {ugeTekst(g.uge)}</div>
      </div>
      <Stat label="Kapital" vaerdi={mioKort(g.kapital)} farve={g.kapital < 0 ? 'var(--color-bad)' : 'var(--color-gold)'} ikon="penge" />
      <Stat label="Indsigt" vaerdi={heltal(g.indsigt)} farve="var(--color-cyan)" ikon="indsigt" />
      <Stat label="Hype" vaerdi={heltal(g.hype)} farve="var(--color-pink)" ikon="hype" />
      <Stat label="Kunder" vaerdi={heltal(spillerKunderTotal(g))} farve="var(--color-sky)" ikon="folk" />
      <div className="ml-auto flex items-center gap-1">
        <Btn lille variant={paused ? 'primaer' : 'sekundaer'} onClick={togglePause} ariaLabel={paused ? 'Fortsæt' : 'Pause'} testId="pause-knap">
          <Ikon navn={paused ? 'play' : 'pause'} />
        </Btn>
        {([1, 2, 4] as const).map((s) => (
          <Btn key={s} lille variant={speed === s ? 'primaer' : 'sekundaer'} onClick={() => setSpeed(s)} testId={`tempo-${s}`}>
            {s}x
          </Btn>
        ))}
        <Btn lille variant="ghost" onClick={() => aabn({ kind: 'gemIndlaes' })} ariaLabel="Gem og indlæs" testId="gem-knap">
          <Ikon navn="gem" />
        </Btn>
        <Btn lille variant="ghost" onClick={() => aabn({ kind: 'indstillinger' })} ariaLabel="Indstillinger" testId="indstillinger-knap">
          <Ikon navn="tandhjul" />
        </Btn>
        {erDebug() && (
          <Btn lille variant="ghost" onClick={() => aabn({ kind: 'debug' })} testId="debug-knap">
            DBG
          </Btn>
        )}
      </div>
    </header>
  );
}

function PauseBanner() {
  const paused = useGame((s) => s.paused);
  const grunde = useGame((s) => s.pauseGrunde);
  const dialoger = useGame((s) => s.dialoger.length);
  const fortsaet = useGame((s) => s.fortsaet);
  if (!paused || dialoger > 0) return null;
  return (
    <div className="anim-glid flex items-center justify-between gap-2 rounded-md border-2 border-line bg-gold px-3 py-1.5 text-line" data-testid="pause-banner">
      <span className="font-pixel text-sm font-bold uppercase">Pause{grunde.length ? ': ' + grunde.join(' · ') : ''}</span>
      <Btn lille variant="sekundaer" onClick={fortsaet} testId="fortsaet">
        <Ikon navn="play" /> Fortsæt
      </Btn>
    </div>
  );
}

function Ticker() {
  const nyheder = useGame((s) => s.game?.nyheder ?? []);
  const tekst = nyheder.slice(0, 8).map((n) => `${datoTekst(n.uge)}: ${n.tekst}`).join('   ◆   ');
  return (
    <div className="overflow-hidden whitespace-nowrap rounded-md border-2 border-line bg-bg2 py-1 text-sm text-muted" data-testid="ticker" aria-live="polite">
      <div className="inline-block pl-2">{tekst}</div>
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const fjern = useGame((s) => s.fjernToast);
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => fjern(toasts[0].id), 3500);
    return () => clearTimeout(t);
  }, [toasts, fjern]);
  return (
    <div className="pointer-events-none fixed right-3 bottom-20 z-40 flex flex-col items-end gap-2 sm:bottom-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-glid pointer-events-auto rounded-md border-2 border-line px-3 py-2 text-sm font-bold text-line pixel-skygge"
          style={{ background: t.kind === 'godt' ? 'var(--color-good)' : t.kind === 'skidt' ? 'var(--color-bad)' : 'var(--color-sky)' }}
          onClick={() => fjern(t.id)}
        >
          {t.tekst}
        </div>
      ))}
    </div>
  );
}

function DialogHost() {
  const dialoger = useGame((s) => s.dialoger);
  const lukDialog = useGame((s) => s.lukDialog);
  const uiDialog = useUi((s) => s.dialog);
  const luk = useUi((s) => s.luk);
  const foerste = dialoger[0];
  if (foerste) {
    const C = SIGNAL_DIALOGER[foerste.signal.k];
    if (!C) {
      queueMicrotask(() => lukDialog(foerste.id));
      return null;
    }
    return <C key={foerste.id} signal={foerste.signal} onLuk={() => lukDialog(foerste.id)} />;
  }
  if (uiDialog) {
    const C = UI_DIALOGER[uiDialog.kind];
    return <C dialog={uiDialog} onLuk={luk} />;
  }
  return null;
}

export default function GameScreen() {
  useGameLoop();
  const panel = useUi((s) => s.panel);
  const setPanel = useUi((s) => s.setPanel);
  const P = PANELER.find((p) => p.id === panel) ?? PANELER[0];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        useGame.getState().togglePause();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className="flex h-full flex-col" data-testid="spilskaerm">
      <Hud />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 lg:flex-row">
        <div className="flex shrink-0 flex-col gap-2 lg:w-[46%] lg:max-w-[760px]">
          <OfficeCanvas />
          <PauseBanner />
          <Ticker />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <Faner className="order-last pb-[env(safe-area-inset-bottom)] lg:order-first" valg={PANELER.map((p) => ({ id: p.id, navn: p.navn, ikon: p.ikon }))} vaerdi={panel} onSkift={setPanel} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <P.komponent />
          </div>
        </div>
      </div>
      <DialogHost />
      <Toasts />
    </div>
  );
}
