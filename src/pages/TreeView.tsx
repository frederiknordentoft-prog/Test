import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Target, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { useObjectiveSummary, useRootObjectives } from '../lib/selectors';
import { LEVEL_LABEL, type Level, type Objective } from '../types/domain';
import { cx, LEVEL_ACCENT, LEVEL_SOFT, pct } from '../lib/ui';
import { HealthDot } from '../components/HealthBadge';
import ProgressBar from '../components/ProgressBar';
import KrCard from '../components/KrCard';

const childLevel: Record<Level, Level | null> = { company: 'tribe', tribe: 'team', team: null };

function ObjectiveNode({ objective, depth }: { objective: Objective; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const krs = useStore((s) => s.krsByObjective.get(objective.id) ?? []);
  const children = useStore((s) => s.objectivesByParent.get(objective.id) ?? []);
  const summary = useObjectiveSummary(objective.id);
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);
  const next = childLevel[objective.level];

  return (
    <div className={cx(depth > 0 && 'ml-3 border-l border-slate-200 pl-4 sm:ml-4 sm:pl-6')}>
      <div className="card mb-3 overflow-hidden">
        {/* Objective-header */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60"
        >
          <span className={cx('h-9 w-1 shrink-0 rounded-full', LEVEL_ACCENT[objective.level])} />
          <ChevronRight
            size={18}
            className={cx('shrink-0 text-ink-muted transition-transform', open && 'rotate-90')}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('chip', LEVEL_SOFT[objective.level])}>{LEVEL_LABEL[objective.level]}</span>
              <HealthDot health={summary.health} />
              {summary.needsCheckInCount > 0 && (
                <span className="text-[11px] font-semibold text-[#b76e00]">
                  {summary.needsCheckInCount} mangler check-in
                </span>
              )}
            </div>
            <Link
              to={`/objective/${objective.id}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 block truncate font-bold text-ink hover:text-brand-600"
            >
              {objective.title}
            </Link>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
              <Users size={12} /> {objective.owner}
            </div>
          </div>
          <div className="hidden w-40 shrink-0 sm:block">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-ink-muted">{krs.length} KR</span>
              <span className="font-semibold text-ink-soft">{pct(summary.progress)}</span>
            </div>
            <ProgressBar value={summary.progress} health={summary.health} height="sm" />
          </div>
        </button>

        {open && (
          <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
            {krs.length > 0 ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {krs.map((kr) => (
                  <KrCard key={kr.id} krId={kr.id} compact />
                ))}
              </div>
            ) : (
              <p className="py-2 text-sm text-ink-muted">Ingen Key Results endnu.</p>
            )}
          </div>
        )}
      </div>

      {/* Child-objektiver */}
      {open && (
        <div>
          {children.map((c) => (
            <ObjectiveNode key={c.id} objective={c} depth={depth + 1} />
          ))}
          {next && (
            <button
              onClick={() =>
                openObjectiveEditor({ level: next, parentObjectiveId: objective.id })
              }
              className="mb-3 ml-1 flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-brand-600"
            >
              <Plus size={14} /> Tilføj {LEVEL_LABEL[next].toLowerCase()}-objective
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TreeView() {
  const roots = useRootObjectives();
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Alignment-træ</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Fra virksomhedsmål ned til team-delmål. Stribede bjælker viser auto-rollup fra bidragende KR'er.
          </p>
        </div>
        <button onClick={() => openObjectiveEditor({ level: 'company' })} className="btn-primary hidden sm:inline-flex">
          <Plus size={16} /> Nyt Objective
        </button>
      </div>

      {roots.length === 0 ? (
        <div className="card grid place-items-center gap-3 p-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <Target size={26} />
          </div>
          <div>
            <p className="font-semibold">Ingen objectives i denne cyklus endnu</p>
            <p className="text-sm text-ink-muted">Opret det første virksomhedsmål for at komme i gang.</p>
          </div>
          <button onClick={() => openObjectiveEditor({ level: 'company' })} className="btn-primary">
            <Plus size={16} /> Opret Objective
          </button>
        </div>
      ) : (
        roots.map((o) => <ObjectiveNode key={o.id} objective={o} depth={0} />)
      )}
    </div>
  );
}
