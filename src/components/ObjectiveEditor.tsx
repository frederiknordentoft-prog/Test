import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { SOFT_LIMITS } from '../lib/okr';
import { LEVEL_LABEL, type Objective } from '../types/domain';
import Modal from './Modal';

export default function ObjectiveEditor() {
  const draft = useUi((s) => s.objectiveEditor);
  const close = useUi((s) => s.closeObjectiveEditor);
  if (!draft) return null;
  return <Body key={draft.id ?? 'new'} onClose={close} />;
}

function Body({ onClose }: { onClose: () => void }) {
  const draft = useUi((s) => s.objectiveEditor)!;
  const isEdit = Boolean(draft.id);
  const objectives = useStore((s) => s.objectives);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const saveObjective = useStore((s) => s.saveObjective);
  const removeObjective = useStore((s) => s.removeObjective);

  const [title, setTitle] = useState(draft.title ?? '');
  const [description, setDescription] = useState(draft.description ?? '');
  const [owner, setOwner] = useState(draft.owner ?? '');
  const level = draft.level;

  // Mulige forældre: objektiver ét niveau over.
  const parentLevel = level === 'company' ? null : level === 'tribe' ? 'company' : 'tribe';
  const parentOptions = objectives.filter(
    (o) => o.cycleId === activeCycleId && o.level === parentLevel,
  );
  const [parentObjectiveId, setParentObjectiveId] = useState(draft.parentObjectiveId ?? '');

  // Blød grænse: tæl søskende på samme niveau under samme forælder.
  const siblings = objectives.filter(
    (o) =>
      o.cycleId === activeCycleId &&
      o.level === level &&
      (o.parentObjectiveId ?? '') === (parentObjectiveId ?? '') &&
      o.id !== draft.id,
  );
  const overLimit = !isEdit && siblings.length + 1 > SOFT_LIMITS.objectivesPerLevel;

  const canSave = title.trim() && owner.trim() && (parentLevel === null || parentObjectiveId);

  const save = async () => {
    const base = {
      title: title.trim(),
      description: description.trim(),
      owner: owner.trim(),
      level,
      parentObjectiveId: parentObjectiveId || undefined,
      cycleId: draft.cycleId ?? activeCycleId,
      status: draft.status ?? 'on_track',
      order: draft.order ?? siblings.length,
    } satisfies Omit<Objective, 'id'>;
    if (isEdit) await saveObjective({ ...base, id: draft.id! });
    else await saveObjective(base);
    onClose();
  };

  const del = async () => {
    if (draft.id && confirm('Slet dette objective og alt under det?')) {
      await removeObjective(draft.id);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Redigér objective' : `Nyt ${LEVEL_LABEL[level].toLowerCase()}-objective`}
      subtitle="Kvalitativt og inspirerende — hvor vil vi hen?"
      footer={
        <>
          {isEdit && (
            <button onClick={del} className="btn-danger mr-auto">
              <Trash2 size={16} /> Slet
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">Annullér</button>
          <button onClick={save} disabled={!canSave} className="btn-primary">Gem</button>
        </>
      }
    >
      {parentLevel && (
        <div className="mb-4">
          <label className="label">Forælder ({LEVEL_LABEL[parentLevel as 'company' | 'tribe'].toLowerCase()})</label>
          <select value={parentObjectiveId} onChange={(e) => setParentObjectiveId(e.target.value)} className="input">
            <option value="">Vælg forælder…</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
        </div>
      )}
      <div className="mb-4">
        <label className="label">Titel</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fx: Spillere bliver hængende fordi spillet er sjovt fra dag 1"
          className="input"
          autoFocus
        />
      </div>
      <div className="mb-4">
        <label className="label">Beskrivelse</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Hvorfor betyder dette mål noget?"
          className="input resize-none"
        />
      </div>
      <div className="mb-2">
        <label className="label">Ejer</label>
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Navn (rolle)" className="input" />
      </div>
      {overLimit && (
        <div className="mt-3 rounded-xl bg-health-yellow/10 px-3.5 py-2.5 text-sm text-[#b76e00]">
          Tip: Dette bliver objektiv nr. {siblings.length + 1} på {LEVEL_LABEL[level].toLowerCase()}-niveau.
          Best practice er maks {SOFT_LIMITS.objectivesPerLevel} — fokus slår bredde.
        </div>
      )}
    </Modal>
  );
}
