import { cx, HEALTH_BG } from '../lib/ui';
import type { HealthColor } from '../types/domain';

interface Props {
  value: number; // 0..1
  health?: HealthColor;
  className?: string;
  height?: 'sm' | 'md' | 'lg';
  /** Markér at værdien stammer fra auto-rollup (stribet). */
  rolledUp?: boolean;
}

const H = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3' };

export default function ProgressBar({ value, health = 'none', className, height = 'md', rolledUp }: Props) {
  const w = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-slate-100', H[height], className)}>
      <div
        className={cx('h-full rounded-full transition-all duration-500', HEALTH_BG[health])}
        style={{
          width: `${w}%`,
          backgroundImage: rolledUp
            ? 'linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.25) 75%, transparent 75%, transparent)'
            : undefined,
          backgroundSize: rolledUp ? '12px 12px' : undefined,
        }}
      />
    </div>
  );
}
