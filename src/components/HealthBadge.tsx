import { cx, HEALTH_BG, HEALTH_SOFT } from '../lib/ui';
import { HEALTH_LABEL } from '../lib/okr';
import type { HealthColor } from '../types/domain';

export function HealthDot({ health, className }: { health: HealthColor; className?: string }) {
  return <span className={cx('inline-block h-2.5 w-2.5 rounded-full', HEALTH_BG[health], className)} />;
}

export function HealthBadge({
  health,
  confidence,
  className,
}: {
  health: HealthColor;
  confidence?: number;
  className?: string;
}) {
  return (
    <span className={cx('chip', HEALTH_SOFT[health], className)}>
      <HealthDot health={health} />
      {HEALTH_LABEL[health]}
      {confidence !== undefined && <span className="opacity-70">· {confidence.toFixed(2)}</span>}
    </span>
  );
}
