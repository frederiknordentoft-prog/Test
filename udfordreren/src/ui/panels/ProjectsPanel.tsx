// Projekter (spec 6.2): Game Dev Story-kernen. Nyt produkt, faser med hold, parametre mod markedsstandarden,
// fejl, boost, forlænget test, lancering og skrinlægning.
import type { GameState, ParamKey, Project, Staff } from '../../sim/types';
import { PARAM_KEYS } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { boostEffekt, boostPris, komboInfo, lanceringsStatus, markedsStandard, maxProjekter, opgaverFor, typeStatus } from '../../sim/selectors';
import { PRODUCT_TYPES, PRODUCT_TYPE_IDS } from '../../data/productTypes';
import { THEMES } from '../../data/themes';
import { MARKETS } from '../../data/markets';
import { BALANCE } from '../../data/balance';
import { BOOST } from '../../data/costs';
import { Btn, Ikon, Panel } from '../components/kit';
import { BekraeftKnap, DevStil, FaseStepper, FitMaerke, ParamRaekke, StaffAvatar } from '../components/DevDele';
import { FASE_GIVER, FASE_NAVN, INTENSITET_NAVN, PARAM_NAVN, holdEstimat, licensInfo, pctKort, ugerTekst, visVersion } from '../lib/devHjaelp';
import { LICENS_STIL, lanceringsPlan, resterendeUdvikling } from '../lib/tvaersHjaelp';
import { heltal, mio } from '../format';

function nytProduktStatus(g: GameState): { ok: boolean; grund?: string } {
  const max = maxProjekter(g);
  if (g.projekter.length >= max) {
    return { ok: false, grund: `Kontoret har plads til ${max} projekt${max === 1 ? '' : 'er'} ad gangen. Lancér eller skrinlæg først.` };
  }
  const ok = PRODUCT_TYPE_IDS.some((t) => typeStatus(g, t).ok);
  if (!ok) {
    const foerste = PRODUCT_TYPE_IDS.find((t) => PRODUCT_TYPES[t].vertikal === g.startVertikal) ?? 'prematch';
    return { ok: false, grund: typeStatus(g, foerste).grund ?? 'Ingen produkttyper er låst op endnu.' };
  }
  return { ok: true };
}

function NytProduktKnap({ g }: { g: GameState }) {
  const st = nytProduktStatus(g);
  const max = maxProjekter(g);
  return (
    <div className="mb-3">
      <Btn
        variant="primaer"
        disabled={!st.ok}
        onClick={() => useUi.getState().aabn({ kind: 'nytProdukt' })}
        testId="nyt-produkt"
        title={st.grund}
        className="min-h-14 w-full text-base"
      >
        <Ikon navn="plus" str={18} />
        <span className="font-pixel uppercase tracking-wider">Nyt produkt</span>
        <span className="tal ml-1 rounded border-2 border-line bg-line/15 px-1.5 font-pixel text-xs">
          {g.projekter.length}/{max}
        </span>
      </Btn>
      {!st.ok && st.grund && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted" data-testid="nyt-produkt-grund">
          <Ikon navn="laas" farve="var(--color-dim)" str={12} className="mt-0.5 shrink-0" />
          {st.grund}
        </p>
      )}
    </div>
  );
}

