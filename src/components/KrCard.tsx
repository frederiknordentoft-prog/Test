import { Link } from 'react-router-dom';
import { GitMerge, TrendingUp, CircleDashed } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { formatMetric } from '../lib/okr';
import { cx, pct } from '../lib/ui';
import ProgressBar from './ProgressBar';
import { HealthBadge } from './HealthBadge';
import KrTypePill from './KrTypePill';
import Sparkline from './Sparkline';

interface Props {
  krId: string;
  compact?: boolean;
}

export default function KrCard({ krId, compact }: Props) {
  const kr = useStore((s) => s.krsById.get(krId));
  const computed = useStore((s) => s.computedByKr.get(krId));
  const checkIns = useStore((s) => s.checkInsByKr.get(krId) ?? []);
  const contributorCount = useStore((s) => s.linksByParent.get(krId)?.length ?? 0);
  const openCheckIn = useUi((s) => s.openCheckIn);

  if (!kr || !computed) return null;
  const progress = computed.hasContributors ? computed.rolledUpProgress : computed.progress;

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <KrTypePill type={kr.type} />
            {computed.hasContributors && (
              <span className="chip bg-violet-50 text-violet-700" title="Fremdrift rulles op fra bidragende KR'er">
                <GitMerge size={12} /> Auto-rollup · {contributorCount}
              </span>
            )}
            {computed.needsCheckIn && (
              <span className="chip bg-health-yellow/10 text-[#b76e00]" title="Mangler ugens check-in">
                <CircleDashed size={12} /> Mangler check-in
              </span>
            )}
          </div>
          <Link
            to={`/kr/${kr.id}`}
            className="block truncate font-semibold text-ink hover:text-brand-600"
            title={kr.title}
          >
            {kr.title}
          </Link>
          <div className="mt-0.5 text-xs text-ink-muted">Ejer: {kr.owner}</div>
        </div>
        <div className="shrink-0 text-right">
          <HealthBadge health={computed.health} confidence={computed.confidence} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="font-medium text-ink-soft">
              {formatMetric(kr.current, kr)}{' '}
              <span className="text-ink-muted">/ {formatMetric(kr.target, kr)}</span>
            </span>
            <span className="font-semibold text-ink-soft">{pct(progress)}</span>
          </div>
          <ProgressBar value={progress} health={computed.health} rolledUp={computed.hasContributors} />
        </div>
      </div>

      {!compact && (
        <div className="mt-3 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Sparkline checkIns={checkIns} kr={kr} height={36} />
          </div>
          <button
            onClick={() => openCheckIn(kr.id)}
            className={cx(
              'btn shrink-0 px-3 py-1.5 text-xs',
              computed.needsCheckIn ? 'btn-primary' : 'btn-secondary',
            )}
          >
            <TrendingUp size={14} /> Check-in
          </button>
        </div>
      )}
    </div>
  );
}
