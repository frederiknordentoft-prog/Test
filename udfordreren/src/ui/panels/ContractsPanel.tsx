// Kontraktopgaver: tilbud (vælg folk og se forventet betaling) og igangværende opgaver med fremdrift.
// Listen står stille under markøren: nye tilbud kommer nederst, og et udløbet tilbud bliver stående som "Udløbet"
// et øjeblik (i stedet for at forsvinde, så kortene under det rykker op, lige som man trykker).
import { useEffect, useRef, useState } from 'react';
import type { ContractOffer, GameState, Staff } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Badge, Btn, Ikon, Panel, Tip, Tom } from '../components/kit';
import { Afsnit, Chip, FirmaAvatar, Maengde } from '../components/FirmaDele';
import { ROLES } from '../../data/roles';
import { KONTRAKT_EFTER_2016 } from '../../data/contracts';
import { aarFor } from '../../sim/time';
import { mio } from '../format';
import { STAT_NAVN, kontraktForventning, kortNavn, paaKontrakt, standardKontraktHold, uger } from '../lib/firmaHjaelp';

function iProjekt(g: GameState): Set<string> {
  const ud = new Set<string>();
  for (const p of g.projekter) if (!p.klar) for (const id of p.faseTildeling[p.fase]) ud.add(id);
  return ud;
}

