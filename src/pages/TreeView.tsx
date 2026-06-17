import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Building2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ListTree,
  Network,
  Plus,
  Search,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { useActiveKeyResults, useActiveOwners, useObjectiveSummary, useRootObjectives } from '../lib/selectors';
import { HEALTH_LABEL } from '../lib/okr';
import { LEVEL_LABEL, type HealthColor, type Level, type Objective } from '../types/domain';
import { cx, LEVEL_ACCENT, LEVEL_BORDER, LEVEL_ICONBG, LEVEL_SOFT, LEVEL_TINT, pct } from '../lib/ui';

const LEVEL_ICON: Record<Level, LucideIcon> = {
  company: Building2,
  tribe: Network,
  team: Users,
};
import { HealthDot } from '../components/HealthBadge';
import ProgressBar from '../components/ProgressBar';
import KrCard from '../components/KrCard';
import PageHeader from '../components/PageHeader';

const childLevel: Record<Level, Level | null> = { company: 'tribe', tribe: 'team', team: null };

interface NodeCtl {
  isOpen: (id: string, depth: number) => boolean;
  toggle: (id: string) => void;
}

function ObjectiveNode({
  objective,
  depth,
  ctl,
  parentLevel,
}: {
  objective: Objective;
  depth: number;
  ctl: NodeCtl;
  parentLevel?: Level;
}) {
  const open = ctl.isOpen(objective.id, depth);
  const krs = useStore((s) => s.krsByObjective.get(objective.id) ?? []);
  const children = useStore((s) => s.objectivesByParent.get(objective.id) ?? []);
  const summary = useObjectiveSummary(objective.id);
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);
  const openKrEditor = useUi((s) => s.openKrEditor);
  const next = childLevel[objective.level];
  const Icon = LEVEL_ICON[objective.level];

  return (
    <div
      className={cx(
        depth > 0 && 'relative ml-2.5 border-l-2 pl-4 sm:ml-4 sm:pl-6',
        depth > 0 && parentLevel && LEVEL_BORDER[parentLevel],
      )}
    >
      {/* Forbindelses-knude på connector-linjen */}
      {depth > 0 && (
        <span
          className={cx(
            'absolute -left-[5px] top-6 h-2 w-2 rounded-full ring-2 ring-canvas',
            parentLevel && LEVEL_ACCENT[parentLevel],
          )}
        />
      )}

      <div className="card mb-3 overflow-hidden">
        <button
          onClick={() => ctl.toggle(objective.id)}
          className={cx('flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors', LEVEL_TINT[objective.level])}
        >
          <span className={cx('h-10 w-1.5 shrink-0 rounded-full', LEVEL_ACCENT[objective.level])} />
          <ChevronRight size={18} className={cx('shrink-0 text-ink-muted transition-transform', open && 'rotate-90')} />
          <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', LEVEL_ICONBG[objective.level])}>
            <Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('chip', LEVEL_SOFT[objective.level])}>
                <Icon size={12} /> {LEVEL_LABEL[objective.level]}
              </span>
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
              className="mt-1 block truncate font-bold text-ink hover:text-brand-700"
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
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Key Results {krs.length > 0 && `· ${krs.length}`}
              </span>
              <button
                onClick={() => openKrEditor({ objectiveId: objective.id })}
                className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700"
              >
                <Plus size={12} /> KR
              </button>
            </div>
            {krs.length > 0 ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {krs.map((kr) => (
                  <KrCard key={kr.id} krId={kr.id} compact />
                ))}
              </div>
            ) : (
              <p className="py-1 text-sm text-ink-muted">Ingen Key Results endnu.</p>
            )}
          </div>
        )}
      </div>

      {open && (
        <div>
          {children.map((c) => (
            <ObjectiveNode key={c.id} objective={c} depth={depth + 1} ctl={ctl} parentLevel={objective.level} />
          ))}
          {next && (
            <button
              onClick={() => openObjectiveEditor({ level: next, parentObjectiveId: objective.id })}
              className="mb-3 ml-1 flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-brand-700"
            >
              <Plus size={14} /> Tilføj {LEVEL_LABEL[next].toLowerCase()}-objective
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyBoard() {
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);
  const loadDemo = useStore((s) => s.loadDemo);
  const navigate = useNavigate();
  return (
    <div className="card grid place-items-center gap-4 p-10 text-center sm:p-14">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <Target size={30} />
      </div>
      <div className="max-w-md">
        <p className="text-lg font-bold">Dit board er tomt — lad os ændre det</p>
        <p className="mt-1 text-sm text-ink-muted">
          Opret dit første Objective, eller udforsk systemet med et færdigt eksempel. Ny til OKR? Læs den korte
          guide først.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <button onClick={() => openObjectiveEditor({ level: 'company' })} className="btn-primary">
          <Plus size={16} /> Opret Objective
        </button>
        <button onClick={() => loadDemo()} className="btn-accent">
          <Sparkles size={16} /> Indlæs eksempel-data
        </button>
        <button onClick={() => navigate('/guide')} className="btn-secondary">
          <BookOpen size={16} /> Sådan virker det
        </button>
      </div>
    </div>
  );
}

function CheckInReminder({ staleKrIds }: { staleKrIds: string[] }) {
  const startQueue = useUi((s) => s.startCheckInQueue);
  if (staleKrIds.length === 0) return null;
  return (
    <div className="card mb-5 flex flex-col gap-3 border-health-yellow/30 bg-health-yellow/5 p-4 sm:flex-row sm:items-center">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-health-yellow/15 text-[#b76e00]">
        <Bell size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">
          {staleKrIds.length} {staleKrIds.length === 1 ? 'Key Result mangler' : 'Key Results mangler'} ugens check-in
        </p>
        <p className="text-sm text-ink-muted">Kør dem alle igennem på stribe — ét check-in tager under 30 sekunder.</p>
      </div>
      <button onClick={() => startQueue(staleKrIds)} className="btn-primary shrink-0">
        Start ugens check-in
      </button>
    </div>
  );
}

const HEALTH_OPTS: { value: HealthColor | 'all'; label: string }[] = [
  { value: 'all', label: 'Al sundhed' },
  { value: 'green', label: HEALTH_LABEL.green },
  { value: 'yellow', label: HEALTH_LABEL.yellow },
  { value: 'red', label: HEALTH_LABEL.red },
  { value: 'none', label: HEALTH_LABEL.none },
];

function LevelLegend({ counts }: { counts: Record<Level, number> }) {
  const levels: Level[] = ['company', 'tribe', 'team'];
  return (
    <div className="card mb-4 flex items-center gap-1.5 overflow-x-auto p-2.5">
      {levels.map((lvl, i) => {
        const Icon = LEVEL_ICON[lvl];
        return (
          <Fragment key={lvl}>
            <div className={cx('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-1.5', LEVEL_TINT[lvl])}>
              <span className={cx('grid h-8 w-8 place-items-center rounded-lg', LEVEL_ICONBG[lvl])}>
                <Icon size={16} />
              </span>
              <div className="leading-tight">
                <div className="text-xs font-bold">{LEVEL_LABEL[lvl]}</div>
                <div className="text-[11px] text-ink-muted">{counts[lvl]} mål</div>
              </div>
            </div>
            {i < levels.length - 1 && <ChevronRight size={16} className="shrink-0 text-ink-muted" />}
          </Fragment>
        );
      })}
      <span className="ml-auto hidden shrink-0 pr-1 text-[11px] text-ink-muted sm:block">
        Mål nedbrydes og ruller op
      </span>
    </div>
  );
}

export default function TreeView() {
  const roots = useRootObjectives();
  const activeKrs = useActiveKeyResults();
  const owners = useActiveOwners();
  const objectives = useStore((s) => s.objectives);
  const computedByKr = useStore((s) => s.computedByKr);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);

  const levelCounts = useMemo(() => {
    const c: Record<Level, number> = { company: 0, tribe: 0, team: 0 };
    for (const o of objectives) if (o.cycleId === activeCycleId) c[o.level] += 1;
    return c;
  }, [objectives, activeCycleId]);

  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState('all');
  const [health, setHealth] = useState<HealthColor | 'all'>('all');
  const [onlyStale, setOnlyStale] = useState(false);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const term = query.trim().toLowerCase();
  const filtersActive = term !== '' || owner !== 'all' || health !== 'all' || onlyStale;

  const allCycleObjIds = useMemo(
    () => objectives.filter((o) => o.cycleId === activeCycleId).map((o) => o.id),
    [objectives, activeCycleId],
  );

  const ctl: NodeCtl = {
    isOpen: (id, depth) => openMap[id] ?? depth < 2,
    toggle: (id) => setOpenMap((m) => ({ ...m, [id]: !(m[id] ?? false) })),
  };
  const expandAll = () => setOpenMap(Object.fromEntries(allCycleObjIds.map((id) => [id, true])));
  const collapseAll = () => setOpenMap(Object.fromEntries(allCycleObjIds.map((id) => [id, false])));

  const staleKrIds = useMemo(
    () => activeKrs.filter(({ kr }) => computedByKr.get(kr.id)?.needsCheckIn).map(({ kr }) => kr.id),
    [activeKrs, computedByKr],
  );

  // Filtrerede resultater (flad visning)
  const krResults = useMemo(() => {
    if (!filtersActive) return [];
    return activeKrs.filter(({ kr, objective }) => {
      const c = computedByKr.get(kr.id);
      if (term && !(kr.title.toLowerCase().includes(term) || kr.owner.toLowerCase().includes(term) || objective.title.toLowerCase().includes(term)))
        return false;
      if (owner !== 'all' && kr.owner !== owner && objective.owner !== owner) return false;
      if (health !== 'all' && c?.health !== health) return false;
      if (onlyStale && !c?.needsCheckIn) return false;
      return true;
    });
  }, [filtersActive, activeKrs, term, owner, health, onlyStale, computedByKr]);

  const objResults = useMemo(() => {
    if (!term) return [];
    return objectives
      .filter((o) => o.cycleId === activeCycleId)
      .filter((o) => o.title.toLowerCase().includes(term) || o.owner.toLowerCase().includes(term))
      .filter((o) => owner === 'all' || o.owner === owner)
      .slice(0, 12);
  }, [term, objectives, activeCycleId, owner]);

  const clearFilters = () => {
    setQuery('');
    setOwner('all');
    setHealth('all');
    setOnlyStale(false);
  };

  return (
    <div>
      <CheckInReminder staleKrIds={staleKrIds} />

      <PageHeader
        icon={<ListTree size={22} />}
        title="Board"
        subtitle="Fra virksomhedsmål ned til team-delmål. Stribede bjælker = auto-rollup."
        actions={
          <button onClick={() => openObjectiveEditor({ level: 'company' })} className="btn-primary hidden px-3 py-2 text-sm sm:inline-flex lg:hidden">
            <Plus size={16} /> Nyt Objective
          </button>
        }
      />

      {roots.length > 0 && !filtersActive && <LevelLegend counts={levelCounts} />}

      {/* Filterbar */}
      {roots.length > 0 && (
        <div className="card mb-5 flex flex-wrap items-center gap-2 p-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrér på titel eller ejer…"
              className="input py-2 pl-9"
            />
          </div>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="input w-auto py-2 text-sm">
            <option value="all">Alle ejere</option>
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select
            value={health}
            onChange={(e) => setHealth(e.target.value as HealthColor | 'all')}
            className="input w-auto py-2 text-sm"
          >
            {HEALTH_OPTS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
          <button
            onClick={() => setOnlyStale((v) => !v)}
            className={cx(
              'btn px-3 py-2 text-xs',
              onlyStale ? 'bg-accent-400 text-ink' : 'border border-slate-300 bg-white text-ink-soft hover:bg-slate-50',
            )}
          >
            <Bell size={14} /> Mangler check-in
          </button>
          <div className="ml-auto flex items-center gap-1">
            {filtersActive ? (
              <button onClick={clearFilters} className="btn-ghost px-2.5 py-2 text-xs">
                <X size={14} /> Ryd
              </button>
            ) : (
              <>
                <button onClick={expandAll} className="btn-ghost px-2.5 py-2 text-xs" title="Fold alle ud">
                  <ChevronsUpDown size={15} />
                </button>
                <button onClick={collapseAll} className="btn-ghost px-2.5 py-2 text-xs" title="Fold alle sammen">
                  <ChevronsDownUp size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {roots.length === 0 ? (
        <EmptyBoard />
      ) : filtersActive ? (
        <FilteredResults objResults={objResults} krResults={krResults} onClear={clearFilters} />
      ) : (
        roots.map((o) => <ObjectiveNode key={o.id} objective={o} depth={0} ctl={ctl} />)
      )}
    </div>
  );
}

function FilteredResults({
  objResults,
  krResults,
  onClear,
}: {
  objResults: Objective[];
  krResults: ReturnType<typeof useActiveKeyResults>;
  onClear: () => void;
}) {
  const total = objResults.length + krResults.length;
  if (total === 0) {
    return (
      <div className="card grid place-items-center gap-3 p-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-ink-muted">
          <Search size={22} />
        </div>
        <p className="font-semibold">Ingen match</p>
        <p className="text-sm text-ink-muted">Prøv at justere filtrene.</p>
        <button onClick={onClear} className="btn-secondary">Ryd filtre</button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        {total} {total === 1 ? 'resultat' : 'resultater'}
      </p>

      {objResults.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Objectives</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {objResults.map((o) => (
              <Link
                key={o.id}
                to={`/objective/${o.id}`}
                className="card flex items-center gap-3 p-3 transition-shadow hover:shadow-cardhover"
              >
                <span className={cx('h-8 w-1 shrink-0 rounded-full', LEVEL_ACCENT[o.level])} />
                <span className="min-w-0 flex-1">
                  <span className={cx('chip', LEVEL_SOFT[o.level])}>{LEVEL_LABEL[o.level]}</span>
                  <span className="mt-1 block truncate font-semibold">{o.title}</span>
                  <span className="block truncate text-xs text-ink-muted">{o.owner}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {krResults.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Key Results</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {krResults.map(({ kr, objective }) => (
              <div key={kr.id}>
                <div className="mb-1 truncate px-1 text-[11px] text-ink-muted">
                  {LEVEL_LABEL[objective.level]} · {objective.title}
                </div>
                <KrCard krId={kr.id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
