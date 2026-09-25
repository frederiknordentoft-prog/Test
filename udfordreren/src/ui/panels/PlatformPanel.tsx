// Platform (fase 4, spec 6.12): byg eller køb. De tre platforme (konto, sportsbook, kasino) med model, kvalitet,
// dataejerskab og revenue share; skift af model med pris, tid og konsekvenser; igangværende migrering med
// fremdrift, risiko og afbryd-knap; B2B-salg af egen platform; og en sammenligning af de fire modeller.
import { useState } from 'react';
import type { GameState, PlatformKind, PlatformModel } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Bar, Btn, Ikon, Panel } from '../components/kit';
import { Afsnit, Chip } from '../components/FirmaDele';
import { PLATFORM_KINDS, PLATFORM_MODELS, MIGRERING, B2B } from '../../data/platforms';
import { b2bStatus, datoTekst, gennemsnitligPlatformKvalitet, kindNavn, platformKvalitet, platformStatus, revenueShare } from '../../sim/selectors';
import { mio, mioKort, pct } from '../format';
import {
  KIND_IKON, KIND_ROLLE, MODEL_RAEKKE, afbrydRefusion, b2bIndtaegt, migreringFremdrift, migreringsTid, skiftKonsekvenser, udviklerKrav, type EffektLinje,
} from '../lib/konkurrentHjaelp';

const TONE_FARVE: Record<EffektLinje['tone'], string> = { god: 'var(--color-good)', skidt: 'var(--color-bad)', neutral: 'var(--color-muted)' };
const MODEL_FARVE: Record<PlatformModel, string> = { whiteLabel: 'var(--color-muted)', turnkey: 'var(--color-sky)', hybrid: 'var(--color-violet)', egen: 'var(--color-gold)' };
const MODEL_IKON: Record<PlatformModel, string> = { whiteLabel: 'taske', turnkey: 'noegle', hybrid: 'tandhjul', egen: 'hus' };
const komma = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

// ---------- Nøgletal og forklaring ----------

