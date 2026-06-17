import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, CalendarClock, CheckCircle2, Filter, LayoutDashboard, TrendingUp, Users } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { HEALTH_HEX, HEALTH_LABEL } from '../lib/okr';
import { cx, HEALTH_SOFT, pct } from '../lib/ui';
import { LEVEL_LABEL, type HealthColor, type KeyResult, type Objective } from '../types/domain';
import KrTypePill from '../components/KrTypePill';
import { HealthDot } from '../components/HealthBadge';
import PageHeader from '../components/PageHeader';

interface Row {
  kr: KeyResult;
  objective: Objective;
  health: HealthColor;
  progress: number;
  needsCheckIn: boolean;
}

export default function Dashboard() {
  const keyResults = useStore((s) => s.keyResults);
  const objectivesById = useStore((s) => s.objectivesById);
  const objectivesByParent = useStore((s) => s.objectivesByParent);
  const objectives = useStore((s) => s.objectives);
  const computedByKr = useStore((s) => s.computedByKr);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const cycles = useStore((s) => s.cycles);
  const openCheckIn = useUi((s) => s.openCheckIn);

  const [scopeId, setScopeId] = useState<string>('all');

  // Objektiver man kan filtrere på (tribe + team i aktiv cyklus).
  const scopeOptions = useMemo(
    () =>
      objectives
        .filter((o) => o.cycleId === activeCycleId && o.level !== 'company')
        .sort((a, b) => (a.level + a.title).localeCompare(b.level + b.title)),
    [objectives, activeCycleId],
  );

  // Resolvér valgt scope til mængden af relevante objective-id'er (inkl. descendants).
  const scopeSet = useMemo(() => {
    if (scopeId === 'all') return null;
    const set = new Set<string>();
    const walk = (id: string) => {
      set.add(id);
      for (const c of objectivesByParent.get(id) ?? []) walk(c.id);
    };
    walk(scopeId);
    return set;
  }, [scopeId, objectivesByParent]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const kr of keyResults) {
      const obj = objectivesById.get(kr.objectiveId);
      if (!obj || obj.cycleId !== activeCycleId) continue;
      if (scopeSet && !scopeSet.has(obj.id)) continue;
      const c = computedByKr.get(kr.id);
      if (!c) continue;
      out.push({
        kr,
        objective: obj,
        health: c.health,
        progress: c.hasContributors ? c.rolledUpProgress : c.progress,
        needsCheckIn: c.needsCheckIn,
      });
    }
    return out;
  }, [keyResults, objectivesById, computedByKr, activeCycleId, scopeSet]);

  const counts = {
    total: rows.length,
    green: rows.filter((r) => r.health === 'green').length,
    yellow: rows.filter((r) => r.health === 'yellow').length,
    red: rows.filter((r) => r.health === 'red').length,
    none: rows.filter((r) => r.health === 'none').length,
    needsCheckIn: rows.filter((r) => r.needsCheckIn).length,
    committed: rows.filter((r) => r.kr.type === 'committed').length,
    aspirational: rows.filter((r) => r.kr.type === 'aspirational').length,
  };
  const avgProgress = rows.length ? rows.reduce((a, r) => a + r.progress, 0) / rows.length : 0;

  const pieData = [
    { name: 'green', value: counts.green },
    { name: 'yellow', value: counts.yellow },
    { name: 'red', value: counts.red },
    { name: 'none', value: counts.none },
  ].filter((d) => d.value > 0);

  // "Mål i drift": rød først, så gul; værste fremdrift øverst.
  const drifting = [...rows]
    .filter((r) => r.health === 'red' || r.health === 'yellow' || r.health === 'none')
    .sort((a, b) => rank(a.health) - rank(b.health) || a.progress - b.progress);

  // Gruppér KR'er pr. tribe (team-KR'er ruller op til deres tribe; company-KR'er for sig).
  const tribeGroups = useMemo(() => {
    const map = new Map<string, { id: string; label: string; isTribe: boolean; rows: Row[] }>();
    for (const r of rows) {
      let cur: Objective | undefined = r.objective;
      while (cur && cur.level === 'team' && cur.parentObjectiveId) {
        cur = objectivesById.get(cur.parentObjectiveId);
      }
      const isTribe = cur?.level === 'tribe';
      const id = isTribe ? cur!.id : '__company__';
      const label = isTribe ? cur!.title : 'Virksomhedsniveau';
      if (!map.has(id)) map.set(id, { id, label, isTribe, rows: [] });
      map.get(id)!.rows.push(r);
    }
    return [...map.values()]
      .map((g) => ({
        id: g.id,
        label: g.label,
        isTribe: g.isTribe,
        total: g.rows.length,
        green: g.rows.filter((r) => r.health === 'green').length,
        yellow: g.rows.filter((r) => r.health === 'yellow').length,
        red: g.rows.filter((r) => r.health === 'red').length,
        none: g.rows.filter((r) => r.health === 'none').length,
        needs: g.rows.filter((r) => r.needsCheckIn).length,
        avg: g.rows.reduce((a, r) => a + r.progress, 0) / g.rows.length,
      }))
      .sort((a, b) => b.red - a.red || b.yellow - a.yellow || b.total - a.total);
  }, [rows, objectivesById]);

  const cycleName = cycles.find((c) => c.id === activeCycleId)?.name ?? '';

  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Dashboard"
        subtitle={`Sundhed på tværs af alle Key Results · ${cycleName}`}
        actions={
          <div className="flex items-center gap-2">
            <Filter size={16} className="hidden text-ink-muted sm:block" />
            <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="input w-auto py-2 text-sm font-semibold">
              <option value="all">Hele organisationen</option>
              {scopeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  [{LEVEL_LABEL[o.level]}] {o.title}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">Ingen Key Results i dette udsnit.</div>
      ) : (
        <>
          {/* KPI-kort */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={<TrendingUp size={18} />}
              tone="brand"
              value={pct(avgProgress)}
              label="Gns. fremdrift"
              sub={`${counts.total} Key Results`}
            />
            <Kpi
              icon={<CheckCircle2 size={18} />}
              tone="green"
              value={`${counts.green}`}
              label="På sporet"
              sub={`${pct(counts.total ? counts.green / counts.total : 0)} af alle`}
            />
            <Kpi
              icon={<AlertTriangle size={18} />}
              tone="red"
              value={`${counts.red + counts.yellow}`}
              label="Mål i drift"
              sub={`${counts.red} kritiske · ${counts.yellow} i risiko`}
            />
            <Kpi
              icon={<CalendarClock size={18} />}
              tone="yellow"
              value={`${counts.needsCheckIn}`}
              label="Mangler check-in"
              sub="denne uge"
            />
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            {/* Sundhedsfordeling (donut) */}
            <section className="card p-5">
              <h2 className="mb-1 text-base font-bold">Sundhedsfordeling</h2>
              <p className="mb-3 text-xs text-ink-muted">Rød / gul / grøn på tværs af KR'er</p>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={HEALTH_HEX[d.name as HealthColor]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(v: number, n) => [`${v} KR`, HEALTH_LABEL[n as HealthColor]]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold">{counts.total}</span>
                  <span className="text-[11px] text-ink-muted">Key Results</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {(['green', 'yellow', 'red', 'none'] as HealthColor[]).map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <HealthDot health={h} />
                    <span className="text-ink-soft">{HEALTH_LABEL[h]}</span>
                    <span className="ml-auto font-semibold">{counts[h]}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Committed vs aspirational */}
            <section className="card p-5">
              <h2 className="mb-1 text-base font-bold">Committed vs. aspirational</h2>
              <p className="mb-4 text-xs text-ink-muted">Strækmål måles mildere (0.7 = godt)</p>
              <TypeBreakdown rows={rows} type="committed" count={counts.committed} />
              <div className="my-4 border-t border-slate-100" />
              <TypeBreakdown rows={rows} type="aspirational" count={counts.aspirational} />
            </section>

            {/* Hurtig sundhedsbar */}
            <section className="card p-5">
              <h2 className="mb-1 text-base font-bold">Samlet sundhed</h2>
              <p className="mb-4 text-xs text-ink-muted">Andel af KR'er pr. tilstand</p>
              <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {(['green', 'yellow', 'red', 'none'] as HealthColor[]).map((h) =>
                  counts[h] > 0 ? (
                    <div
                      key={h}
                      style={{ width: `${(counts[h] / counts.total) * 100}%`, background: HEALTH_HEX[h] }}
                      title={`${HEALTH_LABEL[h]}: ${counts[h]}`}
                    />
                  ) : null,
                )}
              </div>
              <ul className="space-y-2.5 text-sm">
                <Stat label="Grøn-andel" value={pct(counts.total ? counts.green / counts.total : 0)} />
                <Stat label="Kritiske mål" value={`${counts.red}`} danger={counts.red > 0} />
                <Stat label="Uden check-in" value={`${counts.needsCheckIn}`} />
                <Stat label="Gns. fremdrift" value={pct(avgProgress)} />
              </ul>
            </section>
          </div>

          {/* Sundhed pr. tribe */}
          {tribeGroups.length > 1 && (
            <section className="card mb-5 overflow-hidden">
              <div className="card-head">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Users size={16} />
                </span>
                <h2 className="text-base font-bold">Sundhed pr. tribe</h2>
                <span className="ml-auto text-xs text-ink-muted">Klik for at zoome ind</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-ink-muted">
                      <th className="px-5 py-2.5 font-semibold">Tribe</th>
                      <th className="px-3 py-2.5 text-center font-semibold">KR</th>
                      <th className="px-3 py-2.5 font-semibold">Fordeling</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Fremdrift</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Mangler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tribeGroups.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => g.isTribe && setScopeId(g.id)}
                        className={cx(
                          'border-b border-slate-50 last:border-0',
                          g.isTribe && 'cursor-pointer hover:bg-slate-50',
                        )}
                      >
                        <td className="px-5 py-3 font-semibold">{g.label}</td>
                        <td className="px-3 py-3 text-center text-ink-soft">{g.total}</td>
                        <td className="px-3 py-3">
                          <div className="flex h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                            {(['green', 'yellow', 'red', 'none'] as HealthColor[]).map((h) =>
                              g[h] > 0 ? (
                                <div key={h} style={{ width: `${(g[h] / g.total) * 100}%`, background: HEALTH_HEX[h] }} />
                              ) : null,
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{pct(g.avg)}</td>
                        <td className="px-5 py-3 text-right">
                          {g.needs > 0 ? (
                            <span className="chip bg-accent-50 text-accent-800">{g.needs}</span>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Mål i drift */}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Mål i drift</h2>
              <span className="text-xs text-ink-muted">{drifting.length} kræver opmærksomhed</span>
            </div>
            {drifting.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-health-green">
                <CheckCircle2 size={16} /> Alt på sporet — intet i drift.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {drifting.map((r) => (
                  <li key={r.kr.id} className="flex items-center gap-3 py-2.5">
                    <HealthDot health={r.health} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/kr/${r.kr.id}`} className="block truncate font-medium hover:text-brand-600">
                        {r.kr.title}
                      </Link>
                      <div className="truncate text-xs text-ink-muted">
                        {LEVEL_LABEL[r.objective.level]} · {r.objective.title}
                      </div>
                    </div>
                    <KrTypePill type={r.kr.type} className="hidden sm:inline-flex" />
                    <span className={cx('chip', HEALTH_SOFT[r.health])}>{pct(r.progress)}</span>
                    <button onClick={() => openCheckIn(r.kr.id)} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">
                      Check-in
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function rank(h: HealthColor): number {
  return { red: 0, none: 1, yellow: 2, green: 3 }[h];
}

function Kpi({
  icon,
  value,
  label,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
  tone: 'brand' | 'green' | 'yellow' | 'red';
}) {
  const toneCls = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-health-green/10 text-health-green',
    yellow: 'bg-health-yellow/10 text-[#b76e00]',
    red: 'bg-health-red/10 text-health-red',
  }[tone];
  return (
    <div className="card p-4">
      <div className={cx('mb-3 grid h-9 w-9 place-items-center rounded-xl', toneCls)}>{icon}</div>
      <div className="text-2xl font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-sm font-semibold text-ink-soft">{label}</div>
      <div className="text-xs text-ink-muted">{sub}</div>
    </div>
  );
}

function TypeBreakdown({ rows, type, count }: { rows: Row[]; type: KeyResult['type']; count: number }) {
  const subset = rows.filter((r) => r.kr.type === type);
  const green = subset.filter((r) => r.health === 'green').length;
  const avg = subset.length ? subset.reduce((a, r) => a + r.progress, 0) / subset.length : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <KrTypePill type={type} />
        <span className="text-sm font-semibold text-ink-soft">{count} KR</span>
      </div>
      <div className="mb-1 flex justify-between text-xs text-ink-muted">
        <span>Gns. fremdrift</span>
        <span className="font-semibold text-ink-soft">{pct(avg)}</span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-400" style={{ width: `${avg * 100}%` }} />
      </div>
      <div className="text-xs text-ink-muted">
        {green} af {count} på sporet
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={cx('font-bold', danger ? 'text-health-red' : 'text-ink')}>{value}</span>
    </li>
  );
}
