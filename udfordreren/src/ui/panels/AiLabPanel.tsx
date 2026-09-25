// AI-laboratoriet (spec 6.16, 7.13, fase 5): agenter med kapacitet, compute, fejlrate og overvågning; AI-scenarierne;
// fristelsen hyperpersonalisering; AI-transformation; børslicens og agent-API. Før 2026: en låst teaser.
import { useState, type ReactNode } from 'react';
import type { AgentFunktion, AiAgent, GameState, WorldAssessment, WorldScenario } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Badge, Btn, Faner, Ikon, Panel, Skyder, Tom, type IkonNavn } from '../components/kit';
import { Afsnit, Chip, KravRaekke } from '../components/FirmaDele';
import { AiMaerke, AiStil, GloedBar, GloedTerminal } from '../components/AiDele';
import AktSkiftDialog from '../dialogs/AktSkiftDialog';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { AGENTER, AGENT_IDS, AI } from '../../data/ai';
import { ROLES } from '../../data/roles';
import { PLATFORM_KINDS } from '../../data/platforms';
import { RESEARCH_BY_ID } from '../../data/research';
import { aiLabAaben, boersStatus, fejlrate, maxAgenter, menneskeligtTilsyn } from '../../sim/selectors';
import { aarFor } from '../../sim/time';
import { fortegn, mio } from '../format';
import {
  BOERS,
  DATA_ADVARSEL,
  TRANSFORMATION_OMDOEMME,
  agentApiKrav,
  agentData,
  agentEffektLinjer,
  agentFaser,
  agentNavn,
  agentOpgave,
  aiScenarier,
  decimal,
  hyperInfo,
  kroner,
  markedsEffektLinjer,
  overvaagningsLoen,
  procentTekst,
  transformationInfo,
  udrulninger,
  uheldPrAar,
  ugerTilLab,
  type EffektLinje,
} from '../lib/aiHjaelp';

const send = (a: Parameters<ReturnType<typeof useGame.getState>['dispatch']>[0]) => useGame.getState().dispatch(a);

// ---------- Små dele ----------

