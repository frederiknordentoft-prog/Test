import { useMemo, useState } from 'react';
import { ArrowUp, GitMerge, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { LEVEL_LABEL } from '../types/domain';
import { cx, LEVEL_SOFT, pct } from '../lib/ui';
import Modal from './Modal';

export default function AlignModal() {
  const krId = useUi((s) => s.alignKrId);
  const close = useUi((s) => s.closeAlign);
  const kr = useStore((s) => (krId ? s.krsById.get(krId) : undefined));
  if (!kr || !krId) return null;
  return <AlignBody krId={krId} onClose={close} />;
}

function AlignBody({ krId, onClose }: { krId: string; onClose: () => void }) {
  const kr = useStore((s) => s.krsById.get(krId))!;
  const objective = useStore((s) => s.objectivesById.get(kr.objectiveId));
  const krsById = useStore((s) => s.krsById);
  const keyResults = useStore((s) => s.keyResults);
  const objectivesById = useStore((s) => s.objectivesById);
  const computedByKr = useStore((s) => s.computedByKr);
  const linksByChild = useStore((s) => s.linksByChild.get(krId) ?? []);
  const addLink = useStore((s) => s.addLink);
  const removeLink = useStore((s) => s.removeLink);

  const [selected, setSelected] = useState('');
  const [weight, setWeight] = useState(1);

  const existingParentIds = new Set(linksByChild.map((l) => l.parentKrId));

  // Kandidater: alle andre KR'er der ikke allerede er koblet og ikke er KR'et selv.
  const candidates = useMemo(() => {
    return keyResults
      .filter((k) => k.id !== krId && !existingParentIds.has(k.id))
      .map((k) => ({ kr: k, obj: objectivesById.get(k.objectiveId) }))
      .filter((c) => c.obj)
      .sort((a, b) => (a.obj!.level + a.obj!.title).localeCompare(b.obj!.level + b.obj!.title));
  }, [keyResults, krId, existingParentIds, objectivesById]);

  const add = async () => {
    if (!selected) return;
    await addLink(krId, selected, weight);
    setSelected('');
    setWeight(1);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Alignment-kobling"
      subtitle="Vælg hvilke overordnede Key Results dette KR bidrager til"
      size="lg"
    >
      <div className="mb-4 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-sm">
          {objective && <span className={cx('chip', LEVEL_SOFT[objective.level])}>{LEVEL_LABEL[objective.level]}</span>}
          <span className="font-semibold">{kr.title}</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Mange-til-mange: ét KR kan bidrage til flere parents, og fremdrift ruller automatisk op (vægtet).
        </p>
      </div>

      {/* Eksisterende koblinger */}
      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Bidrager til ({linksByChild.length})
        </div>
        {linksByChild.length === 0 ? (
          <p className="text-sm text-ink-muted">Ingen koblinger endnu.</p>
        ) : (
          <ul className="space-y-2">
            {linksByChild.map((l) => {
              const parent = krsById.get(l.parentKrId);
              if (!parent) return null;
              const obj = objectivesById.get(parent.objectiveId);
              const c = computedByKr.get(parent.id);
              return (
                <li key={l.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5">
                  <ArrowUp size={16} className="shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{parent.title}</div>
                    <div className="truncate text-xs text-ink-muted">
                      {obj && LEVEL_LABEL[obj.level]} · {obj?.title} · vægt {l.weight}
                    </div>
                  </div>
                  {c && (
                    <span className="shrink-0 text-xs font-semibold text-ink-soft">
                      {pct(c.hasContributors ? c.rolledUpProgress : c.progress)}
                    </span>
                  )}
                  <button onClick={() => removeLink(l.id)} className="btn-ghost shrink-0 p-1.5" aria-label="Fjern">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tilføj kobling */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <GitMerge size={16} className="text-brand-600" /> Ny kobling
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input flex-1">
            <option value="">Vælg overordnet Key Result…</option>
            {candidates.map(({ kr: c, obj }) => (
              <option key={c.id} value={c.id}>
                [{LEVEL_LABEL[obj!.level]}] {obj!.title} → {c.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <div className="w-24">
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 1)}
                className="input"
                title="Vægt i rollup"
              />
            </div>
            <button onClick={add} disabled={!selected} className="btn-primary shrink-0">
              <Plus size={16} /> Tilføj
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">Vægten styrer hvor meget dette KR tæller i parentens auto-rollup.</p>
      </div>
    </Modal>
  );
}
