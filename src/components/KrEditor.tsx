import { useState } from 'react';
import { Lightbulb, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { looksLikeInitiative, SOFT_LIMITS } from '../lib/okr';
import type { KeyResult, MetricType } from '../types/domain';
import Modal from './Modal';
import KrTypePill from './KrTypePill';
import { cx } from '../lib/ui';

const METRIC_OPTIONS: { value: MetricType; label: string; unit: string }[] = [
  { value: 'number', label: 'Tal', unit: '' },
  { value: 'percent', label: 'Procent', unit: '%' },
  { value: 'currency', label: 'Beløb', unit: 'kr.' },
  { value: 'boolean', label: 'Ja/Nej', unit: '' },
];

export default function KrEditor() {
  const draft = useUi((s) => s.krEditor);
  const close = useUi((s) => s.closeKrEditor);
  if (!draft) return null;
  return <Body key={draft.id ?? 'new'} onClose={close} />;
}

function Body({ onClose }: { onClose: () => void }) {
  const draft = useUi((s) => s.krEditor)!;
  const isEdit = Boolean(draft.id);
  const krsInObjective = useStore((s) => s.krsByObjective.get(draft.objectiveId) ?? []);
  const saveKeyResult = useStore((s) => s.saveKeyResult);
  const removeKeyResult = useStore((s) => s.removeKeyResult);

  const [title, setTitle] = useState(draft.title ?? '');
  const [owner, setOwner] = useState(draft.owner ?? '');
  const [metricType, setMetricType] = useState<MetricType>(draft.metricType ?? 'number');
  const [baseline, setBaseline] = useState<number>(draft.baseline ?? 0);
  const [target, setTarget] = useState<number>(draft.target ?? 100);
  const [current, setCurrent] = useState<number>(draft.current ?? draft.baseline ?? 0);
  const [unit, setUnit] = useState(draft.unit ?? '');
  const [type, setType] = useState<KeyResult['type']>(draft.type ?? 'committed');

  const nudge = title.trim().length > 3 && looksLikeInitiative(title);
  const overLimit = !isEdit && krsInObjective.length + 1 > SOFT_LIMITS.krsPerObjective;
  const canSave = title.trim() && owner.trim();

  const save = async () => {
    const base = {
      objectiveId: draft.objectiveId,
      title: title.trim(),
      owner: owner.trim(),
      metricType,
      baseline: Number(baseline) || 0,
      target: Number(target) || 0,
      current: Number(current) || 0,
      unit: unit.trim(),
      type,
      order: draft.order ?? krsInObjective.length,
    } satisfies Omit<KeyResult, 'id'>;
    if (isEdit) await saveKeyResult({ ...base, id: draft.id! });
    else await saveKeyResult(base);
    onClose();
  };

  const del = async () => {
    if (draft.id && confirm('Slet dette Key Result med initiativer, check-ins og koblinger?')) {
      await removeKeyResult(draft.id);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Redigér Key Result' : 'Nyt Key Result'}
      subtitle="Et målbart udfald — ikke en opgave"
      size="lg"
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
      <div className="mb-1">
        <label className="label">Titel (udfald)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fx: D1 retention fra 42% til 55%"
          className={cx('input', nudge && 'border-health-yellow focus:border-health-yellow focus:ring-amber-100')}
          autoFocus
        />
      </div>
      {nudge && (
        <div className="mb-4 mt-2 flex gap-2 rounded-xl bg-health-yellow/10 px-3.5 py-2.5 text-sm text-[#b76e00]">
          <Lightbulb size={16} className="mt-0.5 shrink-0" />
          <span>
            Dette lyder som et <strong>initiativ</strong> (en opgave), ikke et udfald. Et KR måler et
            <em> resultat</em> — fx "D1 retention til 55%" frem for "Byg nyt onboarding-flow". Opret arbejdet som et initiativ under KR'et i stedet.
          </span>
        </div>
      )}

      <div className="mb-4 mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label">Ejer</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Navn" className="input" />
        </div>
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2">
            {(['committed', 'aspirational'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cx('flex-1 rounded-xl border px-2 py-2 text-sm font-semibold transition', type === t ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white text-ink-muted')}
              >
                <KrTypePill type={t} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label">Metriktype</label>
          <select
            value={metricType}
            onChange={(e) => {
              const m = e.target.value as MetricType;
              setMetricType(m);
              const def = METRIC_OPTIONS.find((o) => o.value === m)?.unit ?? '';
              if (!unit) setUnit(def);
            }}
            className="input"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Enhed</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="fx %, kr., min" className="input" disabled={metricType === 'boolean'} />
        </div>
      </div>

      {metricType !== 'boolean' ? (
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Baseline" value={baseline} onChange={setBaseline} />
          <NumField label="Nu" value={current} onChange={setCurrent} />
          <NumField label="Mål" value={target} onChange={setTarget} />
        </div>
      ) : (
        <div>
          <label className="label">Nuværende</label>
          <div className="flex gap-2">
            {[{ v: 0, l: 'Nej' }, { v: 1, l: 'Ja' }].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => {
                  setCurrent(o.v);
                  setBaseline(0);
                  setTarget(1);
                }}
                className={cx('btn flex-1', current === o.v ? 'btn-primary' : 'btn-secondary')}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      )}

      {overLimit && (
        <div className="mt-4 rounded-xl bg-health-yellow/10 px-3.5 py-2.5 text-sm text-[#b76e00]">
          Tip: Dette bliver KR nr. {krsInObjective.length + 1}. Best practice er 2–{SOFT_LIMITS.krsPerObjective} pr. objective.
        </div>
      )}
    </Modal>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        step="any"
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="input"
      />
    </div>
  );
}
