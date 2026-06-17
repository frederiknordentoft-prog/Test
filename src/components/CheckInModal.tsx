import { useMemo, useState } from 'react';
import { formatISO } from 'date-fns';
import { Check, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { confidenceHealth, formatMetric, HEALTH_LABEL, rawProgress } from '../lib/okr';
import { cx, HEALTH_BG, HEALTH_SOFT, pct } from '../lib/ui';
import Modal from './Modal';
import KrTypePill from './KrTypePill';

export default function CheckInModal() {
  const krId = useUi((s) => s.checkInKrId);
  const close = useUi((s) => s.closeCheckIn);
  const next = useUi((s) => s.nextCheckIn);
  const queueLen = useUi((s) => s.checkInQueue.length);
  const queuePos = useUi((s) => s.checkInQueuePos);
  const kr = useStore((s) => (krId ? s.krsById.get(krId) : undefined));
  const computed = useStore((s) => (krId ? s.computedByKr.get(krId) : undefined));
  const addCheckIn = useStore((s) => s.addCheckIn);

  if (!kr || !computed) return null;
  const isQueue = queueLen > 1;
  return (
    <CheckInForm
      key={kr.id}
      krId={kr.id}
      onClose={close}
      onNext={next}
      addCheckIn={addCheckIn}
      isQueue={isQueue}
      queuePos={queuePos}
      queueLen={queueLen}
    />
  );
}

function CheckInForm({
  krId,
  onClose,
  onNext,
  addCheckIn,
  isQueue,
  queuePos,
  queueLen,
}: {
  krId: string;
  onClose: () => void;
  onNext: () => void;
  addCheckIn: ReturnType<typeof useStore.getState>['addCheckIn'];
  isQueue: boolean;
  queuePos: number;
  queueLen: number;
}) {
  const kr = useStore((s) => s.krsById.get(krId))!;
  const computed = useStore((s) => s.computedByKr.get(krId))!;

  const [value, setValue] = useState<number>(kr.current);
  const [confidence, setConfidence] = useState<number>(computed.confidence ?? 0.6);
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState(kr.owner);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const health = confidenceHealth(confidence, kr.type);
  const newProgress = useMemo(() => rawProgress({ ...kr, current: value }), [kr, value]);
  const delta = value - kr.current;

  const isLast = queuePos >= queueLen - 1;

  const submit = async () => {
    setSaving(true);
    await addCheckIn({
      keyResultId: krId,
      date: formatISO(new Date(), { representation: 'date' }),
      value,
      confidence: Math.round(confidence * 100) / 100,
      comment: comment.trim(),
      author: author.trim() || kr.owner,
    });
    setSaved(true);
    setTimeout(() => (isQueue && !isLast ? onNext() : onClose()), 600);
  };

  const skip = () => (isQueue && !isLast ? onNext() : onClose());

  return (
    <Modal
      open
      onClose={onClose}
      title={isQueue ? `Ugens check-in · ${queuePos + 1} af ${queueLen}` : 'Ugentligt check-in'}
      subtitle={kr.title}
      footer={
        <>
          {isQueue ? (
            <button onClick={skip} className="btn-ghost mr-auto">
              Spring over
            </button>
          ) : (
            <button onClick={onClose} className="btn-secondary">
              Annullér
            </button>
          )}
          <button onClick={submit} disabled={saving} className={cx('btn-primary', saved && 'bg-health-green')}>
            {saved ? (
              <>
                <Check size={16} /> Gemt
              </>
            ) : isQueue && !isLast ? (
              <>
                <TrendingUp size={16} /> Gem & næste
              </>
            ) : (
              <>
                <TrendingUp size={16} /> Gem check-in
              </>
            )}
          </button>
        </>
      }
    >
      {isQueue && (
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${(queuePos / queueLen) * 100}%` }}
          />
        </div>
      )}
      <div className="mb-4 flex items-center gap-2">
        <KrTypePill type={kr.type} />
        <span className="text-xs text-ink-muted">Ejer: {kr.owner}</span>
      </div>

      {/* Værdi */}
      <div className="mb-5">
        <label className="label">Ny værdi {kr.unit && <span className="normal-case text-ink-muted">({kr.unit})</span>}</label>
        {kr.metricType === 'boolean' ? (
          <div className="flex gap-2">
            {[
              { v: 1, label: 'Ja' },
              { v: 0, label: 'Nej' },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setValue(opt.v)}
                className={cx(
                  'btn flex-1 py-3',
                  value === opt.v ? 'btn-primary' : 'btn-secondary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="number"
            value={Number.isNaN(value) ? '' : value}
            step="any"
            onChange={(e) => setValue(parseFloat(e.target.value))}
            className="input text-lg font-semibold"
            autoFocus
          />
        )}
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-ink-muted">
            Var {formatMetric(kr.current, kr)} · mål {formatMetric(kr.target, kr)}
          </span>
          <span className="flex items-center gap-2">
            {delta !== 0 && (
              <span className={cx('font-semibold', delta > 0 ? 'text-health-green' : 'text-health-red')}>
                {delta > 0 ? '▲' : '▼'} {formatMetric(Math.abs(delta), kr)}
              </span>
            )}
            <span className="font-semibold text-ink-soft">{pct(newProgress)} af mål</span>
          </span>
        </div>
      </div>

      {/* Confidence */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label mb-0">Confidence</span>
          <span className={cx('chip', HEALTH_SOFT[health])}>
            {confidence.toFixed(2)} · {HEALTH_LABEL[health]}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={confidence}
          onChange={(e) => setConfidence(parseFloat(e.target.value))}
          className="confidence-range w-full"
          style={{
            accentColor:
              health === 'green' ? '#30a46c' : health === 'yellow' ? '#f5a623' : '#e5484d',
          }}
        />
        <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
          <span>0.0 — usikker</span>
          <span>0.5</span>
          <span>1.0 — sikker</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={cx('h-full rounded-full transition-all', HEALTH_BG[health])} style={{ width: `${confidence * 100}%` }} />
        </div>
        {kr.type === 'aspirational' && (
          <p className="mt-1.5 text-[11px] text-ink-muted">
            Strækmål: 0.7 er allerede et rigtig godt resultat.
          </p>
        )}
      </div>

      {/* Kommentar */}
      <div className="mb-4">
        <label className="label">Kommentar <span className="normal-case text-ink-muted">(valgfri)</span></label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Hvad skete der i denne uge? Hvad er næste skridt?"
          className="input resize-none"
        />
      </div>

      <div>
        <label className="label">Indrapporteret af</label>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className="input" />
      </div>
    </Modal>
  );
}
