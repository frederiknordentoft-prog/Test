import { useState } from 'react';
import { addQuarters, endOfQuarter, formatISO, getQuarter, getYear, startOfQuarter } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import Modal from './Modal';

function nextQuarterDefaults(existingCount: number) {
  const base = addQuarters(new Date(), existingCount === 0 ? 0 : 1);
  return {
    name: `Q${getQuarter(base)} ${getYear(base)}`,
    start: formatISO(startOfQuarter(base), { representation: 'date' }),
    end: formatISO(endOfQuarter(base), { representation: 'date' }),
  };
}

export default function CycleModal() {
  const open = useUi((s) => s.cycleModalOpen);
  const close = useUi((s) => s.closeCycleModal);
  if (!open) return null;
  return <Body onClose={close} />;
}

function Body({ onClose }: { onClose: () => void }) {
  const cycles = useStore((s) => s.cycles);
  const activeCycleId = useStore((s) => s.activeCycleId);
  const addCycle = useStore((s) => s.addCycle);

  const defaults = nextQuarterDefaults(cycles.length);
  const [name, setName] = useState(defaults.name);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [carry, setCarry] = useState(cycles.length > 0);
  const [carryFrom, setCarryFrom] = useState(activeCycleId);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await addCycle(name.trim(), start, end, carry ? carryFrom : undefined);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Ny cyklus"
      subtitle="Opret næste kvartal — og før evt. målene videre"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Annullér</button>
          <button onClick={save} disabled={saving || !name.trim()} className="btn-primary">
            <CalendarPlus size={16} /> Opret cyklus
          </button>
        </>
      }
    >
      <div className="mb-4">
        <label className="label">Navn</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="fx Q3 2026" autoFocus />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label">Start</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Slut</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
        </div>
      </div>

      {cycles.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={carry}
              onChange={(e) => setCarry(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-500"
            />
            <span>
              <span className="text-sm font-semibold">Kopiér mål fra en eksisterende cyklus</span>
              <span className="block text-xs text-ink-muted">
                Objectives og Key Results kopieres med. Fremdrift nulstilles til baseline, og check-in-historik
                følger ikke med — du starter kvartalet på en frisk.
              </span>
            </span>
          </label>
          {carry && (
            <select
              value={carryFrom}
              onChange={(e) => setCarryFrom(e.target.value)}
              className="input mt-3"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </Modal>
  );
}
