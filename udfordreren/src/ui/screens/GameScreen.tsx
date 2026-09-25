// Hovedskærmen: HUD, ugeprogress, pixelkontoret, faner med paneler, nyhedsticker, mentor, dialoger og toasts.
// Bred (laptop/iPad landskab): kontor til venstre (~46 %), paneler til højre med fanebjælke øverst.
// Smal (mobil portræt): kompakt HUD, kontor øverst, scrollbart panel og fanebjælke i bunden.
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { clock, useGame, type Toast } from '../../store/gameStore';
import { useUi, erDebug, type PanelId } from '../../store/uiStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { useAutoFortsaet } from '../hooks/useAutoFortsaet';
import { useReduceretBevaegelse, useSmal } from '../hooks/useMedia';
import { useSignalSfx } from '../../audio/sfx';
import { PANELER } from '../panels';
import { SIGNAL_DIALOGER, UI_DIALOGER } from '../dialogs/registry';
import OfficeCanvas from '../components/OfficeCanvas';
import MentorGuide from '../components/MentorGuide';
import Horisont from '../components/ShellHorisont';
import TrendBadges from '../components/TrendBadges';
import { Btn, Ikon, type IkonNavn } from '../components/kit';
import { datoTekst, ugeIAar } from '../../sim/time';
import { mioKort, heltal } from '../format';
import { spillerKunderTotal } from '../../sim/customers';
import { naesteRunde } from '../../sim/investors';
import { aiLabAaben } from '../../sim/selectors';
import { risikoInfo } from '../lib/byHjaelp';
import { KONKURS_UGER } from '../../data/costs';
import { kassenRaekker } from '../lib/firmaHjaelp';
import { kontorKlar, synligeNyheder } from '../lib/shellHjaelp';
import { hudTilsynsMarked, tillidsMarkeder, tillidsOversigt } from '../lib/markedHjaelp';
import { MARKETS } from '../../data/markets';
import type { NewsItem } from '../../sim/types';

// ---------- HUD ----------

function useDelta(v: number, taerskel: number, uge: number): { id: number; d: number } | null {
  const [delta, setDelta] = useState<{ id: number; d: number } | null>(null);
  const forrige = useRef(v);
  const forrigeUge = useRef(uge);
  // Find ændringer
  useEffect(() => {
    const d = v - forrige.current;
    const spring = Math.abs(uge - forrigeUge.current) > 1; // indlæsning eller debug-hop: ingen "+12 mio"-pop
    forrige.current = v;
    forrigeUge.current = uge;
    if (spring || Math.abs(d) < taerskel) return;
    setDelta({ id: performance.now(), d });
  }, [v, taerskel, uge]);
  // Skjul chippen igen — sin egen timer pr. chip, så en ny uge uden ændring ikke lader den hænge
  useEffect(() => {
    if (!delta) return;
    const t = setTimeout(() => setDelta(null), 1500);
    return () => clearTimeout(t);
  }, [delta]);
  return delta;
}

function HudStat({
  ikon, label, kort, vaerdi, farve, titel, testId, delta, note,
}: {
  ikon: IkonNavn; label: string; kort?: string; vaerdi: string; farve: string; titel: string; testId: string;
  delta?: { id: number; tekst: string; god: boolean } | null;
  /** Vises i stedet for etiketten (fx "rækker ~9 uger" eller "minus 3/8 uger") — synligt, også på touch */
  note?: { tekst: string; farve: string } | null;
}) {
  // Med stor tekst er der ikke plads til etiketter i HUD'en på iPad-bredde; værdien og ikonet står tilbage (etiket i title)
  const storTekst = useGame((s) => s.settings.tekstStoerrelse !== 'normal');
  return (
    <div
      className="relative flex min-w-0 items-center gap-1 lg:max-w-[160px] lg:flex-auto lg:gap-1.5 lg:rounded-md lg:border-2 lg:border-line lg:bg-bg2 lg:px-1.5 lg:py-1 xl:gap-2 xl:px-2"
      title={titel}
      data-testid={testId}
    >
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={16} className={`shrink-0 ${storTekst ? 'max-lg:hidden' : ''}`} />
      <div className="flex min-w-0 flex-col leading-none">
        {note ? (
          <span
            className="order-2 mt-0.5 truncate text-[0.56rem] font-bold uppercase tracking-wide lg:order-1 lg:mt-0 lg:mb-0.5 lg:text-[0.62rem]"
            style={{ color: note.farve }}
            data-testid={`${testId}-note`}
          >
            {note.tekst}
          </span>
        ) : (
          <span
            className={`order-2 mt-0.5 truncate text-[0.56rem] uppercase tracking-wide text-dim lg:order-1 lg:mt-0 lg:mb-0.5 lg:text-[0.62rem] lg:text-muted ${storTekst ? 'lg:max-xl:hidden' : ''}`}
          >
            {kort ? (
              <>
                <span className="lg:hidden">{kort}</span>
                <span className="hidden lg:inline">{label}</span>
              </>
            ) : (
              label
            )}
          </span>
        )}
        <span className="tal order-1 truncate font-pixel text-[0.8rem] font-bold lg:order-2 lg:text-sm" style={{ color: farve }}>
          {vaerdi}
        </span>
      </div>
      {delta && (
        <span
          key={delta.id}
          className="anim-glid pointer-events-none absolute -bottom-3 left-4 z-10 rounded border-2 border-line px-1 font-pixel text-[0.65rem] font-black text-line"
          style={{ background: delta.god ? farve : 'var(--color-bad)' }}
          aria-hidden
        >
          {delta.tekst}
        </span>
      )}
    </div>
  );
}