function TomTilstand({ g }: { g: GameState }) {
  const lic = licensInfo(g, g.startVertikal);
  const trin: { ikon: string; farve: string; titel: string; tekst: string }[] = [
    { ikon: 'stjerne', farve: 'var(--color-violet)', titel: 'Vælg type × tema', tekst: 'Et godt match gør Spillerforum glad. Første forsøg er altid en overraskelse.' },
    { ikon: 'folk', farve: 'var(--color-sky)', titel: 'Tildel folk til faserne', tekst: 'Koncept, Design, Teknik og Test. Se point-boblerne stige over holdet.' },
    { ikon: 'bille', farve: 'var(--color-bad)', titel: 'Test fejlene væk', tekst: 'Teknik laver fejl. Test fjerner dem, før anmelderne finder dem.' },
    { ikon: 'raket', farve: 'var(--color-good)', titel: 'Lancér', tekst: 'Fire anmeldere giver op til 10 point hver. 32/40 udløser Guldkuponen.' },
  ];
  const seneste = g.produkter
    .filter((x) => x.ejer === 'spiller')
    .sort((a, b) => b.lanceretUge - a.lanceretUge)[0];
  if (seneste) {
    const k = komboInfo(g, seneste.typeId, seneste.themeId);
    return (
      <div className="rounded-md border-2 border-dashed border-hi p-3" data-testid="projekter-tom">
        <p className="text-sm text-ink">Ingen projekter i gang. Holdet venter på næste idé!</p>
        <button
          type="button"
          onClick={() => useUi.getState().aabn({ kind: 'produkt', productId: seneste.id })}
          className="mt-2 flex min-h-[44px] w-full flex-wrap items-center gap-2 rounded-md border-2 border-line bg-bg2 p-2 text-left hover:bg-panel2"
          data-testid="seneste-produkt"
        >
          <Ikon navn="stjerne" farve="var(--color-gold)" indre="var(--color-line)" className="shrink-0" />
          <span className="min-w-0 flex-1 text-xs text-muted">
            Seneste lancering: <b className="font-pixel text-ink">{seneste.navn}</b>{' '}
            <b className="tal font-pixel text-gold">{seneste.total40}/40</b>
          </span>
          <FitMaerke fit={k.fit} lille />
        </button>
        <p className="mt-2 text-xs text-muted">
          Prøv en ny kombination og fyld kombinationsbogen — eller byg en 2.0-version af et hit, når det er et år gammelt.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border-2 border-dashed border-hi p-3" data-testid="projekter-tom">
      <p className="mb-3 text-sm text-ink">Ingen projekter i gang. Sådan bliver et produkt til:</p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {trin.map((t, i) => (
          <li key={t.titel} className="flex gap-2 rounded-md border-2 border-line bg-bg2 p-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-line bg-panel2">
              <Ikon navn={t.ikon} farve={t.farve} indre="var(--color-line)" str={18} />
            </span>
            <span className="min-w-0 text-xs leading-snug">
              <span className="block font-pixel text-[0.7rem] font-bold uppercase text-ink">
                {i + 1}. {t.titel}
              </span>
              <span className="text-muted">{t.tekst}</span>
            </span>
          </li>
        ))}
      </ol>
      {lic.status === 'ansoegt' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border-2 border-line bg-panel2 p-2">
          <Ikon navn="ur" farve="var(--color-warn)" indre="var(--color-line)" className="shrink-0" />
          <p className="min-w-0 flex-1 text-sm text-ink">
            Licensen er klar om <b className="tal text-warn">{ugerTekst(lic.uger)}</b>. I kan godt udvikle imens — og en kontraktopgave holder kassen varm.
          </p>
          <Btn onClick={() => useUi.getState().setPanel('kontrakter')} testId="vis-opgaver">
            <Ikon navn="kontrakt" /> Vis opgaver
          </Btn>
        </div>
      )}
    </div>
  );
}

function MarkedChips({ g, p }: { g: GameState; p: Project }) {
  const plan = lanceringsPlan(g, p);
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid={`markedchips-${p.id}`}>
      {plan.map(({ m, lic, tekst }) => {
        const st = LICENS_STIL[lic.tilstand];
        const vent = lic.tilstand === 'ansoegt' || lic.tilstand === 'suspenderet';
        return (
          <span
            key={m}
            className={`inline-flex items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 font-pixel text-[0.68rem] font-bold ${lic.tilstand === 'inddraget' ? 'bg-bad/25 line-through' : 'bg-bg2'}`}
            title={`${MARKETS[m].navn}: ${tekst.replace(`${MARKETS[m].kort} `, '')}`}
            data-licens={lic.tilstand}
          >
            <Ikon navn={st.ikon} farve={st.farve} indre="var(--color-line)" str={10} />
            {MARKETS[m].kort}
            {vent && <span className="tal" style={{ color: st.farve }}>{lic.uger}u</span>}
          </span>
        );
      })}
    </span>
  );
}