/** Advarsel/forklaring med ikon + farve */
function Note({ ikon, farve, children, testId }: { ikon: IkonNavn; farve: string; children: ReactNode; testId?: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs font-bold" style={{ color: farve }} data-testid={testId}>
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function Tal({ label, children, titel }: { label: string; children: ReactNode; titel?: string }) {
  return (
    <div className="min-w-0 rounded-md border-2 border-line bg-[#0a1024] px-2 py-1.5" title={titel}>
      <div className="text-[0.62rem] uppercase leading-tight tracking-wide break-words text-muted">{label}</div>
      <div className="tal truncate font-pixel text-sm font-bold">{children}</div>
    </div>
  );
}

/** Knap med indbygget "er du sikker?" (to tryk) */
function SikkerKnap({
  children, sikkerTekst, onJa, disabled, title, testId, variant = 'sekundaer', className = '',
}: { children: ReactNode; sikkerTekst: ReactNode; onJa: () => void; disabled?: boolean; title?: string; testId?: string; variant?: 'sekundaer' | 'fare' | 'ghost'; className?: string }) {
  const [aaben, setAaben] = useState(false);
  if (!aaben || disabled) {
    return (
      <Btn variant={variant} onClick={() => setAaben(true)} disabled={disabled} title={title} testId={testId} className={className}>
        {children}
      </Btn>
    );
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`} role="group" aria-label="Bekræft">
      <Btn variant="ghost" onClick={() => setAaben(false)} testId={testId ? `${testId}-fortryd` : undefined}>
        Fortryd
      </Btn>
      <Btn
        variant="fare"
        onClick={() => {
          setAaben(false);
          onJa();
        }}
        testId={testId ? `${testId}-ja` : undefined}
      >
        {sikkerTekst}
      </Btn>
    </span>
  );
}

function EffektListe({ linjer, testId }: { linjer: EffektLinje[]; testId?: string }) {
  return (
    <ul className="grid gap-1" data-testid={testId}>
      {linjer.map((l) => (
        <li key={l.id} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded border-2 border-line px-2 py-1 text-sm ${l.aktiv ? 'bg-[#0a1024]' : 'bg-bg2 opacity-60'}`} title={l.titel}>
          <Ikon navn={l.ikon} farve={l.farve} indre="var(--color-line)" str={14} className="shrink-0" />
          <span className="min-w-[7rem] flex-1 text-muted">{l.label}</span>
          <span className="tal ml-auto text-right font-pixel text-xs font-bold" style={{ color: l.aktiv ? l.farve : 'var(--color-dim)' }}>
            {l.tekst}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Teaser (før 2026) ----------

const FORBEREDELSE: { id: string; tekst: string }[] = [
  { id: 'dataplatform', tekst: 'Dataplatform (grundlaget for alle AI-noder)' },
  { id: 'ansvarligtSpil2', tekst: 'Adfærdsovervågning (fører til AI-risikodetektion)' },
  { id: 'oddsModel', tekst: 'Kvantitativ oddsmodel (fører til AI-trading)' },
  { id: 'kasinoLobby', tekst: 'Kasinolobby 2.0 (fører til AI-indholdsmotoren)' },
  { id: 'personalisering', tekst: 'Personalisering (fører til hyperpersonalisering)' },
];

function Teaser({ g }: { g: GameState }) {
  const uger = ugerTilLab(g);
  const aar = Math.max(1, Math.round(uger / 52));
  const ugeTekst = uger === 1 ? '1 uge' : `${uger} uger`;
  const red = useReduceretBevaegelse();
  return (
    <div className="flex flex-col gap-3" data-testid="ailab-teaser">
      <div className={`ai-nat ai-linjer relative overflow-hidden rounded-lg border-2 border-line px-4 py-5 text-center ${red ? '' : 'ai-scan'}`}>
        <div className="relative flex flex-col items-center gap-2.5">
          <span className="relative">
            <GloedTerminal str={64} slukket />
            <span className="absolute -right-2 -bottom-2 flex h-7 w-7 items-center justify-center rounded border-2 border-line bg-panel2">
              <Ikon navn="laas" farve="var(--color-cyan)" str={16} titel="Låst" />
            </span>
          </span>
          <h3 className="font-pixel text-base font-black uppercase tracking-widest text-cyan ai-tekst-gloed sm:text-lg">AI-laboratoriet åbner i 2026</h3>
          <p className="max-w-md text-sm text-muted">
            Lige nu er serverrummet et kosteskab med en router, der blinker hyggeligt. Om {uger >= 52 ? `ca. ${aar} år` : ugeTekst} flytter agenterne ind: de sætter odds, laver
            kasinoindhold, svarer kunderne og holder øje med dem, der spiller for meget.
          </p>
          <span className="tal rounded border-2 border-line bg-[#070b1a] px-2 py-0.5 font-pixel text-xs font-bold text-cyan" data-testid="ailab-nedtaelling">
            {ugeTekst} til
          </span>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="Agenter, der kommer">
        {AGENT_IDS.map((f) => (
          <li key={f} className="flex items-start gap-2 rounded-md border-2 border-line bg-bg2 p-2 opacity-80">
            <GloedTerminal str={32} funktion={f} slukket />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{AGENTER[f].navn}</span>
              <span className="block text-[0.72rem] leading-snug text-muted">{AGENTER[f].beskrivelse}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="rounded-md border-2 border-line bg-bg2 p-2.5">
        <p className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
          <Ikon navn="kolbe" farve="var(--color-cyan)" indre="var(--color-line)" str={14} /> Forbered jer
        </p>
        <ul className="flex flex-col gap-1">
          {FORBEREDELSE.map((f) => (
            <KravRaekke key={f.id} ok={g.forskning.ulaast.includes(f.id)}>
              {f.tekst}
            </KravRaekke>
          ))}
          <KravRaekke ok={g.platforme.kontoplatform.dataejerskab >= AI.minData}>
            Egne data: dataejerskab mindst 0,3 på kontoplatformen (nu {decimal(g.platforme.kontoplatform.dataejerskab, 1)}). Ellers gør agenterne ingen forskel.
          </KravRaekke>
        </ul>
      </div>
    </div>
  );
}

// ---------- Status og data ----------

function Status({ g, onVerden }: { g: GameState; onVerden: () => void }) {
  const max = maxAgenter(g);
  const ai = g.staff.filter((m) => m.rolle === 'aiIngenioer').length;
  const compute = g.agenter.reduce((a, x) => a + x.computePrUge, 0);
  const loen = g.agenter.reduce((a, x) => a + overvaagningsLoen(g, x.overvaagning), 0);
  const tilsynAgenter = g.agenter.some((a) => a.funktion === 'risiko' || a.funktion === 'compliance');
  const tilsyn = menneskeligtTilsyn(g);
  const over = g.agenter.length - max;
  return (
    <div className="ai-nat relative overflow-hidden rounded-lg border-2 border-line p-2.5" data-testid="ailab-status">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <GloedTerminal str={40} />
        <div className="min-w-[180px] flex-1">
          <p className="font-pixel text-sm font-black uppercase tracking-wider text-cyan ai-tekst-gloed">Laboratoriet er åbent</p>
          <p className="text-xs text-muted">Serverne summer. Agenterne arbejder døgnet rundt, men nogen skal holde øje med dem.</p>
        </div>
        <Btn variant="sekundaer" onClick={onVerden} testId="ailab-verdensbillede" className="w-full shrink-0 sm:w-auto">
          <Ikon navn="globus" farve="var(--color-violet)" indre="var(--color-line)" /> Verdensbilledet
        </Btn>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Tal label="Agenter" titel={`Basis ${AI.maxAgenterBasis} pladser, +${AI.maxPrAiIngenioer} pr. AI-ingeniør (I har ${ai}), +${AI.maxMedOrkestrering} med Agent-orkestrering`}>
          <span className={`inline-flex items-center gap-1 ${over > 0 ? 'text-warn' : 'text-cyan'}`} data-testid="ailab-antal">
            {over > 0 && <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} titel="Over loftet" />}
            {g.agenter.length}/{max}
          </span>
        </Tal>
        <Tal label="Compute / uge" titel="Falder ca. 30 % om året">
          <span className="text-gold">{kroner(compute)}</span>
        </Tal>
        <Tal label="Overvågning / uge" titel="Løn til de mennesker, der holder øje med agenterne">
          <span className="text-gold">{kroner(loen)}</span>
        </Tal>
        <Tal label="AI-uheld i alt" titel="Uheld sker oftere ved lav overvågning">
          <span className={g.aiUheld > 0 ? 'text-bad' : 'text-good'}>{g.aiUheld}</span>
        </Tal>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-3" data-testid="ailab-data">
        {PLATFORM_KINDS.map((k) => {
          const v = g.platforme[k.id].dataejerskab;
          const ok = v + 1e-9 >= AI.minData;
          return (
            <div key={k.id} className="flex flex-col gap-0.5 text-[0.72rem]" title={`Dataejerskab på ${k.navn.toLowerCase()}: ${decimal(v, 1)} (agenter kræver mindst 0,3)`}>
              <span className="flex items-center gap-1.5">
                <Ikon navn={ok ? 'flueben' : 'advarsel'} farve={ok ? 'var(--color-good)' : 'var(--color-warn)'} indre="var(--color-line)" str={12} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-muted" title={`Data · ${k.navn}`}>
                  Data · {k.navn.replace(/platform$/, '')}
                </span>
                <span className="tal shrink-0 font-bold" style={{ color: ok ? 'var(--color-ink)' : 'var(--color-warn)' }}>
                  {decimal(v, 1)}
                </span>
              </span>
              <GloedBar vaerdi={v} farve={ok ? 'var(--color-cyan)' : 'var(--color-warn)'} label={`Dataejerskab ${k.navn}`} markoer={AI.minData} />
            </div>
          );
        })}
      </div>
      {over >= 0 && g.agenter.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[0.72rem] font-bold text-warn" data-testid="ailab-over-loft">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
          {over > 0
            ? `${g.agenter.length} agenter på ${max} pladser: transformationen satte flere i drift, end loftet tillader. De kører videre, men en ny agent kræver, at I først slukker ${over + 1}.`
            : 'Alle pladser er i brug. Ansæt AI-ingeniører eller forsk i orkestrering for at få flere.'}
        </p>
      )}
      {PLATFORM_KINDS.some((k) => g.platforme[k.id].dataejerskab + 1e-9 < AI.minData) && (
        <p className="mt-1.5 text-[0.72rem] text-muted">
          Agenter lærer af jeres egne data. White-label giver kun 0,1: skift til turnkey (0,3), hybrid (0,6) eller egen platform (1,0) for at få effekt.
        </p>
      )}
      {tilsynAgenter && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] text-muted" data-testid="ailab-tilsyn">
          <Ikon navn="folk" farve={tilsyn >= 1 ? 'var(--color-good)' : 'var(--color-warn)'} indre="var(--color-line)" str={12} className="shrink-0" />
          Menneskeligt tilsyn: <b className="tal" style={{ color: tilsyn >= 1 ? 'var(--color-good)' : 'var(--color-warn)' }}>{procentTekst(tilsyn)}</b>. Risiko- og compliance-agenter virker
          fuldt med én compliance-medarbejder pr. agent.
        </p>
      )}
    </div>
  );
}

// ---------- Agenter i drift ----------

function AgentRaekke({ g, a }: { g: GameState; a: AiAgent }) {
  const def = AGENTER[a.funktion];
  const data = agentData(g, a.funktion);
  const opg = agentOpgave(g, a.id);
  const loen = overvaagningsLoen(g, a.overvaagning);
  const uheld = a.uheld ?? 0;
  return (
    <li className={`flex flex-col gap-1.5 rounded-md border-2 p-2 ${data.ok ? 'border-cyan/60 bg-[#0a1024]' : 'border-warn/70 bg-bg2'}`} data-testid={`ailab-agent-${a.id}`}>
      <div className="flex flex-wrap items-start gap-2">
        <GloedTerminal funktion={a.funktion} slukket={!data.ok} />
        <div className="min-w-[150px] flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-pixel text-sm font-bold text-ink">{agentNavn(a)}</span>
            <span className="text-xs font-bold text-cyan">{def.navn}</span>
          </div>
          <div className="tal flex flex-wrap gap-x-3 text-[0.72rem] text-muted">
            <span>
              Kapacitet <b className="text-ink">{a.kapacitet}</b>
            </span>
            <span>
              Compute <b className="text-gold">{kroner(a.computePrUge)}</b>/uge
            </span>
            <span>
              Fejlrate <b className={a.fejlrate > 0.03 ? 'text-warn' : 'text-ink'}>{procentTekst(a.fejlrate, 1)}</b>
            </span>
            <span className="inline-flex items-center gap-1">
              <Ikon navn="bille" farve={uheld > 0 ? 'var(--color-bad)' : 'var(--color-dim)'} str={11} />
              Uheld <b className={uheld > 0 ? 'text-bad' : 'text-ink'}>{uheld}</b>
            </span>
          </div>
        </div>
        <SikkerKnap sikkerTekst="Sluk" onJa={() => send({ t: 'retireAgent', agentId: a.id })} testId={`ailab-sluk-${a.id}`} variant="ghost" className="ml-auto shrink-0">
          <Ikon navn="kryds" /> Sluk
        </SikkerKnap>
      </div>
      {opg && (
        <span>
          <Chip ikon="produkt" farve="var(--color-cyan)">
            {opg}
          </Chip>
        </span>
      )}
      <Skyder
        min={0}
        max={1}
        trin={0.1}
        vaerdi={a.overvaagning}
        onSkift={(v) => send({ t: 'setOvervaagning', agentId: a.id, overvaagning: Math.round(v * 10) / 10 })}
        label="Overvågning"
        vis={(v) => `${decimal(v, 1)} · ${kroner(loen)}/uge`}
        testId={`ailab-overvaagning-${a.id}`}
      />
      <p className="text-[0.7rem] text-muted">
        {a.overvaagning >= 0.7
          ? `Tæt overvågning: få AI-uheld (ca. ${decimal(uheldPrAar(a.fejlrate), 1)} om året), men menneskene koster løn.`
          : a.overvaagning <= 0.3
            ? `Lav overvågning er billig, men giver flere AI-uheld (ca. ${decimal(uheldPrAar(a.fejlrate), 1)} om året).`
            : `Ca. ${decimal(uheldPrAar(a.fejlrate), 1)} AI-uheld om året. Mere overvågning giver færre uheld, men koster løn.`}
        {a.funktion === 'risiko' && a.overvaagning < 0.6 && ' Under 0,6 opfylder risikoagenten ikke AI-risikokrav.'}
      </p>
      {!data.ok && (
        <Note ikon="advarsel" farve="var(--color-warn)" testId={`ailab-data-advarsel-${a.id}`}>
          {DATA_ADVARSEL} Den læser fra {data.kilde} ({decimal(data.vaerdi, 1)}).
        </Note>
      )}
    </li>
  );
}

function AgentListe({ g }: { g: GameState }) {
  if (g.agenter.length === 0) return <Tom>Ingen agenter endnu. Serverne summer forventningsfuldt.</Tom>;
  return (
    <ul className="grid grid-cols-1 gap-2 @2xl:grid-cols-2" data-testid="ailab-agentliste">
      {g.agenter.map((a) => (
        <AgentRaekke key={a.id} g={g} a={a} />
      ))}
    </ul>
  );
}

// ---------- Sæt agent i drift ----------

function NyAgent({ g }: { g: GameState }) {
  const liste = udrulninger(g);
  const [valgt, setValgt] = useState<AgentFunktion>(() => liste.find((u) => u.ok && u.data.ok)?.funktion ?? liste.find((u) => u.ok)?.funktion ?? 'udvikling');
  const [ov, setOv] = useState(0.6);
  const u = liste.find((x) => x.funktion === valgt) ?? liste[0];
  const def = AGENTER[u.funktion];
  const fr = fejlrate(u.funktion, ov);
  const loen = overvaagningsLoen(g, ov);
  const max = maxAgenter(g);
  const faser = agentFaser(u.funktion);
  // Sim-kernens grund siger kun "Plads til N agenter" — også når transformationen har sat flere i drift end loftet
  const grund = u.grund && g.agenter.length >= max
    ? `Alle ${max} pladser er brugt (${g.agenter.length} agenter i drift). Sluk ${g.agenter.length - max + 1} agent${g.agenter.length - max + 1 === 1 ? '' : 'er'}, ansæt AI-ingeniører, eller forsk i orkestrering.`
    : u.grund;
  const deploy = () => {
    if (!u.ok) return;
    send({ t: 'deployAgent', funktion: u.funktion, overvaagning: ov });
  };
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-muted">
        <b className={`tal ${g.agenter.length > max ? 'text-warn' : 'text-cyan'}`}>
          {g.agenter.length} af {max}
        </b>{' '}
        pladser i brug. Hver AI-ingeniør giver {AI.maxPrAiIngenioer} pladser mere, og forskningen "Agent-orkestrering" giver {AI.maxMedOrkestrering}.
      </p>
      <div role="radiogroup" aria-label="Agentfunktion" className="grid grid-cols-1 gap-1.5 @md:grid-cols-2 @3xl:grid-cols-3">
        {liste.map((x) => {
          const erValgt = x.funktion === u.funktion;
          const laast = !x.forskningOk;
          return (
            <button
              key={x.funktion}
              type="button"
              role="radio"
              aria-checked={erValgt}
              onClick={() => setValgt(x.funktion)}
              data-testid={`ailab-funktion-${x.funktion}`}
              className={`flex min-h-[44px] items-center gap-2 rounded-md border-2 p-1.5 text-left ${erValgt ? 'border-cyan bg-[#0c1f3a] ai-gloed-stille' : 'border-line bg-panel2 hover:bg-hi'}`}
            >
              <GloedTerminal str={32} funktion={x.funktion} slukket={laast} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-bold text-ink">
                  <span className="truncate">{AGENTER[x.funktion].navn}</span>
                  {erValgt && <Ikon navn="flueben" farve="var(--color-cyan)" str={12} className="shrink-0" titel="Valgt" />}
                </span>
                {laast ? (
                  <span className="flex items-center gap-1 text-[0.68rem] text-warn">
                    <Ikon navn="laas" farve="var(--color-warn)" str={10} className="shrink-0" /> <span className="truncate">Kræver {x.forskning}</span>
                  </span>
                ) : !x.data.ok ? (
                  <span className="flex items-center gap-1 text-[0.68rem] text-warn">
                    <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={10} className="shrink-0" /> <span className="truncate">For lidt data</span>
                  </span>
                ) : (
                  <span className="tal block truncate text-[0.68rem] text-muted">{kroner(x.compute)}/uge i compute</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-md border-2 border-line bg-[#0a1024] p-2.5" data-testid="ailab-ny-detaljer">
        <div className="flex items-start gap-2">
          <GloedTerminal str={44} funktion={u.funktion} slukket={!u.forskningOk} />
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-sm font-black uppercase tracking-wide text-cyan">{def.navn}</p>
            <p className="text-sm text-ink">{def.beskrivelse}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {faser.length > 0 ? (
                <Chip ikon="produkt" farve="var(--color-cyan)" titel="Kan tildeles projektfaser under Tildel hold">
                  Projektfaser: {faser.join(', ')}
                </Chip>
              ) : (
                <Chip ikon="ur" farve="var(--color-muted)">
                  Arbejder i driften
                </Chip>
              )}
              {def.erstatter && (
                <Chip ikon="folk" farve="var(--color-warn)" titel="Kan overtage stillingen ved en AI-transformation">
                  Kan erstatte: {ROLES[def.erstatter].navn.toLowerCase()}
                </Chip>
              )}
              <Chip ikon={u.data.ok ? 'flueben' : 'advarsel'} farve={u.data.ok ? 'var(--color-good)' : 'var(--color-warn)'} titel="Effekten skaleres med dataejerskab">
                Data: {u.data.kilde} {decimal(u.data.vaerdi, 1)}
              </Chip>
            </div>
          </div>
        </div>
        <Skyder min={0} max={1} trin={0.1} vaerdi={ov} onSkift={(v) => setOv(Math.round(v * 10) / 10)} label="Overvågning" vis={(v) => decimal(v, 1)} testId="ailab-ny-overvaagning" />
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Tal label="Opstart">
            <span className="text-gold">{mio(u.pris)}</span>
          </Tal>
          <Tal label="Compute / uge">
            <span className="text-gold">{kroner(u.compute)}</span>
          </Tal>
          <Tal label="Overvågning / uge">
            <span className="text-gold">{kroner(loen)}</span>
          </Tal>
          <Tal label="Fejlrate" titel={`Ca. ${decimal(uheldPrAar(fr), 1)} AI-uheld om året`}>
            <span className={fr > 0.03 ? 'text-warn' : 'text-good'}>{procentTekst(fr, 1)}</span>
          </Tal>
        </div>
        {u.funktion === 'risiko' && ov < 0.6 && (
          <Note ikon="oeje" farve="var(--color-warn)">
            Under 0,6 i overvågning opfylder risikoagenten ikke AI-risikokrav og beskytter ikke mod hyperpersonaliseringens bagside.
          </Note>
        )}
        {!u.data.ok && (
          <Note ikon="advarsel" farve="var(--color-warn)" testId="ailab-ny-data-advarsel">
            {DATA_ADVARSEL} Den læser fra {u.data.kilde} ({decimal(u.data.vaerdi, 1)}).
          </Note>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {grund && (
            <p className="flex min-w-0 flex-1 basis-full items-start gap-1.5 text-xs font-bold text-warn sm:basis-auto" data-testid="deploy-agent-grund">
              <Ikon navn="laas" farve="var(--color-warn)" str={12} className="mt-0.5 shrink-0" />
              {grund}
            </p>
          )}
          <Btn variant="primaer" onClick={deploy} disabled={!u.ok} title={grund} testId="deploy-agent" className="w-full sm:w-auto">
            <Ikon navn="chip" farve="currentColor" indre="var(--color-gold)" /> Sæt i drift · {mio(u.pris)}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ---------- AI-scenarier ----------

function Scenarier({ g }: { g: GameState }) {
  const liste = aiScenarier(g);
  return (
    <ul className="grid grid-cols-1 gap-2 @2xl:grid-cols-2" data-testid="ailab-scenarier">
      {liste.map((a) => (
        <li key={a.id} className={`flex flex-col gap-1 rounded-md border-2 border-line p-2 ${a.startet ? 'bg-[#0a1024]' : 'bg-bg2 opacity-70'}`} data-testid={`ailab-scenarie-${a.id}`}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{a.navn}</span>
            {!a.startet ? (
              <Badge farve="var(--color-panel2)" tekstFarve="var(--color-muted)">
                <Ikon navn="kalender" farve="var(--color-muted)" str={10} /> Fra {a.fraAar}
              </Badge>
            ) : (
              <span className="tal font-pixel text-xs font-bold text-cyan">{procentTekst(a.styrke)}</span>
            )}
          </div>
          <GloedBar vaerdi={a.styrke} label={`Styrke: ${a.navn}`} />
          <p className="text-[0.74rem] text-muted">{a.mekanik}</p>
          <p className="flex items-start gap-1 text-[0.72rem]">
            <Ikon navn="op" farve="var(--color-good)" str={11} className="mt-0.5 shrink-0" />
            <span>
              <b className="text-good">Vinder:</b> <span className="text-ink">{a.vinder}</span>
            </span>
          </p>
          <p className="flex items-start gap-1 text-[0.72rem]">
            <Ikon navn="ned" farve="var(--color-bad)" str={11} className="mt-0.5 shrink-0" />
            <span>
              <b className="text-bad">Taber:</b> <span className="text-ink">{a.taber}</span>
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

// ---------- Fristelsen: hyperpersonalisering ----------

function Hyper({ g }: { g: GameState }) {
  const h = hyperInfo(g);
  const skift = () => send({ t: 'setHyperpersonalisering', aktiv: !h.aktiv });
  return (
    <div className="flex flex-col gap-2" data-testid="ailab-hyper">
      <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-2">
        <div className={`flex flex-col gap-1.5 rounded-md border-2 p-2.5 ${h.aktiv ? 'border-pink bg-pink/10' : 'border-pink/60 bg-[#0a1024]'}`}>
          <p className="text-sm text-ink">Hver kunde får sine egne tilbud, sine egne beskeder og sine egne spil. Præcis dem, der virker.</p>
          <p className="flex flex-wrap items-center gap-x-2">
            <Ikon navn="op" farve="var(--color-gold)" str={18} className="shrink-0" />
            <span className="tal font-pixel text-2xl font-black text-gold" data-testid="ailab-hyper-gevinst">
              +{procentTekst(h.gevinst)}
            </span>
            <span className="text-xs text-muted">BSI pr. kunde{h.foerst && !h.kopieret ? ' · I er først!' : ''}</span>
          </p>
          <p className="text-[0.72rem] text-muted">
            +10 % for dem, der går først (senest 2027), ellers +5 %. Konkurrenterne kopierer efter 12 måneder, så er 40 % af fordelen tilbage.
            {h.kopiOmUger !== null && ` Kopieres om ${h.kopiOmUger} uger.`}
          </p>
        </div>
        <div className="rounded-md border-2 border-bad/70 bg-bad/10 p-2.5" data-testid="ailab-hyper-pris">
          <p className="mb-1 flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-bad">
            <Ikon navn="advarsel" farve="var(--color-bad)" indre="var(--color-line)" str={12} /> Prisen
          </p>
          {/* Den store regning er tilsynet; byen reagerer mere stille (spejler src/sim/trust.ts og src/sim/town.ts) */}
          <ul className="flex flex-col gap-1 text-[0.74rem]">
            <li className="flex items-start gap-1.5">
              <Ikon navn="skjold" farve="var(--color-bad)" str={12} className="mt-0.5 shrink-0" />
              <span className="text-ink">
                Tilsynet: <b className="tal text-bad">{fortegn(h.tillidPrKvartal)}</b> tilsynstillid pr. kvartal i hvert marked, så længe ingen risikoagent med overvågning ≥ 0,6
                holder øje. Det er den store regning — og den trækker, så længe den kører.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Ikon navn="hus" farve="var(--color-bad)" str={12} className="mt-0.5 shrink-0" />
              <span className="text-ink">
                Byen: kunderne glider ca. {procentTekst(h.byRisikoUden)} hurtigere mod risiko og problemspil (med risikoagenten kun {procentTekst(h.byRisikoMed)}). Alene
                ses det knap, men sammen med høj VIP, bonus og intensitet bliver byen gul og rød.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Ikon navn="lyn" farve="var(--color-warn)" str={12} className="mt-0.5 shrink-0" />
              <span className="text-ink">Konkurrenterne ser jer som mere aggressive, og tilsynet vil gerne vide, hvad algoritmen gør.</span>
            </li>
          </ul>
          <ul className="mt-1.5">
            <KravRaekke ok={h.risikoOk} testId="ailab-hyper-risiko">
              {h.risikoOk ? 'I har en risikoagent med overvågning ≥ 0,6: byen mærker det kun lidt.' : 'Ingen risikoagent med overvågning ≥ 0,6 lige nu.'}
            </KravRaekke>
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!h.aktiv && h.grund && (
          <p className="flex min-w-0 flex-1 basis-full items-start gap-1.5 text-xs font-bold text-warn sm:basis-auto" data-testid="ailab-hyper-grund">
            <Ikon navn="laas" farve="var(--color-warn)" str={12} className="mt-0.5 shrink-0" />
            {h.grund}
          </p>
        )}
        {h.aktiv && (
          <Badge farve="var(--color-pink)" tekstFarve="var(--color-line)">
            <Ikon navn="hype" farve="var(--color-line)" str={10} /> Aktiv
          </Badge>
        )}
        <Btn variant={h.aktiv ? 'sekundaer' : 'primaer'} onClick={skift} disabled={!h.aktiv && !h.ok} title={!h.aktiv ? h.grund : undefined} testId="ailab-hyper-knap" className="w-full sm:w-auto">
          <Ikon navn={h.aktiv ? 'kryds' : 'hype'} farve="currentColor" indre={h.aktiv ? undefined : 'var(--color-gold)'} /> {h.aktiv ? 'Slå fra' : 'Slå hyperpersonalisering til'}
        </Btn>
      </div>
    </div>
  );
}

// ---------- AI-transformation ----------

function Linje({ ikon, farve, label, children }: { ikon: IkonNavn; farve: string; label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={12} className="shrink-0" />
      <span className="min-w-0 flex-1 text-muted">{label}</span>
      <b className="tal shrink-0 text-right" style={{ color: farve }}>
        {children}
      </b>
    </li>
  );
}

function Transformation({ g }: { g: GameState }) {
  const valg = [transformationInfo(g, 0.25), transformationInfo(g, 0.5)];
  const erstattet = g.transformation.reduce((a, t) => a + t.erstattet, 0);
  return (
    <div className="flex flex-col gap-2" data-testid="ailab-transformation">
      <p className="text-sm text-muted">Lad agenterne overtage stillinger. Lønningerne falder med det samme, men folk tager deres viden med sig, og avisen skriver om det.</p>
      <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
        {valg.map((v) => {
          const pct = v.andel === 0.25 ? 25 : 50;
          return (
            <div key={pct} className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-[#0a1024] p-2" data-testid={`ailab-transformation-${pct}`}>
              <p className="font-pixel text-sm font-black text-ink">{pct} % af de mulige stillinger</p>
              <ul className="flex flex-col gap-0.5 text-[0.74rem]">
                <Linje ikon="folk" farve="var(--color-ink)" label="Stillinger">
                  {v.antal}
                </Linje>
                <Linje ikon="penge" farve="var(--color-gold)" label="Fratrædelse (engang)">
                  {mio(v.pris)}
                </Linje>
                <Linje ikon="op" farve="var(--color-good)" label="Løn sparet">
                  {kroner(v.loenSparet)}/uge
                </Linje>
                <Linje ikon="chip" farve="var(--color-cyan)" label="Nye agenter">
                  ca. {v.nyeAgenter}
                </Linje>
                <Linje ikon="ned" farve="var(--color-bad)" label="Viden, der forsvinder">
                  {v.indsigtTab > 0 ? `−${Math.round(v.indsigtTab)} indsigt` : '–'}
                </Linje>
                <Linje ikon="nyhed" farve="var(--color-bad)" label="Omdømme (avisen ringer)">
                  op til {fortegn(TRANSFORMATION_OMDOEMME)}
                </Linje>
              </ul>
              {v.nyeAgenter > 0 && g.agenter.length + v.nyeAgenter > maxAgenter(g) && (
                <Note ikon="advarsel" farve="var(--color-warn)" testId={`ailab-transformation-${pct}-loft`}>
                  Giver {g.agenter.length + v.nyeAgenter} agenter på {maxAgenter(g)} pladser. De kører, men I kan ikke sætte flere i drift (fx en risikoagent), før I har slukket nogle.
                </Note>
              )}
              {v.navne.length > 0 && <p className="line-clamp-2 text-[0.7rem] text-dim">Farvel til {v.navne.join(', ')}</p>}
              {!v.ok && v.grund && (
                <Note ikon="laas" farve="var(--color-warn)" testId={`ailab-transformation-${pct}-grund`}>
                  {v.grund}
                </Note>
              )}
              <SikkerKnap
                sikkerTekst={`Ja, erstat ${v.antal}`}
                onJa={() => send({ t: 'aiTransformation', andel: v.andel })}
                disabled={!v.ok}
                title={v.grund}
                testId={`ailab-transformer-${pct}`}
                className="mt-auto w-full"
              >
                <Ikon navn="chip" farve="var(--color-cyan)" indre="var(--color-line)" /> Erstat {v.antal} stilling{v.antal === 1 ? '' : 'er'}
              </SikkerKnap>
            </div>
          );
        })}
      </div>
      {erstattet > 0 && (
        <p className="text-[0.72rem] text-muted">
          Indtil nu har agenterne overtaget <b className="tal text-ink">{erstattet}</b> stillinger ({g.transformation.map((t) => aarFor(t.uge)).join(', ')}).
        </p>
      )}
    </div>
  );
}

// ---------- Agent-API og børslicens ----------

function AgentApi({ g }: { g: GameState }) {
  const { krav, aktiv, kanalNavn } = agentApiKrav(g);
  return (
    <div className="flex flex-col gap-2" data-testid="ailab-agentapi">
      <p className="text-sm text-muted">
        Kundernes egne AI-agenter shopper odds og bonusser. Med en åben {kanalNavn} handler de direkte hos jer: billige kunder og langt mindre marginpres, når agent-økonomien tager
        fart.
      </p>
      <ul className="flex flex-col gap-1">
        {krav.map((k, i) => (
          <KravRaekke key={i} ok={k.ok}>
            {k.tekst}
          </KravRaekke>
        ))}
      </ul>
      {aktiv ? (
        <Note ikon="flueben" farve="var(--color-good)">
          Kanalen kører. Agenterne har fundet vej.
        </Note>
      ) : (
        <p className="text-[0.72rem] text-dim">Budgettet sættes under Marked, når kravene er opfyldt.</p>
      )}
    </div>
  );
}

function Boers({ g }: { g: GameState }) {
  const st = boersStatus(g);
  const b = g.boerslicens;
  return (
    <div className="flex flex-col gap-2" data-testid="ailab-boers">
      <p className="text-sm text-muted">
        Højesteret har gjort event-kontrakter føderale. Med en børslicens kan I sælge dem i hele USA uden delstatsafgifter, og prediction markets bliver en medvind i stedet for en
        modvind.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Tal label="Gebyr">
          <span className="text-gold">{mio(BOERS.gebyr)}</span>
        </Tal>
        <Tal label="Behandling">
          <span className="text-ink">{BOERS.uger} uger</span>
        </Tal>
      </div>
      {b.status !== 'ingen' && (
        <Note ikon={b.status === 'aktiv' ? 'flueben' : 'ur'} farve={b.status === 'aktiv' ? 'var(--color-good)' : 'var(--color-sky)'}>
          {b.status === 'aktiv' ? 'Børslicensen er aktiv.' : `Ansøgningen behandles${b.klarUge !== null ? ` (klar om ${Math.max(0, b.klarUge - g.uge)} uger)` : ''}.`}
        </Note>
      )}
      {!st.ok && b.status === 'ingen' && st.grund && (
        <Note ikon="laas" farve="var(--color-warn)">
          {st.grund}
        </Note>
      )}
      <Btn variant="primaer" onClick={() => send({ t: 'applyBoersLicens' })} disabled={!st.ok} title={st.grund} testId="ailab-boers-knap" className="w-full sm:w-auto sm:self-end">
        <Ikon navn="noegle" farve="currentColor" indre="var(--color-gold)" /> Søg børslicens · {mio(BOERS.gebyr)}
      </Btn>
    </div>
  );
}

// ---------- Laboratoriet ----------

type LabFane = 'agenter' | 'fristelser' | 'verden';
const LAB_FANER: { id: LabFane; navn: string; ikon: IkonNavn }[] = [
  { id: 'agenter', navn: 'Agenter', ikon: 'terminal' },
  { id: 'fristelser', navn: 'Fristelser', ikon: 'hype' },
  { id: 'verden', navn: 'Verden', ikon: 'globus' },
];

function Lab({ g }: { g: GameState }) {
  const [verden, setVerden] = useState(false);
  // Underfaner: laboratoriet er ellers flere skærmhøjder langt (især på iPad og mobil)
  const [fane, setFane] = useState<LabFane>('agenter');
  const scenarier = (Object.keys(g.verdensscenarier) as WorldScenario[]).filter((k) => (g.verdensscenarier[k] ?? 0) > 0);
  const vurderinger = Object.keys(g.verdensVurderinger) as WorldAssessment[];
  const research = RESEARCH_BY_ID.agentOrkestrering;
  return (
    <div className="@container flex flex-col gap-3">
      <Status g={g} onVerden={() => setVerden(true)} />
      <Faner<LabFane>
        valg={LAB_FANER.map((f) => ({
          ...f,
          badge:
            f.id === 'fristelser' && g.hyperpersonalisering.aktiv ? (
              <span className="h-2 w-2 rounded-full bg-pink" aria-label="(hyperpersonalisering er slået til)" />
            ) : undefined,
        }))}
        vaerdi={fane}
        onSkift={setFane}
        className="shell-uden-scrollbar"
      />
      {fane === 'agenter' && (
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        <Afsnit
          titel="Agenter i drift"
          ikon="terminal"
          farve="var(--color-cyan)"
          className="@2xl:col-span-2"
          testId="ailab-agenter"
          hoejre={<AiMaerke titel={research ? `Flere pladser: ${research.navn}` : undefined}>{`${g.agenter.length}/${maxAgenter(g)}`}</AiMaerke>}
        >
          <AgentListe g={g} />
        </Afsnit>
        <Afsnit titel="Sæt agent i drift" ikon="plus" farve="var(--color-cyan)" className="@2xl:col-span-2" testId="ailab-ny">
          <NyAgent g={g} />
        </Afsnit>
        <Afsnit titel="Hvad agenterne gør" ikon="chip" farve="var(--color-cyan)" className="@2xl:col-span-2" testId="ailab-effekt">
          <EffektListe linjer={agentEffektLinjer(g)} testId="ailab-effekt-liste" />
          {g.agenter.some((a) => !agentData(g, a.funktion).ok) && (
            <div className="mt-1.5">
              <Note ikon="advarsel" farve="var(--color-warn)">
                {DATA_ADVARSEL} Det gælder {g.agenter.filter((a) => !agentData(g, a.funktion).ok).length} af jeres agenter.
              </Note>
            </div>
          )}
        </Afsnit>
      </div>
      )}
      {fane === 'verden' && (
      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        <Afsnit titel="AI i Danmark lige nu" ikon="globus" farve="var(--color-violet)" className="@2xl:col-span-2" testId="ailab-marked">
          <EffektListe linjer={markedsEffektLinjer(g, 'dk')} testId="ailab-marked-liste" />
          <p className="mt-1.5 text-[0.72rem] text-muted">
            Summen af jeres agenter, hyperpersonalisering og AI-scenarierne: agent-økonomien presser marginerne, AI-trading belønner egen sportsbook, og AI-native-bølgen straffer tunge
            organisationer.
          </p>
        </Afsnit>
        <Afsnit titel="AI-scenarier" ikon="trend" farve="var(--color-cyan)" className="@2xl:col-span-2" testId="ailab-scenarier-afsnit">
          <Scenarier g={g} />
        </Afsnit>
        <Afsnit titel="Agent-API" ikon="globus" farve="var(--color-cyan)" testId="ailab-agentapi-afsnit" className={g.flags.includes('boerslicensMulig') ? '' : '@2xl:col-span-2'}>
          <AgentApi g={g} />
        </Afsnit>
        {g.flags.includes('boerslicensMulig') && (
          <Afsnit titel="Børslicens i USA" ikon="noegle" farve="var(--color-gold)" testId="ailab-boers-afsnit">
            <Boers g={g} />
          </Afsnit>
        )}
      </div>
      )}
      {fane === 'fristelser' && (
      <div className="grid grid-cols-1 gap-3">
        <Afsnit titel="Fristelse: hyperpersonalisering" ikon="hype" farve="var(--color-pink)" testId="ailab-hyper-afsnit">
          <Hyper g={g} />
        </Afsnit>
        <Afsnit titel="AI-transformation" ikon="folk" farve="var(--color-warn)" testId="ailab-transformation-afsnit">
          <Transformation g={g} />
        </Afsnit>
      </div>
      )}
      {verden && <AktSkiftDialog signal={{ k: 'aktSkift', scenarier, vurderinger }} onLuk={() => setVerden(false)} genvisning />}
    </div>
  );
}

export default function AiLabPanel() {
  const g = useGame((s) => s.game)!;
  const aaben = aiLabAaben(g);
  return (
    <Panel
      titel="AI-lab"
      ikon="chip"
      testId="panel-ailab"
      hoejre={
        aaben ? (
          <AiMaerke>Åbent</AiMaerke>
        ) : (
          <Badge farve="var(--color-panel2)" tekstFarve="var(--color-cyan)">
            <Ikon navn="laas" farve="var(--color-cyan)" str={10} /> 2026
          </Badge>
        )
      }
    >
      <AiStil />
      {aaben ? <Lab g={g} /> : <Teaser g={g} />}
    </Panel>
  );
}
