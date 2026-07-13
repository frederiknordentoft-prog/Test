import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ForecastValidation, MonteCarloStatus } from "../api/types";
import { ChartCard, COLORS, FanChart } from "../components/charts";
import { metricLabel, metricUnit } from "../format";

type SeriesPct = Record<string, { ticks: number[]; p5: number[]; p50: number[]; p95: number[] }>;

const FAN_METRICS = ["market_size_total", "ds_share_total", "channelization"] as const;
const FAN_COLORS: Record<string, string> = {
  market_size_total: COLORS.revenue,
  ds_share_total: COLORS.ds,
  channelization: COLORS.offshore,
};
// which reality anchor overlays which forecast metric (nowcasting)
const ANCHOR_FOR: Record<string, string> = {
  channelization: "channelization_official",
};

/** Forecast & validation — the payoff of the calibration flagship. Runs a
 *  Monte Carlo forecast, overlays the latest real observations (nowcasting),
 *  and shows the evidence for how much to trust the bands: the backtest skill
 *  and the natural-experiment validation, with an honesty banner. */
export function ForecastPage() {
  const [horizonYears, setHorizonYears] = useState(6);
  const [mcId, setMcId] = useState<string | null>(null);
  const [status, setStatus] = useState<MonteCarloStatus | null>(null);
  const [val, setVal] = useState<ForecastValidation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.forecastValidation().then(setVal).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!mcId) return;
    const iv = setInterval(async () => {
      try {
        const s = await api.getMonteCarlo(mcId);
        setStatus(s);
        if (s.status !== "running") clearInterval(iv);
      } catch (e) {
        setError(String(e));
        clearInterval(iv);
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [mcId]);

  const runForecast = async () => {
    setError(null);
    setStatus(null);
    try {
      const r = await api.createMonteCarlo({
        preset_id: "dk_baseline", domain: "gambling",
        n_seeds: 30, ticks: horizonYears * 12, label: `prognose ${horizonYears}år`,
      });
      setMcId(r.mc_id);
    } catch (e) {
      setError(String(e));
    }
  };

  const fans = ((status?.result as { series_percentiles?: SeriesPct } | undefined)
    ?.series_percentiles ?? {}) as SeriesPct;
  const anchorYear = val?.anchor_year ?? 2025;

  const anchorFor = (metric: string): number | null => {
    if (!val) return null;
    const key = ANCHOR_FOR[metric];
    if (!key) return null;
    return val.reality_anchors[key]?.value ?? null;
  };

  return (
    <div className="page">
      {error && <div className="error-box">{error}</div>}

      <div className="card hero" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 6px" }}>Prognose & validering</h2>
        <p className="muted" style={{ margin: "0 0 12px", maxWidth: 820, lineHeight: 1.6 }}>
          {val?.honesty ??
            "Modellen giver et bud på fremtiden som en fordeling, ikke ét tal — forankret i virkelige data og valideret mod chok, den ikke blev fittet på."}
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12 }}>Horisont:</span>
          {[6, 10, 15].map((y) => (
            <button key={y} className={horizonYears === y ? "primary" : ""}
              style={{ fontSize: 12, padding: "3px 10px" }} onClick={() => setHorizonYears(y)}>
              {y} år
            </button>
          ))}
          <button className="primary" onClick={runForecast} disabled={status?.status === "running"}>
            {status?.status === "running" ? "Kører…" : "▶ Kør prognose (30 seeds)"}
          </button>
          {status && (
            <span className="muted" style={{ fontSize: 12 }}>
              {status.progress}/{status.total} kørsler
            </span>
          )}
        </div>
      </div>

      {/* Validation evidence — why (and how much) to trust the bands */}
      {val && (
        <div className="grid grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <h3>Backtest — kan modellen ramme historik, den ikke så?</h3>
            <p className="muted" style={{ fontSize: 12 }}>{val.hindcast.summary}</p>
            <table>
              <thead><tr><th>Spor</th><th>Slår naiv?</th><th>Fejl (MAPE)</th></tr></thead>
              <tbody>
                {val.hindcast.per_series.map((s) => (
                  <tr key={s.vertical}>
                    <td>{s.vertical}</td>
                    <td>{s.beats_random_walk
                      ? <span className="chip realism-high">ja</span>
                      : <span className="chip realism-low">nej (flad serie)</span>}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{(s.mape * 100).toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Naturlige eksperimenter — reproducerer modellen kendte chok?</h3>
            <p className="muted" style={{ fontSize: 12 }}>{val.natural_experiments.summary}</p>
            <ul style={{ lineHeight: 1.7, margin: "6px 0", paddingLeft: 18 }}>
              {val.natural_experiments.checks.map((c) => (
                <li key={c.experiment}>
                  {c.reproduced
                    ? <span className="chip realism-high">✓</span>
                    : <span className="chip realism-low">✗</span>}{" "}
                  <b>{c.experiment}</b>
                  <div className="muted" style={{ fontSize: 11 }}>{c.verdict}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* The forecast itself: fan bands with reality anchors (nowcasting) */}
      {Object.keys(fans).length > 0 ? (
        <div className="grid grid-2">
          {FAN_METRICS.filter((m) => fans[m]).map((m) => (
            <ChartCard key={m}
              title={`${metricLabel(m)} — prognose med usikkerhed`}
              info={`Median (linje) + 90 %-bånd (p5–p95) på tværs af 30 seeds, fra ${anchorYear} og frem. `
                + (ANCHOR_FOR[m] ? "Den grønne prik er den seneste FAKTISKE observation — ligger den i båndet, er nutiden dér, modellen forventer (nowcasting)." : "Læs båndet, ikke midterlinjen.")}>
              <FanChart
                ticks={fans[m].ticks} p5={fans[m].p5} p50={fans[m].p50} p95={fans[m].p95}
                color={FAN_COLORS[m] ?? COLORS.ds} unit={metricUnit(m)}
                anchorYear={anchorYear} anchor={anchorFor(m)} xLabelMode="year" height={240}
              />
            </ChartCard>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="chart-empty" style={{ height: 120 }}>
            Tryk “Kør prognose” for at generere sandsynlighedsbånd fra {anchorYear} og frem.
          </div>
        </div>
      )}
    </div>
  );
}
