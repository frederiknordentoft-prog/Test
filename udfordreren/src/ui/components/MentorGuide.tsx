// Mentoren (spec 6.1): en garvet brancheveteran guider i tre trin. Lille kort, der ikke blokerer spillet.
// Desktop: under kontoret. Mobil: én linje lige over fanebjælken (kan foldes ud) — den dækker aldrig panelet.
// Efter tutorialen giver Knud af og til et kort råd ud fra spillets tilstand (kassen, runder, kontor, ledige folk,
// marketing). Rådene kan lukkes og vender kun tilbage efter et stykke tid, hvis de stadig gælder.
import { useEffect, useState, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Btn, Ikon } from './kit';
import { Portraet, VETERAN } from './ShellPortraet';
import { knudTip, mentorTrin, type KnudMaal, type MentorTrin } from '../lib/shellHjaelp';
import type { GameState } from '../../sim/types';

/** Et lukket råd vender tidligst tilbage efter så mange spiluger */
const TIP_PAUSE_UGER = 8;

function indhold(t: MentorTrin, mode: GameState['mode'] = 'normal'): { titel: string; tekst: string; knap: string; handling: () => void } {
  const ui = useUi.getState();
  switch (t.trin) {
    case 1:
      return {
        // New Game+-modes starter senere og med licensen på plads: så passer garagen og ventetiden ikke
        titel: mode === 'aiNative2026' ? 'Velkommen til 2026!' : mode === 'usa2018' ? 'Velkommen til 2018!' : 'Velkommen i garagen!',
        tekst:
          t.licensUger > 0
            ? `Licensen behandles i 12 uger (${t.licensUger} tilbage) — tag en kontraktopgave imens, så kassen ikke løber tør. Lad én blive hjemme: I skal også bygge jeres første produkt.`
            : 'Licensen er på plads. En kontraktopgave holder kassen varm, men lad én blive hjemme: I skal også bygge jeres første produkt.',
        knap: 'Vis opgaver',
        handling: () => ui.setPanel('kontrakter'),
      };
    case 2:
      if (t.del === 'start') {
        return {
          titel: 'Nu bygger I selv',
          tekst: t.optaget
            ? `Start jeres første produkt. ${t.optaget.navne} er på opgave i ${t.optaget.uger === 1 ? '1 uge' : `${t.optaget.uger} uger`} endnu — projektet går i gang, når de er tilbage.`
            : 'Start jeres første produkt. Vælg en type og et tema, der passer sammen — Spillerforum elsker et godt match.',
          knap: 'Nyt produkt',
          handling: () => ui.aabn({ kind: 'nytProdukt' }),
        };
      }
      if (t.tomFase && t.optaget) {
        return {
          titel: 'Projektet venter på holdet',
          tekst: `${t.optaget.navne} er på opgave i ${t.optaget.uger === 1 ? '1 uge' : `${t.optaget.uger} uger`} endnu, så ${t.faseNavn}-fasen står stille så længe. Tildel dem, når de er tilbage.`,
          knap: 'Vis opgaver',
          handling: () => ui.setPanel('kontrakter'),
        };
      }
      return {
        titel: 'Se boblerne stige',
        tekst: t.tomFase
          ? `Ingen arbejder på ${t.faseNavn}-fasen endnu. Tildel folk i hver fase, så point-boblerne begynder at stige.`
          : 'Tildel folk i hver fase: Koncept, Design, Teknik og Test. Test fjerner fejl, før anmelderne finder dem.',
        knap: t.tomFase ? 'Tildel folk' : 'Vis projektet',
        handling: () => (t.tomFase ? ui.aabn({ kind: 'tildel', projectId: t.projectId }) : ui.setPanel('projekter')),
      };
    case 3:
      return {
        titel: 'Klar til lancering!',
        tekst: t.kanLancere
          ? 'Lancér og få jeres første anmeldelse. Fire anmeldere giver hver op til 10 point.'
          : `Produktet er færdigtestet. ${t.grund ?? ''} Lancér, så snart I kan, og få jeres første anmeldelse.`,
        knap: 'Til lancering',
        handling: () => ui.setPanel('projekter'),
      };
  }
}

