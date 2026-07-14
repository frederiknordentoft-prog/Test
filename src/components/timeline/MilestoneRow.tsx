import { useState } from 'react';
import type { Milestone } from '../../lib/schedule';
import { formatDayTime } from '../../lib/format';

const DELAY_OPTIONS: Array<[number, string]> = [
  [30, '+30 min'],
  [60, '+1 time'],
  [120, '+2 timer'],
];

export function MilestoneRow({
  milestone,
  done,
  isNext,
  onToggleDone,
  onDelay,
  onAddCalendar,
}: {
  milestone: Milestone;
  done: boolean;
  isNext: boolean;
  onToggleDone: () => void;
  onDelay: (minutes: number) => void;
  onAddCalendar: () => void;
}) {
  const [showDelay, setShowDelay] = useState(false);
  const notReadyLabel =
    milestone.id === 'mix' ? 'Surdejen er ikke klar endnu' : 'Dejen er ikke klar endnu';
  const canDelay = milestone.canDelay && !done;

  return (
    <li className="row" data-done={done} data-next={isNext}>
      <div className="row-rail" aria-hidden="true">
        <span className="row-dot">{done ? '✓' : milestone.icon}</span>
      </div>

      <div className="row-card">
        <div className="row-head">
          <span className="row-when">{formatDayTime(milestone.at)}</span>
          <button
            type="button"
            className="check"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? `Fjern markering af ${milestone.title}` : `Markér ${milestone.title} som færdig`}
            onClick={onToggleDone}
          >
            <span aria-hidden="true">{done ? '✓' : ''}</span>
          </button>
        </div>

        <h3 className="row-title">{milestone.title}</h3>
        <p className="row-desc">{milestone.description}</p>
        {milestone.note && <p className="row-note">💡 {milestone.note}</p>}

        <div className="row-actions">
          <button type="button" className="mini-btn" onClick={onAddCalendar}>
            📅 Til kalender
          </button>
          {canDelay && (
            <button
              type="button"
              className="mini-btn"
              aria-expanded={showDelay}
              onClick={() => setShowDelay((v) => !v)}
            >
              ⏰ {notReadyLabel}
            </button>
          )}
        </div>

        {canDelay && showDelay && (
          <div className="delay-panel">
            <span className="delay-hint">Udskyd dette og alle senere trin:</span>
            <div className="delay-btns">
              {DELAY_OPTIONS.map(([min, label]) => (
                <button
                  key={min}
                  type="button"
                  className="delay-btn"
                  onClick={() => {
                    onDelay(min);
                    setShowDelay(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
