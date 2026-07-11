import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { HistoryPoint } from "../store/simStore";
import type { EventMarker } from "../api/types";

export const SERIES = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767", "#d55181"];
export const GRID = "#2d2d2b";
export const MUTED = "#8a897f";

const tooltipStyle = {
  backgroundColor: "#232322",
  border: "1px solid #3a3a37",
  borderRadius: 8,
  fontSize: 12,
};

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h3>{title}</h3>
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
}

export function MetricChart({ data, series, events, height = 200, domain, formatter }: MetricChartProps) {
  const fmt = formatter ?? ((v: number) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="tick" stroke={MUTED} tick={{ fontSize: 11, fill: MUTED }} tickLine={false} />
        <YAxis
          stroke={MUTED}
          tick={{ fontSize: 11, fill: MUTED }}
          tickLine={false}
          width={52}
          domain={domain ?? ["auto", "auto"]}
          tickFormatter={fmt}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: MUTED }}
          formatter={(value: number | string, name: string) => [
            typeof value === "number" ? fmt(value) : value,
            name,
          ]}
          labelFormatter={(t) => `tick ${t}`}
        />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} iconType="plainline" />
        )}
        {(events ?? [])
          .filter((e) => e.phase === "start")
          .map((e, i) => (
            <ReferenceLine
              key={`${e.name}-${e.tick}-${i}`}
              x={e.tick}
              stroke="#e66767"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          ))}
        {series.map((s) => (
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
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
