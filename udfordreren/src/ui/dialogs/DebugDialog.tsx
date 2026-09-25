// Debug-menu (spec 6.20, kun med ?debug=1): seed, hop til år, sæt værdier, udløs events og sim-værdierne bag Top 10.
// Fase 3: åbn et marked, aktivér licens, start trends, sæt politisk pres/tillid, tving næste sanktion og offshore-brand.
import { useState } from 'react';
import type { UiDialog } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';
import { EVENTS, EVENT_BY_ID } from '../../data/events';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { TRENDS } from '../../data/trends';
import { aarFor, datoTekst, ugeTekst } from '../../sim/time';
import { ejerInfo } from '../../sim/competitors';
import { stepMut } from '../../sim/step';
import { autoloesEvents } from '../../sim/events';
import { startTrend } from '../../sim/trends';
import { sanktioner } from '../../sim/trust';
import { makeRng } from '../../sim/rng';
import { SANKTION_NAVN, SANKTION_RISIKO, sanktionsGraense } from '../../sim/selectors';
import type { GameState, LicenseStatus, MarketId, PendingEvent, Signal } from '../../sim/types';
import { Btn, Monogram, Modal } from '../components/kit';

const felt = 'min-h-[44px] w-full rounded-md border-2 border-line bg-bg px-2.5 font-pixel text-sm text-ink outline-none focus:border-gold';

function Tal({ label, vaerdi, onSkift, testId, trin = 1 }: { label: string; vaerdi: string; onSkift: (v: string) => void; testId: string; trin?: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input type="number" inputMode="decimal" step={trin} value={vaerdi} onChange={(e) => onSkift(e.target.value)} className={felt} data-testid={testId} />
    </label>
  );
}

function eventCtx(s: GameState, eventId: string): PendingEvent['ctx'] {
  const e = EVENT_BY_ID[eventId];
  const ctx: PendingEvent['ctx'] = {};
  if (!e) return ctx;
  if (e.trigger === 'medarbejder') {
    const m = s.staff.find((x) => !x.stifter) ?? s.staff[0];
    if (m) {
      ctx.staffId = m.id;
      ctx.navn = m.navn;
    }
  }
  if (e.trigger === 'lanceringMedFejl') {
    const p = [...s.produkter].reverse().find((x) => x.ejer === 'spiller');
    ctx.produkt = p?.navn ?? 'Testproduktet';
    ctx.fejl = p?.fejl ?? 7;
  }
  return ctx;
}

