import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type { RunListEntry } from "../api/types";
import { ChartCard, GRID, MUTED, SERIES } from "../components/charts";

const METRICS = [
  "price_index",
  "systemic_risk",
  "mean_leverage",
  "mean_sentiment",
  "mean_stress",
  "liquidity_index",
  "credit_tightness",
  "wealth_gini",
  "bankruptcies_total",
];

interface Loaded {
  run: RunListEntry;
  ticks: number[];
  values: number[];
  summary: { final: number; min: number; max: number };
}

export function ComparePage() {
  const [runs, setRuns] = useState<RunListEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [metric, setMetric] = useState("price_index");
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.runs().then(setRuns).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      const out: Loaded[] = [];
      for (const id of selected) {
        const run = runs.find((r) => r.run_id === id);
        if (!run) continue;
        try {
          const m = await api.metrics(id, [metric]);
          const values = m.series[metric] ?? [];
          out.push({
            run,
            ticks: m.ticks,
            values,
            summary: {
              final: values[values.length - 1] ?? 0,
              min: Math.min(...values),
              max: Math.max(...values),
            },
          });
        } catch (e) {
          setError(String(e));
        }
      }
      if (!stop) setLoaded(out);
    })();
    return () => {
      stop = true;
    };
  }, [selected, metric, runs]);

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s,
    );

  // merge series into one table keyed by tick (single shared axis)
  const merged: Record<number, Record<string, number>> = {};
  loaded.forEach((l, i) => {
    l.ticks.forEach((t, j) => {
      (merged[t] ??= { tick: t })[`run${i}`] = l.values[j];
    });
  });
  const chartData = Object.values(merged).sort((a, b) => a.tick - b.tick);

  return (
    <div className="page">
      {error && <div className="error-box">{error}</div>}
      <div className="grid" style={{ gridTemplateColumns: "320px 1fr" }}>
        <div className="card">
          <h3>Pick 2–4 runs</h3>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {runs.length === 0 && <div className="muted">No runs yet — create some first.</div>}
            {runs.map((r) => (
              <label
                key={r.run_id}
                style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={selected.includes(r.run_id)}
                  onChange={() => toggle(r.run_id)}
                />
                <span style={{ flex: 1 }}>
                  {r.label} <span className="muted">seed {r.seed} · {r.tick}t</span>
                </span>
                <span className={`badge ${r.status}`}>{r.archived ? "archived" : r.status}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="controls">
              <label style={{ margin: 0 }}>Metric</label>
              <select style={{ width: 220 }} value={metric} onChange={(e) => setMetric(e.target.value)}>
                {METRICS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="muted">
                Compare baseline vs. shock, different seeds, leverage regimes or network structures.
              </span>
            </div>
          </div>
          <ChartCard title={`${metric} — overlay`}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="tick" stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} type="number" domain={["dataMin", "dataMax"]} />
                <YAxis stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} width={54} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#232322", border: "1px solid #3a3a37", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(t) => `tick ${t}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
                {loaded.map((l, i) => (
                  <Line
                    key={l.run.run_id}
                    dataKey={`run${i}`}
                    name={`${l.run.label} (seed ${l.run.seed})`}
                    stroke={SERIES[i % SERIES.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          {loaded.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>Summary — {metric}</h3>
              <table>
                <thead>
                  <tr><th>Run</th><th>Seed</th><th>Final</th><th>Min</th><th>Max</th></tr>
                </thead>
                <tbody>
                  {loaded.map((l, i) => (
                    <tr key={l.run.run_id}>
                      <td><span style={{ color: SERIES[i % SERIES.length] }}>●</span> {l.run.label}</td>
                      <td>{l.run.seed}</td>
                      <td>{l.summary.final.toFixed(2)}</td>
                      <td>{l.summary.min.toFixed(2)}</td>
                      <td>{l.summary.max.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
