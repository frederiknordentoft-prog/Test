import type { Milestone } from '../../lib/schedule';
import { formatDayTime } from '../../lib/format';
import { useCountdown } from '../../hooks/useCountdown';

export function NextStepHero({
  milestone,
  doneCount,
  total,
}: {
  milestone: Milestone | null;
  doneCount: number;
  total: number;
}) {
  const cd = useCountdown(milestone ? milestone.at : null);

  if (!milestone) {
    return (
      <section className="hero hero-done">
        <div className="hero-icon" aria-hidden="true">
          🎉
        </div>
        <h1 className="hero-title">Alle trin er færdige</h1>
        <p className="hero-desc">Nyd dit surdejsbrød — du gjorde det!</p>
      </section>
    );
  }

  return (
    <section className="hero" aria-label="Næste trin">
      <div className="hero-head">
        <p className="hero-kicker">Næste trin</p>
        <p className="hero-progress">
          {doneCount} / {total} klaret
        </p>
      </div>
      <div className="hero-icon" aria-hidden="true">
        {milestone.icon}
      </div>
      <h1 className="hero-title">{milestone.title}</h1>
      <p className="hero-time">{formatDayTime(milestone.at)}</p>
      <div className="hero-countdown" aria-hidden="true">
        <span className="cd-label">{cd?.overdue ? 'Klar nu' : 'Om'}</span>
        <span className="cd-value">{cd?.label}</span>
      </div>
      <p className="hero-desc">{milestone.description}</p>
    </section>
  );
}
