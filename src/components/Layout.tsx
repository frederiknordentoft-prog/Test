import { useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BookOpen,
  CalendarPlus,
  Download,
  LayoutDashboard,
  ListTree,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { cx } from '../lib/ui';

const NAV = [
  { to: '/', label: 'Board', icon: ListTree, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: false },
  { to: '/guide', label: 'Sådan virker det', icon: BookOpen, end: false },
];

function CycleSelect() {
  const cycles = useStore((s) => s.cycles);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const setActiveCycle = useStore((s) => s.setActiveCycle);
  const openCycleModal = useUi((s) => s.openCycleModal);
  return (
    <div className="flex items-center gap-1.5">
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
      <button onClick={openCycleModal} className="btn-secondary shrink-0 px-2.5 py-2" title="Ny cyklus" aria-label="Ny cyklus">
        <CalendarPlus size={16} />
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const loadDemo = useStore((s) => s.loadDemo);
  const clearAll = useStore((s) => s.clearAll);
  const exportToFile = useStore((s) => s.exportToFile);
  const importFromFile = useStore((s) => s.importFromFile);
  const location = useLocation();
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);
  const openCommand = useUi((s) => s.openCommand);
  const fileRef = useRef<HTMLInputElement>(null);

  const onDemo = async () => {
    if (confirm('Indlæs eksempel-data? Dette erstatter dine nuværende data.')) await loadDemo();
  };
  const onClear = async () => {
    if (confirm('Ryd ALLE data og start forfra med en tom cyklus?')) await clearAll();
  };
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Importér data fra fil? Dette erstatter dine nuværende data.')) return;
    try {
      await importFromFile(file);
    } catch (err) {
      alert(`Kunne ikke importere: ${(err as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen lg:flex">
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />

      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-surface px-4 py-6 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
            <Target size={20} />
          </div>
          <div>
            <div className="text-sm font-extrabold leading-none">OKR</div>
            <div className="text-[11px] text-ink-muted">Mål & resultater</div>
          </div>
        </div>

        {/* Søg */}
        <button
          onClick={openCommand}
          className="mb-5 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-muted hover:bg-slate-50"
        >
          <Search size={16} /> Søg…
          <kbd className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
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

        <button onClick={() => openObjectiveEditor({ level: 'company' })} className="btn-primary mt-6 w-full">
          <Plus size={16} /> Nyt Objective
        </button>

        <div className="mt-auto space-y-1 pt-6">
          <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Data</div>
          <button onClick={exportToFile} className="btn-ghost w-full justify-start text-xs">
            <Download size={14} /> Eksportér (JSON)
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost w-full justify-start text-xs">
            <Upload size={14} /> Importér
          </button>
          <button onClick={onDemo} className="btn-ghost w-full justify-start text-xs">
            <Sparkles size={14} /> Indlæs eksempel-data
          </button>
          <button onClick={onClear} className="btn-ghost w-full justify-start text-xs hover:text-health-red">
            <Trash2 size={14} /> Ryd alle data
          </button>
        </div>
      </aside>

      {/* Hovedindhold */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar (mobil) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">
              <Target size={18} />
            </div>
            <span className="font-extrabold">OKR</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openCommand} className="btn-secondary px-2.5 py-2" aria-label="Søg">
              <Search size={16} />
            </button>
            <CycleSelect />
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Bundnavigation (mobil) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-surface/95 backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const active = n.end ? location.pathname === n.to : location.pathname.startsWith(n.to);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={cx(
                'flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold',
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