/** "DK klar · SE licens om 4 uger" — og om licensen når at blive klar før lanceringen */
function Lanceringsplan({ g, p, fuld, centreret }: { g: GameState; p: Project; fuld?: boolean; centreret?: boolean }) {
  const plan = lanceringsPlan(g, p);
  const rest = resterendeUdvikling(p);
  const venter = plan.filter((x) => !x.klar);
  if (!fuld && venter.length === 0) return null;
  const klar = plan.filter((x) => x.klar);
  const falderUd = venter.filter((x) => x.lic.tilstand === 'inddraget' || x.lic.uger > rest);
  return (
    <div className={`flex flex-col gap-0.5 text-xs ${centreret ? 'items-center text-center' : ''}`} data-testid={`lanceringsplan-${p.id}`}>
      <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${centreret ? 'justify-center' : ''}`}>
        <Ikon navn="globus" farve="var(--color-sky)" indre="var(--color-line)" str={12} className="shrink-0" />
        {plan.map((x, i) => (
          <span key={x.m} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-dim" aria-hidden>·</span>}
            <span className="font-bold" style={{ color: LICENS_STIL[x.lic.tilstand].farve }}>
              {x.tekst}
            </span>
          </span>
        ))}
      </p>
      {falderUd.length > 0 && (
        <p className="text-muted" data-testid={`lanceringsplan-note-${p.id}`}>
          {p.klar
            ? `Lancerer I nu, kommer ${klar.length ? klar.map((x) => MARKETS[x.m].kort).join(', ') : 'intet marked'} med — ${falderUd.map((x) => MARKETS[x.m].kort).join(', ')} falder fra.`
            : `${falderUd.map((x) => MARKETS[x.m].kort).join(', ')} er ikke klar, når projektet er færdigt om ca. ${ugerTekst(rest)}.`}
        </p>
      )}
    </div>
  );
}

function Parametre({ g, p }: { g: GameState; p: Project }) {
  const std = markedsStandard(g, p.typeId, p.markeder, p.startUge);
  const hoejest = Math.max(...PARAM_KEYS.map((k) => p.params[k]));
  const skala = Math.max(std * 1.6, hoejest * 1.1, 1);
  const pris = boostPris(p);
  const effekt = boostEffekt(g, p);
  const grund = pris === null ? `Alle ${BOOST.max} boosts er brugt.` : g.indsigt < pris ? `Boost koster ${pris} indsigt — I har ${heltal(g.indsigt)}.` : undefined;
  return (
    <div className="rounded-md border-2 border-line bg-bg2 p-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.7rem]">
        <span className="flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-[3px] rounded-sm border border-line bg-ink" aria-hidden />
          Markedsstandard <b className="tal text-ink">{Math.round(std)}</b>
        </span>
        <span className="flex items-center gap-1 text-muted" data-testid="boost-info">
          <Ikon navn="indsigt" farve="var(--color-cyan)" indre="var(--color-line)" str={12} />
          {pris === null ? (
            'Ingen boosts tilbage'
          ) : (
            <>
              Boost <b className="tal text-cyan">{pris}</b> indsigt · {p.boostBrugt}/{BOOST.max} brugt
            </>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {PARAM_KEYS.map((k: ParamKey) => (
          <ParamRaekke
            key={k}
            param={k}
            vaerdi={p.params[k]}
            standard={std}
            skala={skala}
            hoejre={
              <Btn
                onClick={() => useGame.getState().dispatch({ t: 'boost', projectId: p.id, param: k })}
                disabled={!!grund}
                title={grund ?? `Boost ${PARAM_NAVN[k].toLowerCase()} med +${Math.round(effekt)} for ${pris} indsigt`}
                ariaLabel={`Boost ${PARAM_NAVN[k]}`}
                testId={`boost-${k}`}
                className="w-[70px] shrink-0 px-1 font-pixel text-xs"
              >
                <Ikon navn="lyn" farve="var(--color-cyan)" str={12} />
                <span className="tal">+{Math.round(effekt)}</span>
              </Btn>
            }
          />
        ))}
      </div>
      {grund && pris !== null && (
        <p className="mt-1.5 text-[0.7rem] text-muted" data-testid="boost-grund">
          {grund} Indsigt tjenes på opgaver, lanceringer og messer.
        </p>
      )}
    </div>
  );
}

function Hold({ g, p }: { g: GameState; p: Project }) {
  const ids = p.faseTildeling[p.fase];
  const opgaver = opgaverFor(g);
  const medlemmer = ids.map((id) => g.staff.find((m) => m.id === id)).filter((m): m is Staff => !!m);
  const arbejder = medlemmer.filter((m) => {
    const o = opgaver[m.id];
    return o?.type === 'projekt' && o.projectId === p.id;
  });
  const est = holdEstimat(
    g,
    p,
    p.fase,
    arbejder.map((m) => m.id),
  );
  const staar = arbejder.length === 0;
  const energi = arbejder.length ? arbejder.reduce((a, m) => a + m.energi, 0) / arbejder.length : 100;
  return (
    <div className={`rounded-md border-2 p-2 ${staar ? 'border-warn bg-warn/10' : 'border-line bg-bg2'}`} data-testid={`hold-${p.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-pixel text-[0.7rem] font-bold uppercase tracking-wide text-muted">Hold · {FASE_NAVN[p.fase]}</div>
          <div className="text-[0.7rem] text-dim">{FASE_GIVER[p.fase]}</div>
        </div>
        <Btn
          variant={staar ? 'primaer' : 'sekundaer'}
          onClick={() => useUi.getState().aabn({ kind: 'tildel', projectId: p.id })}
          testId={`tildel-${p.id}`}
          className="shrink-0"
        >
          <Ikon navn="folk" /> Tildel
        </Btn>
      </div>
      {medlemmer.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {medlemmer.map((m) => {
            const o = opgaver[m.id];
            const her = o?.type === 'projekt' && o.projectId === p.id;
            const hvor = o?.type === 'kontrakt' ? 'på opgave' : o?.type === 'projekt' ? 'på et andet projekt' : '';
            return (
              <span key={m.id} className="flex flex-col items-center gap-0.5">
                <StaffAvatar m={m} dim={!her} titel={`${m.navn} · energi ${Math.round(m.energi)}${her ? '' : ` · ${hvor}`}`} />
                <span className={`max-w-[64px] truncate text-[0.62rem] ${her ? 'text-muted' : 'text-dim line-through'}`}>{m.navn.split(' ')[0]}</span>
              </span>
            );
          })}
          {!staar && (
            <span className="ml-auto text-right text-[0.7rem] leading-tight text-muted" data-testid="hold-estimat">
              <span className="tal block font-pixel text-sm font-bold text-gold">≈ {Math.round(est.total)}</span>
              point/uge
            </span>
          )}
        </div>
      )}
      {!staar && energi < 30 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-warn" data-testid="hold-udmattet">
          <Ikon navn="lyn" farve="var(--color-warn)" className="shrink-0" str={12} />
          Holdet er udmattet (energi {Math.round(energi)}) og arbejder op til 45 % langsommere. Energien kommer igen, når de holder fri.
        </p>
      )}
      {staar && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-warn" data-testid="fase-staar-stille">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="shrink-0" />
          {medlemmer.length === 0 ? `Fasen står stille — ingen er tildelt ${FASE_NAVN[p.fase]}.` : 'Fasen står stille — holdet er optaget andetsteds.'}
        </p>
      )}
    </div>
  );
}

