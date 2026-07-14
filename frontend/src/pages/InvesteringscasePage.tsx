import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { CompetitorIntelligence, InvestmentResult, InvestmentStatus } from "../api/types";
import { ChartCard, COLORS, FanChart, Histogram, Tornado, Waterfall } from "../components/charts";
import { formatDa } from "../format";

type Archetype = "greenfield" | "buyout" | "rollup";

const ARCHETYPES: { id: Archetype; label: string; blurb: string }[] = [
  { id: "buyout", label: "Opkøb (buyout)",
    blurb: "Køb en etableret operatør til en indgangsmultipel, løft driften, exit til en multipel." },
  { id: "greenfield", label: "Back en udfordrer",
    blurb: "Skyd egenkapital ind i en ny indtræder fra dag 1 — kapitalen er runway til at bygge markedsandel." },
  { id: "rollup", label: "Buy-and-build",
    blurb: "Konsolidér de mange små licenshavere (long-tail) til én platform — multipel-arbitrage." },
];

// Sensible target menus per archetype (match DEFAULT_OPERATORS / DEFAULT_ENTRANTS).
const TARGETS: Record<Archetype, { id: string; label: string }[]> = {
  buyout: [
    { id: "unibet", label: "Unibet (FDJ)" }, { id: "bet365", label: "bet365" },
    { id: "betano", label: "Betano (aggressiv burn)" }, { id: "longtail", label: "Øvrige licenshavere" },
  ],
  greenfield: [
    { id: "ai_casino", label: "AI-native casino" }, { id: "ai_sportsbook", label: "AI-native sportsbook" },
    { id: "bigtech", label: "Big-tech super-app" }, { id: "challenger", label: "Sponsorat-drevet udfordrer" },
    { id: "crypto_casino", label: "Krypto-casino" },
  ],
  rollup: [{ id: "longtail", label: "Øvrige licenshavere (aggregat)" }],
};

const DEFAULT_TARGET: Record<Archetype, string> = {
  buyout: "unibet", greenfield: "ai_casino", rollup: "longtail",
};

const COMP_KEYS = new Set([
  "deal_entry_exit_multiple", "deal_leverage_ebitda", "deal_debt_rate_annual",
  "ma_ev_ebitda_multiple", "competitive_ebit_margin", "deal_ltv_cac_anchor",
]);

/** Investeringscase — the capital-fund lens. Pick a deal (back a challenger, buy
 *  an incumbent, or roll up the long tail), finance it, and run it across seeds
 *  to see the distribution of returns (IRR/MOIC), the value-creation bridge, the
 *  NAV over the hold, and the thesis-risk tornado. Illustrative — not advice. */
