import { useState } from 'react';
import type { FeedEvent } from '../odds/feed';
import { BUCKET_MIN, momentumBuckets } from '../odds/momentum';

interface Props {
  feed: FeedEvent[];
  minute: number;
  homeLabel: string;
  awayLabel: string;
}

/**
 * Shots per ten-minute bucket. Colour shows which side took more shots, height shows volume.
 * Descriptive only: no "hot" labels, and nothing about odds.
 */
export function MomentumStrip({ feed, minute, homeLabel, awayLabel }: Props) {
  const buckets = momentumBuckets(feed, minute);
  const [sel, setSel] = useState<number | null>(null);
  const maxTotal = Math.max(1, ...buckets.map((b) => b.home + b.away));

  const chosen = sel !== null ? buckets[sel] : null;

  return (
    <div>
      <div className="momentum-strip" role="group" aria-label={`Skud pr. ${BUCKET_MIN} minutter. Modelestimat.`}>
        {buckets.map((b, i) => {
          const total = b.home + b.away;
          const lead = total === 0 || b.home === b.away ? 'even' : b.home > b.away ? 'home' : 'away';
          const future = b.from > minute;
          return (
            <button
              key={b.from}
              className={`mom-cell ${lead}`}
              style={{ height: `${16 + 40 * (total / maxTotal)}px` }}
              aria-pressed={sel === i}
              aria-label={`${b.from}–${b.to} minutter: ${homeLabel} ${b.home} skud, ${awayLabel} ${b.away} skud`}
              disabled={future}
              onClick={() => setSel(sel === i ? null : i)}
            />
          );
        })}
      </div>
      <p className="momentum-read" aria-live="polite">
        {chosen
          ? `${chosen.from}–${chosen.to} min · ${homeLabel} ${chosen.home} skud · ${awayLabel} ${chosen.away} skud`
          : 'Skud pr. 10 minutter. Tryk på et felt for tallene.'}
      </p>
    </div>
  );
}