function Noegletal({ g }: { g: GameState }) {
  const rsBet = revenueShare(g, 'betting');
  const rsKas = revenueShare(g, 'kasino');
  const kval = gennemsnitligPlatformKvalitet(g);
  const data = g.platforme.kontoplatform.dataejerskab;
  const felter = [
    { id: 'rs-betting', navn: 'Revenue share · betting', v: pct(rsBet, rsBet < 0.1 ? 1 : 0), ikon: 'bold', farve: rsBet > 0.15 ? 'var(--color-warn)' : 'var(--color-good)', titel: 'Andel af betting-BSI, der går til platformleverandørerne' },
    { id: 'rs-kasino', navn: 'Revenue share · kasino', v: pct(rsKas, rsKas < 0.1 ? 1 : 0), ikon: 'diamant', farve: rsKas > 0.15 ? 'var(--color-warn)' : 'var(--color-good)', titel: 'Andel af kasino-BSI, der går til platformleverandørerne' },
    { id: 'kvalitet', navn: 'Platformkvalitet', v: `${Math.round(kval)}/100`, ikon: 'tandhjul', farve: 'var(--color-sky)', titel: 'Gennemsnit af de tre platforme (lavere under migrering)' },
    { id: 'data', navn: 'Dataejerskab', v: komma(data), ikon: 'indsigt', farve: 'var(--color-cyan)', titel: 'Fra kontoplatformen. Styrer, hvor meget AI-agenterne kan udrette fra 2026' },
    { id: 'b2b', navn: 'B2B pr. uge', v: g.b2bIndtaegtPrUge > 0 ? `+${mioKort(g.b2bIndtaegtPrUge)}` : '–', ikon: 'penge', farve: 'var(--color-gold)', titel: 'Indtægt fra operatører, der lejer jeres egen platform' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 @xl:grid-cols-5" data-testid="platform-noegletal">
      {felter.map((f) => (
        <div key={f.id} className="min-w-0 rounded-md border-2 border-line bg-bg2 px-2 py-1.5" title={f.titel} data-testid={`platform-tal-${f.id}`}>
          <div className="flex items-center gap-1 text-[0.62rem] uppercase leading-tight tracking-wide text-muted">
            <Ikon navn={f.ikon} farve={f.farve} indre="var(--color-line)" str={11} className="shrink-0" /> <span className="truncate">{f.navn}</span>
          </div>
          <div className="tal font-pixel text-sm font-black" style={{ color: f.farve }}>
            {f.v}
          </div>
        </div>
      ))}
    </div>
  );
}

function ByggeEllerKoebe() {
  return (
    <details className="rounded-md border-2 border-line bg-bg2" data-testid="byg-eller-koeb">
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-1.5 px-2.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
        <Ikon navn="spoergsmaal" farve="var(--color-cyan)" str={13} /> Byg eller køb? Spillets rygrad
      </summary>
      <div className="flex flex-col gap-1.5 px-2.5 pb-2.5 text-sm text-muted">
        <p>
          <b className="text-ink">Køb</b> (white-label eller turnkey) er hurtigt og billigt at komme i gang med — men leverandøren tager en bid af hver krone, kvalitetsloftet er
          lavt, og jeres data bor hos dem.
        </p>
        <p>
          <b className="text-ink">Byg</b> (hybrid eller egen) koster capex og år af jeres udvikleres liv. Til gengæld forsvinder revenue share, kvaliteten kan nå højere op, og I ejer
          data — det, AI-agenterne lever af fra 2026.
        </p>
        <p>
          En egen sportsbook eller kasinoplatform kan endda <b className="text-gold">sælges B2B</b> til andre operatører. Sådan blev Kombi født i 2014.
        </p>
        <p className="text-xs">
          Et modelskift kræver en migrering: kvaliteten er {Math.round((1 - MIGRERING.kvalitetUnder) * 100)} % lavere undervejs, og der er {Math.round(MIGRERING.nedbrudPrUge * 100)} %
          risiko pr. uge for et nedbrud. Afbryder I, får I halvdelen af investeringen tilbage.
        </p>
      </div>
    </details>
  );
}

// ---------- Én platform ----------

function Migrering({ g, kind }: { g: GameState; kind: PlatformKind }) {
  const p = g.platforme[kind];
  const f = migreringFremdrift(g, p);
  if (!p.migrererTil || !f) return null;
  const til = PLATFORM_MODELS[p.migrererTil];
  const refusion = afbrydRefusion(p);
  return (
    <div className="flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-2.5" data-testid={`migrering-${kind}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wide text-ink">
          <Ikon navn="pil" farve="var(--color-sky)" str={12} /> Migrerer til {til.navn.toLowerCase()}
        </span>
        <span className="tal text-xs text-muted">
          Uge {f.gaaet} af {f.ialt} · færdig ca. {datoTekst(p.migreringFaerdigUge ?? g.uge)}
        </span>
      </div>
      <Bar vaerdi={f.andel} max={1} farve="var(--color-sky)" hoejde={10} label={`Migrering ${Math.round(f.andel * 100)} %`} />
      <ul className="flex flex-col gap-1 text-xs">
        <li className="flex items-start gap-1.5 text-warn">
          <Ikon navn="ned" farve="var(--color-warn)" str={11} className="mt-0.5 shrink-0" />
          Kvalitetsdyk: {Math.round(platformKvalitet(g, kind))} i stedet for {Math.round(p.kvalitet)}, indtil migreringen er færdig.
        </li>
        <li className="flex items-start gap-1.5 text-bad">
          <Ikon navn="advarsel" farve="var(--color-bad)" indre="var(--color-line)" str={11} className="mt-0.5 shrink-0" />
          Nedbrudsrisiko {Math.round(MIGRERING.nedbrudPrUge * 100)} % om ugen — hvert nedbrud koster ca. {Math.round(-MIGRERING.nedbrudKunder * 100)} % af kunderne.
        </li>
      </ul>
      <Btn variant="fare" onClick={() => useGame.getState().dispatch({ t: 'choosePlatform', kind, model: p.model })} testId={`afbryd-${kind}`} className="self-start">
        <Ikon navn="kryds" farve="currentColor" str={13} /> Afbryd (halv refusion: {mio(refusion)})
      </Btn>
    </div>
  );
}

function ModelValg({ g, kind }: { g: GameState; kind: PlatformKind }) {
  const p = g.platforme[kind];
  const [valgt, setValgt] = useState<PlatformModel | null>(null);
  if (p.migrererTil) return null;
  const st = valgt ? platformStatus(g, kind, valgt) : null;
  const def = valgt ? PLATFORM_MODELS[valgt] : null;
  const start = () => {
    if (!valgt) return;
    if (useGame.getState().dispatch({ t: 'choosePlatform', kind, model: valgt })) setValgt(null);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">Skift model</div>
      <div className="grid grid-cols-2 gap-1 @md:grid-cols-4" role="radiogroup" aria-label={`Model for ${kindNavn(kind).toLowerCase()}`}>
        {MODEL_RAEKKE.map((m) => {
          const d = PLATFORM_MODELS[m];
          const nu = p.model === m;
          const s = platformStatus(g, kind, m);
          const er = valgt === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={er}
              disabled={nu}
              onClick={() => setValgt(er ? null : m)}
              data-testid={`model-${kind}-${m}`}
              className={`flex min-h-[44px] min-w-0 flex-col items-start rounded-md border-2 border-line px-2 py-1 text-left ${
                nu ? 'bg-hi/60 text-ink' : er ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-ink hover:bg-hi'
              }`}
            >
              <span className="flex w-full items-center gap-1 font-pixel text-[0.7rem] font-black uppercase">
                <Ikon navn={nu ? 'flueben' : s.ok ? MODEL_IKON[m] : 'laas'} farve={er ? 'var(--color-line)' : nu ? 'var(--color-good)' : s.ok ? MODEL_FARVE[m] : 'var(--color-dim)'} indre="var(--color-line)" str={11} className="shrink-0" />
                <span className="truncate">{d.navn}</span>
              </span>
              <span className={`tal text-[0.68rem] ${er ? 'text-line/80' : 'text-muted'}`}>{nu ? 'Nuværende' : `${d.capex > 0 ? mioKort(d.capex) : 'Gratis'} · ${migreringsTid(d.uger)}`}</span>
            </button>
          );
        })}
      </div>
      {valgt && st && def && (
        <div className="flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-2.5" data-testid={`skift-${kind}`}>
          <p className="font-pixel text-xs font-black uppercase tracking-wide text-ink">
            {kindNavn(kind)} → {def.navn}: {st.pris > 0 ? mio(st.pris) : 'ingen capex'} · {migreringsTid(st.uger)}
          </p>
          <ul className="flex flex-col gap-1">
            {skiftKonsekvenser(p, valgt).map((e) => (
              <li key={e.tekst} className="flex items-start gap-1.5 text-xs" style={{ color: TONE_FARVE[e.tone] }}>
                <Ikon navn={e.ikon} farve={TONE_FARVE[e.tone]} indre="var(--color-line)" str={11} className="mt-0.5 shrink-0" />
                <span className="text-ink">{e.tekst}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="primaer" disabled={!st.ok} onClick={start} testId={`vaelg-platform-${kind}`}>
              <Ikon navn="server" farve="currentColor" indre="var(--color-gold)" str={14} /> {def.uger[1] === 0 ? 'Skift nu' : 'Start migrering'}
            </Btn>
            <Btn variant="ghost" onClick={() => setValgt(null)} testId={`fortryd-platform-${kind}`}>
              Fortryd
            </Btn>
            {!st.ok && st.grund && (
              <span className="flex min-w-0 flex-1 basis-40 items-start gap-1 text-xs text-warn" data-testid={`platform-grund-${kind}`}>
                <Ikon navn="laas" farve="var(--color-warn)" str={11} className="mt-0.5 shrink-0" />
                {st.grund}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function B2bSalg({ g, kind }: { g: GameState; kind: PlatformKind }) {
  const p = g.platforme[kind];
  const st = b2bStatus(g, kind);
  const ind = b2bIndtaegt(p);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2.5" data-testid={`b2b-${kind}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-2">
        <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wide text-ink">
          <Ikon navn="taske" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> B2B-salg
        </span>
        <span className="tal text-xs text-muted">
          {p.b2bKunder} af {B2B.maxKunder} kunder · <span className="text-gold">{ind > 0 ? `+${mioKort(ind)}/uge` : '0 kr./uge'}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn disabled={!st.ok} onClick={() => useGame.getState().dispatch({ t: 'sellPlatformB2B', kind })} testId={`saelg-b2b-${kind}`} title={st.ok ? undefined : st.grund}>
          <Ikon navn="taske" farve={st.ok ? 'var(--color-gold)' : 'currentColor'} indre="var(--color-line)" str={14} /> Sælg til en operatør
        </Btn>
        <span className="flex min-w-0 flex-1 basis-40 items-start gap-1 text-xs text-muted" data-testid={`b2b-grund-${kind}`}>
          <Ikon navn={st.ok ? 'flueben' : 'laas'} farve={st.ok ? 'var(--color-good)' : 'var(--color-muted)'} str={11} className="mt-0.5 shrink-0" />
          {st.ok
            ? `Et salgsmøde pr. kvartal. Hver kunde giver op til ${mioKort(B2B.indtaegtPrKundePrUge)} om ugen (ved kvalitet 100).${st.licens > 0 ? ` Første salg kræver en B2B-licens: ${mio(st.licens)}.` : ''}`
            : st.grund}
        </span>
      </div>
    </div>
  );
}

function PlatformKort({ g, kind }: { g: GameState; kind: PlatformKind }) {
  const p = g.platforme[kind];
  const def = PLATFORM_MODELS[p.model];
  const kval = platformKvalitet(g, kind);
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-md border-2 border-line bg-bg2 p-2.5" data-testid={`platform-${kind}`}>
      <header className="flex items-start gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-line" style={{ background: MODEL_FARVE[p.model] }}>
          <Ikon navn={KIND_IKON[kind]} farve="var(--color-line)" indre={MODEL_FARVE[p.model]} str={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-pixel text-sm font-black text-ink">{kindNavn(kind)}</h3>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <Chip ikon={MODEL_IKON[p.model]} farve={MODEL_FARVE[p.model]}>
              {def.navn}
            </Chip>
            {p.migrererTil && (
              <Chip ikon="pil" farve="var(--color-sky)">
                → {PLATFORM_MODELS[p.migrererTil].navn}
              </Chip>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[0.62rem] uppercase text-muted">Rev. share</div>
          <div className="tal font-pixel text-sm font-black" style={{ color: def.revenueShare > 0.15 ? 'var(--color-warn)' : 'var(--color-good)' }}>
            {pct(def.revenueShare)}
          </div>
        </div>
      </header>
      <p className="text-xs text-muted">{KIND_ROLLE[kind]}</p>
      <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
        <div>
          <div className="mb-0.5 flex justify-between text-xs text-muted">
            <span className="flex items-center gap-1">
              <Ikon navn="tandhjul" farve="var(--color-sky)" indre="var(--color-line)" str={11} /> Kvalitet
            </span>
            <span className="tal">
              <b className="text-ink">{Math.round(kval)}</b> / loft {def.kvalitetsloft}
            </span>
          </div>
          <div className="relative">
            <Bar vaerdi={kval} max={100} farve="var(--color-sky)" label={`Kvalitet ${Math.round(kval)}`} />
            <span className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `${def.kvalitetsloft}%` }} title={`Kvalitetsloft ${def.kvalitetsloft}`} aria-hidden />
          </div>
        </div>
        <div>
          <div className="mb-0.5 flex justify-between text-xs text-muted">
            <span className="flex items-center gap-1">
              <Ikon navn="indsigt" farve="var(--color-cyan)" indre="var(--color-line)" str={11} /> Dataejerskab
            </span>
            <span className="tal">
              <b className="text-ink">{komma(p.dataejerskab)}</b> / 1,0
            </span>
          </div>
          <Bar vaerdi={p.dataejerskab} max={1} farve="var(--color-cyan)" label={`Dataejerskab ${komma(p.dataejerskab)}`} />
        </div>
      </div>
      {p.migrererTil ? <Migrering g={g} kind={kind} /> : <ModelValg g={g} kind={kind} />}
      {kind !== 'kontoplatform' && <B2bSalg g={g} kind={kind} />}
    </article>
  );
}

// ---------- Sammenligning af modellerne ----------

function Sammenligning({ g }: { g: GameState }) {
  const maxCapex = Math.max(...MODEL_RAEKKE.map((m) => PLATFORM_MODELS[m].capex));
  const maxRs = Math.max(...MODEL_RAEKKE.map((m) => PLATFORM_MODELS[m].revenueShare));
  const maxUger = Math.max(...MODEL_RAEKKE.map((m) => PLATFORM_MODELS[m].uger[1]));
  return (
    <Afsnit titel="De fire modeller" ikon="bog" testId="platform-sammenligning">
      <div className="grid grid-cols-2 gap-1.5 @2xl:grid-cols-4">
        {MODEL_RAEKKE.map((m) => {
          const d = PLATFORM_MODELS[m];
          const bruges = PLATFORM_KINDS.filter((k) => g.platforme[k.id].model === m);
          const raekker = [
            { navn: 'Capex', v: d.capex > 0 ? mio(d.capex) : 'Gratis', bar: d.capex / maxCapex, farve: 'var(--color-gold)', ikon: 'penge' },
            { navn: 'Migrering', v: migreringsTid(d.uger), bar: d.uger[1] / maxUger, farve: 'var(--color-muted)', ikon: 'ur' },
            { navn: 'Revenue share', v: pct(d.revenueShare), bar: d.revenueShare / maxRs, farve: 'var(--color-warn)', ikon: 'ned' },
            { navn: 'Kvalitetsloft', v: String(d.kvalitetsloft), bar: d.kvalitetsloft / 100, farve: 'var(--color-sky)', ikon: 'tandhjul' },
            { navn: 'Dataejerskab', v: komma(d.dataejerskab), bar: d.dataejerskab, farve: 'var(--color-cyan)', ikon: 'indsigt' },
          ];
          return (
            <div key={m} className="flex min-w-0 flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2" data-testid={`model-kort-${m}`}>
              <div className="flex items-center gap-1.5 font-pixel text-[0.72rem] font-black uppercase text-ink">
                <Ikon navn={MODEL_IKON[m]} farve={MODEL_FARVE[m]} indre="var(--color-line)" str={13} className="shrink-0" />
                <span className="truncate">{d.navn}</span>
              </div>
              {raekker.map((r) => (
                <div key={r.navn} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-1 text-[0.66rem]">
                    <span className="truncate text-muted">{r.navn}</span>
                    <span className="tal font-pixel font-bold text-ink">{r.v}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-sm border border-line bg-bg">
                    <div className="h-full" style={{ width: `${Math.max(0, Math.min(1, r.bar)) * 100}%`, background: r.farve }} />
                  </div>
                </div>
              ))}
              <div className="text-[0.66rem] text-muted">
                {udviklerKrav(m) > 0 ? `Kræver ${udviklerKrav(m)} udviklere` : m === 'turnkey' ? 'Sportsbook fra 2014' : 'Kræver ingenting'}
                {m === 'egen' && ' · kan sælges B2B'}
              </div>
              {bruges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {bruges.map((k) => (
                    <Chip key={k.id} ikon="flueben" farve="var(--color-good)">
                      {k.navn}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Afsnit>
  );
}

// ---------- Panelet ----------

export default function PlatformPanel() {
  const g = useGame((s) => s.game);
  if (!g) return null;
  const migrerer = PLATFORM_KINDS.filter((k) => g.platforme[k.id].migrererTil).length;
  return (
    <Panel
      titel="Platform"
      ikon="server"
      testId="panel-platform"
      hoejre={<span className="font-pixel text-xs text-muted">{migrerer > 0 ? `${migrerer} migrering${migrerer === 1 ? '' : 'er'} i gang` : 'Stabil drift'}</span>}
    >
      <div className="@container flex flex-col gap-3">
        <Noegletal g={g} />
        <ByggeEllerKoebe />
        <div className="grid grid-cols-1 gap-2">
          {PLATFORM_KINDS.map((k) => (
            <PlatformKort key={k.id} g={g} kind={k.id} />
          ))}
        </div>
        <Sammenligning g={g} />
      </div>
    </Panel>
  );
}
