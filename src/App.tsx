import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { formatMetric } from './lib/okr';

// Fase 1: rå liste der beviser at data-laget og seed virker.
// Erstattes af fuld routing/UI i senere faser.
export default function App() {
  const { init, loaded, objectives, krsByObjective } = useStore();

  useEffect(() => {
    init();
  }, [init]);

  if (!loaded) return <div className="p-8 text-ink-muted">Indlæser…</div>;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold mb-6">OKR — rå liste (fase 1)</h1>
      <div className="space-y-4">
        {objectives.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="text-xs uppercase text-ink-muted">{o.level}</div>
            <div className="font-semibold">{o.title}</div>
            <ul className="mt-2 space-y-1 text-sm">
              {(krsByObjective.get(o.id) ?? []).map((kr) => (
                <li key={kr.id} className="text-ink-soft">
                  • {kr.title} — {formatMetric(kr.current, kr)} / {formatMetric(kr.target, kr)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
