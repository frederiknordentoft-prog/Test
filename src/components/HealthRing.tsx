import { HEALTH_HEX } from '../lib/okr';
import type { OrgPulse } from '../lib/selectors';
import { cx } from '../lib/ui';

const ORDER: ('green' | 'yellow' | 'red' | 'none')[] = ['green', 'yellow', 'red', 'none'];

/** Donut-ring der viser sundhedsfordeling med gns. fremdrift i midten. */
export default function HealthRing({
  pulse,
  size = 116,
  thickness = 12,
  className,
}: {
  pulse: OrgPulse;
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const { total, avg } = pulse;

  // Byg conic-gradient ud fra sundhedsfordelingen.
  let acc = 0;
  const stops: string[] = [];
  if (total === 0) {
    stops.push(`#e2e8f0 0deg 360deg`);
  } else {
    for (const key of ORDER) {
      const slice = (pulse[key] / total) * 360;
      if (slice <= 0) continue;
      stops.push(`${HEALTH_HEX[key]} ${acc}deg ${acc + slice}deg`);
      acc += slice;
    }
  }

  return (
    <div
      className={cx('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-700"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
      />
      <div
        className="absolute rounded-full bg-surface shadow-[inset_0_1px_3px_rgba(8,40,26,0.08)]"
        style={{ inset: thickness }}
      />
      <div className="relative z-10 text-center leading-none">
        <div className="text-[22px] font-extrabold tracking-tight text-ink">
          {Math.round(avg * 100)}
          <span className="text-sm font-bold text-ink-muted">%</span>
        </div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">fremdrift</div>
      </div>
    </div>
  );
}
