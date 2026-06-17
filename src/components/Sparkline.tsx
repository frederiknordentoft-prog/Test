import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { format } from 'date-fns';
import type { CheckIn, KeyResult } from '../types/domain';
import { formatMetric } from '../lib/okr';
import { HEALTH_HEX } from '../lib/okr';
import { confidenceHealth } from '../lib/okr';

interface Props {
  checkIns: CheckIn[];
  kr: KeyResult;
  height?: number;
  showAxis?: boolean;
}

/** Lille trend-graf over check-in-værdier. */
export default function Sparkline({ checkIns, kr, height = 40, showAxis = false }: Props) {
  if (checkIns.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[11px] text-ink-muted"
        style={{ height }}
      >
        For få check-ins til trend
      </div>
    );
  }
  const last = checkIns[checkIns.length - 1];
  const color = HEALTH_HEX[confidenceHealth(last.confidence, kr.type)];
  const data = checkIns.map((c) => ({ date: c.date, value: c.value, confidence: c.confidence }));
  const gradientId = `spark-${kr.id}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide={!showAxis} domain={['dataMin', 'dataMax']} width={showAxis ? 44 : 0} fontSize={11} />
        <Tooltip
          cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
          }}
          labelFormatter={(d) => format(new Date(d as string), 'd. MMM')}
          formatter={(v: number, _n, p) => [
            `${formatMetric(v, kr)} · conf ${(p.payload.confidence as number).toFixed(2)}`,
            'Værdi',
          ]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
