// Render a plan as shareable/clipboard-friendly Danish plain text.

import type { Milestone, PlanInput } from './schedule';
import { RECIPES, SIZE_LABELS, TEMP_LABELS } from './schedule';
import { formatDayTime, grams } from './format';

export function renderPlanText(milestones: Milestone[], input: PlanInput): string {
  const r = RECIPES[input.size];
  const lines: string[] = [];
  lines.push('🍞 Min bageplan for surdejsbrød');
  lines.push('');
  lines.push(`${SIZE_LABELS[input.size]} · ${TEMP_LABELS[input.temp]} · koldhævning ${input.coldProofHours} t`);
  lines.push('');
  lines.push('Opskrift:');
  lines.push(`• ${grams(r.starter)} aktiv surdej`);
  lines.push(`• ${grams(r.water)} vand`);
  lines.push(`• ${grams(r.flour)} mel`);
  lines.push(`• ${grams(r.salt)} salt`);
  lines.push('');
  lines.push('Tidsplan:');
  for (const m of milestones) {
    lines.push(`${formatDayTime(m.at)}`);
    lines.push(`${m.icon} ${m.title}`);
  }
  lines.push('');
  lines.push('Hævetider er vejledende — gå efter dejen, ikke kun uret.');
  return lines.join('\n');
}
