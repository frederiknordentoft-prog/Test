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
import type { ReactionsResponse } from "../api/types";
import { GRID, MUTED, SERIES } from "./charts";
import { useSimStore } from "../store/simStore";

export function ReactionPanel({ eventIndex, onClose }: { eventIndex: number; onClose: () => void }) {
  const runId = useSimStore((s) => s.runId);
  const [data, setData] = useState<ReactionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runId === null) return;
    api.reactions(runId, eventIndex).then(setData).catch((e) => setError(String(e)));
  }, [runId, eventIndex]);

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="card muted">Loading reaction analysis…</div>;

  const so = data.second_order;
  return (
    <div className="card">
      <div className="controls" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>
          Reaction analysis — {data.event.name} (t={data.event.tick}, window {data.window[0]}–{data.window[1]})
        </h3>
        <div className="spacer" style={{ flex: 1 }} />
        <button onClick={onClose}>Close</button>
      </div>

      <div className="stat-row">
        <Mini label="Decisions in window" value={String(data.n_decisions)} />
        <Mini label="Margin calls" value={String(so.margin_calls_in_window)} bad={so.margin_calls_in_window > 0} />
        <Mini label="Bankruptcies" value={String(so.bankruptcies_in_window)} bad={so.bankruptcies_in_window > 0} />
        <Mini label="Δ credit tightness" value={so.credit_tightness_change.toFixed(3)} bad={so.credit_tightness_change > 0.02} />
        <Mini label="Max forced-sale share" value={so.max_forced_volume_share.toFixed(2)} bad={so.max_forced_volume_share > 0.1} />
        <Mini label="Δ systemic risk" value={so.systemic_risk_change.toFixed(1)} bad={so.systemic_risk_change > 5} />
      </div>

      <div className="grid grid-2">
        <div>
          <h3>Who reacted &amp; how</h3>
          <table>
            <thead>
              <tr><th>Actor type</th><th>Action</th><th>Count</th><th>Total qty</th></tr>
            </thead>
            <tbody>
              {data.reactions_by_type.slice(0, 12).map((r, i) => (
                <tr key={i}>
                  <td>{r.actor_type}</td><td>{r.action}</td><td>{r.count}</td><td>{r.total_qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: 14 }}>Price moves in window</h3>
          <table>
            <thead><tr><th>Asset</th><th>Return</th><th>Trough</th></tr></thead>
            <tbody>
              {Object.entries(data.price_moves).map(([a, m]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td style={{ color: m.return < 0 ? "#e66767" : "#199e70" }}>
                    {(m.return * 100).toFixed(2)}%
                  </td>
                  <td>{(m.trough_return * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Why (drivers from actual decision logs)</h3>
          <table>
            <thead><tr><th>Driver</th><th>Occurrences</th><th>Mean contribution</th></tr></thead>
            <tbody>
              {data.top_drivers.map((d) => (
                <tr key={d.driver}>
                  <td>{d.driver}</td>
                  <td>{d.count}</td>
                  <td style={{ color: d.mean_contribution < 0 ? "#e89a9a" : "#7fc9a8" }}>
                    {d.mean_contribution >= 0 ? "+" : ""}{d.mean_contribution.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: 14 }}>How the reaction spread (decisions per tick)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.reactions_per_tick} margin={{ top: 4, right: 8, bottom: 2, left: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="tick" stroke={MUTED} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} />
              <YAxis stroke={MUTED} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} width={34} />
              <Tooltip contentStyle={{ backgroundColor: "#232322", border: "1px solid #3a3a37", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="decisions" fill={SERIES[0]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>{data.note}</div>
    </div>
  );
}

function Mini({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className={`value ${bad ? "warn" : ""}`} style={{ fontSize: 18 }}>{value}</div>
    </div>
  );
}
