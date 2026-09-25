// Marked: alle 9 markeder som konsoller (spec 6.7, 6.9, 6.10). Øverst et pixelkort med status og jeres andel pr. marked;
// derunder det valgte markeds konsolkort (størrelse, afgift, strenghed, kanalisering, CAC, licenser), markedsandele,
// offshore og hvad der driver den, regulering, tilsynstillid med sanktionstrappen, det fælles marketingmix, bonus/VIP
// og offshore-fristelsen. Tunge udregninger samles i én useMemo pr. spilstate (dvs. pr. uge eller handling).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { AcqChannel, GameState, MarketId, Vertical } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Monogram, Panel, Tip, type IkonNavn } from '../components/kit';
import { Afsnit, Chip, Donut, FlagStribe, Maengde, Pips, Segment, type DonutDel } from '../components/FirmaDele';
import MarkedKort from '../components/MarkedKortCanvas';
import { DriverListe, PresLog, PresMaaler, SanktionsTrappe, TillidsSkala } from '../components/MarkedKortDele';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { VERTICALS } from '../../data/verticals';
import { CHANNELS, CHANNEL_IDS, type ChannelDef } from '../../data/acquisition';
import { BONUS_CHURN, BONUS_PCT, BONUS_TILGANG, VIP_ARPU, VIP_PCT } from '../../data/costs';
import { TRUST } from '../../data/trust';
import { BALANCE } from '../../data/balance';
import { OFFSHORE_AKTOER } from '../../data/competitors';
import { MAX_MARKETING_PR_KANAL } from '../../sim/actions';
import { offshoreRisikoPrAar } from '../../sim/offshore';
import {
  aarFor, aktiveMarkeder, datoTekst, effektivBonus, effektivCac, effektivVip, ejerInfo, kanalTilgaengelig, licensPris, licensStatus, regelEffekt, SANKTION_RISIKO, strenghedCac, tillidsPoster,
} from '../../sim/selectors';
import { mio, mioKort, heltal } from '../format';
import { alderTekst, naesteKvartalsmoede, procent, rensNote, tillidFarve, uger } from '../lib/firmaHjaelp';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { markedBeskrivelse } from '../lib/tvaersHjaelp';
import { aggressionsIndeks } from '../lib/konkurrentHjaelp';
import { rulIndISyne, rulTilTop } from '../lib/rul';
import { R8 } from '../../data/reactionRules';
import {
  DK_SMITTE, OFFSHORE_BRAND, OFFSHORE_FAKTOR, PRES_EFTER, PRES_TAERSKEL, SANKTION_TRIN, STATUS_INFO, VERTIKALER, afgiftSats, aggressivitet, aktiveRegler, blokeringer, effektivIndsatsAfgift, erMonopol,
  graaMarkedAar, kanalKunder, kanaliseringsMaal, kommendeRegler, kortData, loftRegel, lukketAf, markedStatus, markedsStoerrelse, markedsTrends, offshoreAndel,
  offshoreBrandEstimat, offshoreDrivere, presHistorik, spildtBudget, spillerMargin, useMarkedValg, type Stoerrelse,
} from '../lib/markedHjaelp';
import { rulleKant } from '../hooks/rulleKant';

const OEVRIGE = { navn: 'Øvrige licenserede', farve: '#4a5282', monogram: '+' };

const RISIKO: Record<ChannelDef['risiko'], { farve: string; ikon: IkonNavn; navn: string }> = {
  lav: { farve: 'var(--color-good)', ikon: 'skjold', navn: 'Lav risiko' },
  middel: { farve: 'var(--color-sky)', ikon: 'streg', navn: 'Middel risiko' },
  'middel-høj': { farve: 'var(--color-warn)', ikon: 'advarsel', navn: 'Middel-høj risiko' },
  høj: { farve: 'var(--color-bad)', ikon: 'advarsel', navn: 'Høj risiko' },
};

const tkr = (v: number) => `${heltal(v * 1000)} t. kr.`;
const fmtTal = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',').replace('-', '−');
const pr = (m: MarketId) => MARKETS[m].navn;

// ---------- Beregninger (én gang pr. spilstate og valgt marked) ----------

type KanalData = { cac: number | null; kunder: number; kunderHer: number; lukket: string | null; lukketAndre: MarketId[] };

function beregn(g: GameState, m: MarketId) {
  const aktive = aktiveMarkeder(g);
  const lukketI = (x: MarketId) => regelEffekt(g, x).lukket;
  const lukketHer = lukketI(m);
  const lukketAndre = Object.fromEntries(aktive.filter((x) => x !== m).map((x) => [x, lukketI(x)])) as Partial<Record<MarketId, AcqChannel[]>>;
  const kanaler = {} as Record<AcqChannel, KanalData>;
  for (const k of CHANNEL_IDS) {
    const kk = kanalKunder(g, k);
    kanaler[k] = {
      cac: effektivCac(g, k, m),
      kunder: kk.total,
      kunderHer: kk.prMarked[m] ?? 0,
      lukket: lukketHer.includes(k) ? (lukketAf(g, m, k) ?? 'En regel') : null,
      lukketAndre: (Object.keys(lukketAndre) as MarketId[]).filter((x) => lukketAndre[x]?.includes(k)),
    };
  }
  return {
    kort: kortData(g),
    stoerrelse: markedsStoerrelse(g, m),
    drivere: offshoreDrivere(g, m),
    offshore: offshoreAndel(g, m),
    kanaler,
    poster: tillidsPoster(g, m),
    estimat: offshoreBrandEstimat(g),
    aktive,
  };
}
type Vm = ReturnType<typeof beregn>;

// ---------- Hop til afsnit ----------

const SEKTIONER: { id: string; navn: string; ikon: IkonNavn }[] = [
  { id: 'konsol', navn: 'Konsol', ikon: 'kort' },
  { id: 'andele', navn: 'Andele', ikon: 'hitliste' },
  { id: 'offshore', navn: 'Offshore', ikon: 'globus' },
  { id: 'regler', navn: 'Regler', ikon: 'bog' },
  { id: 'tillid', navn: 'Tillid', ikon: 'skjold' },
  { id: 'marketing', navn: 'Marketing', ikon: 'hoejttaler' },
  { id: 'bonus', navn: 'Bonus/VIP', ikon: 'diamant' },
  { id: 'fristelsen', navn: 'Fristelsen', ikon: 'lyn' },
];

/** Rul til et afsnit — under pausebanneret, som på mobil ligger oven på toppen af scroll-kolonnen */
function hopTil(id: string, reduceret: boolean) {
  const el = document.getElementById(`marked-${id}`);
  if (el) rulTilTop(el, reduceret);
}

/** Flyt fokus til et element efter næste render (når knappen, der havde fokus, er væk) */
function fokusSenere(testId: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus({ preventScroll: true }));
}

function Hop() {
  const reduceret = useReduceretBevaegelse();
  return (
    <nav ref={rulleKant} className="shell-uden-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 @2xl:flex-wrap" aria-label="Hop til afsnit">
      {SEKTIONER.map((s) => (
        <button
          key={s.id}
          type="button"
          data-testid={`marked-hop-${s.id}`}
          onClick={() => hopTil(s.id, reduceret)}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-2 border-line bg-panel2 px-3 text-sm font-bold text-muted hover:bg-hi hover:text-ink"
        >
          <Ikon navn={s.ikon} farve="var(--color-gold)" indre="var(--color-line)" str={13} />
          {s.navn}
        </button>
      ))}
    </nav>
  );
}

// ---------- Konsolkortet ----------

function Nogletal({ label, children, titel, under }: { label: string; children: ReactNode; titel?: string; under?: ReactNode }) {
  return (
    <div className="min-w-0 rounded border-2 border-line bg-panel px-2 py-1.5" title={titel}>
      <div className="truncate text-[0.66rem] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 min-w-0">{children}</div>
      {under && <div className="mt-0.5 text-[0.66rem] leading-tight text-dim">{under}</div>}
    </div>
  );
}

function AfgiftTal({ g, m }: { g: GameState; m: MarketId }) {
  const ms = g.markeder[m];
  if (MARKETS[m].afgiftModel === 'indsats') {
    return (
      <span className="tal font-pixel text-sm font-bold text-ink">
        {procent(afgiftSats(g, m, 'betting'))} <span className="text-[0.66rem] text-muted">af indsats</span>
      </span>
    );
  }
  const b = afgiftSats(g, m, 'betting');
  const k = afgiftSats(g, m, 'kasino');
  return (
    <span className="tal font-pixel text-sm font-bold text-ink">
      {Math.abs(b - k) < 1e-6 ? procent(b) : `${procent(b)} / ${procent(k)}`}
      {ms.afgiftTillaeg !== 0 && <span className="text-[0.66rem] text-warn"> ({ms.afgiftTillaeg > 0 ? '+' : ''}{fmtTal(ms.afgiftTillaeg)} pp)</span>}
    </span>
  );
}

function StoerrelseTal({ st, offshore }: { st: Stoerrelse; offshore: number }) {
  return (
    <span className="tal font-pixel text-sm font-bold text-gold">
      {mio(st.total)}
      <span className="text-[0.66rem] text-dim">/år</span>
      <span className="block text-[0.66rem] font-normal text-muted">
        licens. {mio(st.licenseret).replace(' kr.', '')} · offshore {procent(offshore)}
      </span>
    </span>
  );
}