function Hud() {
  const smal = useSmal();
  const ref = useRef<HTMLElement>(null);
  const firma = useGame((s) => s.game?.firmaNavn ?? '');
  const uge = useGame((s) => s.game?.uge ?? 0);
  // Under en anmeldelse/galla viser HUD'en tallene fra før, så afsløringen ikke bliver spoilet
  const frys = useGame((s) => s.hudFrys);
  const kapitalLive = useGame((s) => s.game?.kapital ?? 0);
  const indsigtLive = useGame((s) => s.game?.indsigt ?? 0);
  const hypeLive = useGame((s) => s.game?.hype ?? 0);
  const kunderLive = useGame((s) => (s.game ? spillerKunderTotal(s.game) : 0));
  const kapital = frys?.kapital ?? kapitalLive;
  const indsigt = frys?.indsigt ?? indsigtLive;
  const hype = frys?.hype ?? hypeLive;
  const kunder = frys?.kunder ?? kunderLive;
  // Flere licenser: vis det svageste marked (med advarsel), og alle markeder i tooltippen
  const tillidMarked = useGame((s) => (s.game ? hudTilsynsMarked(s.game) : 'dk'));
  const tillid = useGame((s) => s.game?.markeder[tillidMarked].tilsynstillid ?? 0);
  const tillidTrin = useGame((s) => s.game?.markeder[tillidMarked].sanktion.trin ?? 0);
  const antalLicenser = useGame((s) => (s.game ? tillidsMarkeder(s.game).length : 0));
  const tillidAlle = useGame((s) => (s.game ? tillidsOversigt(s.game) : ''));
  const minus = useGame((s) => s.game?.negativUger ?? 0);
  const raekker = useGame((s) => (s.game ? (kassenRaekker(s.game)?.uger ?? -1) : -1));
  const tendens = useGame((s) => (s.game ? Math.round((kassenRaekker(s.game)?.tendens ?? 0) * 1000) : 0));
  const storTekst = useGame((s) => s.settings.tekstStoerrelse !== 'normal');
  const speed = useGame((s) => s.speed);
  const paused = useGame((s) => s.paused);
  const aabn = useUi((s) => s.aabn);
  const { setSpeed, togglePause } = useGame.getState();
  const dKapital = useDelta(kapital, 0.05, uge);
  const dIndsigt = useDelta(indsigt, 1, uge);
  const tillidFarve = tillid >= 60 ? 'var(--color-good)' : tillid >= 40 ? 'var(--color-warn)' : 'var(--color-bad)';
  const debug = erDebug();

  // HUD'ens højde som CSS-variabel (toasts på mobil lægger sig lige under den)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const saet = () => document.documentElement.style.setProperty('--hud-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    saet();
    const ro = new ResizeObserver(saet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const kapitalNote =
    minus > 0
      ? { tekst: `Minus ${minus}/${KONKURS_UGER} uger`, farve: 'var(--color-bad)' }
      : raekker >= 0 && raekker < 104
        ? {
            tekst: `Rækker ~${raekker} uge${raekker === 1 ? '' : 'r'}`,
            farve: raekker < 12 ? 'var(--color-bad)' : raekker < 26 ? 'var(--color-warn)' : 'var(--color-muted)',
          }
        : null;
  const kapitalTitel =
    minus > 0
      ? `Kassen er i minus (${minus} uge${minus === 1 ? '' : 'r'}). Efter ${KONKURS_UGER} uger går firmaet konkurs.`
      : raekker >= 0
        ? `Kapital (mio. kr.). I bruger i snit ${Math.abs(tendens)} t. kr. mere, end der kommer ind, pr. uge — så rækker kassen ca. ${raekker} uger.`
        : 'Kapital (mio. kr.)';

  return (
    <header
      ref={ref}
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b-2 border-line bg-panel px-2 pt-[max(6px,env(safe-area-inset-top))] pb-1.5 bred:px-3 lg:flex-nowrap lg:gap-x-5 lg:py-2"
      data-testid="hud"
    >
      <div className="order-1 min-w-0 flex-1 lg:max-w-[230px] lg:min-w-[84px] lg:flex-initial">
        <div className={`font-pixel text-sm font-black text-gold ${storTekst ? 'line-clamp-2 break-words leading-tight' : 'truncate'}`} title={firma}>
          {firma}
        </div>
        <div className="tal truncate text-xs text-muted" data-testid="dato">
          {datoTekst(uge)}
          {!storTekst && <> · uge {ugeIAar(uge) + 1}</>}
        </div>
      </div>

      <div className="order-3 grid w-full grid-cols-[1.35fr_1fr_0.9fr_1.1fr_0.95fr] gap-1.5 lg:order-2 lg:flex lg:w-auto lg:min-w-0 lg:flex-1 lg:gap-2 xl:gap-3">
        <HudStat
          ikon={minus > 0 ? 'advarsel' : 'penge'}
          label="Kapital"
          vaerdi={mioKort(kapital)}
          farve={kapital < 0 ? 'var(--color-bad)' : 'var(--color-gold)'}
          titel={kapitalTitel}
          testId="hud-kapital"
          delta={dKapital && { id: dKapital.id, tekst: `${dKapital.d > 0 ? '+' : '−'}${mioKort(Math.abs(dKapital.d))}`, god: dKapital.d > 0 }}
          note={kapitalNote}
        />
        <HudStat
          ikon="indsigt"
          label="Indsigt"
          vaerdi={heltal(indsigt)}
          farve="var(--color-cyan)"
          titel="Indsigt: bruges på boost, træning og forskning"
          testId="hud-indsigt"
          delta={dIndsigt && { id: dIndsigt.id, tekst: `${dIndsigt.d > 0 ? '+' : '−'}${heltal(Math.abs(dIndsigt.d))}`, god: dIndsigt.d > 0 }}
        />
        <HudStat ikon="hype" label="Hype" vaerdi={heltal(hype)} farve="var(--color-pink)" titel="Hype (0-100): giver flere kunder ved lancering" testId="hud-hype" />
        <HudStat ikon="folk" label="Kunder" vaerdi={heltal(kunder)} farve="var(--color-sky)" titel="Aktive kunder i alt" testId="hud-kunder" />
        <HudStat
          ikon={tillid < 60 || tillidTrin > 0 ? 'advarsel' : 'skjold'}
          label={antalLicenser > 1 ? 'Tilsyn · lavest' : `Tilsyn ${MARKETS[tillidMarked].kort}`}
          kort="Tilsyn"
          vaerdi={antalLicenser > 1 ? `${MARKETS[tillidMarked].kort} ${heltal(tillid)}` : heltal(tillid)}
          farve={tillidFarve}
          titel={
            antalLicenser > 1
              ? `Tilsynstillid (0-100). Laveste vises: ${MARKETS[tillidMarked].navn}${tillidTrin > 0 ? ` (sanktionstrin ${tillidTrin})` : ''}. Alle: ${tillidAlle}`
              : `Tilsynstillid i ${MARKETS[tillidMarked].navn} (0-100)${tillidTrin > 0 ? ` · sanktionstrin ${tillidTrin}` : ''}`
          }
          testId="hud-tillid"
        />
      </div>

      <div className="order-2 ml-auto flex shrink-0 items-center gap-1 lg:order-3">
        <Btn
          variant={paused ? 'primaer' : 'sekundaer'}
          onClick={togglePause}
          ariaLabel={paused ? 'Fortsæt (mellemrum)' : 'Pause (mellemrum)'}
          title={paused ? 'Fortsæt (mellemrum)' : 'Pause (mellemrum)'}
          testId="pause-knap"
          className="w-[44px] px-0"
        >
          <Ikon navn={paused ? 'play' : 'pause'} />
        </Btn>
        {smal ? (
          <Btn
            onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}
            ariaLabel={`Tempo ${speed}x — tryk for at skifte`}
            testId="tempo-skift"
            className="w-12 px-0 font-pixel text-sm"
          >
            {speed}x
          </Btn>
        ) : (
          <div className="flex gap-0.5 rounded-md" role="group" aria-label="Tempo">
            {([1, 2, 4] as const).map((s) => (
              <Btn
                key={s}
                variant={speed === s ? 'primaer' : 'sekundaer'}
                onClick={() => setSpeed(s)}
                testId={`tempo-${s}`}
                ariaLabel={`Tempo ${s}x`}
                className="w-[44px] px-0 font-pixel text-sm"
              >
                {s}x
              </Btn>
            ))}
          </div>
        )}
        <Btn variant="ghost" onClick={() => aabn({ kind: 'gemIndlaes' })} ariaLabel="Gem og indlæs" title="Gem og indlæs" testId="gem-knap" className="w-[44px] px-0">
          <Ikon navn="gem" />
        </Btn>
        <Btn variant="ghost" onClick={() => aabn({ kind: 'indstillinger' })} ariaLabel="Indstillinger" title="Indstillinger" testId="indstillinger-knap" className="w-[44px] px-0">
          <Ikon navn="tandhjul" />
        </Btn>
        {debug && (
          <Btn variant="ghost" onClick={() => aabn({ kind: 'debug' })} ariaLabel="Debug" title="Debug" testId="debug-knap" className="w-[44px] px-0">
            <Ikon navn="bille" farve="var(--color-warn)" />
          </Btn>
        )}
      </div>
    </header>
  );
}