function TestForlaeng({ p }: { p: Project }) {
  const laengde = p.faseLaengde.test;
  const knap = (n: number) => {
    const ok = laengde + n <= BALANCE.maxTestUger;
    return (
      <Btn
        key={n}
        onClick={() => useGame.getState().dispatch({ t: 'extendTest', projectId: p.id, uger: n })}
        disabled={!ok}
        title={ok ? `Forlæng testen med ${ugerTekst(n)}` : `Testen kan højst vare ${BALANCE.maxTestUger} uger`}
        testId={`forlaeng-${n}`}
        className="flex-1 sm:flex-none"
      >
        <Ikon navn="plus" str={12} /> {ugerTekst(n)}
      </Btn>
    );
  };
  return (
    <div className="rounded-md border-2 border-line bg-bg2 p-2" data-testid="forlaeng-test">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 text-xs text-muted">
          <span className="block font-pixel text-[0.7rem] font-bold uppercase tracking-wide text-ink">Forlæng test</span>
          Test: <b className="tal text-ink">{ugerTekst(laengde)}</b> af maks {BALANCE.maxTestUger}. Flere uger fjerner flere fejl og giver tryghed.
        </div>
        <div className="flex w-full gap-2 sm:w-auto">{[1, 2].map(knap)}</div>
      </div>
    </div>
  );
}

