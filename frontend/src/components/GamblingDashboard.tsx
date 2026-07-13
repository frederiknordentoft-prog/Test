import { useMemo } from "react";
import { ChartCard, COLORS, MetricChart } from "./charts";
import { EventTimeline } from "./EventTimeline";
import { useSimStore, type HistoryPoint } from "../store/simStore";
import { formatDa } from "../format";

/** Gambling-domain run dashboard. Every panel carries an ⓘ tooltip explaining
 *  what you are looking at; the market is shown both per month and as a
 *  rolling 12-month run-rate (the number people recognize from annual
 *  reports); customer counts are anchored to realistic Danish levels. */
export function GamblingDashboard() {
  const history = useSimStore((s) => s.history);
  const events = useSimStore((s) => s.events);
  const last = history[history.length - 1] ?? {};

  // Rolling 12-month run-rate per track + total, in mia. kr./år (annualized
  // for the first partial year so the curve starts immediately).
  const rolling = useMemo(() => {
    const keys = ["market_size_total", "bsi_total", "bsi_lottery", "bsi_scratch",
                  "bsi_casino", "bsi_sports"] as const;
    return history.map((_, i) => {
      const from = Math.max(0, i - 11);
      const window = history.slice(from, i + 1);
      const point: HistoryPoint = { tick: history[i].tick };
      for (const k of keys) {
        const sum = window.reduce((a, p) => a + (Number(p[k]) || 0), 0);
        point[`roll_${k}`] = (sum * 12) / window.length / 1000; // -> mia./år
      }
      return point;
    });
  }, [history]);

  const kpi = [
    ["DS andel (samlet)", formatDa(last.ds_share_total, "pct"),
     "Danske Spils andel af HELE spilmarkedet inkl. offshore — monopolet på lotteri/skrab trækker den op."],
    ["DS andel (liberaliseret)", formatDa(last.ds_share_liberalized, "pct"),
     "Danske Spils andel af det liberaliserede, licenserede marked (online casino + sportsbetting) — dér, hvor DS reelt konkurrerer."],
    ["Kanalisering", formatDa(last.channelization, "pct"),
     "Andelen af spillet, der foregår hos licenserede danske udbydere. Omstridt tal — vises som korridoren 72–92 % i grafen."],
    ["Marked, rullende 12 mdr.", formatDa(rolling[rolling.length - 1]?.roll_market_size_total as number * 1000, "mio_kr"),
     "Markedets årstakt: de seneste 12 måneders bruttospilleindtægt (inkl. offshore). Tallet, man genkender fra årsrapporter."],
    ["Kunder (unikke, est.)", formatDa(last.customers_total, "antal"),
     "Estimeret antal unikke kunder på tværs af alle spor og udbydere. Kalibreret: ~1,4 mio. lotterikunder, nogle hundrede tusinde pr. liberaliseret spor — af ~4,5 mio. voksne danskere."],
    ["Licenserede udbydere", formatDa(last.n_licensees, "antal"),
     "Antal repræsenterede licensindehavere: 5 navngivne agenter + ~35 i den aggregerede long-tail (Spillemyndighedens register: 54 inkl. begrænsede licenser)."],
  ] as const;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {kpi.map(([label, value, tip]) => (
            <div key={label} title={tip} style={{ cursor: "help" }}>
              <div className="muted" style={{ fontSize: 11 }}>{label} <span className="info-mini">ⓘ</span></div>
              <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
          Illustrativ foresight — ikke en prognose. Hold musen over ⓘ for forklaringer.
        </div>
      </div>

      <div className="grid grid-2">
        <ChartCard
          title="Marked — rullende 12 måneder (mia. kr./år)"
          info="Årstakten: summen af de seneste 12 måneders bruttospilleindtægt (BSI), pr. spor og for hele markedet. Glatter sæsonudsving ud, så du ser trenden — casino er vækstmotoren, lotteri er fladt, sport svinger med turneringsår."
        >
          <MetricChart
            data={rolling}
            events={events}
            unit="raw"
            xLabel="md"
            formatter={(v: number) => `${v.toFixed(1).replace(".", ",")} mia.`}
            series={[
              { key: "roll_market_size_total", name: "Hele markedet (inkl. offshore)", color: COLORS.offshore },
              { key: "roll_bsi_total", name: "Licenseret i alt", color: COLORS.ds },
              { key: "roll_bsi_casino", name: "Casino", color: COLORS.casino },
              { key: "roll_bsi_sports", name: "Sport", color: COLORS.sports },
              { key: "roll_bsi_lottery", name: "Lotteri", color: COLORS.lottery },
              { key: "roll_bsi_scratch", name: "Skrab", color: COLORS.scratch },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Marked pr. måned (mio. kr.)"
          info="Månedlig bruttospilleindtægt (det, spillerne taber). De vilde hop i den røde linje er sportskalenderen — EM/VM-somre. 'Inkl. offshore' medregner uregulerede sider."
        >
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

        <ChartCard
          title="Danske Spils markedsandel"
          info="'Samlet' = andel af hele markedet (løftet af lotteri-monopolet). 'Liberaliseret' = andel af det licenserede casino+sport-marked, hvor DS konkurrerer på lige vilkår — det mest ærlige konkurrence-tal."
        >
          <MetricChart
            data={history}
            events={events}
            domain={[0, 1]}
            unit="pct"
            xLabel="md"
            series={[
              { key: "ds_share_total", name: "Samlet", color: COLORS.ds },
              { key: "ds_share_liberalized", name: "Liberaliseret marked", color: COLORS.prediction },
              { key: "ds_share_casino", name: "Casino", color: COLORS.casino },
              { key: "ds_share_sports", name: "Sport", color: COLORS.sports },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Kanalisering — den omstridte korridor (72–92 %)"
          info="Hvor stor en del af spillet ligger hos licenserede danske udbydere? Ingen ved det præcist — H2 siger 72 %, Spillemyndigheden 91,5 %. Det grå bånd ER den usikkerhed. Falder linjen, siver spillet til offshore."
        >
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

        <ChartCard
          title="Kunder pr. spor"
          info="Estimeret antal kunder pr. produktspor på tværs af ALLE udbydere (stablet). Kalibreret til danske niveauer: ~1,4 mio. lotterikunder, ~450-500.000 på casino og sport. Politik, AI og nye konkurrenter flytter tallene."
        >
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

        <ChartCard
          title="Kernespænding · skade (målt vs. sand)"
          info="'Målt' er den skade, myndighederne kan se (licenseret marked). 'Sand' medregner offshore-spil, hvor der hverken er ROFUS eller grænser. Når stramninger presser spillere offshore, FALDER målt skade, mens den skjulte stiger — det ligner en succes, men er det ikke nødvendigvis."
        >
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

        <ChartCard
          title="Statens provenu & udlodning pr. måned"
          info="Afgiftsprovenu = 28 % af licenseret casino/sport-BSI + ~15 % gevinstafgift på monopolet. Udlodning = Danske Spils overskud til idræt og foreningsliv (~1,79 mia./år). Begge falder, når spillet siver offshore — det er statens side af kernespændingen."
        >
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

        <ChartCard
          title="AI-front & adoption (indeks 0–1)"
          info="AI-fronten er den globale teknologi-frontlinje; 'bedste kapabilitet' er den dygtigste operatørs AI-niveau. Når fronten stikker af, åbner den for AI-native indtrædere og flytter markedsandele."
        >
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

        <ChartCard
          title="Operatører, indtrædere & exits"
          info="Aktive operatør-AGENTER i modellen (5 navngivne + long-tail, der repræsenterer ~35 rigtige licenser — Spillemyndighedens register har 54 i alt). Indtrædere = nye konkurrenter, der er gået ind; exits = operatører presset ud."
        >
          <MetricChart
            data={history}
            events={events}
            unit="antal"
            xLabel="md"
            series={[
              { key: "n_operators", name: "Aktive operatør-agenter", color: COLORS.ds },
              { key: "n_entrants", name: "Indtrædere", color: COLORS.sports },
              { key: "n_exits", name: "Exits", color: COLORS.offshore },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="ROFUS-bestand (selvudelukkede)"
          info="Antal spillere i det nationale selvudelukkelses-register (virkeligheden: ~60.000). Vokser med skade og AI-baseret detektion. ROFUS blokerer kun LICENSERET spil — udelukkede kan stadig sive offshore."
        >
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
      </div>

      <div style={{ marginTop: 16 }}>
        <EventTimeline onSelect={() => {}} />
      </div>
    </div>
  );
}
