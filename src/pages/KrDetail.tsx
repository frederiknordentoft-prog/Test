import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import {
  ArrowLeft,
  ChevronRight,
  GitMerge,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { formatMetric } from '../lib/okr';
import { cx, INITIATIVE_STYLE, pct } from '../lib/ui';
import { INITIATIVE_STATUS_LABEL, type AlignmentLink } from '../types/domain';
import ProgressBar from '../components/ProgressBar';
import { HealthBadge } from '../components/HealthBadge';
import KrTypePill from '../components/KrTypePill';
import Sparkline from '../components/Sparkline';

export default function KrDetail() {
  const { id = '' } = useParams();
  const kr = useStore((s) => s.krsById.get(id));
  const objective = useStore((s) => (kr ? s.objectivesById.get(kr.objectiveId) : undefined));
  const computed = useStore((s) => s.computedByKr.get(id));
  const checkIns = useStore((s) => s.checkInsByKr.get(id) ?? []);
  const initiatives = useStore((s) => s.initiativesByKr.get(id) ?? []);
  const linksByChild = useStore((s) => s.linksByChild.get(id) ?? []);
  const linksByParent = useStore((s) => s.linksByParent.get(id) ?? []);
  const { openCheckIn, openKrEditor, openInitiativeEditor, openAlign } = useUi();
  const removeKeyResult = useStore((s) => s.removeKeyResult);

  if (!kr || !computed) {
    return (
      <div className="card p-8 text-center text-ink-muted">
        Key Result ikke fundet. <Link to="/" className="text-brand-600">Til trævisning</Link>
      </div>
    );
  }

  const history = [...checkIns].reverse();
  const progress = computed.hasContributors ? computed.rolledUpProgress : computed.progress;

  const onDelete = async () => {
    if (confirm(`Slet "${kr.title}" og dets initiativer, check-ins og koblinger?`)) {
      const back = objective ? `/objective/${objective.id}` : '/';
      await removeKeyResult(id);
      window.location.href = back;
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/" className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={14} /> Træ
        </Link>
        {objective && (
          <>
            <ChevronRight size={14} />
            <Link to={`/objective/${objective.id}`} className="truncate hover:text-ink">
              {objective.title}
            </Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="truncate font-medium text-ink-soft">{kr.title}</span>
      </div>

      {/* Header */}
      <div className="card mb-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <KrTypePill type={kr.type} />
              <HealthBadge health={computed.health} confidence={computed.confidence} />
              {computed.hasContributors && (
                <span className="chip bg-violet-50 text-violet-700">
                  <GitMerge size={12} /> Auto-rollup
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{kr.title}</h1>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
              <Users size={14} /> {kr.owner}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button onClick={() => openCheckIn(kr.id)} className="btn-primary px-3 py-2 text-xs">
              <TrendingUp size={14} /> Check-in
            </button>
            <button onClick={() => openKrEditor(kr)} className="btn-secondary px-3 py-2 text-xs">
              <Pencil size={14} /> Redigér
            </button>
            <button onClick={onDelete} className="btn-danger px-3 py-2 text-xs">
              <Trash2 size={14} /> Slet
            </button>
          </div>
        </div>

        {/* Metric-tal */}
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Baseline" value={formatMetric(kr.baseline, kr)} />
          <Stat label="Nu" value={formatMetric(kr.current, kr)} highlight />
          <Stat label="Mål" value={formatMetric(kr.target, kr)} />
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-ink-muted">
              {computed.hasContributors ? 'Fremdrift (auto-rollup)' : 'Fremdrift'}
            </span>
            <span className="font-semibold">{pct(progress)}</span>
          </div>
          <ProgressBar value={progress} health={computed.health} height="lg" rolledUp={computed.hasContributors} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Check-in-historik */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Check-in-historik</h2>
            <span className="text-xs text-ink-muted">{checkIns.length} check-ins</span>
          </div>
          <div className="mb-4 rounded-xl bg-slate-50 p-2">
            <Sparkline checkIns={checkIns} kr={kr} height={120} showAxis />
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-ink-muted">Ingen check-ins endnu.</p>
          ) : (
            <ul className="space-y-2.5">
              {history.map((ci) => (
                <li key={ci.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{formatMetric(ci.value, kr)}</span>
                    <span className="text-xs text-ink-muted">
                      {format(new Date(ci.date), 'd. MMM yyyy', { locale: da })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-400"
                        style={{ width: `${ci.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-ink-muted">conf {ci.confidence.toFixed(2)}</span>
                  </div>
                  {ci.comment && <p className="mt-1.5 text-sm text-ink-soft">{ci.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          {/* Initiativer (arbejdet) */}
          <section className="card p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">Initiativer</h2>
              <button onClick={() => openInitiativeEditor({ keyResultId: id })} className="btn-secondary px-3 py-1.5 text-xs">
                <Plus size={14} /> Tilføj
              </button>
            </div>
            <p className="mb-3 text-xs text-ink-muted">
              Det konkrete arbejde der driver dette udfald — adskilt fra selve målet.
            </p>
            {initiatives.length === 0 ? (
              <p className="text-sm text-ink-muted">Ingen initiativer endnu.</p>
            ) : (
              <ul className="space-y-2">
                {initiatives.map((ini) => (
                  <li
                    key={ini.id}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', INITIATIVE_STYLE[ini.status].dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{ini.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                        <span className={cx('chip px-2 py-0.5', INITIATIVE_STYLE[ini.status].soft)}>
                          {INITIATIVE_STATUS_LABEL[ini.status]}
                        </span>
                        <span>{ini.owner}</span>
                        {ini.dueDate && <span>· {format(new Date(ini.dueDate), 'd. MMM', { locale: da })}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => openInitiativeEditor(ini)}
                      className="btn-ghost shrink-0 p-1.5 opacity-0 group-hover:opacity-100"
                      aria-label="Redigér initiativ"
                    >
                      <Pencil size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Alignment */}
          <section className="card p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">Alignment</h2>
              <button onClick={() => openAlign(id)} className="btn-secondary px-3 py-1.5 text-xs">
                <GitMerge size={14} /> Kobl
              </button>
            </div>
            <p className="mb-3 text-xs text-ink-muted">
              Bidrager op mod overordnede KR'er, og modtager fremdrift fra bidragende KR'er.
            </p>

            <AlignmentList title="Bidrager til (op)" links={linksByParent} side="parent" />
            <div className="my-3 border-t border-slate-100" />
            <AlignmentList title="Bidrages af (ned)" links={linksByChild} side="child" />
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cx('rounded-xl px-2 py-3', highlight ? 'bg-brand-50' : 'bg-slate-50')}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={cx('mt-1 text-base font-bold', highlight && 'text-brand-700')}>{value}</div>
    </div>
  );
}

function AlignmentList({
  title,
  links,
  side,
}: {
  title: string;
  links: AlignmentLink[];
  side: 'parent' | 'child';
}) {
  const krsById = useStore((s) => s.krsById);
  const objectivesById = useStore((s) => s.objectivesById);
  const computedByKr = useStore((s) => s.computedByKr);
  const removeLink = useStore((s) => s.removeLink);

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</div>
      {links.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Target size={14} /> Ingen koblinger.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => {
            const otherId = side === 'parent' ? l.parentKrId : l.childKrId;
            const otherKr = krsById.get(otherId);
            if (!otherKr) return null;
            const obj = objectivesById.get(otherKr.objectiveId);
            const c = computedByKr.get(otherId);
            return (
              <li key={l.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5">
                <div className="min-w-0 flex-1">
                  <Link to={`/kr/${otherId}`} className="block truncate text-sm font-medium hover:text-brand-600">
                    {otherKr.title}
                  </Link>
                  <div className="truncate text-xs text-ink-muted">
                    {obj?.title} · vægt {l.weight}
                  </div>
                </div>
                {c && (
                  <span className="shrink-0 text-xs font-semibold text-ink-soft">
                    {pct(c.hasContributors ? c.rolledUpProgress : c.progress)}
                  </span>
                )}
                <button
                  onClick={() => removeLink(l.id)}
                  className="btn-ghost shrink-0 p-1.5"
                  aria-label="Fjern kobling"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
