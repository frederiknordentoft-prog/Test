import { useSimStore } from "../store/simStore";
import { ChartCard, MetricChart, SERIES } from "./charts";

export function MarketOverview() {
  const { history, assetIds, events, lastFrame } = useSimStore();
  const m = lastFrame?.metrics ?? {};

  const assetSeries = assetIds.map((a, i) => ({
    key: `p_${a}`,
    name: a,
    color: SERIES[i % SERIES.length],
  }));

  return (
    <>
      <div className="stat-row">
        <Stat label="Price index" value={m.price_index?.toFixed(1) ?? "—"} />
        <Stat
          label="Systemic risk"
          value={m.systemic_risk?.toFixed(0) ?? "—"}
          tone={m.systemic_risk > 55 ? "bad" : m.systemic_risk > 35 ? "warn" : undefined}
        />
        <Stat
          label="Sentiment"
          value={m.mean_sentiment?.toFixed(2) ?? "—"}
          tone={m.mean_sentiment < -0.3 ? "bad" : m.mean_sentiment > 0.3 ? "good" : undefined}
        />
        <Stat label="Leverage (mean)" value={m.mean_leverage?.toFixed(2) ?? "—"} />
        <Stat label="Liquidity index" value={m.liquidity_index?.toFixed(2) ?? "—"} />
        <Stat
          label="Bankruptcies"
          value={m.bankruptcies_total?.toFixed(0) ?? "—"}
          tone={m.bankruptcies_total > 0 ? "warn" : undefined}
        />
        <Stat label="Margin calls" value={m.margin_calls_total?.toFixed(0) ?? "—"} />
        <Stat label="Credit tightness" value={m.credit_tightness?.toFixed(2) ?? "—"} />
      </div>

      <div className="grid grid-2">
        <ChartCard title="Asset prices (event markers in red)">
          <MetricChart data={history} series={assetSeries} events={events} height={260} />
        </ChartCard>
        <ChartCard title="Price index vs systemic risk score">
          <MetricChart
            data={history}
            series={[
              { key: "price_index", name: "price index", color: SERIES[0] },
              { key: "systemic_risk", name: "systemic risk (0–100)", color: SERIES[5] },
            ]}
            events={events}
            height={260}
          />
        </ChartCard>
        <ChartCard title="Total volume per tick">
          <MetricChart
            data={history}
            series={[{ key: "volume", name: "volume", color: SERIES[1] }]}
            height={180}
            formatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))}
          />
        </ChartCard>
        <ChartCard title="Liquidity & credit tightness (0–1)">
          <MetricChart
            data={history}
            series={[
              { key: "liquidity_index", name: "liquidity index", color: SERIES[0] },
              { key: "credit_tightness", name: "credit tightness", color: SERIES[2] },
              { key: "forced_volume_share", name: "forced volume share", color: SERIES[5] },
            ]}
            height={180}
            domain={[0, "auto"]}
          />
        </ChartCard>
        <ChartCard title="Mean spread">
          <MetricChart
            data={history}
            series={[{ key: "spread", name: "spread", color: SERIES[4] }]}
            height={180}
            formatter={(v) => v.toFixed(4)}
          />
        </ChartCard>
        <ChartCard title="Mean leverage (market participants)">
          <MetricChart
            data={history}
            series={[{ key: "mean_leverage", name: "leverage", color: SERIES[2] }]}
            height={180}
          />
        </ChartCard>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
