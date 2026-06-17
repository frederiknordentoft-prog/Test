import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { INITIATIVE_STATUS_LABEL, type Initiative, type InitiativeStatus } from '../types/domain';
import { cx, INITIATIVE_STYLE } from '../lib/ui';
import Modal from './Modal';

const STATUSES: InitiativeStatus[] = ['ikke_startet', 'i_gang', 'færdig', 'blokeret'];

export default function InitiativeEditor() {
  const draft = useUi((s) => s.initiativeEditor);
  const close = useUi((s) => s.closeInitiativeEditor);
  if (!draft) return null;
  return <Body key={draft.id ?? 'new'} onClose={close} />;
}

function Body({ onClose }: { onClose: () => void }) {
  const draft = useUi((s) => s.initiativeEditor)!;
  const isEdit = Boolean(draft.id);
  const list = useStore((s) => s.initiativesByKr.get(draft.keyResultId) ?? []);
  const saveInitiative = useStore((s) => s.saveInitiative);
  const removeInitiative = useStore((s) => s.removeInitiative);

  const [title, setTitle] = useState(draft.title ?? '');
  const [owner, setOwner] = useState(draft.owner ?? '');
  const [status, setStatus] = useState<InitiativeStatus>(draft.status ?? 'ikke_startet');
  const [dueDate, setDueDate] = useState(draft.dueDate ?? '');

  const canSave = title.trim() && owner.trim();

  const save = async () => {
    const base = {
      keyResultId: draft.keyResultId,
      title: title.trim(),
      owner: owner.trim(),
      status,
      dueDate: dueDate || undefined,
      order: draft.order ?? list.length,
    } satisfies Omit<Initiative, 'id'>;
    if (isEdit) await saveInitiative({ ...base, id: draft.id! });
    else await saveInitiative(base);
    onClose();
  };

  const del = async () => {
    if (draft.id && confirm('Slet dette initiativ?')) {
      await removeInitiative(draft.id);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Redigér initiativ' : 'Nyt initiativ'}
      subtitle="Det konkrete arbejde der driver KR'et"
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
      <div className="mb-4">
        <label className="label">Titel</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fx: Redesign af tutorial-trin 1-3" className="input" autoFocus />
      </div>
      <div className="mb-4">
        <label className="label">Status</label>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition',
                status === s ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white',
              )}
            >
              <span className={cx('h-2.5 w-2.5 rounded-full', INITIATIVE_STYLE[s].dot)} />
              {INITIATIVE_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Ejer</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Navn" className="input" />
        </div>
        <div>
          <label className="label">Deadline</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
        </div>
      </div>
    </Modal>
  );
}
