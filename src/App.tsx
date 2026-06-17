import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { useUi } from './store/useUi';
import Layout from './components/Layout';
import TreeView from './pages/TreeView';
import ObjectiveDetail from './pages/ObjectiveDetail';
import KrDetail from './pages/KrDetail';
import Dashboard from './pages/Dashboard';
import Guide from './pages/Guide';
import ModalHost from './components/ModalHost';

const ONBOARD_KEY = 'okr-onboarded-v1';

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const navigate = useNavigate();
  const toggleCommand = useUi((s) => s.toggleCommand);
  const didInit = useRef(false);

  // Global ⌘K / Ctrl+K → kommandopalette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommand();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCommand]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      await init();
      // Førstegangsbesøg uden data → start på guiden (kun én gang).
      const onboarded = localStorage.getItem(ONBOARD_KEY);
      if (!onboarded) {
        localStorage.setItem(ONBOARD_KEY, '1');
        if (useStore.getState().isEmpty() && window.location.pathname.endsWith('/')) {
          navigate('/guide', { replace: true });
        }
      }
    })();
  }, [init, navigate]);

  if (!loaded) {
    return (
      <div className="grid min-h-screen place-items-center text-ink-muted">
        <div className="animate-fade-in text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
          Indlæser OKR-systemet…
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<TreeView />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/objective/:id" element={<ObjectiveDetail />} />
        <Route path="/kr/:id" element={<KrDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ModalHost />
    </Layout>
  );
}
