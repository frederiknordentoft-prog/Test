import { cx } from '../lib/ui';
import type { KrType } from '../types/domain';

const STYLE: Record<KrType, string> = {
  committed: 'bg-slate-100 text-ink-soft',
  aspirational: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};
const LABEL: Record<KrType, string> = {
  committed: 'Committed',
  aspirational: 'Aspirational',
};

export default function KrTypePill({ type, className }: { type: KrType; className?: string }) {
  return (
    <span className={cx('chip', STYLE[type], className)} title={
      type === 'aspirational'
        ? 'Strækmål — 0.7 er allerede et godt resultat'
        : 'Forventes leveret 100 %'
    }>
      {LABEL[type]}
    </span>
  );
}