export function InvesteringscasePage() {
  const [archetype, setArchetype] = useState<Archetype>("buyout");
  const [target, setTarget] = useState("unibet");
  const [capital, setCapital] = useState(400);
  const [leverage, setLeverage] = useState(3);
  const [holdYears, setHoldYears] = useState(5);
  const [entryMult, setEntryMult] = useState(10);
  const [exitMult, setExitMult] = useState(10);
  const [nSeeds, setNSeeds] = useState(20);

  const [invId, setInvId] = useState<string | null>(null);
  const [status, setStatus] = useState<InvestmentStatus | null>(null);
  const [comps, setComps] = useState<CompetitorIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.competitorIntelligence().then(setComps).catch(() => {});
  }, []);

  useEffect(() => {
    if (!invId) return;
    const iv = setInterval(async () => {
      try {
        const s = await api.getInvestment(invId);
        setStatus(s);
        if (s.status !== "running") clearInterval(iv);
      } catch (e) {
        setError(String(e));
        clearInterval(iv);
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [invId]);

  const pickArchetype = (a: Archetype) => {
    setArchetype(a);
    setTarget(DEFAULT_TARGET[a]);
  };

  const run = async () => {
    setError(null);
    setStatus(null);
    try {
      const r = await api.createInvestment({
        preset_id: "dk_baseline",
        gambling_overrides: { population: 400 },
        deal: {
          archetype, target, committed_capital: capital, leverage,
          debt_rate_annual: 0.09, hold_years: holdYears,
          entry_multiple: entryMult, exit_multiple: exitMult, n_seeds: nSeeds,
        },
        tornado: true, tornado_seeds: Math.min(nSeeds, 8),
      });
      setInvId(r.inv_id);
    } catch (e) {
      setError(String(e));
    }
  };

  const result = status?.result as InvestmentResult | null | undefined;
  const running = status?.status === "running";
  const irrs = result?.runs.map((r) => r.deal_irr) ?? [];
  const moics = result?.runs.map((r) => r.deal_moic) ?? [];

  const paybackDisplay = (v: number) =>
    v > holdYears ? `> ${holdYears} år` : `${Math.round(v)} år`;

  return (
    <div className="page">
      {error && <div className="error-box">{error}</div>}

      <div className="card hero" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 6px" }}>Investeringscase — simulér markedet som en kapitalfond</h2>
        <p className="muted" style={{ margin: "0 0 14px", maxWidth: 860, lineHeight: 1.6 }}>
          Vælg en deal, finansiér den, og kør den på tværs af mange seeds. EBITDA-banen
          kommer endogent fra markedssimulationen (andel bevæger sig med konkurrence, AI og
          regulering) — modulet omsætter den til afkast: IRR, MOIC, en værdiskabelses-bro og en
          tese-risiko-tornado. <b>Illustrativ foresight — ikke investeringsrådgivning.</b>
        </p>

        {/* Archetype cards */}
        <div className="preset-grid" style={{ marginBottom: 12 }}>
          {ARCHETYPES.map((a) => (
            <div key={a.id} role="button" tabIndex={0}
              className={`preset-card${archetype === a.id ? " selected" : ""}`}
              onClick={() => pickArchetype(a.id)}
              onKeyDown={(e) => e.key === "Enter" && pickArchetype(a.id)}>
              <div style={{ fontWeight: 600 }}>{a.label}</div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>{a.blurb}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label>{archetype === "greenfield" ? "Backet indtræder" : "Målselskab"}</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {TARGETS[archetype].map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Holdeperiode</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[3, 5, 7].map((y) => (
                <button key={y} className={holdYears === y ? "primary" : ""}
                  style={{ fontSize: 12, padding: "3px 12px" }} onClick={() => setHoldYears(y)}>
                  {y} år
                </button>
              ))}
            </div>
          </div>
          {archetype === "greenfield" && (
            <Slider label="Indskudt egenkapital" display={formatDa(capital, "mio_kr")}
              hint="Fondens kapital — runway til at bygge andel før forretningen tjener penge."
              min={100} max={2000} step={50} value={capital} onChange={setCapital} />
          )}
          <Slider label="Gearing (gæld / EBITDA)" display={`${leverage.toFixed(1)}×`}
            hint="0 = ren egenkapital. PE-buyouts kører typisk 4-6× EBITDA."
            min={0} max={6} step={0.5} value={leverage} onChange={setLeverage} />
          <Slider label="Indgangsmultipel (EV/EBITDA)" display={`${entryMult.toFixed(1)}×`}
            hint="Sektor-M&A 9-13× EBITDA." min={4} max={16} step={0.5}
            value={entryMult} onChange={setEntryMult} />
          <Slider label="Exit-multipel (EV/EBITDA)" display={`${exitMult.toFixed(1)}×`}
            hint="Højere end indgang = multipel-ekspansion (re-rating)." min={4} max={16} step={0.5}
            value={exitMult} onChange={setExitMult} />
          <Slider label="Antal seeds (Monte Carlo)" display={`${nSeeds}`}
            hint="Flere seeds = glattere fordeling, men langsommere." min={6} max={60} step={2}
            value={nSeeds} onChange={setNSeeds} />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
          <button className="primary" onClick={run} disabled={running}>
            {running ? "Kører…" : "▶ Kør investeringscase"}
          </button>
          {status && (
            <span className="muted" style={{ fontSize: 12 }}>{status.progress}/{status.total} kørsler</span>
          )}
        </div>
      </div>

      {result ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
              <Kpi label="IRR (median)" value={formatDa(result.median.deal_irr, "pct")}
                tip="Internt afkast på egenkapitalen — median over alle seeds." />
              <Kpi label="MOIC (median)" value={formatDa(result.median.deal_moic, "x")}
                tip="Multiple of invested capital: samlet værdi ÷ indskudt egenkapital." />
              <Kpi label="IRR (p5 — nedside)" value={formatDa(result.percentiles.deal_irr.p5, "pct")}
                tip="Det dårlige udfald: kun 5 % af seeds er værre. Det, en investeringskomité stress-tester på." />
              <Kpi label="Sandsynlighed for tab" value={formatDa(result.prob_loss, "pct")}
                tip="Andel af seeds med MOIC < 1 (fonden får mindre igen end den skød ind)." />
              <Kpi label="EV/EBITDA (exit)" value={formatDa(result.median.ev_ebitda_exit, "x")}
                tip="Exit-multiplen dealen sælges på." />
              <Kpi label="Tilbagebetaling" value={paybackDisplay(result.median.payback_years)}
                tip="År før udlodninger dækker den indskudte egenkapital (ekskl. exit-værdi)." />
            </div>
            <div className="muted" style={{ marginTop: 10, fontSize: 11 }}>
              {result.archetype} · {result.target} · {result.hold_years} års hold · gearing {result.leverage.toFixed(1)}× ·
              n = {result.n_runs} seeds. Afkast er betinget af modellens antagelser og vises som fordelinger, ikke ét tal.
            </div>
          </div>

          <div className="grid grid-2">
            <ChartCard title="IRR-fordeling (på tværs af seeds)"
              info="Hvor ofte lander det interne afkast hvor? Bredden ER usikkerheden — en enkelt bane er ikke et bud, fordelingen er.">
              <Histogram values={irrs} color={COLORS.ds} unit="pct" />
            </ChartCard>
            <ChartCard title="MOIC-fordeling (afkastmultipel)"
              info="Hvor mange gange pengene igen? Under 1,0× er kapitaltab; en typisk PE-deal sigter mod 2-3×.">
              <Histogram values={moics} color={COLORS.revenue} unit="x" />
            </ChartCard>

            <ChartCard title="Egenkapitalværdi over holdeperioden (NAV)"
              info="Fondens egenkapitalværdi måned for måned: trailing-12-mdr. EBITDA × multipel − nettogæld. Bånd = p5–p95 over seeds.">
              <FanChart ticks={result.nav_fan.ticks} p5={result.nav_fan.p5}
                p50={result.nav_fan.p50} p95={result.nav_fan.p95}
                color={COLORS.ds} unit="mio_kr" height={240} />
            </ChartCard>

            <ChartCard title="Værdiskabelses-bro (median-deal)"
              info="Hvor kommer afkastet fra? EBITDA-vækst (drift) + multipel-ekspansion (re-rating) + nedgearing/frit cash flow. De tre led summerer til egenkapital-gevinsten.">
              <Waterfall unit="mio_kr"
                entry={{ label: "Egenkapital ind", value: result.bridge.equity_entry }}
                exit={{ label: "Samlet værdi ud",
                  value: result.bridge.equity_entry + result.bridge.ebitda_growth
                    + result.bridge.multiple + result.bridge.deleverage_fcf }}
                components={[
                  { label: "EBITDA-vækst", value: result.bridge.ebitda_growth },
                  { label: "Multipel", value: result.bridge.multiple },
                  { label: "Nedgearing/FCF", value: result.bridge.deleverage_fcf },
                ]} />
            </ChartCard>

            {result.tornado && result.tornado.length > 0 && (
              <ChartCard title="Tese-risiko — hvad flytter afkastet?"
                info="Hver stress-scenarie (Spilpakke, skat, vild AI, offshore-bølge) injiceres midt i holdeperioden. Barren er ændringen i median-IRR. Rød = skader, grøn = hjælper — en Spilpakke kan faktisk løfte en disciplineret operatør ved at dæmpe markedsføringskapløbet.">
                <Tornado unit="pct"
                  items={result.tornado.map((t) => ({ name: t.name, value: t.irr_delta }))} />
              </ChartCard>
            )}

            {comps && (
              <ChartCard title="Branchemultipler — virkelighedstjek"
                info="De offentlige årsrapport-tal, dealens antagelser holdes op mod.">
                <table>
                  <thead><tr><th>Parameter</th><th>Værdi</th><th>Kilde</th></tr></thead>
                  <tbody>
                    {comps.parameters.filter((p) => COMP_KEYS.has(p.name)).map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.value} {p.unit}</td>
                        <td className="muted" style={{ fontSize: 11 }}>{p.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="chart-empty" style={{ height: 120 }}>
            Vælg en deal og tryk “Kør investeringscase” for at se afkastfordelingen.
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({ label, hint, display, min, max, step, value, onChange }: {
  label: ReactNode; hint?: string; display: string;
  min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function Kpi({ label, value, tip }: { label: string; value: ReactNode; tip: string }) {
  return (
    <div title={tip} style={{ cursor: "help" }}>
      <div className="muted" style={{ fontSize: 11 }}>{label} <span className="info-mini">ⓘ</span></div>
      <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
