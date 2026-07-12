import { ChartCard, MetricChart, SERIES } from "./charts";
import { EventTimeline } from "./EventTimeline";
import { useSimStore } from "../store/simStore";

const S = (i: number) => SERIES[i % SERIES.length];

/** Gambling-domain run dashboard: market size, market share, channelization,
 *  the core tension (harm vs. state revenue), AI adoption and entrants. All
 *  panels read the named series the backend emits through the generic metrics
 *  frame — no bespoke endpoints. */
export function GamblingDashboard() {
  const history = useSimStore((s) => s.history);
  const events = useSimStore((s) => s.events);
  const last = history[history.length - 1] ?? {};

  const kpi = [
    ["DS markedsandel", pct(last.ds_share_total)],
    ["Kanalisering", pct(last.channelization)],
    ["Markedsstørrelse", mio(last.market_size_total)],
    ["Statens provenu", mio(last.state_revenue)],
    ["Sand skade", num(last.true_harm)],
    ["Aktive operatører", num(last.n_operators, 0)],
  ] as const;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {kpi.map(([label, value]) => (
            <div key={label}>
              <div className="muted" style={{ fontSize: 11 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
          Illustrativ foresight — ikke en prognose. Kanalisering er et interval (72–92 %);
          operatør-markedsandele har ingen officiel kilde.
        </div>
      </div>

      <div className="grid grid-2">
        <ChartCard title="Markedsstørrelse (mio. kr./md)">
          <MetricChart
            data={history}
            events={events}
            series={[
              { key: "bsi_total", name: "Licenseret BSI", color: S(0) },
              { key: "market_size_total", name: "Inkl. offshore", color: S(2) },
            ]}
          />
        </ChartCard>

        <ChartCard title="Danske Spils markedsandel">
          <MetricChart
            data={history}
            events={events}
            domain={[0, 1]}
            series={[
              { key: "ds_share_total", name: "DS samlet", color: S(3) },
              { key: "ds_share_casino", name: "Casino", color: S(0) },
              { key: "ds_share_sports", name: "Sport", color: S(2) },
              { key: "ds_share_lottery", name: "Lotteri", color: S(4) },
            ]}
          />
        </ChartCard>

        <ChartCard title="Kanalisering & offshore-lækage">
          <MetricChart
            data={history}
            events={events}
            domain={[0, 1]}
            series={[
              { key: "channelization", name: "Kanalisering", color: S(1) },
              { key: "offshore_share", name: "Offshore-andel", color: S(5) },
            ]}
          />
        </ChartCard>

        <ChartCard title="Kernespænding · skade (målt vs. sand)">
          <MetricChart
            data={history}
            events={events}
            series={[
              { key: "measured_harm", name: "Målt skade", color: S(3) },
              { key: "true_harm", name: "Sand skade", color: S(5) },
              { key: "harm_gap", name: "Skjult (offshore)", color: S(2) },
            ]}
          />
        </ChartCard>

        <ChartCard title="Statens provenu & udlodning (mio. kr./md)">
          <MetricChart
            data={history}
            events={events}
            series={[
              { key: "state_revenue", name: "Afgiftsprovenu", color: S(0) },
              { key: "udlodning", name: "Udlodning", color: S(3) },
            ]}
          />
        </ChartCard>

        <ChartCard title="AI-front & markedsvækst">
          <MetricChart
            data={history}
            events={events}
            series={[
              { key: "ai_frontier", name: "AI-front", color: S(4) },
              { key: "ai_best_cap", name: "Bedste kapabilitet", color: S(0) },
              { key: "ai_engagement", name: "Engagement ×", color: S(1) },
            ]}
          />
        </ChartCard>

        <ChartCard title="Operatører & indtrædere">
          <MetricChart
            data={history}
            events={events}
            series={[
              { key: "n_operators", name: "Aktive operatører", color: S(0) },
              { key: "n_entrants", name: "Indtrædere", color: S(1) },
              { key: "n_exits", name: "Exits", color: S(5) },
            ]}
          />
        </ChartCard>

        <ChartCard title="Kunder & markedskoncentration">
          <MetricChart
            data={history}
            events={events}
            series={[
              { key: "customers_total", name: "Kunder (unikke)", color: S(0) },
              { key: "hhi_casino", name: "HHI casino", color: S(2) },
              { key: "hhi_sports", name: "HHI sport", color: S(4) },
            ]}
          />
        </ChartCard>
      </div>

      <div style={{ marginTop: 16 }}>
        <EventTimeline onSelect={() => {}} />
      </div>
    </div>
  );
}

function pct(v?: number) {
  return v == null ? "—" : `${(v * 100).toFixed(1)} %`;
}
function mio(v?: number) {
  return v == null ? "—" : v.toFixed(0);
}
function num(v?: number, digits = 1) {
  return v == null ? "—" : v.toFixed(digits);
}
