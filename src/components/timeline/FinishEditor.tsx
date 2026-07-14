import { useMemo, useState } from 'react';
import { fromDatetimeLocal, toDatetimeLocal } from '../../lib/format';

export function FinishEditor({
  finishAt,
  onSave,
  onClose,
}: {
  finishAt: number;
  onSave: (finishAt: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => toDatetimeLocal(finishAt));
  const nowFloor = useMemo(() => toDatetimeLocal(Date.now()), []);

  const save = () => {
    const t = fromDatetimeLocal(value);
    if (Number.isFinite(t)) onSave(t);
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Skift tidspunkt" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Skift færdig-tidspunkt</h2>
        <p className="sheet-lead">Hele planen genberegnes ud fra det nye tidspunkt.</p>
        <input
          className="time-input"
          type="datetime-local"
          value={value}
          min={nowFloor}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="sheet-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Annullér
          </button>
          <button type="button" className="primary-btn" onClick={save}>
            Genberegn plan
          </button>
        </div>
      </div>
    </div>
  );
}