function gaaTil(maal: KnudMaal): void {
  const ui = useUi.getState();
  if (maal === 'nytProdukt') ui.aabn({ kind: 'nytProdukt' });
  else ui.setPanel(maal);
}

/** Kompakt linje (mobil): portræt, titel, handling og fold ud */
function Linje({ titel, knap, onHandling, onFoldUd, nr, onLuk, testId }: { titel: string; knap: string; onHandling: () => void; onFoldUd: () => void; nr?: number; onLuk?: () => void; testId: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-t-2 border-line bg-panel px-2 py-1" data-testid={testId}>
      <button type="button" onClick={onFoldUd} aria-label="Vis Knuds råd" data-testid="mentor-vis" className="relative flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left">
        <Portraet udseende={VETERAN} str={32} baggrund="var(--color-panel2)" className="h-8 w-8 shrink-0 rounded border-2 border-line" />
        <span className="min-w-0 flex-1">
          <span className="block font-pixel text-[0.6rem] font-bold uppercase tracking-wider text-muted">Knud{nr ? ` · trin ${nr}/3` : ' har et råd'}</span>
          <span className="block truncate text-sm font-bold text-ink">{titel}</span>
        </span>
      </button>
      <Btn variant="primaer" onClick={onHandling} testId="mentor-handling" className="shrink-0 px-2.5 text-sm">
        {knap} <Ikon navn="pil" str={12} />
      </Btn>
      {onLuk && (
        <Btn variant="ghost" onClick={onLuk} ariaLabel="Luk rådet" testId="knud-luk" className="w-[44px] shrink-0 px-0">
          <Ikon navn="kryds" str={12} />
        </Btn>
      )}
    </div>
  );
}

function Kort({
  titel, tekst, knap, onHandling, nr, fod, testId,
}: { titel: string; tekst: string; knap: string; onHandling: () => void; nr?: number; fod: ReactNode; testId: string }) {
  return (
    <aside data-testid={testId} aria-label="Mentoren" className="anim-glid relative shrink-0 rounded-lg border-2 border-line bg-panel pixel-skygge">
      <div className="flex gap-2.5 p-2 bred:p-2.5">
        <div className="shrink-0">
          <Portraet udseende={VETERAN} str={44} baggrund="var(--color-bg2)" className="h-9 w-9 rounded border-2 border-line bred:h-11 bred:w-11" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-pixel text-[0.68rem] font-bold uppercase tracking-wider text-muted">
              Knud · veteran {nr ? <span className="text-gold">trin {nr}/3</span> : <span className="text-gold">har et råd</span>}
            </p>
            {nr && (
              <div className="flex gap-1" aria-hidden>
                {[1, 2, 3].map((n) => (
                  <span key={n} className="h-2 w-2 rounded-[1px] border border-line" style={{ background: n <= nr ? 'var(--color-gold)' : 'var(--color-bg)' }} />
                ))}
              </div>
            )}
          </div>
          <p className="font-pixel text-sm font-bold text-ink">{titel}</p>
          <p className="mt-0.5 text-[0.78rem] leading-snug text-muted bred:text-[0.82rem]" data-testid="mentor-tekst">
            {tekst}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-b-md border-t-2 border-line bg-bg2 px-2 py-1.5">
        <Btn variant="primaer" onClick={onHandling} testId="mentor-handling" className="min-w-0 flex-1 truncate text-sm bred:flex-none bred:px-5">
          {knap} <Ikon navn="pil" str={12} />
        </Btn>
        {fod}
      </div>
    </aside>
  );
}