function Tilbud({ t, g, valgt, onValg, udloebet }: { t: ContractOffer; g: GameState; valgt: string[]; onValg: (ids: string[]) => void; udloebet?: boolean }) {
  const optaget = paaKontrakt(g);
  const projekt = iProjekt(g);
  const rolle = ROLES[t.rolle];
  const udloeber = Math.max(0, t.udloeberUge - g.uge);
  const f = kontraktForventning(g, t, valgt);
  const b2b = t.skabelonId === 'b2bMesse';

  const skift = (m: Staff) => {
    if (valgt.includes(m.id)) onValg(valgt.filter((x) => x !== m.id));
    else if (t.maxStaff === 1) onValg([m.id]);
    else if (valgt.length < t.maxStaff) onValg([...valgt, m.id]);
    else onValg([...valgt.slice(1), m.id]);
  };

  // Tutorial: send ikke hele holdet ud — så står det første produkt stille
  const ledige = g.staff.filter((m) => !optaget.has(m.id));
  const alleUd = g.mentor === 'aktiv' && g.projekter.length === 0 && ledige.length > 1 && ledige.every((m) => valgt.includes(m.id));

  const tag = () => {
    if (udloebet) return;
    const st = useGame.getState();
    if (st.dispatch({ t: 'takeContract', contractId: t.id, staff: valgt })) st.toast(`Opgaven for ${t.kunde} er i gang!`, 'godt');
  };

  return (
    <article
      className={`@container flex flex-col gap-2 rounded-md border-2 border-line bg-bg2 p-2.5 ${udloebet ? 'opacity-50' : ''}`}
      data-testid={`kontrakt-tilbud-${t.id}`}
      aria-disabled={udloebet || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-pixel text-sm font-black leading-tight text-ink">{t.navn}</h3>
          <p className="text-sm text-muted">{t.kunde}</p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1 rounded border-2 border-line bg-panel px-1.5 py-0.5 font-pixel text-[0.68rem] font-bold"
          style={{ color: udloebet ? 'var(--color-bad)' : udloeber <= 1 ? 'var(--color-warn)' : 'var(--color-muted)' }}
          title="Tilbuddet udløber"
        >
          <Ikon navn="ur" farve="currentColor" indre="var(--color-line)" str={12} />
          {udloebet ? 'Udløbet' : udloeber <= 0 ? 'Sidste uge' : `Udløber om ${uger(udloeber)}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {b2b && (
          <Badge farve="var(--color-pink)" tekstFarve="var(--color-line)">
            B2B fra messen
          </Badge>
        )}
        <Chip farve={rolle.farve} titel={`${rolle.navn} giver ×1,15 i kvalitet`}>
          <span className="inline-block h-2 w-2 rounded-sm border border-line align-middle" style={{ background: rolle.farve }} /> {rolle.navn} foretrækkes
        </Chip>
        <Chip ikon="stjerne" farve="var(--color-gold)" titel="Den afgørende stat">
          {STAT_NAVN[t.stat]} afgør
        </Chip>
        <Chip ikon="ur" farve="var(--color-sky)">
          {uger(t.uger)}
        </Chip>
        <Chip ikon="folk" farve="var(--color-muted)">
          Maks {t.maxStaff}
        </Chip>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-muted">Basisbetaling</span>
        <Maengde ikon="penge" farve="var(--color-gold)">{mio(t.betaling)}</Maengde>
        <Maengde ikon="indsigt" farve="var(--color-cyan)">{t.indsigt} indsigt</Maengde>
      </div>

      <div>
        <div className="mb-1 text-xs text-muted">
          Vælg {t.maxStaff === 1 ? 'én person' : `op til ${t.maxStaff}`} — flere folk giver bedre kvalitet, men binder dem i {uger(t.uger)}.
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Vælg medarbejdere">
          {g.staff.map((m) => {
            const erValgt = valgt.includes(m.id);
            const paaOpgave = optaget.has(m.id);
            const rolleMatch = m.rolle === t.rolle;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={erValgt}
                disabled={paaOpgave || udloebet}
                onClick={() => skift(m)}
                data-testid={`kontrakt-${t.id}-staff-${m.id}`}
                title={paaOpgave ? `${m.navn} er allerede på en opgave` : projekt.has(m.id) ? `${m.navn} tages fra projektet` : `${STAT_NAVN[t.stat]}: ${m.stats[t.stat]}`}
                className={`flex min-h-[44px] max-w-full items-center gap-1.5 rounded-md border-2 border-line py-1 pr-2 pl-1 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                  erValgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-ink hover:bg-hi'
                }`}
              >
                <FirmaAvatar m={m} str={30} />
                <span className="min-w-0 truncate">{kortNavn(m, g.staff)}</span>
                <span className={`tal font-pixel text-xs ${erValgt ? 'text-line' : 'text-gold'}`}>{m.stats[t.stat]}</span>
                {rolleMatch && <Ikon navn="stjerne" farve={erValgt ? 'var(--color-line)' : 'var(--color-gold)'} str={11} titel="Foretrukken rolle" />}
                {paaOpgave && <Ikon navn="laas" farve="currentColor" str={11} titel="På opgave" />}
                {!paaOpgave && projekt.has(m.id) && <Ikon navn="produkt" farve={erValgt ? 'var(--color-line)' : 'var(--color-violet)'} indre="transparent" str={11} titel="Arbejder på et projekt" />}
              </button>
            );
          })}
        </div>
        {alleUd && (
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-warn" data-testid={`kontrakt-${t.id}-hjemme`}>
            <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} /> Lad én blive hjemme — I skal også bygge jeres første produkt.
          </p>
        )}
        {valgt.some((id) => projekt.has(id)) && (
          <p className="mt-1 flex items-center gap-1 text-xs text-warn">
            <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} /> Valgte folk forlader deres projektfase, mens opgaven kører.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-2 @md:flex-row @md:items-center">
        <div className="min-w-0 flex-1" data-testid={`kontrakt-forventet-${t.id}`}>
          <div className="text-[0.68rem] uppercase tracking-wide text-muted">Forventet ved levering</div>
          {valgt.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <Maengde ikon="penge" farve="var(--color-gold)" className="text-base">{mio(f.betaling)}</Maengde>
              <Maengde ikon="indsigt" farve="var(--color-cyan)">{f.indsigt} indsigt</Maengde>
              <span className="tal font-pixel text-xs text-muted" title="Kvalitet: 0,7 + stat/60, ×1,15 ved foretrukken rolle, +35 % pr. ekstra person">
                kvalitet ×{f.q.toFixed(2).replace('.', ',')}
              </span>
            </div>
          ) : (
            <div className="text-sm text-muted">Vælg mindst én person.</div>
          )}
        </div>
        <Btn
          variant="primaer"
          disabled={valgt.length === 0 || udloebet}
          title={udloebet ? 'Tilbuddet er udløbet' : valgt.length === 0 ? 'Vælg mindst én medarbejder' : undefined}
          onClick={tag}
          testId={`tag-kontrakt-${t.id}`}
        >
          <Ikon navn="kontrakt" farve="currentColor" indre="var(--color-gold)" str={14} /> {udloebet ? 'Udløbet' : 'Tag opgaven'}
        </Btn>
      </div>
    </article>
  );
}

type Spoegelse = { t: ContractOffer; indeks: number; til: number };
const SPOEGELSE_MS = 4000;

/** Tilbud, der netop er udløbet, bliver stående på deres plads et øjeblik (og så længe musen er over listen) */
function useUdloebne(tilbud: ContractOffer[], tagetIds: string[]): { liste: { t: ContractOffer; udloebet: boolean }[]; onEnter: () => void; onLeave: () => void } {
  const [spoegelser, setSpoegelser] = useState<Spoegelse[]>([]);
  const forrige = useRef(tilbud);
  const hover = useRef(false);
  const [tjek, setTjek] = useState(0);
  useEffect(() => {
    const gamle = forrige.current;
    forrige.current = tilbud;
    const taget = new Set(tagetIds);
    const vaek: Spoegelse[] = [];
    gamle.forEach((t, indeks) => {
      if (!tilbud.some((x) => x.id === t.id) && !taget.has(t.id)) vaek.push({ t, indeks, til: performance.now() + SPOEGELSE_MS });
    });
    if (vaek.length) setSpoegelser((sp) => [...sp.filter((x) => !vaek.some((v) => v.t.id === x.t.id)), ...vaek]);
  }, [tilbud, tagetIds]);
  useEffect(() => {
    if (spoegelser.length === 0) return;
    const naeste = Math.min(...spoegelser.map((x) => x.til));
    const id = setTimeout(() => {
      if (hover.current) return; // vent til musen forlader listen
      const nu = performance.now();
      setSpoegelser((sp) => sp.filter((x) => x.til > nu));
    }, Math.max(50, naeste - performance.now()));
    return () => clearTimeout(id);
  }, [spoegelser, tjek]);
  const liste: { t: ContractOffer; udloebet: boolean }[] = tilbud.map((t) => ({ t, udloebet: false }));
  for (const sp of [...spoegelser].sort((a, b) => a.indeks - b.indeks)) liste.splice(Math.min(sp.indeks, liste.length), 0, { t: sp.t, udloebet: true });
  return {
    liste,
    onEnter: () => {
      hover.current = true;
    },
    onLeave: () => {
      hover.current = false;
      setTjek((x) => x + 1);
    },
  };
}

export default function ContractsPanel() {
  const g = useGame((s) => s.game)!;
  const [valg, setValg] = useState<Record<string, string[]>>({});
  const optaget = paaKontrakt(g);
  const efter2016 = aarFor(g.uge) >= 2016;
  const effektivtValg = (t: ContractOffer) => (valg[t.id] ?? standardKontraktHold(g, t)).filter((id) => !optaget.has(id) && g.staff.some((m) => m.id === id));
  const tagetIds = useRef<string[]>([]);
  const nyeTaget = g.kontraktopgaver.map((c) => c.id);
  if (nyeTaget.join('|') !== tagetIds.current.join('|')) tagetIds.current = nyeTaget;
  const { liste, onEnter, onLeave } = useUdloebne(g.kontraktTilbud, tagetIds.current);

  return (
    <Panel
      titel="Kontraktopgaver"
      ikon="kontrakt"
      testId="panel-kontrakter"
      hoejre={<span className="font-pixel text-xs text-muted">{g.kontraktTilbud.length} tilbud</span>}
    >
      <div className="flex flex-col gap-3">
        {efter2016 ? (
          <Tip>
            Efter 2016 er der færre opgaver, og de betaler kun omkring {Math.round(KONTRAKT_EFTER_2016.betaling * 100)} % af før. Nu er de et valg — ikke en nødvendighed.
          </Tip>
        ) : (
          <Tip>Opgaver giver penge og indsigt, men binder folk i et par uger. I garagen er de det, der holder kassen kørende.</Tip>
        )}

        {liste.length === 0 ? (
          <Tom>Ingen opgaver lige nu. Nye kunder banker på inden for et par uger.</Tom>
        ) : (
          <div className="flex flex-col gap-2" data-testid="kontrakt-tilbud" onPointerEnter={(e) => e.pointerType === 'mouse' && onEnter()} onPointerLeave={onLeave}>
            {liste.map(({ t, udloebet }) => (
              <Tilbud key={t.id} t={t} g={g} udloebet={udloebet} valgt={udloebet ? [] : effektivtValg(t)} onValg={(ids) => setValg((v) => ({ ...v, [t.id]: ids }))} />
            ))}
          </div>
        )}

        <Afsnit
          titel="I gang"
          ikon="ur"
          farve="var(--color-sky)"
          testId="kontrakter-igang"
          hoejre={<span className="font-pixel text-xs text-muted">{g.kontraktopgaver.length}</span>}
        >
          {g.kontraktopgaver.length === 0 ? (
            <p className="text-sm text-muted">Ingen opgaver i gang.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {g.kontraktopgaver.map((c) => {
                const hold = c.staff.map((id) => g.staff.find((m) => m.id === id)).filter((m): m is Staff => !!m);
                const f = kontraktForventning(g, c.tilbud, c.staff);
                const faerdig = (c.tilbud.uger - c.resterendeUger) / Math.max(1, c.tilbud.uger);
                return (
                  <li key={c.id} className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2" data-testid={`kontrakt-igang-${c.id}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="font-pixel text-sm font-black">{c.tilbud.navn}</span>
                      <span className="text-xs text-muted">{c.tilbud.kunde}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-sm border-2 border-line bg-bg" role="progressbar" aria-valuenow={Math.round(faerdig * 100)} aria-valuemin={0} aria-valuemax={100}>
                        <span className="block h-full bg-sky transition-[width] duration-300" style={{ width: `${faerdig * 100}%` }} />
                      </span>
                      <span className="tal shrink-0 font-pixel text-xs font-bold text-sky">{uger(c.resterendeUger)} tilbage</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hold.map((m) => (
                          <span key={m.id} className="inline-flex items-center gap-1 text-sm">
                            <FirmaAvatar m={m} str={26} />
                            {kortNavn(m, g.staff)}
                          </span>
                        ))}
                      </div>
                      <span className="flex items-center gap-2 text-sm">
                        <Maengde ikon="penge" farve="var(--color-gold)">{mio(f.betaling)}</Maengde>
                        <Maengde ikon="indsigt" farve="var(--color-cyan)">{f.indsigt}</Maengde>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Afsnit>
      </div>
    </Panel>
  );
}
