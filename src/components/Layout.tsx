import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListTree, RotateCcw, Target, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { cx } from '../lib/ui';

const NAV = [
  { to: '/', label: 'Trævisning', icon: ListTree, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: false },
];

function CycleSelect() {
  const cycles = useStore((s) => s.cycles);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const setActiveCycle = useStore((s) => s.setActiveCycle);
  return (
    <select
      value={activeCycleId}
      onChange={(e) => setActiveCycle(e.target.value)}
      className="input cursor-pointer py-2 text-sm font-semibold"
      aria-label="Vælg cyklus"
    >
      {cycles.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.isActive ? ' (aktiv)' : ''}
        </option>
      ))}
    </select>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const reset = useStore((s) => s.reset);
  const location = useLocation();
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);

  const onReset = async () => {
    if (confirm('Nulstil al data og indlæs demo-seed forfra?')) await reset();
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-surface px-4 py-6 lg:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
            <Target size={20} />
          </div>
          <div>
            <div className="text-sm font-extrabold leading-none">OKR</div>
            <div className="text-[11px] text-ink-muted">Nordlys Games</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
                )
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 space-y-2">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Cyklus</div>
          <CycleSelect />
        </div>

        <button
          onClick={() => openObjectiveEditor({ level: 'company' })}
          className="btn-primary mt-6 w-full"
        >
          <Plus size={16} /> Nyt Objective
        </button>

        <div className="mt-auto pt-6">
          <button onClick={onReset} className="btn-ghost w-full justify-start text-xs">
            <RotateCcw size={14} /> Nulstil demo-data
          </button>
        </div>
      </aside>

      {/* Hovedindhold */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar (mobil) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">
              <Target size={18} />
            </div>
            <span className="font-extrabold">OKR</span>
          </div>
          <CycleSelect />
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Bundnavigation (mobil) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-slate-200 bg-surface/95 backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const active = n.end ? location.pathname === n.to : location.pathname.startsWith(n.to);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={cx(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold',
                active ? 'text-brand-600' : 'text-ink-muted',
              )}
            >
              <n.icon size={20} /> {n.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