export default function MentorGuide({ kompakt = false }: { kompakt?: boolean }) {
  const g = useGame((s) => s.game);
  const aktiv = g?.mentor === 'aktiv';
  const harLanceret = g?.milepaele.foersteLancering !== undefined;
  const trin = g && aktiv ? mentorTrin(g) : null;
  const dialogAaben = useGame((s) => s.dialoger.length > 0);
  const afvist = useUi((s) => s.afvisteTips);
  // Mobil: én linje som standard (panelet skal have pladsen); desktop: hele kortet
  const [skjult, setSkjult] = useState(kompakt);

  // Første lancering er sket: mentoren trækker sig tilbage, når anmeldelsen er lukket
  useEffect(() => {
    if (!aktiv || !harLanceret || dialogAaben) return;
    const st = useGame.getState();
    if (st.dispatch({ t: 'setMentor', status: 'faerdig' })) st.toast('Mentoren: I klarer jer fint selv nu. Men kigger jeg forbi med et råd, så lyt efter.', 'godt');
  }, [aktiv, harLanceret, dialogAaben]);

  // ---------- Efter tutorialen: Knuds råd ----------
  // Sprang spilleren tutorialen over, siger Knud kun noget, når kassen er i fare
  if (g && (g.mentor === 'faerdig' || g.mentor === 'sprunget')) {
    const alleTip = knudTip(g);
    const tip = alleTip && (g.mentor === 'faerdig' || alleTip.id === 'minus' || alleTip.id === 'kasse') ? alleTip : null;
    const lukket = tip ? afvist[tip.id] : undefined;
    if (!tip || (lukket !== undefined && g.uge - lukket < TIP_PAUSE_UGER)) return null;
    const luk = () => useUi.getState().afvisTip(tip.id, g.uge);
    if (kompakt && skjult) {
      return <Linje titel={tip.titel} knap={tip.knap} onHandling={() => gaaTil(tip.maal)} onFoldUd={() => setSkjult(false)} onLuk={luk} testId="knud-tip" />;
    }
    return (
      <Kort
        titel={tip.titel}
        tekst={tip.tekst}
        knap={tip.knap}
        onHandling={() => gaaTil(tip.maal)}
        testId="knud-tip"
        fod={
          <>
            {kompakt && (
              <Btn variant="ghost" onClick={() => setSkjult(true)} ariaLabel="Minimér rådet" testId="mentor-skjul" className="w-[44px] px-0">
                <Ikon navn="ned" str={14} />
              </Btn>
            )}
            <Btn variant="ghost" onClick={luk} testId="knud-luk" className="px-2.5 text-sm bred:ml-auto">
              Tak, Knud
            </Btn>
          </>
        }
      />
    );
  }

  if (!aktiv || !trin || harLanceret) return null;
  const i = indhold(trin, g?.mode);
  const trinNr = trin.trin;

  if (skjult) {
    if (kompakt) return <Linje titel={i.titel} knap={i.knap} onHandling={i.handling} onFoldUd={() => setSkjult(false)} nr={trinNr} testId="mentor-linje" />;
    return (
      <button
        type="button"
        onClick={() => setSkjult(false)}
        data-testid="mentor-vis"
        aria-label="Vis mentorens råd"
        className="relative flex h-[44px] w-full shrink-0 items-center justify-start gap-2 rounded-lg border-2 border-line bg-panel2 px-2 hover:bg-hi"
      >
        <Portraet udseende={VETERAN} str={32} baggrund="var(--color-panel2)" className="h-7 w-7" />
        <span className="min-w-0 flex-1 truncate text-left text-sm text-muted">
          Knud har et råd til jer — <span className="font-bold text-ink">{i.titel}</span>
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-line bg-gold font-pixel text-[0.65rem] font-black text-line">{trinNr}</span>
      </button>
    );
  }

  return (
    <Kort
      titel={i.titel}
      tekst={i.tekst}
      knap={i.knap}
      onHandling={i.handling}
      nr={trinNr}
      testId="mentor"
      fod={
        <>
          <Btn variant="ghost" onClick={() => setSkjult(true)} ariaLabel="Minimér mentoren" testId="mentor-skjul" className="px-2.5 bred:ml-auto">
            <Ikon navn="ned" str={14} />
          </Btn>
          <Btn variant="ghost" onClick={() => useGame.getState().dispatch({ t: 'setMentor', status: 'sprunget' })} testId="mentor-spring" className="px-2.5 text-sm">
            Spring over
          </Btn>
        </>
      }
    />
  );
}
