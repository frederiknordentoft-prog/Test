// Kontortrin (spec 6.5): garage → kælder → kontor → etage → hovedkontor.
import type { GameState, MarketId } from './types';
import { OFFICES } from '../data/costs';
import { afvis, betal, nyhed, signal } from './util';

export function naesteKontor(s: GameState) {
  const i = OFFICES.findIndex((o) => o.id === s.kontor);
  return OFFICES[i + 1] ?? null;
}

export function kontorKrav(s: GameState): { ok: boolean; grunde: string[] } {
  const n = naesteKontor(s);
  if (!n) return { ok: false, grunde: ['I har allerede hovedkontoret.'] };
  const grunde: string[] = [];
  if (s.kapital < n.pris) grunde.push(`Kræver ${n.pris} mio. kr. i kassen`);
  if (n.id === 'kontor' && s.milepaele.foersteGuldkupon === undefined) grunde.push('Kræver en Guldkupon');
  if (n.id === 'etage') {
    const udland = (Object.keys(s.markeder) as MarketId[]).some((m) => m !== 'dk' && s.markeder[m].licens === 'aktiv');
    if (!udland) grunde.push('Kræver en aktiv licens uden for Danmark');
  }
  return { ok: grunde.length === 0, grunde };
}

export function upgradeOffice(s: GameState): boolean {
  const n = naesteKontor(s);
  if (!n) return afvis(s, 'I har allerede hovedkontoret.');
  const k = kontorKrav(s);
  if (!k.ok) return afvis(s, k.grunde[0] ?? 'Kravene er ikke opfyldt.');
  if (!betal(s, n.pris, `flytningen til ${n.navn.toLowerCase()}`)) return false;
  s.kontor = n.id;
  if (n.id === 'kaelder' && s.milepaele.kaelder === undefined) s.milepaele.kaelder = s.uge;
  if (n.id === 'kontor' && s.milepaele.kontor === undefined) s.milepaele.kontor = s.uge;
  signal(s, { k: 'kontor', tier: n.id });
  nyhed(s, `${s.firmaNavn} flytter i ${n.navn.toLowerCase()} med plads til ${n.pladser}.`, 'firma');
  return true;
}
