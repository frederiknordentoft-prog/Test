import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type { MonteCarloStatus, Preset } from "../api/types";
import { ChartCard, GRID, MUTED, SERIES } from "../components/charts";

const HIST_KEYS = [
  { key: "final_price_index", label: "Final price index" },
  { key: "max_drawdown", label: "Max drawdown" },
  { key: "bankruptcies_total", label: "Bankruptcies" },
  { key: "worst_systemic_risk", label: "Worst systemic risk" },
];

const PCT_ROWS = ["min", "p5", "p25", "median", "p75", "p95", "max", "mean"];

export function MonteCarloPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [scenario, setScenario] = useState("");
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [nSeeds, setNSeeds] = useState(10);
  const [ticks, setTicks] = useState(150);
  const [nActors, setNActors] = useState(150);
  const [mcId, setMcId] = useState<string | null>(null);
  const [status, setStatus] = useState<MonteCarloStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.presets().then(setPresets).catch(() => {});
    api.scenarios().then((s) => setScenarios(s.map((x) => x.id))).catch(() => {});
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
    }, 1200);
    return () => clearInterval(iv);
  }, [mcId]);

  const launch = async () => {
    setError(null);
    setStatus(null);
    try {
      const r = await api.createMonteCarlo({
        preset_id: presetId,
        scenario: scenario || null,
        n_seeds: nSeeds,
        ticks,
        n_actors: nActors,
        label: `mc ${presetId ?? "default"} ${scenario}`,
      });
      setMcId(r.mc_id);
    } catch (e) {
      setError(String(e));
    }
  };

  const result = status?.result;

  return (
    <div className="page">
      {error && <div className="error-box">{error}</div>}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Monte Carlo experiment — same scenario, many seeds</h3>
        <div className="form-grid">
          <div className="field">
            <label>Preset</label>
            <select value={presetId ?? ""} onChange={(e) => setPresetId(e.target.value || null)}>
              <option value="">Default Market</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Scenario</label>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              <option value="">— none —</option>
              {scenarios.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Seeds</label>
            <select value={nSeeds} onChange={(e) => setNSeeds(+e.target.value)}>
              {[5, 10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ticks</label>
            <input type="number" value={ticks} onChange={(e) => setTicks(+e.target.value)} />
          </div>
          <div className="field">
            <label>Actors</label>
            <input type="number" value={nActors} onChange={(e) => setNActors(+e.target.value)} />
          </div>
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="primary" onClick={launch} disabled={status?.status === "running"}>
              Run batch
            </button>
          </div>
        </div>
        {status && (
          <div className="controls" style={{ marginTop: 8 }}>
            <span className={`badge ${status.status}`}>{status.status}</span>
            <div className="progress-outer">
              <div
                className="progress-inner"
                style={{ width: `${(100 * status.progress) / Math.max(status.total, 1)}%` }}
              />
            </div>
            <span className="muted">{status.progress}/{status.total} runs</span>
          </div>
        )}
      </div>

      {result && (
        <>
          <ChartCard title={`Outcome distributions (${result.n_runs} seeds) — read percentiles, not single paths`}>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  {PCT_ROWS.map((p) => (
                    <th key={p}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.percentiles).map(([k, row]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    {PCT_ROWS.map((p) => (
                      <td key={p}>{Number(row[p]).toFixed(2)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            {HIST_KEYS.map(({ key, label }, i) => (
              <ChartCard key={key} title={`${label} across seeds`}>
                <Histogram values={result.runs.map((r) => Number(r[key]))} color={SERIES[i % SERIES.length]} />
              </ChartCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Histogram({ values, color }: { values: number[]; color: string }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const nb = Math.min(12, Math.max(5, Math.round(Math.sqrt(values.length) * 1.5)));
  const w = (hi - lo) / nb || 1;
  const buckets = Array.from({ length: nb }, (_, i) => ({
    bucket: (lo + i * w + w / 2).toFixed(1),
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / w)));
    buckets[idx].count += 1;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={buckets} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="bucket" stroke={MUTED} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} />
        <YAxis stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: "#232322", border: "1px solid #3a3a37", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "#2d2d2b", opacity: 0.4 }}
        />
        <Bar dataKey="count" name="seeds" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
