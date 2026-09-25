// Tildel hold (spec 6.2): vælg folk pr. fase. Viser den relevante stat, energi, status og et estimat af ugens point,
// så spilleren lærer, at små, stærke hold slår store (holdvægt 0,5^(n−1)).
import { useMemo, useState } from 'react';
import type { GameState, Phase, Project, Staff } from '../../sim/types';
import { PHASES } from '../../sim/types';
import type { UiDialog } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';
import { ledigeAgenter, ledigeTilProjekt, opgaverFor } from '../../sim/selectors';
import { personPoint } from '../../sim/projects';
import { ROLES } from '../../data/roles';
import { BALANCE } from '../../data/balance';
import { Btn, Faner, Ikon, Modal, Tom } from '../components/kit';
import { DevStil, EnergiBar, StaffAvatar } from '../components/DevDele';
import { FASE_GIVER, FASE_NAVN, FASE_STAT_TEKST, PARAM_FARVE, PARAM_KORT, PARAM_NAVN, faseStat, holdEstimat, ugerTekst } from '../lib/devHjaelp';
import { PARAM_KEYS } from '../../sim/types';
import { AGENTER } from '../../data/ai';
import { AiMaerke, GloedTerminal } from '../components/AiDele';
import { DATA_ADVARSEL, agentData, agentNavn, procentTekst } from '../lib/aiHjaelp';

function statTekst(m: Staff, fase: Phase): string {
  const st = m.stats;
  if (fase === 'koncept') return `Kre ${st.kreativitet}`;
  if (fase === 'design') return `Kre ${st.kreativitet} · Mat ${st.matematik}`;
  if (fase === 'teknik') return `Tek ${st.teknik}`;
  return `Tek ${st.teknik} · Ans ${st.ansvar}`;
}

function samme(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

type Status = { optaget: boolean; tekst: string; farve: string };

function statusFor(g: GameState, p: Project, m: Staff, fase: Phase, ledige: Set<string>, opgaver: ReturnType<typeof opgaverFor>): Status {
  const o = opgaver[m.id];
  const aktivFase = fase === p.fase && !p.klar;
  if (o?.type === 'kontrakt') {
    const c = g.kontraktopgaver.find((x) => x.id === o.contractId);
    const tekst = c ? `På opgave: ${c.tilbud.navn} (${ugerTekst(c.resterendeUger)} tilbage)` : 'På en kontraktopgave';
    return { optaget: aktivFase && !ledige.has(m.id), tekst: aktivFase ? tekst : `${tekst} — kan være fri, når fasen starter`, farve: 'var(--color-warn)' };
  }
  if (o?.type === 'projekt' && o.projectId !== p.id) {
    const andet = g.projekter.find((x) => x.id === o.projectId);
    const tekst = `Arbejder på ${andet?.navn ?? 'et andet projekt'}`;
    return { optaget: aktivFase && !ledige.has(m.id), tekst, farve: 'var(--color-warn)' };
  }
  if (o?.type === 'projekt' && o.projectId === p.id) return { optaget: false, tekst: 'Arbejder på projektet', farve: 'var(--color-good)' };
  return { optaget: false, tekst: 'Ledig', farve: 'var(--color-good)' };
}

function Estimat({ g, p, fase, ids }: { g: GameState; p: Project; fase: Phase; ids: string[] }) {
  const est = holdEstimat(g, p, fase, ids);
  const maxParam = Math.max(1, ...PARAM_KEYS.map((k) => est.params[k]));
  const sidste = est.bidrag.length >= 2 ? est.bidrag[est.bidrag.length - 1] : undefined;
  const svagest =
    sidste && sidste.point < 0.2 * est.total
      ? { navn: g.staff.find((m) => m.id === sidste.id)?.navn.split(' ')[0] ?? g.agenter.find((a) => a.id === sidste.id)?.navn ?? 'Den sidste', point: sidste.point }
      : undefined;
  return (
    <div className="rounded-md border-2 border-line bg-bg2 p-3" data-testid="tildel-estimat">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="shrink-0">
          <div className="text-[0.68rem] uppercase tracking-wide text-muted">Forventet pr. uge</div>
          <div className="tal font-pixel text-2xl font-black text-gold" data-testid="tildel-point">
            {ids.length === 0 ? '0' : `≈ ${Math.round(est.total)}`}
            <span className="ml-1 text-xs font-bold text-muted">point</span>
          </div>
        </div>
        <div className="grid min-w-[180px] flex-1 grid-cols-2 gap-x-3 gap-y-1">
          {PARAM_KEYS.filter((k) => BALANCE.fordeling[fase][k] > 0).map((k) => (
            <div key={k} className="flex items-center gap-1.5 text-[0.7rem]">
              <span className="w-9 shrink-0 font-bold" style={{ color: PARAM_FARVE[k] }} title={PARAM_NAVN[k]}>
                {PARAM_KORT[k]}
              </span>
              <span className="block h-2 flex-1 overflow-hidden rounded-sm border border-line bg-bg">
                <span className="block h-full" style={{ width: `${(est.params[k] / maxParam) * 100}%`, background: PARAM_FARVE[k] }} />
              </span>
              <span className="tal w-8 text-right text-muted">+{Math.round(est.params[k])}</span>
            </div>
          ))}
        </div>
        {fase === 'teknik' && ids.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-bad" title="Fejl opstår i teknikfasen — flere ved lav teknik og lav energi">
            <Ikon navn="bille" farve="var(--color-bad)" str={14} />
            <span className="tal">≈ +{est.fejl.toFixed(1).replace('.', ',')} fejl/uge</span>
          </div>
        )}
        {fase === 'test' && ids.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-good" title="Test fjerner fejl — mest med høj teknik og ansvar">
            <Ikon navn="bille" farve="var(--color-good)" str={14} />
            <span className="tal">≈ −{est.fjernet.toFixed(1).replace('.', ',')} fejl/uge</span>
          </div>
        )}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[0.7rem] text-muted">
        <Ikon navn="stjerne" farve="var(--color-gold)" str={12} className="mt-px shrink-0" />
        Den stærkeste tæller fuldt, nr. 2 halvt, nr. 3 en fjerdedel. Små, stærke hold vinder — og alle på holdet bruger energi.
      </p>
      {svagest && (
        <p className="mt-1 flex items-start gap-1.5 text-[0.7rem] text-cyan" data-testid="tildel-tip">
          <Ikon navn="indsigt" farve="var(--color-cyan)" indre="var(--color-line)" str={12} className="mt-px shrink-0" />
          Tip: {svagest.navn} giver kun +{Math.round(svagest.point)} her. Uden for holdet hviler vedkommende og får energi til næste fase.
        </p>
      )}
    </div>
  );
}

