import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { useObjectiveSummary } from '../lib/selectors';
import { LEVEL_LABEL } from '../types/domain';
import { cx, LEVEL_ACCENT, LEVEL_SOFT, pct } from '../lib/ui';
import ProgressBar from '../components/ProgressBar';
import { HealthDot } from '../components/HealthBadge';
import KrCard from '../components/KrCard';
import { SOFT_LIMITS } from '../lib/okr';

export default function ObjectiveDetail() {
  const { id = '' } = useParams();
  const objective = useStore((s) => s.objectivesById.get(id));
  const parent = useStore((s) => (objective?.parentObjectiveId ? s.objectivesById.get(objective.parentObjectiveId) : undefined));
  const krs = useStore((s) => s.krsByObjective.get(id) ?? []);
  const children = useStore((s) => s.objectivesByParent.get(id) ?? []);
  const summary = useObjectiveSummary(id);
  const { openObjectiveEditor, openKrEditor } = useUi();
  const removeObjective = useStore((s) => s.removeObjective);

  if (!objective) {
    return (
      <div className="card p-8 text-center text-ink-muted">
        Objective ikke fundet. <Link to="/" className="text-brand-600">Til trævisning</Link>
      </div>
    );
  }

  const overLimit = krs.length > SOFT_LIMITS.krsPerObjective;

  const onDelete = async () => {
    if (confirm(`Slet "${objective.title}" og alle tilhørende KR'er, initiativer og check-ins?`)) {
      await removeObjective(id);
      history.back();
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={14} /> Træ
        </Link>
        {parent && (
          <>
            <ChevronRight size={14} />
            <Link to={`/objective/${parent.id}`} className="truncate hover:text-ink">
              {parent.title}
            </Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="truncate font-medium text-ink-soft">{objective.title}</span>
      </div>

      {/* Header */}
      <div className="card mb-5 p-5">
        <div className="flex items-start gap-4">
          <span className={cx('mt-1 h-12 w-1.5 shrink-0 rounded-full', LEVEL_ACCENT[objective.level])} />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cx('chip', LEVEL_SOFT[objective.level])}>{LEVEL_LABEL[objective.level]}</span>
              <span className="chip bg-slate-100 text-ink-soft">
                <HealthDot health={summary.health} /> {pct(summary.progress)} samlet
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{objective.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{objective.description}</p>
            <div className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted">
              <Users size={14} /> {objective.owner}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button onClick={() => openObjectiveEditor(objective)} className="btn-secondary px-3 py-2 text-xs">
              <Pencil size={14} /> Redigér
            </button>
            <button onClick={onDelete} className="btn-danger px-3 py-2 text-xs">
              <Trash2 size={14} /> Slet
            </button>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={summary.progress} health={summary.health} height="lg" />
        </div>
      </div>

      {/* Key Results */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Key Results <span className="text-ink-muted">({krs.length})</span></h2>
          <button onClick={() => openKrEditor({ objectiveId: id })} className="btn-secondary px-3 py-2 text-xs">
            <Plus size={14} /> Tilføj KR
          </button>
        </div>
        {overLimit && (
          <div className="mb-3 rounded-xl bg-health-yellow/10 px-3.5 py-2.5 text-sm text-[#b76e00]">
            Tip: {krs.length} KR'er på ét objective. Best practice er {SOFT_LIMITS.krsPerObjective} eller færre — overvej at fokusere.
          </div>
        )}
        {krs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {krs.map((kr) => (
              <KrCard key={kr.id} krId={kr.id} />
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-sm text-ink-muted">Ingen Key Results endnu.</p>
        )}
      </div>

      {/* Child-objektiver */}
      {children.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-bold">Underliggende objectives</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {children.map((c) => (
              <ChildObjectiveCard key={c.id} id={c.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChildObjectiveCard({ id }: { id: string }) {
  const obj = useStore((s) => s.objectivesById.get(id));
  const summary = useObjectiveSummary(id);
  if (!obj) return null;
  return (
    <Link to={`/objective/${id}`} className="card flex items-center gap-3 p-3.5 transition-shadow hover:shadow-cardhover">
      <span className={cx('h-9 w-1 shrink-0 rounded-full', LEVEL_ACCENT[obj.level])} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={cx('chip', LEVEL_SOFT[obj.level])}>{LEVEL_LABEL[obj.level]}</span>
          <HealthDot health={summary.health} />
        </div>
        <div className="truncate font-semibold">{obj.title}</div>
        <ProgressBar value={summary.progress} health={summary.health} height="sm" className="mt-2" />
      </div>
      <ChevronRight size={18} className="shrink-0 text-ink-muted" />
    </Link>
  );
}
