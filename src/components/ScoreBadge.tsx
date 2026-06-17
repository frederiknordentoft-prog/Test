import { cx, HEALTH_SOLID } from '../lib/ui';
import type { HealthColor } from '../types/domain';

/** Glanceable score-badge (0–100) farvet efter sundhed — fx "96". */
export default function ScoreBadge({
  value,
  health,
  size = 'md',
  className,
}: {
  value: number; // 0..1
  health: HealthColor;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sz = {
    sm: 'h-7 min-w-7 px-1.5 text-xs',
    md: 'h-8 min-w-8 px-2 text-sm',
    lg: 'h-10 min-w-10 px-2.5 text-base',
  }[size];
  return (
    <span
      className={cx('grid place-items-center rounded-xl font-extrabold tabular-nums', HEALTH_SOLID[health], sz, className)}
      title="Fremdrift / sundhed"
    >
      {Math.round(value * 100)}
    </span>
  );
}
