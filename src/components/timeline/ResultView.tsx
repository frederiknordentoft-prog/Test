import { useMemo, useState } from 'react';
import { computeScheduleSafe, type Milestone, type MilestoneId, type PlanInput } from '../../lib/schedule';
import { renderPlanText } from '../../lib/planText';
import { copyText, sharePlan } from '../../lib/share';
import { addToCalendar } from '../../lib/ics';
import { NextStepHero } from './NextStepHero';
import { RecipeCard } from './RecipeCard';
import { MilestoneRow } from './MilestoneRow';
import { FinishEditor } from './FinishEditor';
import { PrintSheet } from '../print/PrintSheet';

export function ResultView({
  input,
  doneIds,
  createdAt,
  onSetFinish,
  onDelay,
  onToggleDone,
  onReset,
  onEdit,
  showToast,
}: {
  input: PlanInput;
  doneIds: MilestoneId[];
  createdAt: number;
  onSetFinish: (finishAt: number) => void;
  onDelay: (id: MilestoneId, minutes: number) => void;
  onToggleDone: (id: MilestoneId) => void;
  onReset: () => void;
  onEdit: () => void;
  showToast: (msg: string) => void;
}) {
  const { milestones, adjustment } = useMemo(() => computeScheduleSafe(input), [input]);
  const doneSet = useMemo(() => new Set(doneIds), [doneIds]);
  const [editing, setEditing] = useState(false);

  const nextId = milestones.find((m) => !doneSet.has(m.id))?.id ?? null;
  const next = milestones.find((m) => m.id === nextId) ?? null;
  const doneCount = milestones.reduce((n, m) => (doneSet.has(m.id) ? n + 1 : n), 0);

  const startPassed = milestones.length > 0 && milestones[0].at < Date.now();
  const showPastWarning = startPassed && doneCount === 0;

  const handleCopy = async () => {
    const ok = await copyText(renderPlanText(milestones, input, adjustment));
    showToast(ok ? 'Planen er kopieret' : 'Kunne ikke kopiere planen');
  };

  const handleShare = async () => {
    const res = await sharePlan('Min bageplan for surdejsbrød', renderPlanText(milestones, input, adjustment));
    if (res === 'copied') showToast('Planen er kopieret');
    else if (res === 'unavailable') showToast('Deling er ikke tilgængelig her');
  };

  const handleCalendar = async (m: Milestone) => {
    try {
      await addToCalendar(m, createdAt || Date.now());
    } catch {
      showToast('Kunne ikke åbne kalenderen');
    }
  };

  return (
    <>
      <div className="result">
        <NextStepHero milestone={next} doneCount={doneCount} total={milestones.length} />

        <div className="action-bar">
          <button type="button" className="action" onClick={handleShare}>
            <span aria-hidden="true">📤</span> Del
          </button>
          <button type="button" className="action" onClick={handleCopy}>
            <span aria-hidden="true">📋</span> Kopiér
          </button>
          <button type="button" className="action" onClick={() => setEditing(true)}>
            <span aria-hidden="true">🕑</span> Skift tid
          </button>
        </div>

        <button type="button" className="pdf-btn" onClick={() => window.print()}>
          <span aria-hidden="true">🖨️</span> Gem hele planen som PDF
        </button>
        <p className="pdf-hint">Åbner udskriv-vinduet — vælg “Gem som PDF”, så kan du følge planen uden appen.</p>

        {adjustment.note && (
          <p className={`banner ${adjustment.status === 'nightUnavoidable' ? 'banner-warn' : 'banner-night'}`}>
            {adjustment.status === 'nightUnavoidable' ? '⚠️' : '🌙'} {adjustment.note}
          </p>
        )}

        {showPastWarning && (
          <p className="banner banner-warn">
            ⚠️ Starttidspunktet er allerede passeret. Vælg et senere færdig-tidspunkt med “Skift tid”.
          </p>
        )}

        <p className="banner banner-info">
          Hævetider er vejledende — gå efter dejen, ikke kun uret. Er dejen eller surdejen ikke klar,
          så tryk “ikke klar endnu”, så rykker resten af planen automatisk.
        </p>

        <RecipeCard size={input.size} />

        <ol className="timeline">
          {milestones.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              done={doneSet.has(m.id)}
              isNext={m.id === nextId}
              onToggleDone={() => onToggleDone(m.id)}
              onDelay={(min) => onDelay(m.id, min)}
              onAddCalendar={() => handleCalendar(m)}
            />
          ))}
        </ol>

        <div className="result-footer">
          <button type="button" className="ghost-btn" onClick={onEdit}>
            Redigér valg
          </button>
          <button type="button" className="ghost-btn danger" onClick={onReset}>
            Ny plan
          </button>
        </div>

        {editing && (
          <FinishEditor
            finishAt={input.finishAt}
            onSave={(t) => {
              onSetFinish(t);
              setEditing(false);
            }}
            onClose={() => setEditing(false)}
          />
        )}
      </div>

      <PrintSheet milestones={milestones} input={input} adjustment={adjustment} />
    </>
  );
}