/** Tynd bar under HUD'en: hvor langt er vi i ugen? Opdateres via rAF uden React-rerender. */
function UgeProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const frosset = useGame((s) => s.paused || s.dialoger.length > 0);
  const menu = useUi((s) => s.dialog !== null);
  const paused = frosset || menu;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const p = clock.ugeMs > 0 ? Math.max(0, Math.min(1, (performance.now() - clock.sidsteTickMs) / clock.ugeMs)) : 0;
        el.style.transform = `scaleX(${p.toFixed(4)})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="h-[5px] shrink-0 border-b-2 border-line bg-bg2" data-testid="ugeprogress" aria-hidden>
      <div
        ref={ref}
        className="h-full origin-left"
        style={{ transform: 'scaleX(0)', background: paused ? 'var(--color-dim)' : 'linear-gradient(90deg, var(--color-gold), #ffe98a)' }}
      />
    </div>
  );
}

// ---------- Pause, ticker og toasts ----------

/** Pausebanneret ligger over toppen af kontoret (på mobil lige under HUD'en, så det altid er synligt) */
function PauseBanner({ placering = 'absolute inset-x-2 top-[40px]' }: { placering?: string }) {
  const paused = useGame((s) => s.paused);
  const grunde = useGame((s) => s.pauseGrunde);
  const dialoger = useGame((s) => s.dialoger.length);
  const slut = useGame((s) => !!s.game?.slut);
  const fortsaet = useGame((s) => s.fortsaet);
  const smal = useSmal();
  if (slut && dialoger === 0) {
    return (
      <div className={`anim-glid ${placering} z-10 flex items-center gap-2 rounded-md border-2 border-line bg-panel2 px-2.5 py-1.5 pixel-skygge`} data-testid="pause-banner">
        <Ikon navn="trofae" farve="var(--color-gold)" indre="var(--color-line)" />
        <span className="min-w-0 flex-1 font-pixel text-sm font-bold uppercase">Spillet er slut</span>
        <Btn variant="primaer" onClick={() => useGame.getState().lukSpil()} testId="til-titel">
          Til titelskærm
        </Btn>
      </div>
    );
  }
  if (!paused || dialoger > 0) return null;
  return (
    <div
      className={`anim-glid ${placering} z-10 flex items-center gap-2 rounded-md border-2 border-line bg-gold px-2.5 py-1 text-line pixel-skygge`}
      data-testid="pause-banner"
      role="status"
    >
      <Ikon navn="pause" farve="var(--color-line)" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="font-pixel text-sm font-black uppercase tracking-wide">Pause</div>
        <div className="line-clamp-2 text-xs font-bold">
          {grunde.length ? grunde.join(' · ') : smal ? 'Tiden står stille.' : 'Tiden står stille. Tryk mellemrum for at fortsætte.'}
        </div>
      </div>
      <Btn variant="sekundaer" onClick={fortsaet} testId="fortsaet" className="shrink-0">
        <Ikon navn="play" /> Fortsæt
      </Btn>
    </div>
  );
}

const NYHED_FARVE: Record<NonNullable<NewsItem['kind']> | 'ingen', { ikon: IkonNavn; farve: string }> = {
  firma: { ikon: 'firma', farve: 'var(--color-gold)' },
  konkurrent: { ikon: 'lyn', farve: 'var(--color-warn)' },
  marked: { ikon: 'kort', farve: 'var(--color-sky)' },
  verden: { ikon: 'globus', farve: 'var(--color-violet)' },
  ingen: { ikon: 'nyhed', farve: 'var(--color-muted)' },
};

function TickerPunkt({ n }: { n: NewsItem }) {
  const k = NYHED_FARVE[n.kind ?? 'ingen'];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 pr-8">
      <Ikon navn={k.ikon} farve={k.farve} indre="var(--color-line)" str={14} />
      <span className="tal font-pixel text-[0.7rem] font-bold text-dim">{datoTekst(n.uge)}</span>
      <span className="text-ink">{n.tekst}</span>
    </span>
  );
}

function Ticker() {
  const nyheder = useGame((s) => s.game?.nyheder);
  const uge = useGame((s) => s.game?.uge ?? 0);
  const dialogAaben = useGame((s) => s.dialoger.length > 0);
  const reduceret = useReduceretBevaegelse();
  const liste = synligeNyheder(nyheder, uge, dialogAaben).slice(0, 8);
  const noegle = liste[0] ? `${liste[0].uge}-${liste[0].tekst}` : 'tom';
  const tegn = liste.reduce((a, n) => a + n.tekst.length + 14, 0);
  const tid = Math.max(24, (tegn * 7.2) / 55); // ca. 55 px/s
  if (liste.length === 0) return null;
  return (
    <div
      className="shell-ticker relative flex h-8 shrink-0 items-center overflow-hidden rounded-md border-2 border-line bg-bg2 text-sm"
      data-testid="ticker"
      role="marquee"
      aria-label={`Seneste nyhed: ${liste[0].tekst}`}
    >
      <span className="z-10 flex h-full shrink-0 items-center gap-1 border-r-2 border-line bg-pink px-2 font-pixel text-[0.65rem] font-black uppercase text-line">
        <Ikon navn="nyhed" farve="var(--color-line)" indre="var(--color-pink)" str={12} />
        <span className="hidden sm:inline">Nyt</span>
      </span>
      {reduceret ? (
        <ul className="flex min-w-0 flex-1 gap-6 overflow-hidden whitespace-nowrap pl-2" data-testid="ticker-statisk">
          {liste.slice(0, 3).map((n, i) => (
            <li key={i} className="min-w-0 truncate first:shrink-0 first:max-w-full">
              <TickerPunkt n={n} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap" aria-hidden>
          <div key={noegle} className="shell-ticker-spor pl-3" style={{ '--ticker-tid': `${tid.toFixed(1)}s` } as CSSProperties}>
            <span className="inline-flex">
              {liste.map((n, i) => (
                <TickerPunkt key={i} n={n} />
              ))}
            </span>
            <span className="inline-flex">
              {liste.map((n, i) => (
                <TickerPunkt key={i} n={n} />
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const TOAST_STIL: Record<Toast['kind'], { ikon: IkonNavn; bg: string }> = {
  godt: { ikon: 'flueben', bg: 'var(--color-good)' },
  skidt: { ikon: 'advarsel', bg: 'var(--color-bad)' },
  info: { ikon: 'nyhed', bg: 'var(--color-sky)' },
};

function ToastKort({ t, smal, kompakt = false }: { t: Toast; smal: boolean; kompakt?: boolean }) {
  useEffect(() => {
    const id = setTimeout(() => useGame.getState().fjernToast(t.id), t.kind === 'skidt' ? 5000 : 3600);
    return () => clearTimeout(id);
  }, [t.id, t.kind]);
  const s = TOAST_STIL[t.kind];
  // Samme besked flere gange i træk (fx "Niveau 5!" for fire medarbejdere): én toast med ×N
  const antal = t.antal && t.antal > 1 ? (
    <span className="tal ml-1 shrink-0 rounded border-2 border-line bg-line/20 px-1 font-pixel text-[0.7rem] font-black" data-testid="toast-antal">
      ×{t.antal}
    </span>
  ) : null;
  if (smal) {
    // Mobil: toasten fanger ikke tryk (knapperne under den virker stadig) — kun det lille kryds kan trykkes
    return (
      <div
        className="anim-glid pointer-events-none flex w-full items-center gap-2 rounded-md border-2 border-line py-0.5 pr-0.5 pl-3 text-left text-sm font-bold text-line pixel-skygge"
        style={{ background: s.bg }}
        data-testid="toast"
        role="status"
      >
        <Ikon navn={s.ikon} farve="var(--color-line)" str={14} className="shrink-0" />
        <span className="min-w-0 flex-1 py-1.5 leading-snug">
          {t.tekst}
          {antal}
        </span>
        <button
          type="button"
          className="pointer-events-auto flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded"
          onClick={() => useGame.getState().fjernToast(t.id)}
          aria-label="Luk besked"
          data-testid="toast-luk"
        >
          <Ikon navn="kryds" farve="var(--color-line)" str={12} />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`anim-glid pointer-events-auto flex items-center gap-2 rounded-md border-2 border-line px-3 py-2 text-left text-sm font-bold text-line pixel-skygge ${
        kompakt ? 'max-w-[min(300px,calc(100vw-24px))]' : 'max-w-[min(420px,calc(100vw-24px))]'
      }`}
      style={{ background: s.bg }}
      onClick={() => useGame.getState().fjernToast(t.id)}
      data-testid="toast"
    >
      <Ikon navn={s.ikon} farve="var(--color-line)" str={14} className="shrink-0" />
      <span>{t.tekst}</span>
      {antal}
    </button>
  );
}

function udvaelgToasts(alle: Toast[], n: number): Toast[] {
  const valgt = new Set<number>();
  for (const t of [...alle].reverse()) if (valgt.size < n && t.kind === 'skidt') valgt.add(t.id);
  for (const t of [...alle].reverse()) if (valgt.size < n) valgt.add(t.id);
  return alle.filter((t) => valgt.has(t.id));
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const smal = useSmal();
  const signalDialog = useGame((s) => s.dialoger.length > 0);
  const menu = useUi((s) => s.dialog !== null);
  const dialogAaben = signalDialog || menu;
  // Pausebanneret ligger øverst på mobil: læg toasts under det, så Fortsæt ikke gemmes
  const banner = useGame((s) => (s.paused || !!s.game?.slut) && s.dialoger.length === 0);
  // Mens en signal-dialog er åben, venter ugens toasts (de vises, når dialogerne er lukket) — kun svar på noget,
  // spilleren selv gør i dialogen (fx en afvist handling), vises straks. Toasts dækker aldrig dialogens titel eller
  // lukkekryds: med en dialog åben ligger de nederst til venstre (bred) eller over dialogens fod (mobil).
  // Højst tre (mobil: to), advarsler først.
  const kandidater = signalDialog ? toasts.filter((t) => t.handling) : toasts;
  const vis = udvaelgToasts(kandidater, smal ? 2 : 3);
  return (
    <div
      className={`pointer-events-none fixed flex flex-col gap-2 ${
        dialogAaben
          ? smal
            ? 'right-3 bottom-[calc(96px+env(safe-area-inset-bottom))] left-3 z-[60] items-stretch'
            : 'bottom-4 left-3 z-[60] items-start'
          : smal
            ? `right-3 left-3 ${banner ? 'top-[calc(var(--hud-h,96px)+72px)]' : 'top-[calc(var(--hud-h,96px)+10px)]'} z-40 items-stretch`
            : 'right-3 bottom-[calc(80px+env(safe-area-inset-bottom))] left-3 z-40 items-end bred:left-auto bred:bottom-4'
      }`}
      aria-live="polite"
      data-testid="toasts"
    >
      {vis.map((t) => (
        <ToastKort key={t.id} t={t} smal={smal} kompakt={dialogAaben} />
      ))}
    </div>
  );
}

// ---------- Dialoger ----------

function DialogHost() {
  const dialoger = useGame((s) => s.dialoger);
  const lukDialog = useGame((s) => s.lukDialog);
  const uiDialog = useUi((s) => s.dialog);
  const luk = useUi((s) => s.luk);
  const foerste = dialoger[0];
  const C = foerste ? SIGNAL_DIALOGER[foerste.signal.k] : undefined;
  // Signal uden dialog i registeret: fjern den fra køen
  useEffect(() => {
    if (foerste && !C) lukDialog(foerste.id);
  }, [foerste, C, lukDialog]);
  const U = uiDialog ? UI_DIALOGER[uiDialog.kind] : undefined;
  // En brugeråbnet menu forbliver monteret (og bevarer sine valg) under en signal-dialog, der dukker op imens.
  // Signal-dialogen tegnes sidst og ligger derfor øverst; kun den øverste dialog reagerer på Escape.
  return (
    <>
      {U && uiDialog && <U key={uiDialog.kind} dialog={uiDialog} onLuk={luk} />}
      {foerste && C && <C key={foerste.id} signal={foerste.signal} gruppe={foerste.gruppe} onLuk={() => lukDialog(foerste.id)} />}
    </>
  );
}

// ---------- Fanebjælke ----------

/** Korte navne til smalle, brede layouts (fx iPad og telefon på langs) og til mobilens bundbjælke */
const KORT_NAVN: Partial<Record<string, string>> = {
  projekter: 'Projekt',
  personale: 'Folk',
  produkter: 'Produkt',
  kombinationer: 'Kombi',
  nyheder: 'Nyt',
  platform: 'Teknik',
};

type FaneBadge = { tekst: string; farve: string; hjaelp: string };
type FanePanel = (typeof PANELER)[number];

/** Badges og låse på fanerne (fælles for den brede bjælke og mobilens "Mere") */
function useFaner(): { synlige: FanePanel[]; badge: (id: PanelId) => FaneBadge | null; laast: (id: PanelId) => boolean } {
  const klar = useGame((s) => s.game?.projekter.filter((p) => p.klar).length ?? 0);
  const tilbud = useGame((s) => s.game?.kontraktTilbud.length ?? 0);
  // Firma: en runde er klar, eller der er råd til at flytte
  const firmaKlar = useGame((s) => (s.game ? naesteRunde(s.game).ok || kontorKlar(s.game) : false));
  // AI-lab: låst med en teaser før 2026; derefter et "!", indtil den første agent kører
  const aiAaben = useGame((s) => (s.game ? aiLabAaben(s.game) : false));
  const aiNy = useGame((s) => (s.game ? s.game.flags.includes('aktTo') && s.game.agenter.length === 0 : false));
  // Rivaler: et opkøbstilbud eller en sponsorauktion venter på svar
  const rivalSvar = useGame((s) => !!s.game && (s.game.opkoebstilbud !== null || s.game.sponsorAuktion !== null));
  // Byen: flere i gul og rød end hos en typisk udbyder (det koster tilsynstillid hvert kvartal)
  const byRoed = useGame((s) => {
    if (!s.game) return false;
    const n = risikoInfo(s.game).niveau;
    return n === 'hoej' || n === 'pres';
  });
  // Arkivet kan slås fra i indstillingerne: så forsvinder fanen
  const arkivTil = useGame((s) => s.settings.arkiv);
  const badge = (id: PanelId): FaneBadge | null => {
    if (id === 'projekter' && klar > 0) return { tekst: '!', farve: 'var(--color-good)', hjaelp: 'et produkt er klar til lancering' };
    if (id === 'kontrakter' && tilbud > 0) return { tekst: String(tilbud), farve: 'var(--color-sky)', hjaelp: `${tilbud} opgaver venter` };
    if (id === 'firma' && firmaKlar) return { tekst: '!', farve: 'var(--color-gold)', hjaelp: 'noget nyt venter' };
    if (id === 'ailab' && aiNy) return { tekst: '!', farve: 'var(--color-cyan)', hjaelp: 'laboratoriet er åbent' };
    if (id === 'konkurrenter' && rivalSvar) return { tekst: '!', farve: 'var(--color-warn)', hjaelp: 'et tilbud venter på svar' };
    if (id === 'by' && byRoed) return { tekst: '!', farve: 'var(--color-bad)', hjaelp: 'byen koster tilsynstillid' };
    return null;
  };
  const laast = (id: PanelId): boolean => id === 'ailab' && !aiAaben;
  return { synlige: PANELER.filter((p) => p.id !== 'arkiv' || arkivTil), badge, laast };
}

function FaneKnap({ p, valgt, badge, laast, onClick, kort, className, testId, ekstraLabel, mereMaerke }: {
  p: FanePanel; valgt: boolean; badge: FaneBadge | null; laast: boolean; onClick: () => void;
  /** 'bred': korte navne på smalle brede skærme; 'altid': altid kort (mobilens bundbjælke); 'aldrig': fulde navne */
  kort: 'bred' | 'altid' | 'aldrig';
  /** Højde, luft og skriftstørrelse (sættes her, så klasserne ikke konkurrerer) */
  className: string; testId?: string; ekstraLabel?: string;
  /** Mobil: panelet ligger under "Mere" — vis et lille gitter i hjørnet */
  mereMaerke?: boolean;
}) {
  const k = KORT_NAVN[p.id];
  const label = `${p.navn}${laast ? ' (låst til 2026)' : ''}${badge ? ` — ${badge.hjaelp}` : ''}${ekstraLabel ?? ''}`;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={valgt}
      aria-label={label}
      data-testid={testId ?? `fane-${p.id}`}
      onClick={onClick}
      className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-line font-pixel font-bold uppercase leading-none ${className} ${
        valgt ? 'bg-gold text-line pixel-skygge' : `bg-panel2 hover:bg-hi hover:text-ink ${laast ? 'text-dim' : 'text-muted'}`
      }`}
    >
      <Ikon navn={p.ikon} farve="currentColor" indre={valgt ? 'var(--color-gold)' : 'var(--color-panel2)'} str={18} />
      {kort === 'altid' || (kort === 'bred' && k) ? (
        kort === 'altid' ? (
          <span className="max-w-full truncate">{k ?? p.navn}</span>
        ) : (
          <>
            <span className="max-w-full truncate bred:max-2xl:hidden">{p.navn}</span>
            <span className="hidden max-w-full truncate bred:max-2xl:inline">{k}</span>
          </>
        )
      ) : (
        <span className="max-w-full truncate">{p.navn}</span>
      )}
      {badge ? (
        <span
          className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded border-2 border-line px-0.5 text-[0.6rem] font-black text-line"
          style={{ background: badge.farve }}
          data-testid={`fane-badge-${p.id}`}
        >
          {badge.tekst}
        </span>
      ) : laast ? (
        <span className="absolute -top-1.5 -right-1 flex h-5 w-5 items-center justify-center rounded border-2 border-line bg-panel" data-testid={`fane-laas-${p.id}`}>
          <Ikon navn="laas" farve="var(--color-muted)" str={10} />
        </span>
      ) : null}
      {mereMaerke && (
        <span className="absolute -top-1.5 -left-1 flex h-5 w-5 items-center justify-center rounded border-2 border-line bg-panel2" aria-hidden>
          <Ikon navn="mere" farve="var(--color-muted)" str={10} />
        </span>
      )}
    </button>
  );
}

