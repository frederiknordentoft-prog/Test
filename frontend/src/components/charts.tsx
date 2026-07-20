import { useRef, useState, type ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
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

const TIP_WIDTH = 300;

/** ⓘ tooltip that can never be clipped: rendered position:fixed (its containing
 *  block is the viewport, so `.card { overflow: auto }` cannot cut it) and
 *  clamped to the screen edges. A user-reported bug: the old absolute-positioned
 *  tip disappeared behind the card edge in the right grid column. */
export function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - TIP_WIDTH - 12));
    // Flip above the anchor when there is no room below.
    const below = r.bottom + 8;
    const top = below + 180 > window.innerHeight ? Math.max(8, r.top - 8 - 180) : below;
    setPos({ left, top });
  };

  return (
    <span
      className="info-dot"
      tabIndex={0}
      aria-label={text}
      onMouseEnter={(e) => show(e.currentTarget)}
      onFocus={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onBlur={() => setPos(null)}
    >
      ⓘ
      {pos && (
        <span className="info-tip-fixed" style={{ left: pos.left, top: pos.top }}>
          {text}
        </span>
      )}
    </span>
  );
}

export function ChartCard({ title, info, children }: {
  title: string; info?: string; children: ReactNode;
}) {
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <h3 style={{ flex: "0 1 auto", margin: 0 }}>{title}</h3>
        {info && <InfoTip text={info} />}
        <span style={{ flex: 1 }} />
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

/** Fan chart: p5–p95 band + median line over time (Monte Carlo uncertainty),
 *  with an optional reality anchor (the latest actual, for nowcasting). */
export function FanChart({
  ticks, p5, p50, p95, color, unit = "raw", height = 220,
  anchorYear, anchor, xLabelMode = "month",
}: {
  ticks: number[]; p5: number[]; p50: number[]; p95: number[];
  color: string; unit?: Unit; height?: number;
  anchorYear?: number; anchor?: number | null; xLabelMode?: "month" | "year";
}) {
  const data = ticks.map((t, i) => ({
    tick: t, p5: p5[i], p50: p50[i], band: p95[i] - p5[i],
  }));
  // Stacked areas pin the y-axis to 0, which wastes the plot for large-kr
  // series ("markedsstørrelsen starter på 0 kr" — user report). Anchor the
  // axis to the data instead (include the reality anchor when present).
  const lo = Math.min(...p5, ...(anchor != null ? [anchor] : []));
  const hi = Math.max(...p95, ...(anchor != null ? [anchor] : []));
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.05 || 1;
  const yDomain: [number, number] = [lo - pad, hi + pad];
  const anchorInBand = anchor != null && anchor >= p5[0] * 0.9 && anchor <= p95[0] * 1.1;
  const label = (t: number) =>
    anchorYear != null ? `${anchorYear + Math.round(t / 12)}` : `md ${t}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="tick" stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false}
          tickFormatter={xLabelMode === "year" ? label : undefined} />
        <YAxis stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} width={56}
          domain={yDomain} allowDataOverflow
          tickFormatter={(v: number) => axisDa(v, unit)} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: MUTED }}
          formatter={(value: number | string, name: string) => {
            if (name === "band") return [null as unknown as string, ""];
            return [typeof value === "number" ? formatDa(value, unit) : value,
                    name === "p50" ? "median" : name];
          }}
          labelFormatter={(t) => (xLabelMode === "year" ? label(t as number) : `måned ${t}`)}
        />
        <Area dataKey="p5" stackId="fan" stroke="none" fill="transparent"
          isAnimationActive={false} legendType="none" name="p5" />
        <Area dataKey="band" stackId="fan" stroke="none" fill={color} fillOpacity={0.16}
          isAnimationActive={false} legendType="none" name="band" />
        <Line dataKey="p50" name="p50" stroke={color} strokeWidth={2} dot={false}
          isAnimationActive={false} />
        {anchor != null && (
          <ReferenceDot x={0} y={anchor} r={5} isFront
            fill={anchorInBand ? "#199e70" : "#e66767"} stroke="#fff" strokeWidth={1}
            label={{ value: `faktisk ${anchorYear ?? ""}`, position: "top",
                     fill: anchorInBand ? "#199e70" : "#e66767", fontSize: 10 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Distribution histogram across Monte Carlo seeds (IRR, MOIC, …). Buckets are
 *  labelled with the series unit so the x-axis reads in the right terms. */
export function Histogram({
  values, color, unit = "raw", height = 200,
}: { values: number[]; color: string; unit?: Unit; height?: number }) {
  if (!values.length) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const nb = Math.min(12, Math.max(5, Math.round(Math.sqrt(values.length) * 1.5)));
  const w = (hi - lo) / nb || 1;
  const buckets = Array.from({ length: nb }, (_, i) => ({
    bucket: axisDa(lo + i * w + w / 2, unit),
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / w)));
    buckets[idx].count += 1;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={buckets} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="bucket" stroke={MUTED} tick={{ fontSize: 10, fill: MUTED }} tickLine={false} />
        <YAxis stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} width={36}
          allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#2d2d2b", opacity: 0.4 }} />
        <Bar dataKey="count" name="seeds" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Value-creation waterfall (the PE bridge): a floating bar per component
 *  between an entry total and an exit total. Green = value created, red =
 *  destroyed, blue = the entry/exit anchors. */
export function Waterfall({
  entry, exit, components, unit = "mio_kr", height = 240,
}: {
  entry: { label: string; value: number };
  exit: { label: string; value: number };
  components: { label: string; value: number }[];
  unit?: Unit; height?: number;
}) {
  let running = entry.value;
  const rows: { name: string; base: number; span: number; kind: string; delta: number }[] = [
    { name: entry.label, base: 0, span: entry.value, kind: "total", delta: entry.value },
  ];
  for (const c of components) {
    const base = c.value >= 0 ? running : running + c.value;
    rows.push({ name: c.label, base, span: Math.abs(c.value),
      kind: c.value >= 0 ? "pos" : "neg", delta: c.value });
    running += c.value;
  }
  rows.push({ name: exit.label, base: 0, span: exit.value, kind: "total", delta: exit.value });
  const fill = (k: string) => (k === "total" ? COLORS.ds : k === "pos" ? COLORS.revenue : COLORS.offshore);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="name" stroke={MUTED} tick={{ fontSize: 10, fill: MUTED }} tickLine={false}
          interval={0} />
        <YAxis stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} width={56}
          tickFormatter={(v: number) => axisDa(v, unit)} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#2d2d2b", opacity: 0.3 }}
          formatter={(_v: number | string, _n: string, p: { payload?: { delta: number } }) =>
            [formatDa(p?.payload?.delta ?? 0, unit), "bidrag"]} />
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} legendType="none" />
        <Bar dataKey="span" stackId="wf" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {rows.map((r, i) => <Cell key={i} fill={fill(r.kind)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tornado: horizontal bars of an effect (e.g. IRR delta) per scenario, most
 *  extreme first. Green = the effect helps, red = it hurts. */
export function Tornado({
  items, unit = "pct", height = 220,
}: {
  items: { name: string; value: number }[];
  unit?: Unit; height?: number;
}) {
  if (!items.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 6, right: 16, bottom: 2, left: 8 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false}
          tickFormatter={(v: number) => axisDa(v, unit)} />
        <YAxis type="category" dataKey="name" stroke={MUTED} width={180}
          tick={{ fontSize: 10, fill: MUTED }} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#2d2d2b", opacity: 0.3 }}
          formatter={(v: number | string) =>
            [typeof v === "number" ? formatDa(v, unit) : v, "effekt på IRR"]} />
        <ReferenceLine x={0} stroke={MUTED} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {items.map((it, i) => <Cell key={i} fill={it.value >= 0 ? COLORS.revenue : COLORS.offshore} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
