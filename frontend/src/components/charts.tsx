import { useRef, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { HistoryPoint } from "../store/simStore";
import type { EventMarker } from "../api/types";
import { axisDa, formatDa, type Unit } from "../format";

export const SERIES = ["#3987e5", "#199e70", "#c98500", "#3aa6a6", "#9085e9", "#e66767", "#d55181"];
export const GRID = "#2d2d2b";
export const MUTED = "#8a897f";

/** Semantic colors: the same actor/track always wears the same color, on every
 *  chart (a design-review finding — colors were dealt like playing cards). */
export const COLORS = {
  ds: "#3987e5",          // Danske Spil — always blue
  competitors: "#9085e9", // licensed competitors
  offshore: "#e66767",    // offshore — always the danger red
  prediction: "#d55181",  // prediction markets
  casino: "#9085e9",
  sports: "#199e70",
  lottery: "#c98500",
  scratch: "#caa53f",
  harmTrue: "#e66767",
  harmMeasured: "#c98500",
  revenue: "#199e70",
  neutral: "#8a897f",
  ai: "#3aa6a6",
} as const;

const tooltipStyle = {
  backgroundColor: "#232322",
  border: "1px solid #3a3a37",
  borderRadius: 8,
  fontSize: 12,
};

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const downloadSvg = () => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("style", "background:#1a1a19");
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60)}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card" ref={ref}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <h3 style={{ flex: 1 }}>{title}</h3>
        <button
          onClick={downloadSvg}
          title="Download grafen som SVG"
          style={{ padding: "2px 8px", fontSize: 11 }}
        >
          SVG ↓
        </button>
      </div>
      {children}
    </div>
  );
}

interface MetricChartProps {
  data: HistoryPoint[];
  series: { key: string; name: string; color: string }[];
  events?: EventMarker[];
  height?: number;
  domain?: [number | string, number | string];
  formatter?: (v: number) => string;
  /** Unit for axis/tooltip formatting (Danish locale). */
  unit?: Unit;
  /** X axis label mode: gambling runs are month-resolved. */
  xLabel?: "md" | "tick";
  /** Optional uncertainty corridor: shaded band between two data keys. */
  band?: { lowKey: string; highKey: string; color: string; name: string };
  /** Stack the series as areas (composition view) instead of lines. */
  stacked?: boolean;
  emptyText?: string;
}

/** A/B/C badges on event markers, matched in the timeline list. */
export function eventLetter(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

export function MetricChart({
  data, series, events, height = 200, domain, formatter, unit = "raw",
  xLabel = "tick", band, stacked = false, emptyText,
}: MetricChartProps) {
  const fmtAxis = formatter ?? ((v: number) => axisDa(v, unit));
  const fmtVal = formatter ?? ((v: number) => formatDa(v, unit));

  if (!data.length) {
    return (
      <div className="chart-empty" style={{ height }}>
        {emptyText ?? "Simulationen er ikke startet — tryk ▶ Kør."}
      </div>
    );
  }

  const markers = (events ?? []).filter((e) => e.phase === "start");

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="tick" stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} />
        <YAxis
          stroke={MUTED}
          tick={{ fontSize: 11, fill: MUTED }}
          tickLine={false}
          width={56}
          domain={domain ?? ["auto", "auto"]}
          tickFormatter={fmtAxis}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: MUTED }}
          formatter={(value: number | string, name: string) => [
            typeof value === "number" ? fmtVal(value) : value,
            name,
          ]}
          labelFormatter={(t) => (xLabel === "md" ? `måned ${t}` : `tick ${t}`)}
        />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} iconType="plainline" />
        )}
        {markers.map((e, i) => (
          <ReferenceLine
            key={`${e.name}-${e.tick}-${i}`}
            x={e.tick}
            stroke="#e66767"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: eventLetter(i), position: "top",
              fill: "#e66767", fontSize: 10,
            }}
          />
        ))}
        {band && (
          <>
            {/* invisible floor + shaded delta = corridor between low and high */}
            <Area dataKey={band.lowKey} stackId="band" stroke="none" fill="transparent"
              isAnimationActive={false} legendType="none" tooltipType="none" name="__low" />
            <Area
              dataKey={(d: HistoryPoint) => {
                const lo = d[band.lowKey]; const hi = d[band.highKey];
                return lo != null && hi != null ? (hi as number) - (lo as number) : 0;
              }}
              stackId="band" stroke="none" fill={band.color} fillOpacity={0.14}
              isAnimationActive={false} legendType="none" tooltipType="none" name={band.name}
            />
          </>
        )}
        {series.map((s) =>
          stacked ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stackId="stack"
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Fan chart: p5–p95 band + median line over time (Monte Carlo uncertainty). */
export function FanChart({
  ticks, p5, p50, p95, color, unit = "raw", height = 220,
}: {
  ticks: number[]; p5: number[]; p50: number[]; p95: number[];
  color: string; unit?: Unit; height?: number;
}) {
  const data = ticks.map((t, i) => ({
    tick: t, p5: p5[i], p50: p50[i], band: p95[i] - p5[i],
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="tick" stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} />
        <YAxis stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} width={56}
          domain={["auto", "auto"]} tickFormatter={(v: number) => axisDa(v, unit)} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: MUTED }}
          formatter={(value: number | string, name: string) => {
            if (name === "band") return [null as unknown as string, ""];
            return [typeof value === "number" ? formatDa(value, unit) : value,
                    name === "p50" ? "median" : name];
          }}
          labelFormatter={(t) => `måned ${t}`}
        />
        <Area dataKey="p5" stackId="fan" stroke="none" fill="transparent"
          isAnimationActive={false} legendType="none" name="p5" />
        <Area dataKey="band" stackId="fan" stroke="none" fill={color} fillOpacity={0.16}
          isAnimationActive={false} legendType="none" name="band" />
        <Line dataKey="p50" name="p50" stroke={color} strokeWidth={2} dot={false}
          isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