function Fanebjaelke() {
  const smal = useSmal();
  return smal ? <MobilFaner /> : <BredFaner />;
}

/** Bred: alle faner i én række (to rækker à 7 under 1280 px) */
function BredFaner() {
  const panel = useUi((s) => s.panel);
  const setPanel = useUi((s) => s.setPanel);
  const { synlige, badge, laast } = useFaner();
  return (
    <div
      role="tablist"
      aria-label="Paneler"
      data-testid="fanebjaelke"
      className="grid shrink-0 auto-cols-fr grid-flow-col gap-1 max-xl:grid-flow-row max-xl:grid-cols-7"
    >
      {synlige.map((p) => (
        <FaneKnap
          key={p.id}
          p={p}
          valgt={p.id === panel}
          badge={badge(p.id)}
          laast={laast(p.id)}
          onClick={() => setPanel(p.id)}
          kort="bred"
          className="min-h-12 px-0 text-[0.68rem] tracking-wide max-xl:text-[0.56rem] max-xl:tracking-tighter"
        />
      ))}
    </div>
  );
}

/** Mobil: de fem vigtigste faner står fast i bunden; resten ligger i et ark under "Mere" */
const MOBIL_FASTE: PanelId[] = ['projekter', 'personale', 'kontrakter', 'hitliste', 'marked'];
/** Fra 2026 bytter Opgaver plads med AI-laboratoriet (Opgaver ligger stadig under "Mere") */
const MOBIL_FASTE_AI: PanelId[] = ['projekter', 'personale', 'hitliste', 'marked', 'ailab'];