function Lancering({ g, p }: { g: GameState; p: Project }) {
  const st = lanceringsStatus(g, p);
  const venter = lanceringsPlan(g, p).filter((x) => x.lic.tilstand === 'ansoegt' || x.lic.tilstand === 'suspenderet');
  const foerst = venter.length ? Math.min(...venter.map((x) => x.lic.uger)) : null;
  const grund = st.ok
    ? undefined
    : st.markeder.length === 0 && foerst !== null
      ? venter.length === 1 && p.markeder.length === 1
        ? `Licensen er klar om ${ugerTekst(foerst)}.`
        : `Første licens er klar om ${ugerTekst(foerst)}.`
      : st.markeder.length === 0 && p.markeder.length > 0
        ? 'Ingen af projektets markeder har en aktiv licens.'
        : st.grund;
  return (
    <div className="flex flex-col gap-1.5">
      <Btn
        variant="god"
        disabled={!st.ok}
        onClick={() => useGame.getState().dispatch({ t: 'launch', projectId: p.id })}
        testId={`lancer-${p.id}`}
        title={grund}
        className="dev-puls min-h-14 w-full text-lg"
      >
        <Ikon navn="raket" farve="var(--color-line)" str={20} />
        <span className="font-pixel uppercase tracking-widest">Lancér!</span>
      </Btn>
      <Lanceringsplan g={g} p={p} fuld centreret />
      {grund ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-warn" data-testid="lancer-grund">
          <Ikon navn="ur" farve="var(--color-warn)" indre="var(--color-line)" className="shrink-0" />
          {grund}
        </p>
      ) : (
        <p className="text-center text-xs text-muted">Anmelderne sidder klar med kuglepennen.</p>
      )}
    </div>
  );
}

