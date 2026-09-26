// Anmeldelsen (spec 6.3 + 6.19): fanfaren. Fire anmeldere afsløres én ad gangen, scoren tælles op,
// totalen /40 trommes frem, og til sidst kommer Guldkupon, Hall of Fame, kombinationsbogen og niveauer.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LiveProduct, ProductTypeId, ReviewerId, Signal, ThemeId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { maxProjekter } from '../../sim/selectors';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { REVIEWER_BY_ID, REVIEWERS, GULDKUPON_TOTAL } from '../../data/reviewers';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { THEMES } from '../../data/themes';
import { fitFor, FIT_NAVN } from '../../data/compatibility';
import { Btn, Ikon, Modal, Tom } from '../components/kit';
import { PixelTekst } from '../components/ShellPixelFont';
import { DevStil, FitMaerke } from '../components/DevDele';
import {
  anmeldelsesDom, hallOfFameMangler, lanceringsIndsigt, scoreFarve, standardKurve, standardSpring, svagesteParam, varFoersteForsoeg, visCitat, visVersion,
  type StandardSpring,
} from '../lib/devHjaelp';
import { Portraet, VETERAN } from '../components/ShellPortraet';
import { aarFor } from '../../sim/time';
import { spil } from '../../audio/sfx';
import { konfetti } from '../../render/particles';

const START = 380; // dialogen popper ind først
const KORT_IND = 140; // kortet glider ind, før scoren tæller
const TAEL = 48; // ms pr. point
const EFTER_KORT = 240;
const TOTAL_PAUSE = 260;
const TOTAL_VARIGHED = 1250;
const MAERKE_PAUSE = 380;
const MAERKE_TRIN = 520;

type Plan = {
  kort: { start: number; scoreStart: number; citat: number }[];
  totalStart: number;
  totalSlut: number;
  maerker: number[];
  slut: number;
};

type Maerke = { id: string; node: ReactNode };

function lavPlan(scores: number[], antalMaerker: number): Plan {
  let t = START;
  const kort = scores.map((sc) => {
    const start = t;
    const scoreStart = start + KORT_IND;
    const citat = scoreStart + sc * TAEL + 60;
    t = citat + EFTER_KORT;
    return { start, scoreStart, citat };
  });
  const totalStart = t + TOTAL_PAUSE;
  const totalSlut = totalStart + TOTAL_VARIGHED;
  const maerker = Array.from({ length: antalMaerker }, (_, i) => totalSlut + MAERKE_PAUSE + i * MAERKE_TRIN);
  const slut = (maerker.length ? maerker[maerker.length - 1] : totalSlut) + 250;
  return { kort, totalStart, totalSlut, maerker, slut };
}

function AnmelderKort({ id, score, citat, vist, taelt, citatVist }: { id: ReviewerId; score: number; citat: string; vist: boolean; taelt: number; citatVist: boolean }) {
  const r = REVIEWER_BY_ID[id];
  const faerdig = taelt >= score;
  // Kortet står der hele tiden (usynligt, til det afsløres), så dialogen har sin endelige højde fra start og ikke
  // hopper, når kortene, totalen og mærkerne kommer til
  return (
    <div className="relative">
      {!vist && <div className="absolute inset-0 rounded-md border-2 border-dashed border-hi bg-bg2/50" aria-hidden />}
      <KortIndhold id={id} r={r} score={score} citat={citat} vist={vist} taelt={taelt} citatVist={citatVist} faerdig={faerdig} />
    </div>
  );
}