export default function AssignDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const projectId = dialog.kind === 'tildel' ? dialog.projectId : '';
  const p = g?.projekter.find((x) => x.id === projectId);
  const [fane, setFane] = useState<Phase>(() => (p && !p.klar ? p.fase : 'test'));
  const [valg, setValg] = useState<Record<Phase, string[]>>(() =>
    p ? { koncept: [...p.faseTildeling.koncept], design: [...p.faseTildeling.design], teknik: [...p.faseTildeling.teknik], test: [...p.faseTildeling.test] } : { koncept: [], design: [], teknik: [], test: [] },
  );

  const ledige = useMemo(() => (g && p ? new Set(ledigeTilProjekt(g, p.id).map((m) => m.id)) : new Set<string>()), [g, p]);
  // + AI-akten: agenter, der kan arbejde i hver fase (ikke optaget i et andet projekts aktive fase)
  const agentFaser = useMemo(() => {
    const r = { koncept: new Set<string>(), design: new Set<string>(), teknik: new Set<string>(), test: new Set<string>() } as Record<Phase, Set<string>>;
    if (g && p) for (const f of PHASES) for (const a of ledigeAgenter(g, p, f)) r[f].add(a.id);
    return r;
  }, [g, p]);
  const opgaver = useMemo(() => (g ? opgaverFor(g) : {}), [g]);

  if (!g || !p) {
    return (
      <Modal titel="Tildel hold" onLuk={onLuk} testId="dialog-tildel" bredde={480} fod={<Btn onClick={onLuk}>Luk</Btn>}>
        <Tom>Projektet findes ikke længere.</Tom>
      </Modal>
    );
  }

  const aktivFase = !p.klar ? p.fase : null;
  const faseIdx = PHASES.indexOf(p.fase);
  /** Dem, der faktisk kan arbejde i en fase (i den aktive fase: ikke optaget andetsteds) */
  const erAgent = (id: string) => g.agenter.some((a) => a.id === id);
  const effektive = (f: Phase): string[] => valg[f].filter((id) => (erAgent(id) ? agentFaser[f].has(id) : f !== aktivFase || ledige.has(id)));

  const toggle = (id: string) => {
    setValg((v) => ({ ...v, [fane]: v[fane].includes(id) ? v[fane].filter((x) => x !== id) : [...v[fane], id] }));
  };
  const alleFaser = () => {
    const ids = valg[fane];
    setValg((v) => {
      const ny = { ...v };
      for (const f of PHASES) {
        if (PHASES.indexOf(f) < faseIdx && !p.klar) continue; // afsluttede faser røres ikke
        ny[f] = ids.filter((id) => (erAgent(id) ? agentFaser[f].has(id) : f !== aktivFase || ledige.has(id)));
      }
      return ny;
    });
  };

  const aendrede = PHASES.filter((f) => !samme(effektive(f), p.faseTildeling[f]));
  const gem = () => {
    const st = useGame.getState();
    for (const f of aendrede) {
      if (!st.dispatch({ t: 'assignPhase', projectId: p.id, fase: f, ids: effektive(f) })) return;
    }
    onLuk();
  };

  const staff = [...g.staff].sort((a, b) => personPoint(b, p, fane) - personPoint(a, p, fane));
  const estIds = effektive(fane);
  const est = holdEstimat(g, p, fane, estIds);
  const bidragFor = new Map(est.bidrag.map((b) => [b.id, b]));
  const bedsteId = staff[0]?.id;

  return (
    <Modal
      titel={`Tildel hold · ${p.navn}`}
      onLuk={onLuk}
      testId="dialog-tildel"
      bredde={780}
      fod={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Btn variant="ghost" onClick={alleFaser} testId="tildel-alle-faser" title="Brug det valgte hold i alle kommende faser" className="basis-full sm:basis-auto">
            <Ikon navn="folk" /> Samme hold i alle faser
          </Btn>
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Btn onClick={onLuk} className="flex-1 sm:flex-none">
              Annullér
            </Btn>
            <Btn variant="primaer" onClick={gem} testId="tildel-gem" className="flex-[2] sm:flex-none">
              <Ikon navn="flueben" /> {aendrede.length ? 'Gem hold' : 'OK'}
            </Btn>
          </div>
        </div>
      }
    >
      <DevStil />
      <Faner<Phase>
        className="mb-3"
        valg={PHASES.map((f, i) => {
          const n = effektive(f).length;
          const faerdig = !p.klar ? i < faseIdx : true;
          return {
            id: f,
            navn: FASE_NAVN[f],
            badge: (
              <span
                className={`tal ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded border-2 border-line px-0.5 text-[0.62rem] ${
                  n === 0 && !faerdig ? 'bg-warn text-line' : f === aktivFase ? 'bg-good text-line' : 'bg-bg2 text-muted'
                }`}
                title={f === aktivFase ? 'Aktiv fase' : faerdig ? 'Afsluttet' : undefined}
              >
                {faerdig && f !== aktivFase ? <Ikon navn="flueben" farve="var(--color-good)" str={10} /> : n === 0 ? '!' : n}
              </span>
            ),
          };
        })}
        vaerdi={fane}
        onSkift={setFane}
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-pixel font-bold uppercase text-ink">{FASE_NAVN[fane]}</span>
        <span>
          Stat: <b className="text-ink">{FASE_STAT_TEKST[fane]}</b>
        </span>
        <span>Giver: {FASE_GIVER[fane]}</span>
        <span className="tal">
          {ugerTekst(p.faseLaengde[fane])}
          {fane === aktivFase ? ` · uge ${Math.min(p.faseUge + 1, p.faseLaengde[fane])} nu` : ''}
        </span>
        {!p.klar && PHASES.indexOf(fane) < faseIdx && <span className="text-dim">Fasen er afsluttet.</span>}
      </div>

      <Estimat g={g} p={p} fase={fane} ids={estIds} />

      {estIds.length === 0 && (fane === aktivFase || PHASES.indexOf(fane) > faseIdx) && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-warn" data-testid="tildel-tom-advarsel">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="shrink-0" />
          {fane === aktivFase ? 'Ingen på holdet — fasen står stille.' : 'Tom fase: holdet fra fasen før tager over, når den starter.'}
        </p>
      )}

      <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="tildel-liste">
        {staff.map((m) => {
          const st = statusFor(g, p, m, fane, ledige, opgaver);
          const valgt = valg[fane].includes(m.id);
          const b = bidragFor.get(m.id);
          const disabled = st.optaget && !valgt;
          const konflikt = st.optaget && valgt;
          return (
            <li key={m.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={valgt}
                disabled={disabled}
                onClick={() => toggle(m.id)}
                data-testid={`tildel-${m.id}`}
                title={disabled ? st.tekst : undefined}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-md border-2 p-2 text-left transition-colors ${
                  konflikt ? 'border-bad bg-bad/10' : valgt ? 'border-gold bg-hi' : 'border-line bg-panel2 hover:bg-hi'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-line ${valgt ? 'bg-gold' : 'bg-bg'}`} aria-hidden>
                  {valgt && <Ikon navn="flueben" farve="var(--color-line)" str={14} />}
                </span>
                <StaffAvatar m={m} str={34} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-bold text-ink">{m.navn}</span>
                    {m.id === bedsteId && g.staff.length > 1 && (
                      <Ikon navn="stjerne" farve="var(--color-gold)" str={12} titel="Stærkest i fasen" className="shrink-0" />
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem]">
                    <span className="font-bold" style={{ color: ROLES[m.rolle].farve }}>
                      {ROLES[m.rolle].navn} {m.niveau}
                    </span>
                    <span className="tal text-muted" title={`${FASE_STAT_TEKST[fane]}: ${Math.round(faseStat(m, fane))}`}>
                      {statTekst(m, fane)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <EnergiBar energi={m.energi} />
                    <span className="truncate text-[0.68rem]" style={{ color: konflikt ? 'var(--color-bad)' : st.farve }}>
                      {konflikt ? `${st.tekst} — tælles ikke med` : st.tekst}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right" aria-live="polite">
                  {b ? (
                    <>
                      <span className="tal block font-pixel text-sm font-bold text-gold">+{Math.round(b.point)}</span>
                      <span className="tal block text-[0.62rem] text-muted">{b.plads === 0 ? 'fuld vægt' : `×${b.vaegt.toString().replace('.', ',')}`}</span>
                    </>
                  ) : (
                    <span className="tal block text-[0.68rem] text-dim" title="Point pr. uge alene">
                      {Math.round(holdEstimat(g, p, fane, [m.id]).total)} alene
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {g.agenter.length > 0 && (
        <section className="mt-3" data-testid="tildel-agenter">
          <p className="mb-2 flex flex-wrap items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-cyan">
            <Ikon navn="chip" farve="var(--color-cyan)" indre="var(--color-line)" str={14} /> AI-agenter
            <span className="font-sans text-[0.68rem] font-normal normal-case tracking-normal text-muted">Arbejder uden energi, men laver fejl efter overvågningen.</span>
          </p>
          {g.agenter.some((a) => agentFaser[fane].has(a.id) || valg[fane].includes(a.id)) ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.agenter
                .filter((a) => agentFaser[fane].has(a.id) || valg[fane].includes(a.id))
                .map((a) => {
                  const valgt = valg[fane].includes(a.id);
                  const kan = agentFaser[fane].has(a.id);
                  const b = bidragFor.get(a.id);
                  const data = agentData(g, a.funktion);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={valgt}
                        disabled={!kan && !valgt}
                        onClick={() => toggle(a.id)}
                        data-testid={`tildel-${a.id}`}
                        className={`flex min-h-[44px] w-full items-center gap-2 rounded-md border-2 p-2 text-left transition-colors ${
                          valgt && !kan ? 'border-bad bg-bad/10' : valgt ? 'border-cyan bg-[#0c1f3a]' : 'border-line bg-panel2 hover:bg-hi'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-line ${valgt ? 'bg-cyan' : 'bg-bg'}`} aria-hidden>
                          {valgt && <Ikon navn="flueben" farve="var(--color-line)" str={14} />}
                        </span>
                        <GloedTerminal str={34} funktion={a.funktion} slukket={!data.ok} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-ink">{agentNavn(a)}</span>
                            <AiMaerke titel="AI-agent" />
                          </span>
                          <span className="tal flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem]">
                            <span className="font-bold text-cyan">{AGENTER[a.funktion].navn}</span>
                            <span className="text-muted">Kap. {a.kapacitet}</span>
                            <span className="text-muted" title="Fejlrate (lavere med mere overvågning)">
                              Fejl {procentTekst(a.fejlrate, 1)}
                            </span>
                          </span>
                          <span className="block truncate text-[0.68rem]" style={{ color: !kan ? 'var(--color-bad)' : data.ok ? 'var(--color-good)' : 'var(--color-warn)' }}>
                            {!kan ? 'Optaget på et andet projekt — tælles ikke med' : data.ok ? 'Klar' : DATA_ADVARSEL}
                          </span>
                        </span>
                        <span className="shrink-0 text-right" aria-live="polite">
                          {b ? (
                            <>
                              <span className="tal block font-pixel text-sm font-bold text-gold">+{Math.round(b.point)}</span>
                              <span className="tal block text-[0.62rem] text-muted">{b.plads === 0 ? 'fuld vægt' : `×${b.vaegt.toString().replace('.', ',')}`}</span>
                            </>
                          ) : (
                            <span className="tal block text-[0.68rem] text-dim" title="Point pr. uge alene">
                              {Math.round(holdEstimat(g, p, fane, [a.id]).total)} alene
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="text-xs text-muted" data-testid="tildel-agenter-ingen">
              Ingen af jeres agenter kan arbejde i {FASE_NAVN[fane].toLowerCase()}fasen. Udviklingsagenter tager design, teknik og test; indholdsagenter koncept og design på kasino; trading-agenter design og teknik på betting.
            </p>
          )}
        </section>
      )}
    </Modal>
  );
}