function ProjektKort({ g, p }: { g: GameState; p: Project }) {
  const type = PRODUCT_TYPES[p.typeId];
  const tema = THEMES[p.themeId];
  const kombi = komboInfo(g, p.typeId, p.themeId);
  const original = p.efterfoelgerAf ? g.produkter.find((x) => x.id === p.efterfoelgerAf) : undefined;
  return (
    <article
      className={`rounded-lg border-2 border-line bg-panel2 p-3 pixel-skygge ${p.klar ? 'outline-2 outline-good' : ''}`}
      data-testid={`projekt-${p.id}`}
    >
      <header className="mb-2 flex flex-wrap items-start gap-x-2 gap-y-1">
        <div className="min-w-[11rem] flex-1">
          <h3 className="flex items-center gap-1.5 font-pixel text-base font-black text-ink">
            <span className="truncate">{p.navn}</span>
            {original && visVersion(p.navn, original.version + 1) && (
              <span className="shrink-0 rounded border-2 border-line bg-violet px-1 text-[0.65rem] text-line" title={`Efterfølger til ${original.navn}`}>
                {original.version + 1}.0
              </span>
            )}
          </h3>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="font-bold text-ink">{type.navn}</span>
            <span aria-hidden>×</span>
            <span className="inline-flex items-center gap-1 font-bold text-ink">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-line" style={{ background: tema.farve }} aria-hidden />
              {tema.navn}
            </span>
            <FitMaerke fit={kombi.fit} foersteForsoeg={p.foersteForsoeg} lille />
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <MarkedChips g={g} p={p} />
          <span
            className={`inline-flex items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 font-pixel text-[0.7rem] font-bold ${p.fejl >= 0.5 ? 'bg-bad text-line' : 'bg-bg2 text-dim'}`}
            title="Fejl: opstår i Teknik, fjernes i Test"
            data-testid="fejl-taeller"
          >
            <Ikon navn="bille" farve={p.fejl >= 0.5 ? 'var(--color-line)' : 'var(--color-dim)'} str={12} />
            <span className="tal">{Math.round(p.fejl)}</span>
            <span className="sr-only">fejl</span>
          </span>
        </div>
      </header>

      <FaseStepper fase={p.fase} klar={p.klar} faseUge={p.faseUge} faseLaengde={p.faseLaengde[p.fase]} />
      {!p.klar && (
        <div className="mt-1.5">
          <Lanceringsplan g={g} p={p} />
        </div>
      )}

      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7rem] text-dim">
        <span>
          Margin <b className="tal text-muted">{pctKort(p.margin)}</b>
        </span>
        <span>
          Intensitet <b className="text-muted">{p.intensitet} · {INTENSITET_NAVN[p.intensitet]}</b>
        </span>
        <span>
          Budget <b className="tal text-muted">{mio(p.budget)}</b>
        </span>
      </p>

      <div className="mt-2 flex flex-col gap-2">
        <Parametre g={g} p={p} />
        {p.klar && p.fejl >= 0.5 && p.faseLaengde.test < BALANCE.maxTestUger && (
          <p className="flex items-center gap-1.5 text-xs text-bad">
            <Ikon navn="bille" farve="var(--color-bad)" str={12} className="shrink-0" />
            Der er stadig {Math.round(p.fejl)} fejl. Tilsynet ser gerne en længere test.
          </p>
        )}
        {!p.klar && <Hold g={g} p={p} />}
        {p.fase === 'test' && <TestForlaeng p={p} />}
        {p.klar && <Lancering g={g} p={p} />}
        <div className="flex justify-end">
          <BekraeftKnap
            tekst="Skrinlæg"
            spoergsmaal={`Skrinlæg ${p.navn}? Budgettet på ${mio(p.budget)} er brugt og kommer ikke igen.`}
            ja="Skrinlæg"
            onJa={() => useGame.getState().dispatch({ t: 'cancelProject', projectId: p.id })}
            testId={`skrinlaeg-${p.id}`}
            className="text-sm"
          />
        </div>
      </div>
    </article>
  );
}

export default function ProjectsPanel() {
  const g = useGame((s) => s.game);
  if (!g) return null;
  const projekter = [...g.projekter].sort((a, b) => Number(b.klar) - Number(a.klar) || a.startUge - b.startUge);
  return (
    <Panel titel="Projekter" ikon="produkt" testId="panel-projekter">
      <DevStil />
      <NytProduktKnap g={g} />
      {projekter.length === 0 ? (
        <TomTilstand g={g} />
      ) : (
        <div className="flex flex-col gap-3">
          {projekter.map((p) => (
            <ProjektKort key={p.id} g={g} p={p} />
          ))}
        </div>
      )}
    </Panel>
  );
}
