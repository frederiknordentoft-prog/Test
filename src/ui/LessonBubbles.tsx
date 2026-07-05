// Short, dismissible Danish explanation bubbles triggered by user actions.

import { useStore } from '../state/store';
import { da } from '../i18n/da';

const TEXTS: Record<string, string> = {
  firstShape: da.bubbleFirstShape,
  pressure: da.bubblePressure,
  vorticity: da.bubbleVorticity,
  angle: da.bubbleAngle,
  weight: da.bubbleWeight,
};

export function LessonBubbles() {
  const bubble = useStore((s) => s.bubble);
  const dismissBubble = useStore((s) => s.dismissBubble);
  if (!bubble || !TEXTS[bubble]) return null;

  return (
    <div className="bubble" role="note">
      <p>{TEXTS[bubble]}</p>
      <button className="btn small" onClick={() => dismissBubble(bubble)}>{da.gotIt}</button>
    </div>
  );
}
