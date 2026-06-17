import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store/useStore';
import Layout from './components/Layout';
import TreeView from './pages/TreeView';
import ObjectiveDetail from './pages/ObjectiveDetail';
import KrDetail from './pages/KrDetail';
import Dashboard from './pages/Dashboard';
import ModalHost from './components/ModalHost';

export default function App() {
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);

  useEffect(() => {
    init();
  }, [init]);

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
        <Route path="/objective/:id" element={<ObjectiveDetail />} />
        <Route path="/kr/:id" element={<KrDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ModalHost />
    </Layout>
  );
}