function KortIndhold({
  id, r, score, citat, vist, taelt, citatVist, faerdig,
}: { id: ReviewerId; r: (typeof REVIEWER_BY_ID)[ReviewerId]; score: number; citat: string; vist: boolean; taelt: number; citatVist: boolean; faerdig: boolean }) {
  return (
    <article
      className={`overflow-hidden rounded-md border-2 border-line bg-bg2 pixel-skygge ${vist ? 'dev-ind' : 'invisible'}`}
      data-testid={vist ? `anmelder-${id}` : undefined}
      aria-hidden={vist ? undefined : true}
    >
      <header
        className="flex items-center justify-between gap-2 border-b-2 border-line px-2 py-1"
        style={{ background: `repeating-linear-gradient(90deg, ${r.farve} 0 6px, color-mix(in srgb, ${r.farve} 82%, #000) 6px 8px)` }}
      >
        <span className="truncate font-pixel text-[0.78rem] font-black uppercase tracking-widest text-white" style={{ textShadow: '1px 1px 0 #0009' }}>
          {r.navn}
        </span>
        <span className="hidden shrink-0 text-[0.62rem] font-bold text-white/85 sm:inline" style={{ textShadow: '1px 1px 0 #0008' }}>
          {r.vaegter}
        </span>
      </header>
      <div className="flex items-center gap-3 p-2">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded border-2 border-line bg-panel ${faerdig ? 'dev-stempel' : ''}`}
          aria-label={`${r.navn}: ${faerdig ? score : taelt} af 10`}
          data-testid={vist ? `anmelder-score-${id}` : undefined}
        >
          {taelt > 0 ? (
            <PixelTekst
              key={taelt}
              tekst={String(taelt)}
              farver={faerdig ? scoreFarve(score) : 'var(--color-ink)'}
              side={faerdig ? '#0b0c16' : '#30365a'}
              className={`h-9 w-auto max-w-[48px] ${faerdig ? '' : 'dev-hop'}`}
              titel={String(taelt)}
            />
          ) : (
            <span className="font-pixel text-xl font-black text-dim">?</span>
          )}
        </div>
        <p className={`min-w-0 flex-1 text-sm italic leading-snug text-ink transition-opacity duration-300 ${citatVist ? 'opacity-100' : 'opacity-0'}`}>»{citat}«</p>
      </div>
    </article>
  );
}

/** Markedets standard steg siden sidst: vis kurven og Knuds råd (så et fald ikke føles som en straf for at gøre det rigtige) */
function StandardBoks({ spring, kurve, aar, vist }: { spring: StandardSpring; kurve: { aar: number; v: number }[]; aar: number; vist: boolean }) {
  const max = Math.max(1, ...kurve.map((k) => k.v));
  const pct = Math.round(spring.pct * 100);
  const raad =
    aar < 2016
      ? 'Standarden stiger stejlt i garageårene og flader ud omkring 2016. Et større budget, træning af holdet og en god kombination holder jer med — og hvert produkt løfter type- og temaniveauet.'
      : 'Konkurrenterne hæver barren hvert år. Et større budget, træning af holdet og en stærkere platform holder jer med.';
  return (
    <div
      className={`mt-2 w-full rounded-md border-2 border-line bg-bg2 p-2 text-left ${vist ? 'anim-glid' : 'invisible'}`}
      data-testid={vist ? 'anmeldelse-standard' : undefined}
      aria-hidden={vist ? undefined : true}
    >
      <div className="flex flex-wrap items-end gap-3">
        <p className="min-w-[180px] flex-1 text-sm text-muted">
          <Ikon navn="trend" farve="var(--color-warn)" str={14} className="mr-1 inline align-[-2px]" />
          <b className="text-ink">Markedets standard</b> pr. parameter gik fra{' '}
          <b className="tal font-pixel text-ink">{Math.round(spring.fra)}</b> til <b className="tal font-pixel text-warn">{Math.round(spring.til)}</b>
          {pct > 0 && <> (+{pct} %)</>} siden {spring.forrigeNavn}.
        </p>
        <div className="flex h-12 shrink-0 items-end gap-1" role="img" aria-label={`Markedsstandarden ${kurve.map((k) => `${k.aar}: ${Math.round(k.v)}`).join(', ')}`}>
          {kurve.map((k) => (
            <div key={k.aar} className="flex h-full flex-col items-center justify-end gap-0.5">
              <div
                className="w-3.5 rounded-t-sm border-2 border-b-0 border-line"
                style={{ height: `${Math.max(8, (k.v / max) * 100)}%`, background: k.aar === aar ? 'var(--color-warn)' : 'var(--color-hi)' }}
                title={`${k.aar}: ${Math.round(k.v)}`}
              />
              <span className={`font-pixel text-[0.6rem] leading-none ${k.aar === aar ? 'font-black text-warn' : 'text-dim'}`}>'{String(k.aar).slice(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-start gap-2 border-t-2 border-line/60 pt-2">
        <Portraet udseende={VETERAN} str={28} baggrund="var(--color-panel2)" className="h-7 w-7 shrink-0 rounded border-2 border-line" />
        <p className="text-xs leading-snug text-muted">
          <b className="text-ink">Knud:</b> {raad}
        </p>
      </div>
    </div>
  );
}

export default function ReviewDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const productId = signal.k === 'anmeldelse' ? signal.productId : '';
  const reduceret = useReduceretBevaegelse();
  // Øjebliksbillede ved åbning: tallene skal ikke flytte sig, mens fanfaren kører
  const [snap] = useState(() => {
    const st = useGame.getState();
    const g = st.game;
    const p: LiveProduct | undefined = g?.produkter.find((x) => x.id === productId);
    if (!g || !p) return null;
    // Flere niveauspring i samme lancering (fx brug + Hall of Fame) vises som ét: det højeste pr. type/tema
    const alle = st.sidsteSignaler.filter(
      (x): x is Extract<Signal, { k: 'typeNiveau' } | { k: 'temaNiveau' }> =>
        (x.k === 'typeNiveau' && x.typeId === p.typeId) || (x.k === 'temaNiveau' && x.themeId === p.themeId),
    );
    const niveauer = (['typeNiveau', 'temaNiveau'] as const)
      .map((k) => alle.filter((x) => x.k === k).sort((a, b) => b.niveau - a.niveau)[0])
      .filter((x): x is (typeof alle)[number] => !!x);
    // Forrige egne lancering (til dommen: bedre eller dårligere end sidst?)
    const egne = g.produkter.filter((x) => x.ejer === 'spiller' && x.id !== p.id && x.lanceretUge <= p.lanceretUge);
    const forrige = egne.reduce<LiveProduct | null>((b, x) => (!b || x.lanceretUge > b.lanceretUge ? x : b), null);
    return {
      p,
      foerste: varFoersteForsoeg(g, p),
      indsigt: lanceringsIndsigt(g, p.total40, p.guldkupon),
      niveauer,
      firma: g.firmaNavn,
      dom: anmeldelsesDom(p.total40, forrige?.total40 ?? null, egne.length + 1, svagesteParam(g, p)),
      // Faldt scoren i forhold til sidst? Så vises markedsstandardens udvikling og et råd fra Knud
      spring: forrige && p.total40 < forrige.total40 ? standardSpring(g, p, forrige) : null,
      kurve: standardKurve(g, p, Math.max(2012, aarFor(p.lanceretUge) - 4), Math.min(2035, aarFor(p.lanceretUge) + 3)),
      aar: aarFor(p.lanceretUge),
      hofMangler: hallOfFameMangler(g, p),
      citater: Object.fromEntries(p.anmeldelser.map((a) => [a.anmelder, visCitat(g, p, a)])) as Partial<Record<ReviewerId, string>>,
    };
  });
  // Plads til et nyt projekt? Så kan spilleren gå direkte videre til næste produkt
  const kanNyt = useGame((s) => (s.game ? s.game.projekter.length < maxProjekter(s.game) : false));

  const anmeldelser = useMemo(() => {
    if (!snap) return [];
    return REVIEWERS.map((r) => snap.p.anmeldelser.find((a) => a.anmelder === r.id)).filter((a): a is NonNullable<typeof a> => !!a);
  }, [snap]);

  const maerker: Maerke[] = useMemo(() => {
    if (!snap) return [];
    const p = snap.p;
    const typeNavn = PRODUCT_TYPES[p.typeId].navn;
    const temaNavn = THEMES[p.themeId].navn;
    const liste: Maerke[] = [];
    if (p.guldkupon) {
      liste.push({
        id: 'guld',
        node: (
          <div className="dev-stempel-bred dev-glimt flex items-center gap-3 rounded-md border-2 border-line bg-gold px-3 py-2 text-line pixel-skygge" data-testid="maerke-guldkupon">
            <Ikon navn="trofae" farve="var(--color-line)" indre="#fff1a8" str={32} />
            <div>
              <div className="font-pixel text-lg font-black uppercase tracking-wider">Guldkuponen!</div>
              <div className="text-xs font-bold">+15 hype og ekstra indsigt. Branchen har set jer.</div>
            </div>
          </div>
        ),
      });
    }
    if (p.hallOfFame) {
      liste.push({
        id: 'hof',
        node: (
          <div className="dev-stempel-bred flex items-center gap-3 rounded-md border-2 border-line bg-violet px-3 py-2 text-line pixel-skygge" data-testid="maerke-hof">
            <Ikon navn="krone" farve="var(--color-line)" indre="var(--color-gold)" str={32} />
            <div>
              <div className="font-pixel text-lg font-black uppercase tracking-wider">Hall of Fame!</div>
              <div className="text-xs font-bold">
                {typeNavn} og {temaNavn} stiger permanent et niveau.
              </div>
            </div>
          </div>
        ),
      });
    }
    if (snap.hofMangler) {
      liste.push({
        id: 'hof-naesten',
        node: (
          <div className="dev-ind flex items-center gap-3 rounded-md border-2 border-line bg-panel2 px-3 py-2" data-testid="maerke-hof-naesten">
            <Ikon navn="krone" farve="var(--color-violet)" indre="var(--color-line)" str={24} />
            <div className="min-w-0 text-sm">
              <div className="font-pixel font-bold text-ink">{p.total40} point — næsten Hall of Fame!</div>
              <div className="text-xs text-muted">
                Hall of Fame kræver også, at {typeNavn} er på niveau {snap.hofMangler.krav}. I er på niveau {snap.hofMangler.niveau} — det stiger med hvert produkt af typen.
              </div>
            </div>
          </div>
        ),
      });
    }
    if (snap.foerste) {
      const fit = fitFor(p.typeId, p.themeId);
      liste.push({
        id: 'kombi',
        node: (
          <div className="dev-ind flex flex-wrap items-center gap-2 rounded-md border-2 border-line bg-panel2 px-3 py-2" data-testid="maerke-kombi">
            <Ikon navn="bog" farve="var(--color-gold)" indre="var(--color-line)" str={24} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.68rem] uppercase tracking-wide text-muted">Første forsøg — ny side i kombinationsbogen</div>
              <div className="font-pixel text-sm font-bold text-ink">
                {typeNavn} × {temaNavn}: {FIT_NAVN[fit]}!
              </div>
            </div>
            <FitMaerke fit={fit} />
          </div>
        ),
      });
    }
    for (const n of snap.niveauer) {
      const navn = n.k === 'typeNiveau' ? PRODUCT_TYPES[n.typeId as ProductTypeId].navn : THEMES[n.themeId as ThemeId].navn;
      liste.push({
        id: `niv-${n.k}`,
        node: (
          <div className="dev-ind flex items-center gap-2 rounded-md border-2 border-line bg-panel2 px-3 py-2" data-testid={`maerke-${n.k}`}>
            <Ikon navn="op" farve="var(--color-good)" str={20} />
            <div className="text-sm">
              <b className="text-ink">{navn}</b> <span className="text-muted">er nu</span>{' '}
              <b className="font-pixel text-good">niveau {n.niveau}</b>
              <span className="text-muted"> — flere point i næste projekt.</span>
            </div>
          </div>
        ),
      });
    }
    liste.push({
      id: 'indsigt',
      node: (
        <div className="dev-ind flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border-2 border-line bg-bg2 px-3 py-2 text-sm" data-testid="maerke-indsigt">
          <span className="flex items-center gap-1.5">
            <Ikon navn="indsigt" farve="var(--color-cyan)" indre="var(--color-line)" />
            <b className="tal font-pixel text-cyan">+{snap.indsigt}</b> <span className="text-muted">indsigt</span>
          </span>
          {!p.guldkupon && (
            <span className="text-xs text-muted">
              Guldkuponen kræver {GULDKUPON_TOTAL}/40 — {GULDKUPON_TOTAL - p.total40} point fra. Næste gang!
            </span>
          )}
        </div>
      ),
    });
    return liste;
  }, [snap]);

  const plan = useMemo(() => lavPlan(anmeldelser.map((a) => a.score), maerker.length), [anmeldelser, maerker.length]);

  const [sprunget, setSprunget] = useState(false);
  const [t, setT] = useState(0);
  const tid = reduceret || sprunget ? Number.POSITIVE_INFINITY : t;
  const faerdig = tid >= plan.slut;

  // Tidslinje
  useEffect(() => {
    if (reduceret || sprunget || !snap) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (nu: number) => {
      const e = nu - t0;
      setT(e);
      if (e < plan.slut) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduceret, sprunget, snap, plan.slut]);

  // Afledte visningsværdier
  const kortVis = plan.kort.map((k, i) => {
    const score = anmeldelser[i]?.score ?? 0;
    const taelt = tid < k.scoreStart ? 0 : Math.min(score, Math.floor((tid - k.scoreStart) / TAEL) + 1);
    return { vist: tid >= k.start, taelt, citat: tid >= k.citat };
  });
  const total = snap?.p.total40 ?? 0;
  const totalTaelt = tid < plan.totalStart ? -1 : Math.min(total, Math.floor(((tid - plan.totalStart) / TOTAL_VARIGHED) * (total + 1)));
  const totalFaerdig = tid >= plan.totalSlut;
  const maerkerVist = plan.maerker.filter((m) => tid >= m).length;

  // Lyd og konfetti (kun ved ændringer)
  const lyd = useRef({ kort: [0, 0, 0, 0], total: -1, slut: false, maerker: 0 });
  useEffect(() => {
    const l = lyd.current;
    if (!snap) return;
    const alt = !Number.isFinite(tid);
    if (!alt) {
      kortVis.forEach((k, i) => {
        if (k.taelt > l.kort[i]) {
          try {
            spil('fanfareTick', k.taelt);
          } catch {
            /* lyd må aldrig vælte spillet */
          }
        }
        l.kort[i] = k.taelt;
      });
      if (totalTaelt > l.total) {
        if (totalTaelt % 2 === 0) {
          try {
            spil('fanfareTick', Math.floor(totalTaelt / 4));
          } catch {
            /* ignorer */
          }
        }
        l.total = totalTaelt;
      }
    }
    if (totalFaerdig && !l.slut) {
      l.slut = true;
      try {
        spil('fanfareSlut');
      } catch {
        /* ignorer */
      }
    }
    if (maerkerVist > l.maerker) {
      for (let i = l.maerker; i < maerkerVist; i++) {
        const id = maerker[i]?.id ?? '';
        if (id === 'guld') {
          konfetti({ antal: 170, kraft: 1.1 });
          spil('guldkupon');
        } else if (id === 'hof') {
          konfetti({ antal: 220, kraft: 1.4 });
          spil('guldkupon', 1);
          setTimeout(() => konfetti({ antal: 160, regn: true }), 300);
        } else if (id.startsWith('niv-') && !alt) {
          try {
            spil('niveauOp');
          } catch {
            /* ignorer */
          }
        }
      }
      l.maerker = maerkerVist;
    }
  });

  // Rul nyeste afsløring i syne på små skærme
  const totalRef = useRef<HTMLDivElement>(null);
  const maerkeRef = useRef<HTMLDivElement>(null);
  const totalVist = totalTaelt >= 0;
  useEffect(() => {
    if (totalVist && !reduceret) totalRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [totalVist, reduceret]);
  useEffect(() => {
    if (maerkerVist > 0 && !reduceret) maerkeRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [maerkerVist, reduceret]);

  if (!snap) {
    return (
      <Modal titel="Anmeldelser" onLuk={onLuk} testId="dialog-anmeldelse" bredde={480} fod={<Btn variant="primaer" onClick={onLuk}>OK</Btn>}>
        <Tom>Produktet blev ikke fundet.</Tom>
      </Modal>
    );
  }

  const p = snap.p;
  const tromme = totalVist && !totalFaerdig;
  return (
    <Modal
      titel="Anmeldelserne er landet!"
      onLuk={onLuk}
      testId="dialog-anmeldelse"
      bredde={720}
      fod={
        faerdig ? (
          <>
            {kanNyt && (
              <Btn
                onClick={() => {
                  onLuk();
                  useUi.getState().aabn({ kind: 'nytProdukt' });
                }}
                testId="anmeldelse-naeste"
              >
                <Ikon navn="plus" /> Start næste produkt
              </Btn>
            )}
            <Btn variant="primaer" onClick={onLuk} testId="anmeldelse-ok" className="min-w-32">
              {p.total40 < 20 ? 'Videre' : 'Fedt!'}
            </Btn>
          </>
        ) : (
          <Btn variant="ghost" onClick={() => setSprunget(true)} testId="anmeldelse-spring">
            <Ikon navn="hurtig" /> Spring over
          </Btn>
        )
      }
    >
      <DevStil />
      <div className="mb-3 text-center">
        <p className="text-[0.7rem] uppercase tracking-widest text-muted">{snap.firma} præsenterer</p>
        <h3 className="font-pixel text-xl font-black text-gold" data-testid="anmeldelse-produkt">
          {p.navn}
          {visVersion(p.navn, p.version) && <span className="ml-2 rounded border-2 border-line bg-violet px-1 align-middle text-xs text-line">{p.version}.0</span>}
        </h3>
        <p className="text-sm text-muted">
          {PRODUCT_TYPES[p.typeId].navn} × {THEMES[p.themeId].navn}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {anmeldelser.map((a, i) => (
          <AnmelderKort key={a.anmelder} id={a.anmelder} score={a.score} citat={snap.citater[a.anmelder] ?? a.citat} vist={kortVis[i].vist} taelt={kortVis[i].taelt} citatVist={kortVis[i].citat} />
        ))}
      </div>

      <div ref={totalRef} className="mt-4 flex flex-col items-center" data-testid="anmeldelse-total">
        {totalVist ? (
          <div className={`flex items-end gap-2 ${tromme ? 'dev-trommel' : ''} ${totalFaerdig ? 'dev-slag' : ''}`}>
            <PixelTekst
              tekst={String(Math.max(0, totalTaelt))}
              farver={totalFaerdig ? (p.guldkupon ? ['#fff1a8', 'var(--color-gold)', '#f59f1a'] : ['#ffffff', 'var(--color-ink)', '#c9c4b4']) : 'var(--color-muted)'}
              side={totalFaerdig && p.guldkupon ? '#8c4a12' : '#30365a'}
              className="h-16 w-auto sm:h-20"
              titel={`${totalTaelt} af 40`}
            />
            <span className="pb-2 font-pixel text-2xl font-black text-muted">/40</span>
          </div>
        ) : (
          <div className="flex h-16 items-center font-pixel text-sm uppercase tracking-widest text-dim sm:h-20">Total …</div>
        )}
        {/* Dommen og markedsstandarden står der fra start (usynligt), så dialogen ikke hopper, når de kommer */}
        <p
          className={`mt-1 text-center text-sm text-muted ${totalFaerdig ? 'anim-glid' : 'invisible'}`}
          data-testid={totalFaerdig ? 'anmeldelse-dom' : undefined}
          aria-hidden={totalFaerdig ? undefined : true}
        >
          {snap.dom}
        </p>
        {snap.spring && <StandardBoks spring={snap.spring} kurve={snap.kurve} aar={snap.aar} vist={totalFaerdig} />}
      </div>

      <div ref={maerkeRef} className="mt-3 flex flex-col gap-2" data-testid="anmeldelse-maerker">
        {maerker.map((m, i) => {
          const vist = i < maerkerVist;
          // Nøglen skifter, når mærket afsløres: så afspilles dets animation først dér
          return (
            <div key={`${m.id}-${vist ? 'vist' : 'skjult'}`} className={vist ? undefined : 'invisible'} aria-hidden={vist ? undefined : true}>
              {m.node}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
