import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CornerDownLeft, LayoutDashboard, ListTree, Search, Target, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { LEVEL_LABEL } from '../types/domain';
import { cx, HEALTH_BG } from '../lib/ui';

type Item =
  | { kind: 'nav'; id: string; label: string; sub: string; to: string; icon: JSX.Element }
  | { kind: 'objective'; id: string; label: string; sub: string; to: string }
  | { kind: 'kr'; id: string; label: string; sub: string; to: string; health: string };

export default function CommandPalette() {
  const open = useUi((s) => s.commandOpen);
  const close = useUi((s) => s.closeCommand);
  if (!open) return null;
  return <Palette onClose={close} />;
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const objectives = useStore((s) => s.objectives);
  const keyResults = useStore((s) => s.keyResults);
  const objectivesById = useStore((s) => s.objectivesById);
  const computedByKr = useStore((s) => s.computedByKr);
  const activeCycleId = useStore((s) => s.activeCycleId);

  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const navItems: Item[] = [
    { kind: 'nav', id: 'n-board', label: 'Board', sub: 'Alignment-træ', to: '/', icon: <ListTree size={16} /> },
    { kind: 'nav', id: 'n-dash', label: 'Dashboard', sub: 'Ledelsesoverblik', to: '/dashboard', icon: <LayoutDashboard size={16} /> },
    { kind: 'nav', id: 'n-guide', label: 'Sådan virker det', sub: 'Guide', to: '/guide', icon: <BookOpen size={16} /> },
  ];

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const objItems: Item[] = objectives
      .filter((o) => o.cycleId === activeCycleId)
      .filter((o) => !term || o.title.toLowerCase().includes(term) || o.owner.toLowerCase().includes(term))
      .slice(0, 8)
      .map((o) => ({
        kind: 'objective',
        id: o.id,
        label: o.title,
        sub: `${LEVEL_LABEL[o.level]} · ${o.owner}`,
        to: `/objective/${o.id}`,
      }));

    const krItems: Item[] = keyResults
      .filter((k) => {
        const obj = objectivesById.get(k.objectiveId);
        return obj && obj.cycleId === activeCycleId;
      })
      .filter((k) => !term || k.title.toLowerCase().includes(term) || k.owner.toLowerCase().includes(term))
      .slice(0, 10)
      .map((k) => {
        const obj = objectivesById.get(k.objectiveId);
        const c = computedByKr.get(k.id);
        return {
          kind: 'kr' as const,
          id: k.id,
          label: k.title,
          sub: `${obj?.title ?? ''} · ${k.owner}`,
          to: `/kr/${k.id}`,
          health: c?.health ?? 'none',
        };
      });

    const navFiltered = navItems.filter((n) => !term || n.label.toLowerCase().includes(term));
    return [...navFiltered, ...objItems, ...krItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, objectives, keyResults, objectivesById, computedByKr, activeCycleId]);

  useEffect(() => setActive(0), [q]);

  const go = (item?: Item) => {
    const target = item ?? results[active];
    if (!target) return;
    navigate(target.to);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-modal animate-scale-in">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Søg efter mål, Key Results eller ejere…"
            className="w-full bg-transparent py-4 text-base outline-none placeholder:text-ink-muted"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-ink-muted sm:block">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-ink-muted">Ingen resultater for “{q}”.</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                data-idx={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                  i === active ? 'bg-brand-50' : 'hover:bg-slate-50',
                )}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-100 text-ink-muted">
                  {item.kind === 'nav' ? (
                    item.icon
                  ) : item.kind === 'objective' ? (
                    <Target size={15} />
                  ) : (
                    <TrendingUp size={15} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {item.kind === 'kr' && (
                      <span className={cx('h-2 w-2 shrink-0 rounded-full', HEALTH_BG[item.health as 'green'])} />
                    )}
                    <span className="truncate text-sm font-semibold">{item.label}</span>
                  </span>
                  <span className="block truncate text-xs text-ink-muted">{item.sub}</span>
                </span>
                {i === active && <CornerDownLeft size={14} className="shrink-0 text-brand-500" />}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-ink-muted">
          <span>↑↓ naviger</span>
          <span>↵ åbn</span>
          <span className="ml-auto">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