function TyskAfgift({ g }: { g: GameState }) {
  const eks: { v: Vertical; marginer: number[] }[] = [
    { v: 'betting', marginer: [0.07, 0.12] },
    { v: 'kasino', marginer: [0.04, 0.06] },
  ];
  const vis = (v: Vertical, margin: number) => {
    const a = effektivIndsatsAfgift(g, v, margin);
    return `${procent(margin)} margin ≈ ${procent(a, 0)} af BSI${a >= 0.9 - 1e-9 ? ' (loft)' : ''}`;
  };
  return (
    <div className="rounded-md border-2 border-line bg-panel px-2.5 py-2 text-sm" data-testid="indsatsafgift">
      <p className="flex items-center gap-1.5 font-pixel text-xs font-bold uppercase tracking-wide text-warn">
        <Ikon navn="penge" farve="var(--color-warn)" indre="var(--color-line)" str={13} /> Indsatsafgift
      </p>
      <p className="mt-1 text-muted">
        Tyskland beskatter <b className="text-ink">indsatsen</b>, ikke BSI: 5,3 % af alt, kunderne satser. Omregnet til BSI afhænger det af jeres margin —{' '}
        <b className="text-ink">jo højere margin, jo lavere effektiv afgift</b>.
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 text-xs">
        {eks.map(({ v, marginer }) => {
          const egen = spillerMargin(g, 'de', v);
          return (
            <li key={v} className="flex flex-wrap items-center gap-x-2">
              <span className="font-bold text-ink">{VERTICALS[v].kort}:</span>
              {marginer.map((mg) => (
                <span key={mg} className="tal text-muted">
                  {vis(v, mg)}
                </span>
              ))}
              {egen !== null && <span className="tal font-bold text-gold">Jeres: {vis(v, egen)}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Aabning({ g, m }: { g: GameState; m: MarketId }) {
  const def = MARKETS[m];
  const status = markedStatus(g, m);
  if (status === 'monopol') {
    return (
      <p className="flex items-start gap-1.5 text-sm text-muted">
        <Ikon navn="laas" farve="var(--color-muted)" str={13} className="mt-0.5 shrink-0" />
        Åbner aldrig: statens selskab har eneret, og {def.tilsyn} giver ingen licenser.
      </p>
    );
  }
  if (status === 'lukket' && def.aabnerUge !== null) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-bold text-sky" data-testid="marked-aabner">
        <Ikon navn="kalender" farve="var(--color-sky)" indre="var(--color-line)" str={13} className="shrink-0" />
        Åbner {datoTekst(def.aabnerUge)} · om {alderTekst(def.aabnerUge - g.uge)}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <Ikon navn="kalender" farve="var(--color-muted)" indre="var(--color-line)" str={12} className="shrink-0" />
      Åben for licenser siden {datoTekst(def.aabnerUge ?? g.markeder[m].aabnetUge ?? 0)}
    </p>
  );
}

function Konsolkort({ g, m, vm }: { g: GameState; m: MarketId; vm: Vm }) {
  const def = MARKETS[m];
  const ms = g.markeder[m];
  const status = markedStatus(g, m);
  const info = STATUS_INFO[status];
  const pris = licensPris(g, m);
  const trends = markedsTrends(g, m);
  const lukket = status === 'lukket';
  const monopol = status === 'monopol';
  // Lukkede markeder: vis størrelsen, som den ser ud ved åbningen
  const vedAabning = lukket && def.aabnerUge !== null && vm.stoerrelse.betting.total + vm.stoerrelse.kasino.total < 1e-6;
  const st = vedAabning && def.aabnerUge !== null ? markedsStoerrelse(g, m, def.aabnerUge) : vm.stoerrelse;
  const kanalisering = ms.aaben ? ms.kanalisering : 1 - (vm.offshore.betting + vm.offshore.kasino) / 2;
  const harVertikal = VERTIKALER.some((v) => ms.vertikaler[v].status !== 'ingen');
  // Suspenderet eller inddraget: ingen BSI her (sim-kernens tal er fra ugen før sanktionen)
  const ramt = ms.licens === 'inddraget' || ms.licens === 'suspenderet';
  const bsiUge = ramt ? 0 : ms.spillerBsiPrUge.betting + ms.spillerBsiPrUge.kasino;
  return (
    <section id="marked-konsol" className="scroll-mt-2 overflow-hidden rounded-lg border-2 border-line bg-bg2 pixel-skygge" data-testid={`konsol-${m}`}>
      <FlagStribe farver={def.farver} className={`h-2 rounded-none border-0 border-b-2 ${monopol || lukket ? 'grayscale-[60%]' : ''}`} />
      <div className="flex flex-col gap-2.5 p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded border-2 border-line bg-panel2 px-1.5 py-0.5 font-pixel text-sm font-black text-ink">{def.kort}</span>
            <div className="min-w-0">
              <h3 className="font-pixel text-base font-black uppercase leading-none tracking-wide">{def.navn}</h3>
              <p className="flex items-center gap-1 text-xs text-muted" data-testid="marked-tilsyn">
                <Ikon navn="skjold" farve="var(--color-muted)" indre="var(--color-line)" str={11} /> {def.tilsyn}
              </p>
            </div>
          </div>
          <Chip ikon={info.ikon} farve={info.farve} fyld={status === 'aktiv'}>
            {info.navn}
          </Chip>
        </div>
        <p className="text-xs text-dim">{markedBeskrivelse(m, g.uge)}</p>
        <Aabning g={g} m={m} />
        {monopol ? (
          <div className="grid grid-cols-2 gap-1.5 @xl:grid-cols-4">
            <Nogletal label="Gråt marked" titel="Onlinespil hos udenlandske sider (mio. kr. pr. år)">
              <span className="tal font-pixel text-sm font-bold text-muted">{mio(graaMarkedAar(g, m))}</span>
              <span className="text-[0.66rem] text-dim">/år</span>
            </Nogletal>
            <Nogletal label="Offshore">
              <span className="tal font-pixel text-sm font-bold text-muted">{procent(Math.max(vm.offshore.betting, vm.offshore.kasino), 0)}</span>
            </Nogletal>
            <Nogletal label={`Strenghed ${fmtTal(ms.strenghed)}/5`}>
              <Pips vaerdi={ms.strenghed} label="Strenghed" />
            </Nogletal>
            <Nogletal label="Jeres grå BSI/uge">
              <Maengde ikon="penge" farve={ms.offshoreBrandBsiPrUge > 0 ? 'var(--color-warn)' : 'var(--color-dim)'} className="text-sm">
                {ms.offshoreBrandBsiPrUge > 0 ? mio(ms.offshoreBrandBsiPrUge) : '—'}
              </Maengde>
            </Nogletal>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 @xl:grid-cols-4" data-testid="noegletal">
            {VERTIKALER.map((v) => (
              <Nogletal
                key={v}
                label={`${vedAabning ? 'Ved åbning' : 'Marked'} · ${VERTICALS[v].kort}`}
                titel="Hele markedets online-BSI pr. år (licenseret + offshore), uden ugens udsving"
              >
                <StoerrelseTal st={st[v]} offshore={vm.offshore[v]} />
              </Nogletal>
            ))}
            <Nogletal label={def.afgiftModel === 'indsats' ? 'Afgift (indsats)' : 'Afgift af BSI'} titel="Betting / kasino, hvis de er forskellige">
              <AfgiftTal g={g} m={m} />
            </Nogletal>
            <Nogletal label={`Strenghed ${fmtTal(ms.strenghed)}/5`} titel="Regler for bonus, grænser, reklame og KYC. Over 2 gør kunderne dyrere og mindre værd.">
              <Pips vaerdi={ms.strenghed} label="Strenghed" />
            </Nogletal>
            <Nogletal label="Kanalisering" titel="Andel af spillet, der foregår hos licenserede udbydere" under={`mål ${procent(def.kanaliseringMaal, 0)}${ms.aaben ? '' : ' · før åbning'}`}>
              <span className="tal font-pixel text-sm font-bold" style={{ color: kanalisering >= def.kanaliseringMaal ? 'var(--color-good)' : 'var(--color-warn)' }}>
                {procent(kanalisering, 1)}
              </span>
            </Nogletal>
            <Nogletal label="CAC-faktor" titel="Prisen pr. ny kunde i forhold til Danmark (før strenghed og konkurrence)" under={`strenghed ×${fmtTal(strenghedCac(ms.strenghed))}`}>
              <span className="tal font-pixel text-sm font-bold text-sky">×{fmtTal(def.cacFaktor)}</span>
            </Nogletal>
            {ms.licens === 'inddraget' ? (
              <Nogletal label="Licens" titel={`${def.tilsyn} har inddraget licensen for altid`} under="for altid">
                <span className="flex items-center gap-1 font-pixel text-sm font-bold text-bad" data-testid="licens-mistet">
                  <Ikon navn="kryds" farve="var(--color-bad)" str={12} className="shrink-0" /> Mistet
                </span>
              </Nogletal>
            ) : (
              <Nogletal label="Licens" titel="Gebyr og behandlingstid" under={harVertikal ? 'næste vertikal' : 'første licens i markedet'}>
                <span className="tal font-pixel text-sm font-bold text-gold">{mio(pris.gebyr)}</span>
                <span className="text-[0.66rem] text-muted"> · {uger(pris.uger)}</span>
              </Nogletal>
            )}
            <Nogletal label="Jeres kunder" under={`BSI ${mio(bsiUge)}/uge`}>
              <span className="flex flex-wrap gap-x-2">
                {VERTIKALER.map((v) => (
                  <Maengde key={v} ikon="folk" farve="var(--color-sky)" className="text-sm" titel={VERTICALS[v].navn}>
                    {heltal(ms.spillerKunder[v])}
                    <span className="text-[0.62rem] font-normal text-dim">{VERTICALS[v].kort.slice(0, 1)}</span>
                  </Maengde>
                ))}
              </span>
            </Nogletal>
          </div>
        )}
        {m === 'de' && <TyskAfgift g={g} />}
        {trends.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Trends i markedet lige nu" data-testid="marked-trends">
            {trends.map((t) => (
              <li key={t.id} className="flex min-w-0 items-center gap-1 rounded border-2 border-line bg-panel px-1.5 py-0.5 text-[0.72rem]">
                <Ikon navn="lyn" farve="var(--color-pink)" indre="var(--color-line)" str={11} className="shrink-0" />
                <b className="text-ink">{t.titel}</b>
                {t.effekt.length > 0 && <span className="text-muted">{t.effekt.join(', ')}</span>}
                <span className="text-dim">· til {datoTekst(t.slutUge)}</span>
              </li>
            ))}
          </ul>
        )}
        {!monopol && <Licenser g={g} m={m} />}
      </div>
    </section>
  );
}

// ---------- Licenser ----------

function Licenser({ g, m }: { g: GameState; m: MarketId }) {
  const ms = g.markeder[m];
  const def = MARKETS[m];
  const pris = licensPris(g, m);
  const st = licensStatus(g, m);
  const inddraget = ms.licens === 'inddraget';
  // Tastatur: "Søg licens" forsvinder, når ansøgningen er sendt — så flyttes fokus til licenskortet (ikke til <body>)
  const kort = useRef<Partial<Record<Vertical, HTMLDivElement | null>>>({});
  const soeg = (v: Vertical) => {
    if (!useGame.getState().dispatch({ t: 'applyLicense', market: m, vertical: v })) return;
    useGame.getState().toast(`Ansøgning sendt til ${def.tilsyn}!`, 'godt');
    requestAnimationFrame(() => kort.current[v]?.focus({ preventScroll: true }));
  };
  return (
    <div className="flex flex-col gap-2" id="marked-licenser" data-testid="licenser">
      <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
        {VERTIKALER.map((v) => {
          const vl = ms.vertikaler[v];
          const tilbage = vl.status === 'ansoegt' && vl.klarUge !== null ? Math.max(0, vl.klarUge - g.uge) : 0;
          const raad = g.kapital >= pris.gebyr;
          const grund = !st.ok ? st.grund : !raad ? `Ikke råd (${mio(pris.gebyr)})` : undefined;
          const suspenderet = !inddraget && vl.status === 'aktiv' && ms.licens === 'suspenderet';
          const status = inddraget ? 'inddraget' : suspenderet ? 'suspenderet' : vl.status;
          return (
            <div
              key={v}
              ref={(el) => {
                kort.current[v] = el;
              }}
              tabIndex={-1}
              role="group"
              aria-label={`${VERTICALS[v].navn} i ${def.navn}`}
              onKeyDown={(e) => {
                // Mellemrum på selve kortet (fx lige efter en ansøgning) må ikke starte tiden ved et uheld
                if (e.key === ' ' && e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2 outline-none focus-visible:ring-2 focus-visible:ring-gold"
              data-testid={`licens-${m}-${v}`}
            >
              <div className="flex items-center justify-between gap-2" data-testid={m === 'dk' ? `licens-${v}` : undefined}>
                <span className="flex items-center gap-1.5 font-pixel text-sm font-black">
                  <span className="h-3 w-3 rounded-sm border-2 border-line" style={{ background: VERTICALS[v].farve }} aria-hidden />
                  {VERTICALS[v].navn}
                </span>
                {status === 'inddraget' ? (
                  <Chip ikon="kryds" farve="var(--color-bad)" fyld>
                    Inddraget
                  </Chip>
                ) : status === 'suspenderet' ? (
                  <Chip ikon="pause" farve="var(--color-warn)" fyld>
                    Suspenderet
                  </Chip>
                ) : status === 'aktiv' ? (
                  <Chip ikon="flueben" farve="var(--color-good)" fyld>
                    Aktiv
                  </Chip>
                ) : status === 'ansoegt' ? (
                  <Chip ikon="ur" farve="var(--color-warn)">
                    {uger(tilbage)} tilbage
                  </Chip>
                ) : (
                  <Chip ikon="laas" farve="var(--color-muted)">
                    Ingen licens
                  </Chip>
                )}
              </div>
              {status === 'inddraget' && (
                <p className="flex items-start gap-1 text-xs text-bad" data-testid={`licens-mistet-${m}-${v}`}>
                  <Ikon navn="kryds" farve="var(--color-bad)" str={11} className="mt-0.5 shrink-0" />
                  Mistet for altid efter tilsynets gennemgang.
                </p>
              )}
              {status === 'ingen' && (
                <>
                  <p className="text-xs text-muted">{VERTICALS[v].beskrivelse}</p>
                  <div data-testid={m === 'dk' ? `soeg-licens-${v}` : undefined} className="flex">
                    <Btn variant="primaer" disabled={!!grund} title={grund} className="w-full" testId={`soeg-licens-${m}-${v}`} onClick={() => soeg(v)}>
                      <Ikon navn="noegle" farve="currentColor" indre="var(--color-gold)" str={14} /> Søg licens · {mio(pris.gebyr)} · {uger(pris.uger)}
                    </Btn>
                  </div>
                  {grund && (
                    <p className="flex items-start gap-1 text-xs text-muted" data-testid={`licens-grund-${m}-${v}`}>
                      <Ikon navn={st.ok ? 'penge' : 'laas'} farve="var(--color-dim)" indre="var(--color-line)" str={11} className="mt-0.5 shrink-0" />
                      {grund}
                      {!ms.aaben && def.aabnerUge !== null ? ` Åbner ${datoTekst(def.aabnerUge)}.` : ''}
                    </p>
                  )}
                </>
              )}
              {status === 'aktiv' && (
                <p className="text-xs text-muted">
                  {vl.klarUge !== null ? `Licens siden ${datoTekst(vl.klarUge)}. ` : ''}
                  {ms.spillerBsiPrUge[v] >= 0.0005 ? (
                    <>
                      Jeres BSI her: <b className="tal text-gold">{mioKort(ms.spillerBsiPrUge[v])}</b>/uge.
                    </>
                  ) : (
                    'Ingen BSI her lige nu — vælg markedet, når I starter et nyt produkt.'
                  )}
                </p>
              )}
              {status === 'ansoegt' && (
                <span className="h-2.5 overflow-hidden rounded-sm border border-line bg-bg" aria-hidden>
                  <span className="block h-full bg-warn" style={{ width: `${Math.max(4, 100 - (tilbage / Math.max(1, pris.uger)) * 100)}%` }} />
                </span>
              )}
              {status === 'suspenderet' && ms.suspenderetTil !== null && (
                <p className="text-xs text-warn">
                  Til {datoTekst(ms.suspenderetTil)} ({uger(ms.suspenderetTil - g.uge)}). Ingen BSI her så længe — kunderne kan ikke spille og siver væk imens.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {VERTIKALER.some((v) => ms.vertikaler[v].status !== 'aktiv') && !inddraget && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Ikon navn="folk" farve="var(--color-sky)" indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
          Kryds-salg: den første lancering i en ny vertikal tager {Math.round(BALANCE.krydsSalgStart * 100)} % af jeres eksisterende kunder med over. Et produkt kan
          lanceres i alle markeder, hvor vertikalen er søgt eller aktiv.
        </p>
      )}
    </div>
  );
}

// ---------- Markedsandele ----------

function Andele({ g, m }: { g: GameState; m: MarketId }) {
  const ms = g.markeder[m];
  const def = MARKETS[m];
  const andele = ms.andele;
  const noegler = Object.keys(andele);
  if (erMonopol(g, m)) {
    return <p className="text-sm text-muted">Monopolet har eneret på papiret, men langt det meste norske onlinespil sker på udenlandske sider. Der er ingen licenseret kage at dele.</p>;
  }
  if (!ms.aaben) {
    return <p className="text-sm text-muted">Kagen bages først, når {def.navn} åbner {def.aabnerUge !== null ? datoTekst(def.aabnerUge) : ''}. Så begynder kampen om andelene.</p>;
  }
  if (noegler.length === 0) return <p className="text-sm text-muted">Andelene tælles op efter den første uge.</p>;
  const konk = noegler.filter((k) => k !== 'spiller' && k !== 'offshore' && k !== 'oevrige').sort((a, b) => (andele[b] ?? 0) - (andele[a] ?? 0));
  const raekke = ['spiller', ...konk, 'oevrige', 'offshore'].filter((k) => andele[k] !== undefined);
  const info = (k: string) => (k === 'offshore' ? OFFSHORE_AKTOER : k === 'oevrige' ? OEVRIGE : ejerInfo(g, k));
  const dele: DonutDel[] = raekke.map((k) => ({ id: k, navn: k === 'offshore' ? `${info(k).navn} (offshore)` : info(k).navn, andel: andele[k] ?? 0, farve: info(k).farve }));
  const spiller = andele.spiller ?? 0;
  return (
    <div className="flex flex-col items-center gap-3 @md:flex-row @md:items-start">
      <Donut
        dele={dele}
        str={148}
        midte={
          <>
            <span className="tal font-pixel text-lg font-black text-gold">{procent(spiller, 1)}</span>
            <span className="text-[0.62rem] uppercase text-muted">jeres andel</span>
          </>
        }
      />
      <ul className="grid w-full min-w-0 flex-1 grid-cols-1 gap-1 @xl:grid-cols-2" data-testid="andele-forklaring">
        {raekke.map((k) => {
          const i = info(k);
          return (
            <li key={k} className={`flex min-h-9 items-center gap-2 rounded border-2 px-1.5 py-1 ${k === 'spiller' ? 'border-gold bg-panel' : 'border-line bg-panel'}`}>
              <Monogram tekst={i.monogram} farve={i.farve} str={24} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {i.navn}
                {k === 'offshore' && <span className="text-dim"> · offshore</span>}
              </span>
              <span className="tal shrink-0 font-pixel text-xs font-bold">{procent(andele[k] ?? 0, 1)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Offshore i markedet ----------

function Offshore({ g, m, vm }: { g: GameState; m: MarketId; vm: Vm }) {
  const { poster, sum, trendPp } = vm.drivere;
  const def = MARKETS[m];
  const ms = g.markeder[m];
  // Norge følger sin egen model (monopol, og efter en evt. åbning flytter spillerne langsomt hjem)
  const monopol = m === 'no';
  return (
    <div className={`grid grid-cols-1 gap-2.5 ${monopol ? '' : '@2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] @2xl:items-start'}`}>
      <div className="flex flex-col gap-2">
        <div className={`grid grid-cols-1 gap-2 ${monopol ? '@lg:grid-cols-2' : '@lg:grid-cols-2 @2xl:grid-cols-1'}`}>
        {(['kasino', 'betting'] as Vertical[]).map((v) => {
          const a = vm.offshore[v];
          return (
            <div key={v} className="flex flex-col gap-1 rounded-md border-2 border-line bg-panel px-2 py-1.5" data-testid={`offshore-${v}`}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="h-3 w-3 rounded-sm border-2 border-line" style={{ background: VERTICALS[v].farve }} aria-hidden />
                  {VERTICALS[v].navn}
                </span>
                <span className="tal shrink-0 font-pixel text-sm font-black" style={{ color: a > 0.25 ? 'var(--color-bad)' : a > 0.1 ? 'var(--color-warn)' : 'var(--color-muted)' }}>
                  {procent(a, 1)}
                </span>
              </div>
              <span className="relative h-3 overflow-hidden rounded-sm border-2 border-line bg-bg" aria-hidden>
                <span className="absolute inset-y-0 left-0" style={{ width: `${a * 100}%`, background: OFFSHORE_AKTOER.farve }} />
              </span>
              <span className="text-[0.66rem] text-dim">
                spilles offshore. Trykket ganges med {fmtTal(OFFSHORE_FAKTOR[v])}
                {v === 'kasino' ? ' — kasino og high-rollers flytter først' : ''}
              </span>
            </div>
          );
        })}
        </div>
        {!monopol && (
          <p className="text-xs text-muted" data-testid="offshore-sum">
            Samlet tryk <b className="tal text-ink">{fmtTal(sum)} pp</b>: kasino ×{fmtTal(OFFSHORE_FAKTOR.kasino)}, betting ×{fmtTal(OFFSHORE_FAKTOR.betting)}
            {Math.abs(trendPp) > 0.05 && (
              <>
                , plus <b className="tal text-pink">{trendPp > 0 ? '+' : ''}{fmtTal(trendPp)} pp</b> fra trends
              </>
            )}
            . Bedre licenserede produkter trækker spillerne hjem.
            {!ms.aaben && ' (Beregnet, som om markedet var åbent i dag.)'}
          </p>
        )}
      </div>
      {monopol ? (
        <Tip>
          {ms.aaben
            ? 'Norge har åbnet for licenser. Offshore-andelen falder fra næsten alt mod ca. 35 % over to år, efterhånden som spillerne flytter hjem til de licenserede.'
            : 'Monopolet har kun en lille del af onlinespillet; resten spilles på udenlandske sider, selv med betalingsblokering siden 2010 og DNS-blokering fra 2025. Det er den pulje, et offshore-brand kan fiske i.'}
        </Tip>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-1.5 font-pixel text-xs font-bold uppercase tracking-wide text-muted">
            <Ikon navn="spoergsmaal" farve="var(--color-muted)" str={12} /> Hvad driver offshore i {def.navn}?
          </p>
          <DriverListe poster={poster} />
        </div>
      )}
    </div>
  );
}

// ---------- Regulering ----------

function Regulering({ g, m }: { g: GameState; m: MarketId }) {
  const ms = g.markeder[m];
  const def = MARKETS[m];
  const kommende = kommendeRegler(g, m);
  const aktive = aktiveRegler(g, m);
  const blok = blokeringer(g, m);
  const agg = aggressivitet(g);
  const maal = kanaliseringsMaal(m);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2">
          <span className="font-pixel text-xs font-black uppercase">Politisk pres</span>
          <PresMaaler pres={ms.politiskPres} />
          <p className="text-xs text-muted">
            Ved {PRES_TAERSKEL} vedtages en ny regel, der træder i kraft efter 1-2 år, og presset starter forfra på {fmtTal(PRES_EFTER)}. Ellers falder
            det langsomt (−0,1 pr. kvartal).
          </p>
          <PresLog poster={presHistorik(g, m)} />
          <p className="flex items-start gap-1.5 text-xs" style={{ color: agg >= 4 ? 'var(--color-warn)' : 'var(--color-muted)' }} data-testid="aggressivitet">
            <Ikon navn={agg >= 4 ? 'advarsel' : 'hype'} farve={agg >= 4 ? 'var(--color-warn)' : 'var(--color-pink)'} indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
            <span>
              Presindeks (politikerne): <b className="tal">{agg}/4</b> — bonus + VIP + aggressive kanaler. Ved 4 eller mere presser I politikerne med +0,25 pr. kvartal i
              markeder, hvor I har licens. Tilsynets påbudsindeks (R8) er et andet tal: se Tilsynstillid.
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2" data-testid="blokering">
          <span className="font-pixel text-xs font-black uppercase">Blokering af ulovlige sider</span>
          <ul className="flex flex-col gap-1">
            {blok.map((b) => (
              <li key={b.id} className="flex items-start gap-1.5 text-sm">
                <span
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 border-line"
                  style={{ background: b.aktiv ? 'var(--color-good)' : 'var(--color-panel2)' }}
                >
                  <Ikon navn={b.aktiv ? 'flueben' : 'streg'} farve={b.aktiv ? 'var(--color-line)' : 'var(--color-dim)'} str={10} titel={b.aktiv ? 'Aktiv' : 'Ikke aktiv'} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={b.aktiv ? 'font-bold text-ink' : 'text-muted'}>{b.navn}</span>
                  {b.aktiv && b.fraUge !== null && b.fraUge > 0 && <span className="text-xs text-dim"> · siden {datoTekst(b.fraUge)}</span>}
                  <span className="block text-[0.68rem] text-dim">{b.note}</span>
                </span>
                {b.aktiv && <span className="tal shrink-0 font-pixel text-xs font-bold text-good">−{fmtTal(b.pp)} pp</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase">
          <Ikon navn="ur" farve="var(--color-warn)" indre="var(--color-line)" str={12} /> På vej
        </span>
        {kommende.length === 0 ? (
          <p className="text-sm text-muted">Ingen vedtagne regler på vej i {def.navn} lige nu.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="regler-paa-vej">
            {kommende.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 rounded border-2 border-line bg-panel px-2 py-1.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <b className="text-sm text-ink">{r.navn}</b>
                  <Chip ikon="kalender" farve="var(--color-warn)">
                    {datoTekst(r.uge)} · om {alderTekst(r.ugerTil)}
                  </Chip>
                  {r.tal && (
                    <Chip ikon={r.op ? 'op' : 'ned'} farve={r.op ? 'var(--color-bad)' : 'var(--color-good)'}>
                      <span className="tal" data-testid="regel-paa-vej-tal">{r.tal}</span>
                    </Chip>
                  )}
                  <span className="text-[0.66rem] uppercase text-dim">{r.dynamisk ? 'Nyt politisk indgreb' : 'Vedtaget'}</span>
                </span>
                <span className="text-xs text-muted">{r.beskrivelse}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase">
          <Ikon navn="bog" farve="var(--color-sky)" indre="var(--color-line)" str={12} /> Gældende regler
        </span>
        {aktive.length === 0 ? (
          <p className="text-sm text-muted">Ingen særlige regler ud over grundreglerne (strenghed {fmtTal(ms.strenghed)}/5).</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="regler-aktive">
            {aktive.map((r) => (
              <li key={r.id} className="rounded border-2 border-line bg-panel px-2 py-1.5">
                <b className="text-sm text-ink">{r.navn}</b>
                <span className="block text-xs text-muted">{r.beskrivelse}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {maal !== undefined && (
        <p className="flex items-start gap-1.5 text-xs text-muted" data-testid="kanaliseringsmaal">
          <Ikon navn="kort" farve="var(--color-muted)" indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
          <span>
            Kanaliseringsmål {procent(maal, 0)}. Ligger kanaliseringen under målet i to år, kommer der blokering (40 %) eller lempelse (20 %).
            {ms.lavKanaliseringUger > 0 && <b className="text-warn"> Under målet i {uger(ms.lavKanaliseringUger)}.</b>}
          </span>
        </p>
      )}
    </div>
  );
}

// ---------- Tilsynstillid ----------

/** Tilsynets påbudsindeks (R8): bonus + VIP + aggressive kanaler + høj intensitet + hyperpersonalisering, grænse 5 i 2 kvartaler */
function PaabudsIndeks({ g, m, kompakt = false }: { g: GameState; m: MarketId; kompakt?: boolean }) {
  const ms = g.markeder[m];
  if (ms.licens !== 'aktiv') return null;
  const idx = aggressionsIndeks(g, m);
  const kv = g.aggressionKvartaler[m] ?? 0;
  const over = idx.total >= idx.taerskel;
  const farve = !over ? 'var(--color-good)' : kv >= R8.kvartaler - 1 ? 'var(--color-bad)' : 'var(--color-warn)';
  const status = over
    ? `${Math.min(kv, R8.kvartaler)} af ${R8.kvartaler} kvartaler over grænsen`
    : kv > 0
      ? `under grænsen igen (${kv} af ${R8.kvartaler} kvartaler talt)`
      : 'under grænsen';
  const naeste = over && kv >= R8.kvartaler - 1 ? `Står det stadig på ${idx.taerskel} eller mere ved næste kvartalsmøde, kommer påbuddet (tillid −6).` : null;
  if (kompakt) {
    return (
      <p className="flex items-start gap-1.5 text-xs" style={{ color: over ? farve : 'var(--color-muted)' }} data-testid="paabud-indeks-kort">
        <Ikon navn={over ? 'advarsel' : 'skjold'} farve={farve} indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
        <span>
          Påbudsindeks (R8) i {MARKETS[m].kort}: <b className="tal">{idx.total}/{idx.taerskel}</b> · {status}.{naeste ? ` ${naeste}` : ''}
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2" data-testid="paabud-indeks">
      <p className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase">
          <Ikon navn={over ? 'advarsel' : 'skjold'} farve={farve} indre="var(--color-line)" str={13} className="shrink-0" /> Påbudsindeks (R8)
        </span>
        <span className="tal font-pixel text-sm font-black" style={{ color: farve }}>
          {idx.total}/{idx.taerskel} · {status}
        </span>
      </p>
      <ul className="flex flex-wrap gap-1">
        {idx.dele.map((d) => (
          <li
            key={d.navn}
            className={`tal inline-flex items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 text-[0.7rem] font-bold ${d.v > 0 ? 'bg-bg2 text-ink' : 'bg-bg text-dim'}`}
          >
            <Ikon navn={d.v > 0 ? 'op' : 'streg'} farve={d.v > 0 ? 'var(--color-warn)' : 'var(--color-dim)'} str={10} />
            {d.navn} {d.v}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Ligger indekset på {idx.taerskel} eller mere ved {R8.kvartaler} kvartalsmøder i træk, giver {MARKETS[m].tilsyn} påbud (tillid −6), og hvert {R8.reglerEfter}. påbud strammer
        reglerne for hele branchen.{naeste ? <b className="text-bad"> {naeste}</b> : ''}
      </p>
    </div>
  );
}

function Tillid({ g, m, vm }: { g: GameState; m: MarketId; vm: Vm }) {
  const ms = g.markeder[m];
  const def = MARKETS[m];
  const t = ms.tilsynstillid;
  const farve = tillidFarve(t);
  const poster = vm.poster;
  const sum = poster.reduce((a, p) => a + p.vaerdi, 0);
  const kv = naesteKvartalsmoede(g.uge);
  // Kvartalets poster tæller kun med aktiv licens (under en suspension står tilliden stille, men trappen kan stadig gå op)
  const taeller = ms.licens === 'aktiv';
  if (erMonopol(g, m)) {
    return (
      <p className="text-sm text-muted">
        {def.tilsyn} giver ingen licens, så der er ingen tillid at passe på her. Men et offshore-brand koster {fmtTal(Math.abs(TRUST.offshoreBrand))} i tilsynstillid pr. kvartal i alle
        jeres andre markeder.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {/* flex-wrap + min-w-0: med stor tekst skal sanktionschippen kunne gå på ny linje i stedet for at skubbe siden bredere */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Ikon navn={t >= 60 ? 'skjold' : 'advarsel'} farve={farve} indre="var(--color-line)" str={22} />
          <span className="tal font-pixel text-3xl font-black leading-none" style={{ color: farve }} data-testid="tillid-vaerdi">
            {Math.round(t)}
          </span>
          <span className="text-xs leading-tight text-muted">
            <span className="block font-bold uppercase" style={{ color: farve }}>
              {t >= 60 ? 'God tillid' : t >= 40 ? 'Tilsynet holder øje' : 'Lav tillid'}
            </span>
            {def.tilsyn}
          </span>
          <Chip
            ikon={ms.sanktion.trin === 0 ? 'flueben' : 'advarsel'}
            farve={ms.sanktion.trin === 0 ? 'var(--color-good)' : SANKTION_TRIN[ms.sanktion.trin - 1].farve}
            fyld={ms.sanktion.trin > 0}
            className="max-w-full"
          >
            {ms.sanktion.trin === 0 ? 'Ingen sanktioner' : `Trin ${ms.sanktion.trin}: ${SANKTION_TRIN[ms.sanktion.trin - 1].navn}`}
          </Chip>
        </div>
        {taeller && (
          <span className="text-right text-xs text-muted">
            Næste kvartalsmøde om {uger(kv.uger)}
            <span
              className="tal block font-pixel text-sm font-black"
              style={{ color: sum > 0 ? 'var(--color-good)' : sum < 0 ? 'var(--color-bad)' : 'var(--color-muted)' }}
            >
              {sum > 0 ? '+' : sum < 0 ? '−' : '±'}
              {fmtTal(Math.abs(sum))}
            </span>
          </span>
        )}
      </div>
      <TillidsSkala vaerdi={t} testId="tillid-skala" />
      <SanktionsTrappe trin={ms.sanktion.trin} tillid={t} />
      <p className="text-xs text-muted">
        Under en grænse er der {Math.round(SANKTION_RISIKO * 100)} % risiko pr. kvartal for næste trin. Fire rolige kvartaler med tillid over 60 bringer trappen et trin ned
        {ms.sanktion.trin > 0 && ms.sanktion.trin < 4 && (
          <b className="tal text-ink"> ({ms.sanktion.roligeKvartaler}/4 rolige)</b>
        )}
        .
      </p>
      {ms.licens === 'suspenderet' && ms.suspenderetTil !== null && (
        <p className="flex items-center gap-1.5 rounded-md border-2 border-line bg-panel p-2 text-sm font-bold text-warn" data-testid="suspension">
          <Ikon navn="pause" farve="var(--color-warn)" str={14} className="shrink-0" />
          Licensen er suspenderet til {datoTekst(ms.suspenderetTil)} — {uger(ms.suspenderetTil - g.uge)} tilbage.
        </p>
      )}
      {ms.licens === 'inddraget' && (
        <p className="flex items-center gap-1.5 rounded-md border-2 border-line bg-panel p-2 text-sm font-bold text-bad">
          <Ikon navn="kryds" farve="var(--color-bad)" str={14} className="shrink-0" />
          {def.tilsyn} har inddraget licensen. {def.navn} er lukket land for jer.
        </p>
      )}
      {poster.length === 0 ? (
        <p className="text-sm text-muted">Intet trækker i tilliden lige nu.</p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="tillid-poster">
          {poster.map((p) => (
            <li key={p.tekst} className="flex items-center gap-2 rounded border-2 border-line bg-panel px-2 py-1 text-sm">
              <Ikon navn={p.vaerdi >= 0 ? 'op' : 'ned'} farve={p.vaerdi >= 0 ? 'var(--color-good)' : 'var(--color-bad)'} str={12} className="shrink-0" />
              <span className="min-w-0 flex-1">{p.tekst}</span>
              <span className="tal font-pixel text-xs font-bold" style={{ color: p.vaerdi >= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                {p.vaerdi > 0 ? '+' : '−'}
                {fmtTal(Math.abs(p.vaerdi))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <PaabudsIndeks g={g} m={m} />
      {ms.licens === 'suspenderet' ? (
        <p className="text-xs text-dim">Mens licensen er suspenderet, står tilliden stille — men falder den under {SANKTION_TRIN[3].graense}, kan licensen stadig blive inddraget.</p>
      ) : (
        !taeller && ms.licens !== 'inddraget' && <p className="text-xs text-dim">Tilliden regnes først, når licensen er aktiv.</p>
      )}
      {m === 'dk' && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Ikon navn="globus" farve="var(--color-violet)" indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
          Den danske licens smitter: mister I den, koster det {fmtTal(Math.abs(DK_SMITTE))} i tilsynstillid i alle andre markeder.
        </p>
      )}
    </div>
  );
}

// ---------- Marketingmix (fælles for alle markeder) ----------

function KanalRaekke({ g, k, m, d }: { g: GameState; k: AcqChannel; m: MarketId; d: KanalData }) {
  const def = CHANNELS[k];
  const [kladde, setKladde] = useState<string | null>(null);
  const nu = g.marketingMix[k] ?? 0;
  const aaben = kanalTilgaengelig(g, k);
  const r = RISIKO[def.risiko];
  const note = rensNote(def.note);
  const her = pr(m);
  const monopol = erMonopol(g, m);
  const saet = (v: number) => {
    const ny = Math.max(0, Math.min(MAX_MARKETING_PR_KANAL, Math.round(v * 1000) / 1000));
    if (Math.abs(ny - nu) < 1e-9) return;
    useGame.getState().dispatch({ t: 'setMarketing', channel: k, prUge: ny });
  };
  const gem = () => {
    if (kladde === null) return;
    const v = Number(kladde.replace(',', '.'));
    if (Number.isFinite(v)) saet(v / 1000);
    setKladde(null);
  };
  const tast = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') setKladde(null);
  };

  return (
    <li className={`@container flex flex-col gap-1.5 rounded-md border-2 border-line p-2 ${nu > 0 ? 'bg-panel' : 'bg-bg2'}`} data-testid={`kanal-${k}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-pixel text-sm font-black">{def.navn}</span>
        <Chip ikon={r.ikon} farve={r.farve}>
          {r.navn}
        </Chip>
        {def.aggressiv && (
          <Chip ikon="skjold" farve="var(--color-warn)" titel="Aggressive kanaler koster tilsynstillid, når de er i brug">
            {fmtTal(TRUST.aggressivKanal)} tillid/kvartal
          </Chip>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs">
          {monopol ? (
            <span className="text-dim">Ingen licens i {her}</span>
          ) : d.lukket ? (
            <span className="flex items-center gap-1 font-bold text-bad" data-testid={`kanal-${k}-lukket`}>
              <Ikon navn="laas" farve="var(--color-bad)" str={12} titel="Lukket" /> Lukket i {her}
            </span>
          ) : d.cac === null ? (
            <span className="text-muted">Fastholdelse</span>
          ) : (
            <span className="text-muted" title={`Pris pr. ny indbetalende kunde i ${her} lige nu`} data-testid={`kanal-${k}-cac`}>
              CAC i {MARKETS[m].kort} <b className="tal font-pixel text-ink">{heltal(d.cac)} kr.</b>
            </span>
          )}
        </span>
      </div>
      {!aaben ? (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Ikon navn="laas" farve="var(--color-dim)" str={14} className="shrink-0" />
          {aarFor(g.uge) < def.fraAar ? `Åbner fra ${def.fraAar}.` : 'Låst.'}
          {note && note !== '–' ? ` ${note.replace(/^Fra \d{4},\s*/, '').replace(/^./, (c) => c.toUpperCase())}` : ''}
        </p>
      ) : (
        <>
          {d.lukket && (
            <p className="flex items-start gap-1.5 text-xs text-bad">
              <Ikon navn="laas" farve="var(--color-bad)" str={12} className="mt-0.5 shrink-0" />
              {d.lukket} lukker kanalen i {her}. Budgettet virker stadig i jeres andre markeder.
            </p>
          )}
          {note && note !== '–' && <p className="text-xs text-dim">{note}</p>}
          <div className="grid grid-cols-4 items-center gap-1 @md:grid-cols-[auto_auto_auto_minmax(5rem,1fr)_auto_auto]">
            <Btn lille className="order-first min-h-[44px] min-w-[44px] px-1.5 @md:order-none" onClick={() => saet(0)} disabled={nu <= 0} testId={`kanal-${k}-nul`} ariaLabel={`${def.navn}: sæt til 0`}>
              0
            </Btn>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu - 0.1)} disabled={nu <= 0} testId={`kanal-${k}-minus100`} ariaLabel={`${def.navn}: −100 t. kr.`}>
              −100
            </Btn>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu - 0.01)} disabled={nu <= 0} testId={`kanal-${k}-minus10`} ariaLabel={`${def.navn}: −10 t. kr.`}>
              −10
            </Btn>
            <label className="relative order-first col-span-3 flex min-w-0 items-center @md:order-none @md:col-span-1">
              <span className="sr-only">{def.navn}: ugentligt forbrug i tusind kroner</span>
              <input
                type="text"
                inputMode="numeric"
                data-testid={`kanal-${k}-felt`}
                value={kladde ?? String(Math.round(nu * 1000))}
                onChange={(e) => setKladde(e.target.value.replace(/[^\d,.]/g, ''))}
                onBlur={gem}
                onKeyDown={tast}
                className="tal h-[44px] w-full min-w-0 rounded-md border-2 border-line bg-bg pr-7 pl-2 text-right font-pixel text-sm font-bold text-gold outline-none focus:border-gold"
              />
              <span className="pointer-events-none absolute right-1.5 text-[0.62rem] font-bold text-dim">t.kr</span>
            </label>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu + 0.01)} testId={`kanal-${k}-plus10`} ariaLabel={`${def.navn}: +10 t. kr.`}>
              +10
            </Btn>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu + 0.1)} testId={`kanal-${k}-plus100`} ariaLabel={`${def.navn}: +100 t. kr.`}>
              +100
            </Btn>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {k === 'crm' ? (
              <span>Sænker churn hos eksisterende kunder (op til −35 %).</span>
            ) : (
              <span>
                {nu > 0 ? (
                  <>
                    ≈ <b className="tal text-sky">{heltal(d.kunder)}</b> nye kunder/uge
                    {d.kunderHer > 0 && d.kunderHer < d.kunder - 0.5 && (
                      <span className="text-dim">
                        {' '}
                        (heraf {heltal(d.kunderHer)} i {MARKETS[m].kort})
                      </span>
                    )}
                  </>
                ) : (
                  'Slukket'
                )}
              </span>
            )}
            {def.hype > 0 && nu * def.hype >= 0.05 && <span className="text-pink">+{fmtTal(Math.min(4, nu * def.hype))} hype/uge</span>}
            <span className="text-dim">Halv effekt ved ca. {tkr(def.maetning)}/uge</span>
            {d.lukketAndre.length > 0 && (
              <span className="flex items-center gap-1 text-dim">
                <Ikon navn="laas" farve="var(--color-dim)" str={10} /> Lukket i {d.lukketAndre.map((x) => MARKETS[x].kort).join(', ')}
              </span>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function Marketing({ g, m, vm }: { g: GameState; m: MarketId; vm: Vm }) {
  const total = CHANNEL_IDS.reduce((a, k) => a + (kanalTilgaengelig(g, k) ? (g.marketingMix[k] ?? 0) : 0), 0);
  const nye = CHANNEL_IDS.reduce((a, k) => a + vm.kanaler[k].kunder, 0);
  const harLicens = vm.aktive.length > 0;
  const harProdukter = g.produkter.some((p) => p.ejer === 'spiller' && p.aktiv);
  const spild = spildtBudget(g);
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border-2 border-line bg-bg2 px-3 py-2 text-sm" data-testid="marketing-forklaring">
        <p className="flex items-center gap-1.5 font-pixel text-xs font-bold uppercase tracking-wide text-sky">
          <Ikon navn="folk" farve="var(--color-sky)" str={14} /> Sådan får I kunder
        </p>
        <p className="mt-1 text-muted">
          Et lanceret produkt trækker nogle kunder af sig selv (hype, anmeldelser, Top 10). Marketing køber flere: hver kanal har en pris pr. ny kunde (CAC), og
          effekten flader ud, jo mere I bruger. Budgettet deles mellem jeres aktive markeder efter deres størrelse, og CAC er forskellig fra land til land
          {erMonopol(g, m) ? '.' : (
            <>
              {' '}— her vises <b className="text-ink">{pr(m)}</b>.
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border-2 border-line bg-panel px-2 py-1.5 text-sm">
        <span className="text-muted">I alt</span>
        <Maengde ikon="penge" farve="var(--color-gold)">{mio(total)}/uge</Maengde>
        <Maengde ikon="folk" farve="var(--color-sky)">≈ {heltal(nye)} kunder/uge</Maengde>
        {vm.aktive.length > 1 && <span className="text-xs text-dim">fordelt på {vm.aktive.map((x) => MARKETS[x].kort).join(', ')}</span>}
      </div>
      {total > 0 && harLicens && harProdukter && spild.andel > 0.005 && (
        <p className="flex items-start gap-1.5 rounded-md border-2 border-line bg-panel p-2 text-sm text-warn" data-testid="marketing-spild">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
          <span>
            Ca. <b className="tal">{procent(spild.andel, 0)}</b> af budgettet ({mio(total * spild.andel)}/uge) går til {spild.markeder.map((x) => MARKETS[x].kort).join(', ')}, hvor I har licens,
            men intet lanceret produkt. De penge giver ingen kunder, før I lancerer dér.
          </span>
        </p>
      )}
      {total > 0 && (!harLicens || !harProdukter) && (
        <p className="flex items-start gap-1.5 rounded-md border-2 border-line bg-panel p-2 text-sm text-warn" data-testid="marketing-advarsel">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
          {!harLicens ? 'Ingen licens er aktiv endnu. Marketing koster, men giver ingen kunder, før en licens er godkendt.' : 'Uden et lanceret produkt giver marketing ingen nye kunder.'}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {CHANNEL_IDS.map((k) => (
          <KanalRaekke key={k} g={g} k={k} m={m} d={vm.kanaler[k]} />
        ))}
      </ul>
    </div>
  );
}

// ---------- Bonus og VIP (fælles, men loftet af regler pr. marked) ----------

function LoftLinje({ g, m, hvad, aktive }: { g: GameState; m: MarketId; hvad: 'bonus' | 'vip'; aktive: MarketId[] }) {
  const her = loftRegel(g, m, hvad);
  const andre = aktive.filter((x) => x !== m && loftRegel(g, x, hvad) !== null);
  if (!her && andre.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid={`${hvad}-loft`}>
      {her && (
        <Chip ikon="laas" farve="var(--color-warn)" titel={`${her.regel} i ${pr(m)}`}>
          {MARKETS[m].kort}: højst niveau {her.niveau} ({her.regel})
        </Chip>
      )}
      {andre.length > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted">
          <Ikon navn="laas" farve="var(--color-dim)" str={11} /> Også loftet i {andre.map((x) => MARKETS[x].kort).join(', ')}
        </span>
      )}
    </div>
  );
}

/** Prisen står under hvert bonus-/VIP-niveau, før man vælger det (fristelsen skal have et synligt prisskilt) */
function NiveauPris({ n, pris, tillid }: { n: number; pris: string; tillid: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5 leading-none">
      <span>{n}</span>
      <span className="tal font-sans text-[0.66rem] font-bold whitespace-nowrap opacity-85">
        {pris} · {tillid}
      </span>
    </span>
  );
}

function BonusVip({ g, m, vm }: { g: GameState; m: MarketId; vm: Vm }) {
  const b = g.bonusNiveau;
  const v = g.vipProgram;
  const niveauer = [0, 1, 2, 3] as const;
  // Kostprisen følger det effektive niveau i hvert marked (regler kan lofte det)
  let bonusKost = 0;
  let vipKost = 0;
  for (const x of MARKET_IDS) {
    const bsi = g.markeder[x].spillerBsiPrUge.betting + g.markeder[x].spillerBsiPrUge.kasino;
    if (bsi <= 0) continue;
    bonusKost += bsi * BONUS_PCT[effektivBonus(g, x)];
    vipKost += bsi * VIP_PCT[effektivVip(g, x)];
  }
  const effB = effektivBonus(g, m);
  const effV = effektivVip(g, m);
  // Påbudsindekset (R8) i det valgte marked — og andre markeder, der allerede er over grænsen
  const andreOver = vm.aktive.filter((x) => x !== m && g.markeder[x].licens === 'aktiv' && aggressionsIndeks(g, x).total >= R8.taerskel);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-pixel text-xs font-black uppercase">Velkomstbonus</span>
            <span className="text-xs text-muted">
              Niveau {b}
              {effB < b && <span className="text-warn"> · {effB} i {MARKETS[m].kort}</span>}
            </span>
          </div>
          <Segment
            label="Bonusniveau"
            valg={niveauer.map((n) => ({
              id: n,
              navn: n === 0 ? 'Fra' : <NiveauPris n={n} pris={procent(BONUS_PCT[n])} tillid={fmtTal(TRUST.bonusNiveau * n)} />,
              titel: n === 0 ? 'Ingen bonus' : `Niveau ${n}: +${Math.round(BONUS_TILGANG[n] * 100)} % tilgang, ${procent(BONUS_PCT[n])} af BSI, ${fmtTal(TRUST.bonusNiveau * n)} tilsynstillid pr. kvartal`,
            }))}
            vaerdi={b}
            onSkift={(n) => useGame.getState().dispatch({ t: 'setBonus', niveau: n })}
            testIdPrefix="bonus"
          />
          <div className="flex flex-wrap gap-1" data-testid="bonus-effekt">
            {b === 0 ? (
              <span className="text-xs text-muted">Ingen bonus. Kunderne kommer for produkterne.</span>
            ) : (
              <>
                <Chip ikon="folk" farve="var(--color-good)">+{Math.round(BONUS_TILGANG[b] * 100)} % tilgang</Chip>
                <Chip ikon="folk" farve="var(--color-good)">{Math.round(BONUS_CHURN[b] * 100)} % churn</Chip>
                <Chip ikon="penge" farve="var(--color-bad)">
                  {procent(BONUS_PCT[b])} af BSI{bonusKost > 0 ? ` ≈ ${mio(bonusKost)}/uge` : ''}
                </Chip>
                <Chip ikon="skjold" farve="var(--color-bad)">{fmtTal(TRUST.bonusNiveau * b)} tillid/kvartal</Chip>
              </>
            )}
          </div>
          <LoftLinje g={g} m={m} hvad="bonus" aktive={vm.aktive} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-pixel text-xs font-black uppercase">VIP-program</span>
            <span className="text-xs text-muted">
              Niveau {v}
              {effV < v && <span className="text-warn"> · {effV} i {MARKETS[m].kort}</span>}
            </span>
          </div>
          <Segment
            label="VIP-niveau"
            valg={niveauer.map((n) => ({
              id: n,
              navn: n === 0 ? 'Fra' : <NiveauPris n={n} pris={procent(VIP_PCT[n])} tillid={fmtTal(TRUST.vipProgram * n)} />,
              titel: n === 0 ? 'Intet VIP-program' : `Niveau ${n}: +${Math.round(VIP_ARPU[n] * 100)} % BSI pr. kunde, ${procent(VIP_PCT[n])} af BSI, ${fmtTal(TRUST.vipProgram * n)} tilsynstillid pr. kvartal`,
            }))}
            vaerdi={v}
            onSkift={(n) => useGame.getState().dispatch({ t: 'setVip', niveau: n })}
            testIdPrefix="vip"
          />
          <div className="flex flex-wrap gap-1" data-testid="vip-effekt">
            {v === 0 ? (
              <span className="text-xs text-muted">Intet VIP-program. Alle kunder behandles ens.</span>
            ) : (
              <>
                <Chip ikon="diamant" farve="var(--color-good)">+{Math.round(VIP_ARPU[v] * 100)} % BSI pr. kunde</Chip>
                <Chip ikon="penge" farve="var(--color-bad)">
                  {procent(VIP_PCT[v])} af BSI{vipKost > 0 ? ` ≈ ${mio(vipKost)}/uge` : ''}
                </Chip>
                <Chip ikon="skjold" farve="var(--color-bad)">{fmtTal(TRUST.vipProgram * v)} tillid/kvartal</Chip>
              </>
            )}
          </div>
          <LoftLinje g={g} m={m} hvad="vip" aktive={vm.aktive} />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[0.7rem] text-muted" data-testid="niveau-pris-forklaring">
        <Ikon navn="penge" farve="var(--color-bad)" str={11} className="shrink-0" /> Under hvert niveau: prisen i % af BSI · tilsynstillid pr. kvartal.
      </p>
      <PaabudsIndeks g={g} m={m} kompakt />
      {andreOver.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-warn" data-testid="paabud-andre">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
          Påbudsindekset står også på {R8.taerskel} eller mere i {andreOver.map((x) => `${MARKETS[x].kort} (${Math.min(g.aggressionKvartaler[x] ?? 0, R8.kvartaler)}/${R8.kvartaler} kv.)`).join(', ')}.
        </p>
      )}
    </div>
  );
}

// ---------- Offshore-fristelsen (spec 6.10) ----------

function OffshoreFristelse({ g, vm }: { g: GameState; vm: Vm }) {
  // Inline-bekræftelse: 'start' (2 mio. og tillid) eller 'luk' (opstarten er tabt). Fokus går til "Fortryd" (det sikre valg),
  // boksen rulles i syne (også over fanebjælken på mobil), og Escape fortryder.
  const [bekraeft, setBekraeft] = useState<null | 'start' | 'luk'>(null);
  const boks = useRef<HTMLDivElement>(null);
  const reduceret = useReduceretBevaegelse();
  useEffect(() => {
    if (!bekraeft || !boks.current) return;
    const el = boks.current;
    rulIndISyne(el, reduceret);
    el.querySelector<HTMLElement>('[data-testid$="fortryd"]')?.focus({ preventScroll: true });
  }, [bekraeft, reduceret]);
  const fortryd = () => {
    const tilbage = bekraeft === 'luk' ? 'offshore-luk' : 'offshore-start';
    setBekraeft(null);
    fokusSenere(tilbage);
  };
  const tastBoks = (e: KeyboardEvent<HTMLDivElement>) => {
    // Mellemrum trykker på den fokuserede knap (Fortryd) — aldrig spillets pause, mens bekræftelsen står åben
    if (e.key === ' ') {
      e.stopPropagation();
      return;
    }
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    fortryd();
  };
  const aktiv = g.offshoreBrand;
  const harProdukt = g.produkter.some((p) => p.ejer === 'spiller');
  const raad = g.kapital >= OFFSHORE_BRAND.opstart;
  const grund = !harProdukt ? 'Kræver mindst ét lanceret produkt at kopiere.' : !raad ? `Ikke råd (${mio(OFFSHORE_BRAND.opstart)}).` : undefined;
  const haft = g.flags.includes('haftOffshoreBrand');
  const iRisiko = MARKET_IDS.filter((m) => ['aktiv', 'ansoegt', 'suspenderet'].includes(g.markeder[m].licens));
  const faktisk = MARKET_IDS.map((m) => ({ m, b: g.markeder[m].offshoreBrandBsiPrUge })).filter((x) => x.b > 0);
  const faktiskSum = faktisk.reduce((a, x) => a + x.b, 0);
  const estimat = vm.estimat;
  // Lige efter start er der endnu ikke gået en uge: vis forventningen, indtil de første grå kroner er talt op
  const erFaktisk = aktiv && faktiskSum > 0;
  const visListe = erFaktisk ? faktisk : MARKET_IDS.map((m) => ({ m, b: estimat.prMarked[m] ?? 0 })).filter((x) => x.b > 0);
  const beloeb = erFaktisk ? faktiskSum : estimat.total;
  const harAktivtProdukt = g.produkter.some((p) => p.ejer === 'spiller' && p.aktiv);
  // Afsløringsrisikoen vokser med den grå pengestrøm (grundrisiko + et tillæg pr. 10 mio. om ugen)
  const risikoAar = offshoreRisikoPrAar(beloeb);
  const risikoEkstra = risikoAar - OFFSHORE_BRAND.tabRisikoPrAar;
  const start = () => {
    const ok = useGame.getState().dispatch({ t: 'setOffshoreBrand', aktiv: true });
    if (ok) useGame.getState().toast('Offshore-brandet er live. Det grå kasino kører.', 'info');
    setBekraeft(null);
    fokusSenere(ok ? 'offshore-luk' : 'offshore-start');
  };
  const luk = () => {
    const ok = useGame.getState().dispatch({ t: 'setOffshoreBrand', aktiv: false });
    if (ok) useGame.getState().toast('Offshore-brandet er lukket. Tilsynene holder op med at trække tillid for det.', 'info');
    setBekraeft(null);
    fokusSenere(ok ? 'offshore-start' : 'offshore-luk');
  };
  const pris: { ikon: IkonNavn; tekst: ReactNode; farve: string }[] = [
    { ikon: 'penge', tekst: <>{mio(OFFSHORE_BRAND.opstart)} i opstart, og {Math.round(OFFSHORE_BRAND.omkostning * 100)} % af den grå BSI går til betalinger og hosting</>, farve: 'var(--color-bad)' },
    { ikon: 'skjold', tekst: <>{fmtTal(TRUST.offshoreBrand)} tilsynstillid pr. kvartal i alle markeder, så længe det kører</>, farve: 'var(--color-bad)' },
    {
      ikon: 'advarsel',
      tekst: (
        <>
          Ca. <b className="tal text-ink">{fmtTal(risikoAar * 100)} %</b> risiko pr. år for at blive afsløret
          {risikoEkstra >= 0.001
            ? ` (${fmtTal(OFFSHORE_BRAND.tabRisikoPrAar * 100)} % grundrisiko plus ${fmtTal(risikoEkstra * 100)} %, fordi ${mioKort(beloeb)} om ugen i grå penge bliver fulgt)`
            : ` (grundrisikoen; den stiger, jo flere grå penge der løber igennem)`}
          . Så inddrages <b>alle</b> jeres licenser på én gang
          {iRisiko.length > 0 ? ` (lige nu ${iRisiko.length}: ${iRisiko.map((m) => MARKETS[m].kort).join(', ')})` : ''}, og uden en licens, der bærer firmaet, er
          spillet slut
        </>
      ),
      farve: 'var(--color-bad)',
    },
    { ikon: 'laas', tekst: <>Lukker for et senere salg til statsselskaber og nordiske grupper — det huskes, også efter I lukker brandet</>, farve: 'var(--color-warn)' },
  ];
  return (
    <div className="flex flex-col gap-2.5" data-testid="offshore-brand">
      <div className="flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-2.5 @xl:flex-row @xl:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            Et gråt kryptokasino med licens fra Curaçao. Ingen afgift, ingen grænser, ingen ROFUS — og hurtige penge fra de spillere, der alligevel spiller offshore.
            Det er også den eneste vej ind til de norske spillere.
          </p>
          <p className="mt-1 text-xs text-muted" data-testid="offshore-raekkevidde">
            Rækkevidde <b className="tal text-ink">{procent(estimat.raekkevidde, 0)}</b>: brandet vokser med jeres kundetal og når fuld styrke ved{' '}
            {heltal(OFFSHORE_BRAND.fuldRaekkeviddeKunder)} kunder.
          </p>
        </div>
        <div className="shrink-0 rounded-md border-2 border-line bg-bg2 px-3 py-2 text-center" data-testid="offshore-beloeb">
          <span className="block text-[0.62rem] uppercase tracking-wide text-muted">{erFaktisk ? 'Grå BSI nu' : 'Forventet grå BSI'}</span>
          {beloeb > 0 ? (
            <>
              <span className="tal block font-pixel text-lg font-black text-warn">≈ {mio(beloeb)}</span>
              <span className="text-[0.66rem] text-dim">pr. uge</span>
            </>
          ) : (
            <>
              <span className="tal block font-pixel text-lg font-black text-dim">—</span>
              <span className="text-[0.66rem] text-dim">{harAktivtProdukt ? 'intet at hente lige nu' : 'kræver et aktivt produkt'}</span>
            </>
          )}
        </div>
      </div>
      {visListe.length > 0 && (
        <ul className="grid grid-cols-3 gap-1 @lg:grid-cols-5" aria-label={erFaktisk ? 'Grå BSI pr. marked' : 'Forventet grå BSI pr. marked'} data-testid="offshore-markeder">
          {visListe
            .sort((a, b) => b.b - a.b)
            .map(({ m, b }) => (
              <li key={m} className="flex min-w-0 flex-col overflow-hidden rounded border-2 border-line bg-panel">
                <FlagStribe farver={MARKETS[m].farver} className="h-1 rounded-none border-0 border-b-2" />
                <span className="flex items-center justify-between gap-1 px-1.5 py-0.5">
                  <span className="font-pixel text-xs font-black">{MARKETS[m].kort}</span>
                  <span className="tal truncate font-pixel text-[0.7rem] font-bold text-warn">{mioKort(b)}</span>
                </span>
              </li>
            ))}
        </ul>
      )}
      <div>
        <p className="mb-1 font-pixel text-xs font-black uppercase text-bad">Prisen</p>
        <ul className="flex flex-col gap-1" data-testid="offshore-pris">
          {pris.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm text-muted">
              <Ikon navn={p.ikon} farve={p.farve} indre="var(--color-line)" str={13} className="mt-0.5 shrink-0" />
              <span>{p.tekst}</span>
            </li>
          ))}
        </ul>
      </div>
      {aktiv && bekraeft === 'luk' ? (
        <div
          ref={boks}
          className="anim-pop flex scroll-mb-2 flex-col gap-2 rounded-md border-2 border-warn bg-bg2 p-2.5"
          data-testid="offshore-luk-boks"
          role="group"
          aria-label="Bekræft lukning af offshore-brandet"
          onKeyDown={tastBoks}
        >
          <p className="flex items-start gap-1.5 text-sm font-bold text-ink">
            <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={14} className="mt-0.5 shrink-0" />
            <span>
              Luk brandet? Opstarten på {mio(OFFSHORE_BRAND.opstart)} er tabt, og et nyt brand koster det samme igen. Historikken huskes — statsselskaber og nordiske grupper
              holder stadig afstand.
            </span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="ghost" testId="offshore-luk-fortryd" onClick={fortryd}>
              Fortryd
            </Btn>
            <Btn variant="fare" testId="offshore-luk-bekraeft" onClick={luk}>
              <Ikon navn="kryds" farve="currentColor" str={13} /> Luk brandet
            </Btn>
          </div>
        </div>
      ) : aktiv ? (
        <div className="flex flex-col gap-2 rounded-md border-2 border-warn bg-bg2 p-2.5 @lg:flex-row @lg:items-center" data-testid="offshore-aktiv">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-bold text-warn">
            <Ikon navn="lyn" farve="var(--color-warn)" indre="var(--color-line)" str={14} className="shrink-0" />
            Brandet kører
            {g.offshoreBrandStartUge !== null
              ? g.uge > g.offshoreBrandStartUge
                ? ` siden ${datoTekst(g.offshoreBrandStartUge)} (${alderTekst(g.uge - g.offshoreBrandStartUge)})`
                : ' — lige startet'
              : ''}
            . Risikoen tikker: ca.{' '}
            {fmtTal((risikoAar / 52) * 100)} % hver uge.
          </p>
          <Btn variant="sekundaer" testId="offshore-luk" onClick={() => setBekraeft('luk')}>
            <Ikon navn="kryds" farve="currentColor" str={13} /> Luk brandet
          </Btn>
        </div>
      ) : bekraeft === 'start' ? (
        <div
          ref={boks}
          className="anim-pop flex flex-col gap-2 rounded-md border-2 border-bad bg-bg2 p-2.5"
          data-testid="offshore-bekraeft-boks"
          role="group"
          aria-label="Bekræft offshore-brand"
          onKeyDown={tastBoks}
        >
          <p className="flex items-start gap-1.5 text-sm font-bold text-ink">
            <Ikon navn="advarsel" farve="var(--color-bad)" indre="var(--color-line)" str={14} className="mt-0.5 shrink-0" />
            <span>
              Sikker? Det koster {mio(OFFSHORE_BRAND.opstart)} nu og {fmtTal(TRUST.offshoreBrand)} tillid pr. kvartal overalt. Bliver det afsløret, ryger alle licenser på én gang.
            </span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="ghost" testId="offshore-fortryd" onClick={fortryd}>
              Fortryd
            </Btn>
            <Btn variant="fare" testId="offshore-bekraeft" onClick={start} disabled={!!grund} title={grund}>
              <Ikon navn="lyn" farve="currentColor" str={13} /> Ja, start brandet
            </Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Btn variant="primaer" testId="offshore-start" disabled={!!grund} title={grund} onClick={() => setBekraeft('start')} className="w-full @lg:w-auto @lg:self-start">
            <Ikon navn="lyn" farve="currentColor" indre="var(--color-gold)" str={14} /> Start offshore-brand · {mioKort(OFFSHORE_BRAND.opstart)}
          </Btn>
          {grund && <p className="text-xs text-muted">{grund}</p>}
        </div>
      )}
      {haft && !aktiv && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Ikon navn="bog" farve="var(--color-dim)" indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
          I har haft et offshore-brand. Det står i bøgerne: statsselskaber og nordiske grupper holder afstand.
        </p>
      )}
    </div>
  );
}

// ---------- Panelet ----------

export default function MarketPanel() {
  const g = useGame((s) => s.game)!;
  const m = useMarkedValg((s) => s.valgt);
  const vaelg = useMarkedValg((s) => s.vaelg);
  const sektion = useMarkedValg((s) => s.sektion);
  const reduceret = useReduceretBevaegelse();
  const vm = useMemo(() => beregn(g, m), [g, m]);
  // En dialog bad om et bestemt afsnit ("Marked →" fra en sanktion eller regel): rul dertil én gang.
  // Efter næste frame, så fanens egen "vis toppen af panelet" (forælderens effekt) ikke overskriver det.
  useEffect(() => {
    if (!sektion) return;
    const raf = requestAnimationFrame(() => {
      hopTil(sektion, reduceret);
      useMarkedValg.getState().rydSektion();
    });
    return () => cancelAnimationFrame(raf);
  }, [sektion, reduceret]);
  const navn = pr(m);
  return (
    <Panel titel="Markeder" ikon="kort" testId="panel-marked">
      <div className="@container flex flex-col gap-3">
        <Afsnit id="marked-kort" titel="Markedskort" ikon="globus" farve="var(--color-violet)" testId="markedskort-afsnit">
          <MarkedKort kort={vm.kort} valgt={m} offshoreAktiv={g.offshoreBrand} onVaelg={vaelg} onOffshore={() => hopTil('fristelsen', reduceret)} />
        </Afsnit>
        <Hop />
        <Konsolkort g={g} m={m} vm={vm} />
        <Afsnit id="marked-andele" titel={`Markedsandele i ${navn}`} ikon="hitliste" farve="var(--color-pink)" testId="andele">
          <Andele g={g} m={m} />
        </Afsnit>
        <Afsnit id="marked-offshore" titel={`Offshore i ${navn}`} ikon="globus" farve="var(--color-muted)" testId={`offshore-${m}`}>
          <Offshore g={g} m={m} vm={vm} />
        </Afsnit>
        <Afsnit id="marked-regler" titel={`Regulering i ${navn}`} ikon="bog" farve="var(--color-sky)" testId="regulering">
          <Regulering g={g} m={m} />
        </Afsnit>
        <Afsnit id="marked-tillid" titel={`Tilsynstillid i ${navn}`} ikon="skjold" farve="var(--color-good)" testId="tilsynstillid">
          <Tillid g={g} m={m} vm={vm} />
        </Afsnit>
        <Afsnit id="marked-marketing" titel="Marketingmix · alle markeder" ikon="hoejttaler" farve="var(--color-sky)" testId="marketingmix">
          <Marketing g={g} m={m} vm={vm} />
        </Afsnit>
        <Afsnit id="marked-bonus" titel="Bonus og VIP · alle markeder" ikon="diamant" farve="var(--color-pink)" testId="bonus-vip">
          <Tip>Fristende: flere kunder og mere spil. Prisen står ved siden af — i kroner og i tilsynets tillid. Nogle markeder lofter niveauet.</Tip>
          <div className="mt-2">
            <BonusVip g={g} m={m} vm={vm} />
          </div>
        </Afsnit>
        <Afsnit id="marked-fristelsen" titel="Offshore-fristelsen" ikon="lyn" farve="var(--color-warn)" testId="offshore-fristelse">
          <OffshoreFristelse g={g} vm={vm} />
        </Afsnit>
      </div>
    </Panel>
  );
}

