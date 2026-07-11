import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActorsResponse } from "../api/types";
import { useSimStore } from "../store/simStore";
import { ChartCard, GRID, MetricChart, MUTED, SERIES } from "./charts";

export function ActorOverview({ actors }: { actors: ActorsResponse | null }) {
  const { history } = useSimStore();

  const histData =
    actors?.wealth_histogram.counts.map((c, i) => ({
      bucket: `10^${actors.wealth_histogram.log10_edges[i].toFixed(1)}`,
      count: c,
    })) ?? [];

  return (
    <div className="grid grid-2">
      <ChartCard title="Actors by type">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Alive</th>
              <th>Bankrupt</th>
              <th>Mean wealth</th>
              <th>Sentiment</th>
              <th>Stress</th>
              <th>Leverage</th>
            </tr>
          </thead>
          <tbody>
            {actors &&
              Object.entries(actors.types).map(([t, s]) => (
                <tr key={t}>
                  <td>{t}</td>
                  <td>{s.alive}/{s.count}</td>
                  <td style={{ color: s.bankrupt > 0 ? "#e66767" : undefined }}>{s.bankrupt}</td>
                  <td>{formatMoney(s.mean_wealth)}</td>
                  <td>{s.mean_sentiment.toFixed(2)}</td>
                  <td>{s.mean_stress.toFixed(2)}</td>
                  <td>{s.mean_leverage.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </ChartCard>

      <ChartCard title="Wealth distribution (log₁₀ buckets, living actors)">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={histData} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="bucket" stroke={MUTED} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} />
            <YAxis stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: "#232322", border: "1px solid #3a3a37", borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: "#2d2d2b", opacity: 0.4 }}
            />
            <Bar dataKey="count" name="actors" fill={SERIES[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Mean sentiment (−1…1)">
        <MetricChart
          data={history}
          series={[
            { key: "mean_sentiment", name: "all actors", color: SERIES[1] },
          ]}
          height={180}
          domain={[-1, 1]}
        />
      </ChartCard>

      <ChartCard title="Employment index">
        <MetricChart
          data={history}
          series={[{ key: "employment_index", name: "employment index", color: SERIES[3] }]}
          height={180}
        />
      </ChartCard>

      <ChartCard title="Mean stress & wealth inequality">
        <MetricChart
          data={history}
          series={[
            { key: "mean_stress", name: "mean stress (0–1)", color: SERIES[6] },
            { key: "wealth_gini", name: "wealth gini (0–1)", color: SERIES[2] },
          ]}
          height={180}
          domain={[0, 1]}
        />
      </ChartCard>

      <ChartCard title="Richest actors">
        <table>
          <thead>
            <tr>
              <th>Actor</th>
              <th>Type</th>
              <th>Strategy</th>
              <th>Wealth</th>
              <th>Lev</th>
              <th>Sent</th>
              <th>Stress</th>
            </tr>
          </thead>
          <tbody>
            {actors?.top.map((a) => (
              <tr key={a.id} style={{ opacity: a.alive ? 1 : 0.45 }}>
                <td>{a.name}</td>
                <td>{a.type}</td>
                <td>{a.strategy}</td>
                <td>{formatMoney(a.wealth)}</td>
                <td>{a.leverage.toFixed(2)}</td>
                <td>{a.sentiment.toFixed(2)}</td>
                <td>{a.stress.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>

      <ChartCard title="Bankruptcies & margin calls (cumulative counts)">
        <MetricChart
          data={history}
          series={[
            { key: "bankruptcies_total", name: "bankruptcies", color: SERIES[5] },
            { key: "margin_calls_total", name: "margin calls", color: SERIES[2] },
          ]}
          height={180}
        />
      </ChartCard>
    </div>
  );
}

function formatMoney(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return v.toFixed(0);
}