export default function DebugDialog({ onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const [aar, setAar] = useState(() => String(Math.min(2035, (g ? aarFor(g.uge) : 2012) + 1)));
  const [kapital, setKapital] = useState(() => String(g?.kapital.toFixed(2) ?? '0'));
  const [indsigt, setIndsigt] = useState(() => String(g?.indsigt ?? 0));
  const [tillid, setTillid] = useState(() => String(Math.round(g?.markeder.dk.tilsynstillid ?? 70)));
  const [eventId, setEventId] = useState(EVENTS[0]?.id ?? '');
  const [besked, setBesked] = useState<string | null>(null);
  const [marked, setMarked] = useState<MarketId>(() => (g ? (MARKET_IDS.find((m) => !g.markeder[m].aaben && MARKETS[m].aabnerUge !== null) ?? 'dk') : 'dk'));
  const [pres, setPres] = useState(() => String(g?.markeder[marked].politiskPres ?? 1));
  const [mTillid, setMTillid] = useState(() => String(Math.round(g?.markeder[marked].tilsynstillid ?? 70)));
  const [trendId, setTrendId] = useState(() => Object.keys(TRENDS)[0] ?? '');
  const [trendUger, setTrendUger] = useState('8');
  if (!g) return null;
  const nuAar = aarFor(g.uge);
  const ms = g.markeder[marked];
  const mDef = MARKETS[marked];

  const vaelgMarked = (m: MarketId) => {
    setMarked(m);
    setPres(String(Math.round(g.markeder[m].politiskPres * 10) / 10));
    setMTillid(String(Math.round(g.markeder[m].tilsynstillid)));
  };

  const visSignaler = (sig: Signal[]) => {
    if (sig.length === 0) return;
    const st = useGame.getState();
    useGame.setState({ dialoger: [...st.dialoger, ...sig.map((x, i) => ({ id: Date.now() + i, signal: x }))], paused: true });
  };

  /** Simulér frem til ugen før markedet åbner, og tag den sidste uge "live", så åbningen kommer som signal og dialog */
  const hopTilAabning = () => {
    const a = mDef.aabnerUge;
    if (a === null || ms.aaben) return;
    setBesked(`Hopper til ${datoTekst(a)} …`);
    setTimeout(() => {
      useGame.getState().debugSaet((s) => {
        while (s.uge < a - 1 && !s.slut) {
          if (s.kapital < 1) s.kapital = 1;
          s.negativUger = 0;
          autoloesEvents(s);
          stepMut(s, []);
        }
        autoloesEvents(s);
        s.signaler = [];
      });
      useGame.setState({ dialoger: [], pauseGrunde: [] });
      useGame.getState().stepUge();
      onLuk();
    }, 30);
  };

  const licensNu = () => {
    useGame.getState().debugSaet((s) => {
      const x = s.markeder[marked];
      if (!x.aaben) return;
      x.vertikaler[s.startVertikal] = { status: 'aktiv', klarUge: s.uge };
      if (x.licens === 'ingen' || x.licens === 'ansoegt') x.licens = 'aktiv';
    });
    setBesked(`Licens aktiv i ${mDef.navn}.`);
  };

  const saetMarked = () => {
    const p = Number(pres.replace(',', '.'));
    const t = Number(mTillid);
    useGame.getState().debugSaet((s) => {
      if (Number.isFinite(p)) s.markeder[marked].politiskPres = Math.max(0, Math.min(5, p));
      if (Number.isFinite(t)) s.markeder[marked].tilsynstillid = Math.max(0, Math.min(100, t));
    });
    setBesked(`${mDef.navn}: pres og tillid sat.`);
  };

  /** Sæt tilliden under næste grænse og kør sanktionstrinnet med sikkerhed (kun for dette marked) */
  const naesteSanktion = () => {
    useGame.getState().debugSaet((s) => {
      const x = s.markeder[marked];
      if (x.licens !== 'aktiv' && x.licens !== 'suspenderet') return;
      const n = x.sanktion.trin + 1;
      if (n > 4) return;
      x.tilsynstillid = Math.min(x.tilsynstillid, sanktionsGraense(n as 1 | 2 | 3 | 4) - 1);
      const gemt: Partial<Record<MarketId, LicenseStatus>> = {};
      for (const k of MARKET_IDS) {
        if (k === marked) continue;
        gemt[k] = s.markeder[k].licens;
        s.markeder[k].licens = 'ingen';
      }
      s.signaler = [];
      sanktioner(s, makeRng(s.rngState), 1 / SANKTION_RISIKO + 1);
      for (const k of Object.keys(gemt) as MarketId[]) s.markeder[k].licens = gemt[k]!;
    });
    visSignaler(useGame.getState().game?.signaler.filter((x) => x.k === 'sanktion') ?? []);
    onLuk();
  };

  const startValgtTrend = () => {
    const u = Math.max(1, Math.round(Number(trendUger) || 8));
    if (!TRENDS[trendId]) return;
    useGame.getState().debugSaet((s) => startTrend(s, trendId, u));
    useGame.getState().toast(TRENDS[trendId].titel, 'info');
    setBesked(`Trend startet: ${TRENDS[trendId].titel} (${u} uger).`);
  };

  const offshoreBrand = () => {
    useGame.getState().debugSaet((s) => {
      s.offshoreBrand = !s.offshoreBrand;
      s.offshoreBrandStartUge = s.offshoreBrand ? s.uge : null;
      if (!s.offshoreBrand) for (const k of MARKET_IDS) s.markeder[k].offshoreBrandBsiPrUge = 0;
    });
    setBesked(`Offshore-brand ${g.offshoreBrand ? 'slået fra' : 'slået til (uden opstartsomkostning)'}.`);
  };

  const visRegel = (varsel: boolean) => {
    const plan = g.planlagteRegler.find((p) => p.marked === marked);
    const regelId = varsel ? (plan?.regelId ?? 'bonusloft') : (ms.regler[ms.regler.length - 1] ?? plan?.regelId ?? 'bonusloft');
    visSignaler([{ k: 'regel', marked, regelId, varsel }]);
    onLuk();
  };
  const kanSanktion = (ms.licens === 'aktiv' || ms.licens === 'suspenderet') && ms.sanktion.trin < 4;

  const saetVaerdier = () => {
    const k = Number(kapital);
    const i = Number(indsigt);
    const t = Number(tillid);
    useGame.getState().debugSaet((s) => {
      if (Number.isFinite(k)) s.kapital = k;
      if (Number.isFinite(i)) s.indsigt = Math.max(0, Math.round(i));
      if (Number.isFinite(t)) s.markeder.dk.tilsynstillid = Math.max(0, Math.min(100, t));
    });
    setBesked('Værdier sat.');
  };

  const hop = () => {
    const a = Number(aar);
    if (!Number.isFinite(a) || a <= nuAar) return;
    setBesked(`Hopper til ${a} …`);
    // Lad beskeden nå skærmen, før den tunge simulering kører
    setTimeout(() => {
      useGame.getState().debugHopTilAar(a);
      onLuk();
    }, 30);
  };

  const udloes = () => {
    const st = useGame.getState();
    if (!st.game || !EVENT_BY_ID[eventId]) return;
    if (st.game.ventendeEvents.some((e) => e.eventId === eventId)) {
      setBesked('Eventet venter allerede.');
      return;
    }
    const ctx = eventCtx(st.game, eventId);
    st.debugSaet((s) => {
      s.ventendeEvents.push({ eventId, uge: s.uge, ctx });
    });
    useGame.setState({ dialoger: [...useGame.getState().dialoger, { id: Date.now(), signal: { k: 'event', eventId } }], paused: true });
    onLuk();
  };

  const tabelMarked: MarketId = ms.aaben ? marked : 'dk';
  const top10 = g.markeder[tabelMarked].top10.map((e) => ({ e, p: g.produkter.find((x) => x.id === e.productId) }));

  return (
    <Modal titel="Debug" onLuk={onLuk} testId="dialog-debug" bredde={720} fod={<Btn variant="primaer" onClick={onLuk}>Luk</Btn>}>
      <div className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-2 gap-2 rounded-md border-2 border-line bg-bg2 p-2.5 font-pixel text-xs sm:grid-cols-4">
          <div>
            <div className="text-dim">Seed</div>
            <div className="font-bold text-ink" data-testid="debug-seed">{g.seed}</div>
          </div>
          <div>
            <div className="text-dim">Uge</div>
            <div className="font-bold text-ink" data-testid="debug-uge">
              {g.uge} ({ugeTekst(g.uge)})
            </div>
          </div>
          <div>
            <div className="text-dim">Mentor</div>
            <div className="font-bold text-ink">{g.mentor}</div>
          </div>
          <div>
            <div className="text-dim">Ventende events</div>
            <div className="font-bold text-ink">{g.ventendeEvents.length}</div>
          </div>
        </div>

        {besked && <p className="rounded-md border-2 border-line bg-good px-3 py-1.5 font-bold text-line" role="status">{besked}</p>}

        <section className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Hop til år (events auto-vælges)
            <select value={aar} onChange={(e) => setAar(e.target.value)} className={felt} data-testid="debug-aar">
              {Array.from({ length: 2035 - 2013 + 1 }, (_, i) => 2013 + i).map((a) => (
                <option key={a} value={a} disabled={a <= nuAar}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <Btn variant="primaer" onClick={hop} disabled={Number(aar) <= nuAar} testId="debug-hop">
            Hop
          </Btn>
        </section>

        <section className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Tal label="Kapital (mio. kr.)" vaerdi={kapital} onSkift={setKapital} testId="debug-kapital" trin={0.1} />
          <Tal label="Indsigt" vaerdi={indsigt} onSkift={setIndsigt} testId="debug-indsigt" />
          <Tal label="Tilsynstillid DK" vaerdi={tillid} onSkift={setTillid} testId="debug-tillid" />
          <Btn onClick={saetVaerdier} testId="debug-saet">
            Sæt
          </Btn>
        </section>

        <section className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Udløs event
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={felt} data-testid="debug-event">
              {EVENTS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} — {e.titel}
                </option>
              ))}
            </select>
          </label>
          <Btn onClick={udloes} testId="debug-udloes">
            Udløs
          </Btn>
        </section>

        <section>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => useGame.getState().stepUge()} testId="debug-uge-frem">
              +1 uge
            </Btn>
            <Btn onClick={() => useGame.getState().dispatch({ t: 'setMentor', status: g.mentor === 'aktiv' ? 'sprunget' : 'aktiv' })} testId="debug-mentor">
              Mentor {g.mentor === 'aktiv' ? 'fra' : 'til'}
            </Btn>
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="debug-fase3">
          <h3 className="font-pixel text-xs font-bold uppercase tracking-wider text-muted">Markeder og regulering</h3>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Marked
            <select value={marked} onChange={(e) => vaelgMarked(e.target.value as MarketId)} className={felt} data-testid="debug-marked">
              {MARKET_IDS.map((m) => {
                const x = g.markeder[m];
                const a = MARKETS[m].aabnerUge;
                const status = a === null ? 'monopol' : !x.aaben ? `åbner ${datoTekst(a)}` : `licens: ${x.licens}${x.sanktion.trin ? ` · ${SANKTION_NAVN[x.sanktion.trin].toLowerCase()}` : ''}`;
                return (
                  <option key={m} value={m}>
                    {MARKETS[m].kort} — {MARKETS[m].navn} ({status})
                  </option>
                );
              })}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={hopTilAabning} disabled={ms.aaben || mDef.aabnerUge === null} testId="debug-aabn-marked" title={ms.aaben ? 'Markedet er allerede åbent' : undefined}>
              Hop til åbning
            </Btn>
            <Btn onClick={licensNu} disabled={!ms.aaben || ms.licens === 'inddraget'} testId="debug-licens-nu">
              Licens aktiv nu
            </Btn>
            <Btn onClick={naesteSanktion} disabled={!kanSanktion} testId="debug-sanktion" title={kanSanktion ? `Tillid under ${sanktionsGraense((ms.sanktion.trin + 1) as 1 | 2 | 3 | 4)}` : 'Kræver aktiv eller suspenderet licens'}>
              Næste sanktion ({kanSanktion ? SANKTION_NAVN[(ms.sanktion.trin + 1) as 1 | 2 | 3 | 4].toLowerCase() : '–'})
            </Btn>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Tal label={`Politisk pres (0-5, nu ${String(Math.round(ms.politiskPres * 10) / 10).replace('.', ',')})`} vaerdi={pres} onSkift={setPres} testId="debug-pres" trin={0.5} />
            <Tal label={`Tilsynstillid ${mDef.kort}`} vaerdi={mTillid} onSkift={setMTillid} testId="debug-marked-tillid" />
            <Btn onClick={saetMarked} testId="debug-saet-marked">
              Sæt
            </Btn>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Start trend
              <select value={trendId} onChange={(e) => setTrendId(e.target.value)} className={felt} data-testid="debug-trend">
                {Object.values(TRENDS).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.titel}
                  </option>
                ))}
              </select>
            </label>
            <Tal label="Uger" vaerdi={trendUger} onSkift={setTrendUger} testId="debug-trend-uger" />
            <Btn onClick={startValgtTrend} testId="debug-start-trend">
              Start
            </Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={offshoreBrand} testId="debug-offshore" variant={g.offshoreBrand ? 'fare' : 'sekundaer'}>
              Offshore-brand {g.offshoreBrand ? 'fra' : 'til (gratis)'}
            </Btn>
            <Btn onClick={() => { visSignaler([{ k: 'markedAabner', marked }]); onLuk(); }} disabled={mDef.aabnerUge === null} testId="debug-vis-aabner">
              Vis markedsåbning
            </Btn>
            <Btn onClick={() => visRegel(true)} testId="debug-vis-regelvarsel">
              Vis regelvarsel
            </Btn>
            <Btn onClick={() => visRegel(false)} testId="debug-vis-regel">
              Vis ny regel
            </Btn>
          </div>
        </section>

        <section>
          <h3 className="mb-1.5 font-pixel text-xs font-bold uppercase tracking-wider text-muted">Top 10 {MARKETS[tabelMarked].kort} — sim-værdier</h3>
          <div className="overflow-x-auto rounded-md border-2 border-line">
            <table className="w-full min-w-[520px] text-left text-xs" data-testid="debug-top10">
              <thead className="bg-panel2 font-pixel text-[0.65rem] uppercase text-muted">
                <tr>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Produkt</th>
                  <th className="px-2 py-1.5">Ejer</th>
                  <th className="px-2 py-1.5 text-right">Nye · BSI/uge</th>
                  <th className="px-2 py-1.5 text-right">Kvalitet</th>
                  <th className="px-2 py-1.5 text-right">/40</th>
                  <th className="px-2 py-1.5 text-right">Alder</th>
                </tr>
              </thead>
              <tbody className="tal">
                {top10.map(({ e, p }) => {
                  const ejer = p ? ejerInfo(g, p.ejer) : null;
                  return (
                    <tr key={e.productId} className={`border-t border-line ${p?.ejer === 'spiller' ? 'bg-gold/10' : ''}`}>
                      <td className="px-2 py-1 font-pixel font-bold">{e.placering}</td>
                      <td className="max-w-[160px] truncate px-2 py-1">{p?.navn ?? e.productId}</td>
                      <td className="px-2 py-1">
                        {ejer && (
                          <span className="inline-flex items-center gap-1.5">
                            <Monogram tekst={ejer.monogram} farve={ejer.farve} str={20} />
                            <span className="max-w-[90px] truncate">{ejer.navn}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">{Math.round(p?.nyeSpillerePrUge?.[tabelMarked] ?? 0).toLocaleString('da-DK')} nye · {Math.round((p?.bsiPrUge[tabelMarked] ?? 0) * 1000).toLocaleString('da-DK')} t</td>
                      <td className="px-2 py-1 text-right">{((p?.kvalitet ?? 0) * 100).toFixed(1)} %</td>
                      <td className="px-2 py-1 text-right">{p?.total40 ?? '–'}</td>
                      <td className="px-2 py-1 text-right">{p ? `${g.uge - p.lanceretUge} u` : '–'}</td>
                    </tr>
                  );
                })}
                {top10.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-center text-muted">
                      Hitlisten er tom.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Modal>
  );
}
