import { useState } from 'react';
import { Board } from './components/Board';
import { Toolbar } from './components/Toolbar';
import { WinOverlay } from './components/WinOverlay';
import { ControlPanel } from './components/ControlPanel';
import { Dashboard } from './components/Dashboard';

type Tab = 'dashboard' | 'control';

export default function App() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-bold text-brand-gold">Kabale Combo</h1>
          <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-white/60">
            Prototype med spillepenge — ikke et rigtigt pengespil
          </span>
        </div>
        <button
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20"
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? 'Skjul panel ›' : '‹ Vis panel'}
        </button>
      </header>

      <div className="flex flex-1 gap-4 px-5 pb-5">
        {/* Main play area */}
        <main className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="rounded-xl bg-black/15 p-4 ring-1 ring-white/5">
            <Toolbar />
          </div>
          <div className="flex-1 overflow-auto rounded-xl bg-felt/40 p-5 ring-1 ring-white/5">
            <Board />
          </div>
        </main>

        {/* Side panel */}
        {panelOpen && (
          <aside className="thin-scroll w-[360px] shrink-0 overflow-y-auto rounded-xl bg-black/25 p-4 ring-1 ring-white/5">
            <div className="mb-3 flex gap-2">
              {(['dashboard', 'control'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    tab === t ? 'bg-brand-gold text-brand-green-dark' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {t === 'dashboard' ? 'Dashboard' : 'Kontrolpanel'}
                </button>
              ))}
            </div>
            {tab === 'dashboard' ? <Dashboard /> : <ControlPanel />}
          </aside>
        )}
      </div>

      <WinOverlay />
    </div>
  );
}