function MobilFaner() {
  const panel = useUi((s) => s.panel);
  const setPanel = useUi((s) => s.setPanel);
  const aktTo = useGame((s) => !!s.game?.flags.includes('aktTo'));
  const { synlige, badge, laast } = useFaner();
  const [aaben, setAaben] = useState(false);
  const arkId = useId();
  const faste = aktTo ? MOBIL_FASTE_AI : MOBIL_FASTE;
  const fastePaneler = faste.map((id) => synlige.find((p) => p.id === id)).filter((p): p is FanePanel => !!p);
  const oevrige = synlige.filter((p) => !faste.includes(p.id));
  const valgtIMere = oevrige.find((p) => p.id === panel) ?? null;
  // "Mere" arver det første "!" fra fanerne derinde (tal-badges som ventende opgaver tæller ikke med)
  const mereBadge = oevrige.map((p) => badge(p.id)).find((b) => b?.tekst === '!') ?? null;

  useEffect(() => {
    if (!aaben) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAaben(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [aaben]);

  const vaelg = (id: PanelId) => {
    setPanel(id);
    setAaben(false);
  };

  return (
    <div className="relative z-40 shrink-0">
      {aaben && (
        <>
          <div className="fixed inset-0 z-30 bg-line/60" onClick={() => setAaben(false)} aria-hidden data-testid="fane-mere-bag" />
          <div
            id={arkId}
            role="tablist"
            aria-label="Flere paneler"
            data-testid="fane-mere-ark"
            className="anim-pop absolute inset-x-1.5 bottom-full z-40 mb-1.5 grid grid-cols-3 gap-1.5 rounded-lg border-2 border-line bg-panel p-2 pixel-kant"
          >
            {oevrige.map((p) => (
              <FaneKnap key={p.id} p={p} valgt={p.id === panel} badge={badge(p.id)} laast={laast(p.id)} onClick={() => vaelg(p.id)} kort="aldrig" className="min-h-14 px-1 text-[0.62rem] tracking-wide" />
            ))}
          </div>
        </>
      )}
      <div
        role="tablist"
        aria-label="Paneler"
        data-testid="fanebjaelke"
        className="relative z-40 grid grid-cols-6 gap-1 border-t-2 border-line bg-panel px-1.5 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]"
      >
        {fastePaneler.map((p) => (
          <FaneKnap key={p.id} p={p} valgt={p.id === panel} badge={badge(p.id)} laast={laast(p.id)} onClick={() => vaelg(p.id)} kort="altid" className="min-h-12 px-0.5 text-[0.6rem] tracking-tight" />
        ))}
        {valgtIMere ? (
          // Et panel fra "Mere" er valgt: knappen viser det, og et tryk åbner arket igen
          <FaneKnap
            p={valgtIMere}
            valgt
            badge={mereBadge}
            laast={laast(valgtIMere.id)}
            onClick={() => setAaben((a) => !a)}
            kort="altid"
            className="min-h-12 px-0.5 text-[0.6rem] tracking-tight"
            testId="fane-mere"
            ekstraLabel=" (under Mere — tryk for flere)"
            mereMaerke
          />
        ) : (
          <button
            type="button"
            role="tab"
            aria-selected={false}
            aria-expanded={aaben}
            aria-controls={aaben ? arkId : undefined}
            aria-label={`Mere: ${oevrige.map((p) => p.navn).join(', ')}${mereBadge ? ` — ${mereBadge.hjaelp}` : ''}`}
            data-testid="fane-mere"
            onClick={() => setAaben((a) => !a)}
            className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-line px-1 font-pixel text-[0.6rem] font-bold uppercase leading-none tracking-tight ${
              aaben ? 'bg-hi text-ink' : 'bg-panel2 text-muted hover:bg-hi hover:text-ink'
            }`}
          >
            <Ikon navn="mere" farve="currentColor" str={18} />
            <span className="max-w-full truncate">Mere</span>
            {mereBadge && (
              <span
                className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded border-2 border-line px-0.5 text-[0.6rem] font-black text-line"
                style={{ background: mereBadge.farve }}
                data-testid="fane-badge-mere"
              >
                {mereBadge.tekst}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Skærmen ----------

export default function GameScreen() {
  useGameLoop();
  useAutoFortsaet();
  useSignalSfx();
  const panel = useUi((s) => s.panel);
  const smal = useSmal();
  const P = PANELER.find((p) => p.id === panel) ?? PANELER[0];
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Ny fane: vis toppen af panelet (på mobil scroller hele kolonnen, så rul kun op til panelets start)
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const p = panelRef.current;
    if (smal && p) {
      const top = Math.max(0, p.offsetTop - 8);
      if (sc.scrollTop > top) sc.scrollTo?.({ top });
    } else sc.scrollTo?.({ top: 0 });
  }, [panel, smal]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || (t.closest('button, a, [role=tab]') && t.matches(':focus-visible')))) return;
      if (useGame.getState().dialoger.length > 0 || useUi.getState().dialog) return;
      e.preventDefault();
      useGame.getState().togglePause();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  if (smal) {
    // Mobil portræt: kun HUD og fanebjælke står fast. Kontor, ticker og panel scroller som én kolonne,
    // så panelet får hele skærmen, når man scroller ned (også med stor tekst).
    return (
      <div className="flex h-full flex-col overflow-hidden" data-testid="spilskaerm">
        <Hud />
        <UgeProgress />
        <div className="relative z-20 h-0">
          <PauseBanner placering="absolute inset-x-2 top-1.5" />
        </div>
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="spilkolonne">
          <div className="flex flex-col gap-2 p-2">
            <div className="relative mx-auto w-full max-w-[calc(34dvh*16/9)]" data-testid="kontor-ramme">
              <OfficeCanvas />
            </div>
            <TrendBadges kompakt />
            <Ticker />
            <div ref={panelRef} className="min-w-0 pb-2" role="tabpanel" data-testid="panelomraade">
              <P.komponent />
            </div>
          </div>
        </div>
        <MentorGuide kompakt />
        <Fanebjaelke />
        <DialogHost />
        <Toasts />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="spilskaerm">
      <Hud />
      <UgeProgress />
      <div className="flex min-h-0 flex-1 flex-row gap-3 p-3">
        <div className="flex min-h-0 w-[46%] max-w-[760px] shrink-0 flex-col gap-2 overflow-y-auto">
          <div className="relative mx-auto w-full" data-testid="kontor-ramme">
            <OfficeCanvas />
            <PauseBanner />
          </div>
          <MentorGuide />
          <Ticker />
          <Horisont />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <Fanebjaelke />
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2" role="tabpanel" data-testid="panelomraade">
            <P.komponent />
          </div>
        </div>
      </div>
      <DialogHost />
      <Toasts />
    </div>
  );
}
