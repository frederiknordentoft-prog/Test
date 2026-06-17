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
  TrendingUp,
  Upload,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { useOrgPulse, useStaleKrIds } from '../lib/selectors';
import { HEALTH_LABEL } from '../lib/okr';
import { cx, HEALTH_BG } from '../lib/ui';
import HealthRing from './HealthRing';

const NAV = [
  { to: '/', label: 'Board', icon: ListTree, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: false },
  { to: '/guide', label: 'Guide', icon: BookOpen, end: false },
];

function CycleSelect({ compact }: { compact?: boolean }) {
  const cycles = useStore((s) => s.cycles);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const setActiveCycle = useStore((s) => s.setActiveCycle);
  const openCycleModal = useUi((s) => s.openCycleModal);
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={activeCycleId}
        onChange={(e) => setActiveCycle(e.target.value)}
        className={cx('input cursor-pointer font-semibold', compact ? 'w-auto py-1.5 text-xs' : 'py-2 text-sm')}
        aria-label="Vælg cyklus"
      >
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.isActive ? ' (aktiv)' : ''}
          </option>
        ))}
      </select>
      {!compact && (
        <button onClick={openCycleModal} className="btn-secondary shrink-0 px-2.5 py-2" title="Ny cyklus" aria-label="Ny cyklus">
          <CalendarPlus size={16} />
        </button>
      )}
    </div>
  );
}

function OrgPulseCard() {
  const pulse = useOrgPulse();
  const staleKrIds = useStaleKrIds();
  const startQueue = useUi((s) => s.startCheckInQueue);

  if (pulse.total === 0) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-center">
        <p className="text-sm font-semibold text-white">Ingen mål endnu</p>
        <p className="mt-0.5 text-xs text-white/60">Pulsen vises, når du har Key Results.</p>
      </div>
    );
  }

  const legend = (['green', 'yellow', 'red', 'none'] as const).filter((k) => pulse[k] > 0);

  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-card backdrop-blur-sm">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">Organisationens puls</div>
      <div className="flex items-center gap-3">
        <HealthRing pulse={pulse} size={92} thickness={10} />
        <div className="min-w-0 flex-1 space-y-1">
          {legend.map((k) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className={cx('h-2 w-2 rounded-full ring-1 ring-white/20', HEALTH_BG[k])} />
              <span className="text-white/85">{HEALTH_LABEL[k]}</span>
              <span className="ml-auto font-bold tabular-nums text-white">{pulse[k]}</span>
            </div>
          ))}
        </div>
      </div>
      {staleKrIds.length > 0 && (
        <button onClick={() => startQueue(staleKrIds)} className="btn-accent mt-3 w-full py-2 text-xs">
          <TrendingUp size={14} /> Ugens check-in · {staleKrIds.length}
        </button>
      )}
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
  const startQueue = useUi((s) => s.startCheckInQueue);
  const staleKrIds = useStaleKrIds();
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

      {/* ===== Sidebar (desktop) ===== */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-5 overflow-y-auto bg-gradient-to-b from-brand-700 to-brand-900 px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-1">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent-400 text-brand-800 shadow-sm">
            <Target size={21} />
          </div>
          <div>
            <div className="text-base font-extrabold leading-none tracking-tight">OKR</div>
            <div className="mt-0.5 text-[11px] text-white/60">Mål, der flytter noget</div>
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
                  'nav-pill',
                  isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>

        <OrgPulseCard />

        <div className="space-y-2">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">Cyklus</div>
          <CycleSelect />
        </div>

        <button onClick={() => openObjectiveEditor({ level: 'company' })} className="btn-accent w-full">
          <Plus size={16} /> Nyt Objective
        </button>

        <div className="mt-auto rounded-2xl border border-white/15 bg-white/10 p-2">
          <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">Data</div>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={exportToFile} className="btn justify-start px-2 py-1.5 text-xs text-white/80 hover:bg-white/10">
              <Download size={14} /> Eksport
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn justify-start px-2 py-1.5 text-xs text-white/80 hover:bg-white/10">
              <Upload size={14} /> Import
            </button>
            <button onClick={onDemo} className="btn justify-start px-2 py-1.5 text-xs text-white/80 hover:bg-white/10">
              <Sparkles size={14} /> Eksempel
            </button>
            <button onClick={onClear} className="btn justify-start px-2 py-1.5 text-xs text-white/80 hover:bg-health-red/30">
              <Trash2 size={14} /> Ryd
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Content column ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop command bar */}
        <header className="sticky top-0 z-30 hidden items-center gap-3 border-b border-slate-200 glass px-6 py-3 lg:flex">
          <button
            onClick={openCommand}
            className="flex max-w-md flex-1 items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-ink-muted transition hover:border-brand-300 hover:shadow-sm"
          >
            <Search size={16} /> Søg efter mål, Key Results eller ejere…
            <kbd className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {staleKrIds.length > 0 && (
              <button onClick={() => startQueue(staleKrIds)} className="btn-accent px-3 py-2 text-sm">
                <TrendingUp size={15} /> Ugens check-in · {staleKrIds.length}
              </button>
            )}
            <button onClick={() => openObjectiveEditor({ level: 'company' })} className="btn-primary px-3 py-2 text-sm">
              <Plus size={16} /> Nyt Objective
            </button>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200 glass px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
              <Target size={18} />
            </div>
            <span className="font-extrabold tracking-tight">OKR</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openCommand} className="btn-secondary px-2.5 py-2" aria-label="Søg">
              <Search size={16} />
            </button>
            <CycleSelect compact />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <div key={location.pathname} className="mx-auto w-full max-w-5xl animate-rise">
            {children}
          </div>
        </main>
      </div>

      {/* ===== Mobile bottom bar + FAB ===== */}
      <button
        onClick={() => (staleKrIds.length > 0 ? startQueue(staleKrIds) : openObjectiveEditor({ level: 'company' }))}
        className="fixed bottom-[68px] right-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-cardhover animate-pop active:scale-95 lg:hidden"
        aria-label={staleKrIds.length > 0 ? 'Ugens check-in' : 'Nyt Objective'}
      >
        {staleKrIds.length > 0 ? <TrendingUp size={24} /> : <Plus size={24} />}
        {staleKrIds.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent-400 px-1 text-[11px] font-bold text-ink">
            {staleKrIds.length}
          </span>
        )}
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 glass lg:hidden">
        {NAV.map((n) => {
          const active = n.end ? location.pathname === n.to : location.pathname.startsWith(n.to);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={cx(
                'flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
                active ? 'text-brand-600' : 'text-ink-muted',
              )}
            >
              <span className={cx('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-brand-50')}>
                <n.icon size={19} />
              </span>
              {n.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
