import { ChartCard, COLORS, MetricChart } from "./charts";
import { EventTimeline } from "./EventTimeline";
import { useSimStore } from "../store/simStore";
import { formatDa } from "../format";

/** Gambling-domain run dashboard: market size, market share, channelization
 *  (drawn as the contested corridor, not a confident line), customers per
 *  track, the core tension (harm vs. state revenue), AI adoption and entrants.
 *  All panels read the named series the backend emits through the generic
 *  metrics frame — no bespoke endpoints. Colors are semantic: DS is always
 *  blue, offshore always red, each track keeps its hue. */
export function GamblingDashboard() {
  const history = useSimStore((s) => s.history);
  const events = useSimStore((s) => s.events);
  const last = history[history.length - 1] ?? {};

  const kpi = [
    ["DS markedsandel", formatDa(last.ds_share_total, "pct")],
    ["Kanalisering", formatDa(last.channelization, "pct")],
    ["Markedsstørrelse/md", formatDa(last.market_size_total, "mio_kr")],
    ["Kunder", formatDa(last.customers_total, "antal")],
    ["Statens provenu/md", formatDa(last.state_revenue, "mio_kr")],
    ["Sand skade (indeks)", formatDa(last.true_harm, "index")],
  ] as const;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {kpi.map(([label, value]) => (
            <div key={label} className="stat-tile-inline">
              <div className="muted" style={{ fontSize: 11 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
          Illustrativ foresight — ikke en prognose. Kanalisering er omstridt og vises som
          korridoren 72–92 %; operatør-markedsandele har ingen officiel kilde.
        </div>
      </div>

      <div className="grid grid-2">
        <ChartCard title="Markedsstørrelse pr. måned">
          <MetricChart
            data={history}
            events={events}
            unit="mio_kr"
            xLabel="md"
            series={[
              { key: "bsi_total", name: "Licenseret BSI", color: COLORS.ds },
              { key: "market_size_total", name: "Inkl. offshore", color: COLORS.offshore },
            ]}
          />
        </ChartCard>

        <ChartCard title="Danske Spils markedsandel">
          <MetricChart
            data={history}
            events={events}
            domain={[0, 1]}
            unit="pct"
            xLabel="md"
            series={[
              { key: "ds_share_total", name: "DS samlet", color: COLORS.ds },
              { key: "ds_share_casino", name: "Casino", color: COLORS.casino },
              { key: "ds_share_sports", name: "Sport", color: COLORS.sports },
              { key: "ds_share_lottery", name: "Lotteri", color: COLORS.lottery },
            ]}
          />
        </ChartCard>

        <ChartCard title="Kanalisering — den omstridte korridor (72–92 %)">
          <MetricChart
            data={history}
            events={events}
            domain={[0, 1]}
            unit="pct"
            xLabel="md"
            band={{ lowKey: "channelization_low", highKey: "channelization_high",
                    color: COLORS.neutral, name: "antagelses-korridor" }}
            series={[
              { key: "channelization", name: "Kanalisering (denne antagelse)", color: COLORS.ds },
              { key: "offshore_share", name: "Offshore-andel", color: COLORS.offshore },
            ]}
          />
        </ChartCard>

        <ChartCard title="Kunder pr. spor">
          <MetricChart
            data={history}
            events={events}
            unit="antal"
            xLabel="md"
            stacked
            series={[
              { key: "customers_casino", name: "Casino", color: COLORS.casino },
              { key: "customers_sports", name: "Sport", color: COLORS.sports },
              { key: "customers_lottery", name: "Lotteri", color: COLORS.lottery },
              { key: "customers_scratch", name: "Skrab", color: COLORS.scratch },
            ]}
          />
        </ChartCard>

        <ChartCard title="Kernespænding · skade (målt vs. sand)">
          <MetricChart
            data={history}
            events={events}
            unit="index"
            xLabel="md"
            series={[
              { key: "measured_harm", name: "Målt skade", color: COLORS.harmMeasured },
              { key: "true_harm", name: "Sand skade", color: COLORS.harmTrue },
              { key: "harm_gap", name: "Skjult (offshore)", color: COLORS.prediction },
            ]}
          />
        </ChartCard>

        <ChartCard title="Statens provenu & udlodning pr. måned">
          <MetricChart
            data={history}
            events={events}
            unit="mio_kr"
            xLabel="md"
            series={[
              { key: "state_revenue", name: "Afgiftsprovenu", color: COLORS.revenue },
              { key: "udlodning", name: "Udlodning", color: COLORS.ds },
            ]}
          />
        </ChartCard>

        <ChartCard title="AI-front & adoption (indeks 0–1)">
          <MetricChart
            data={history}
            events={events}
            domain={[0, 1]}
            unit="index"
            xLabel="md"
            series={[
              { key: "ai_frontier", name: "AI-front", color: COLORS.ai },
              { key: "ai_best_cap", name: "Bedste kapabilitet", color: COLORS.competitors },
            ]}
          />
        </ChartCard>

        <ChartCard title="Operatører, indtrædere & ROFUS">
          <MetricChart
            data={history}
            events={events}
            unit="antal"
            xLabel="md"
            series={[
              { key: "n_operators", name: "Aktive operatører", color: COLORS.ds },
              { key: "n_entrants", name: "Indtrædere", color: COLORS.sports },
              { key: "n_exits", name: "Exits", color: COLORS.offshore },
            ]}
          />
        </ChartCard>

        <ChartCard title="ROFUS-bestand (selvudelukkede)">
          <MetricChart
            data={history}
            events={events}
            unit="antal"
            xLabel="md"
            series={[
              { key: "rofus_stock", name: "ROFUS-bestand", color: COLORS.harmMeasured },
            ]}
          />
        </ChartCard>

        <ChartCard title="Markedskoncentration (HHI, licenseret marked)">
          <MetricChart
            data={history}
            events={events}
            unit="raw"
            xLabel="md"
            series={[
              { key: "hhi_casino", name: "HHI casino", color: COLORS.casino },
              { key: "hhi_sports", name: "HHI sport", color: COLORS.sports },
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
