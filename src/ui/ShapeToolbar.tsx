// Shape tools: freehand + primitives + probe + clear + compare.

import { makePrimitive } from '../engine/shape/primitives';
import { useStore, type Tool } from '../state/store';
import { da } from '../i18n/da';

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'freehand', label: da.toolDraw, icon: '✏️' },
  { id: 'circle', label: da.toolCircle, icon: '●' },
  { id: 'square', label: da.toolSquare, icon: '■' },
  { id: 'plate', label: da.toolPlate, icon: '▮' },
  { id: 'teardrop', label: da.toolTeardrop, icon: '💧' },
  { id: 'probe', label: da.toolProbe, icon: '🎯' },
];

export function ShapeToolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const committedShape = useStore((s) => s.committedShape);
  const compareMode = useStore((s) => s.compareMode);
  const set = useStore((s) => s.set);
  const showBubble = useStore((s) => s.showBubble);

  const pick = (id: Tool) => {
    if (id === 'freehand' || id === 'probe') {
      set({ activeTool: id });
      return;
    }
    set({ activeTool: id, committedShape: makePrimitive(id), probe: null });
    showBubble('firstShape');
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Formværktøjer">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={activeTool === t.id ? 'tool active' : 'tool'}
          onClick={() => pick(t.id)}
          aria-pressed={activeTool === t.id}
        >
          <span aria-hidden>{t.icon}</span> {t.label}
        </button>
      ))}
      {committedShape && (
        <button className="tool" onClick={() => set({ committedShape: null, probe: null })}>
          🗑 {da.clearShape}
        </button>
      )}
      <button className={compareMode ? 'tool active' : 'tool'} onClick={() => set({ compareMode: !compareMode })}>
        ⇄ {compareMode ? da.compareClose : da.compare}
      </button>
    </div>
  );
}
