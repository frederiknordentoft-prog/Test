// Collapsible challenge list with completion state.

import { useStore } from '../state/store';
import { CHALLENGES } from '../learn/challenges';
import { da } from '../i18n/da';

export function ChallengePanel() {
  const open = useStore((s) => s.challengesOpen);
  const completed = useStore((s) => s.completedChallenges);
  const set = useStore((s) => s.set);

  return (
    <div className={`challenges ${open ? 'open' : ''}`}>
      <button className="btn small" onClick={() => set({ challengesOpen: !open })}>
        🏆 {da.challenges} ({completed.length}/{CHALLENGES.length})
      </button>
      {open && (
        <ul>
          {CHALLENGES.map((c) => (
            <li key={c.id} className={completed.includes(c.id) ? 'done' : ''}>
              <strong>{completed.includes(c.id) ? '✓ ' : ''}{c.title}</strong>
              <span>{c.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
