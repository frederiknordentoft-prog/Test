// Branchemesser (spec 6.15): London-messen (feb.) og Sportsmessen (sep.). Stande giver hype, indsigt, kandidater og B2B-chancer.
import type { GameState } from './types';
import type { Rng } from './rng';
import { EXPOS, EXPO_BY_ID, STAND_NAVN } from '../data/expos';
import { aarFor, ugeIAar } from './time';
import { afvis, betal, clamp, nyId, nyhed, signal } from './util';
import { lavKandidat } from './staff';

/** Er bookingvinduet åbent for en messe (fra varsel til ugen før)? */
export function bookingAabent(s: GameState, expoId: string): boolean {
  const e = EXPO_BY_ID[expoId];
  if (!e) return false;
  const u = ugeIAar(s.uge);
  return u >= e.ugeIAar - e.varselUger && u < e.ugeIAar;
}

export function naesteMesse(s: GameState): { expoId: string; uge: number; aar: number; booket: 0 | 1 | 2 | 3; aaben: boolean } | null {
  let best: { expoId: string; uge: number; aar: number; booket: 0 | 1 | 2 | 3; aaben: boolean } | null = null;
  for (const e of EXPOS) {
    const u = ugeIAar(s.uge);
    const aar = u < e.ugeIAar ? aarFor(s.uge) : aarFor(s.uge) + 1;
    const ugeAbs = (aar - 2012) * 52 + e.ugeIAar;
    const b = s.messeBookinger.find((x) => x.expoId === e.id && x.aar === aar);
    const kand = { expoId: e.id, uge: ugeAbs, aar, booket: (b?.stoerrelse ?? 0) as 0 | 1 | 2 | 3, aaben: bookingAabent(s, e.id) && aar === aarFor(s.uge) };
    if (!best || kand.uge < best.uge) best = kand;
  }
  return best;
}

export function bookExpoStand(s: GameState, expoId: string, stoerrelse: 1 | 2 | 3): boolean {
  const e = EXPO_BY_ID[expoId];
  if (!e) return afvis(s, 'Ukendt messe.');
  if (!bookingAabent(s, expoId)) return afvis(s, `Stande til ${e.navn} kan bookes fra ${e.varselUger} uger før messen.`);
  const aar = aarFor(s.uge);
  if (s.messeBookinger.some((b) => b.expoId === expoId && b.aar === aar)) return afvis(s, 'I har allerede booket en stand.');
  if (!betal(s, e.standPris[stoerrelse - 1], 'standen')) return false;
  s.messeBookinger.push({ expoId, aar, stoerrelse });
  nyhed(s, `${s.firmaNavn} har booket en ${STAND_NAVN[stoerrelse].toLowerCase()} på ${e.navn}.`, 'firma');
  return true;
}

export function ugentligeMesser(s: GameState, rng: Rng): void {
  const u = ugeIAar(s.uge);
  const aar = aarFor(s.uge);
  for (const e of EXPOS) {
    if (u === e.ugeIAar - e.varselUger && s.uge > 0) {
      signal(s, { k: 'messeVarsel', expoId: e.id });
      nyhed(s, `${e.navn} i ${e.by} om ${e.varselUger} uger. Book en stand nu.`, 'verden');
    }
    if (u === e.ugeIAar) {
      const booking = s.messeBookinger.find((b) => b.expoId === e.id && b.aar === aar);
      const st = (booking?.stoerrelse ?? 0) as 0 | 1 | 2 | 3;
      if (st === 0) {
        signal(s, { k: 'messe', expoId: e.id, stoerrelse: 0, hype: 0, indsigt: 0, kandidater: 0, b2b: false });
        nyhed(s, `${e.navn} er i gang — uden ${s.firmaNavn} på gulvet.`, 'verden');
        continue;
      }
      const i = st - 1;
      const hype = e.hype[i];
      const indsigt = e.indsigt[i];
      s.hype = clamp(s.hype + hype, 0, 100);
      s.indsigt += indsigt;
      s.omdoemme = clamp(s.omdoemme + e.omdoemme[i], 0, 100);
      const antal = e.kandidater[i];
      for (let k = 0; k < antal; k++) s.kandidater.push(lavKandidat(s, rng, 18 + 6 * st, 34 + 8 * st, 1, 1 + st));
      if (s.kandidater.length > 8) s.kandidater = s.kandidater.slice(-8);
      const b2b = rng.chance(e.b2bChance[i]);
      if (b2b) {
        s.kontraktTilbud.push({
          id: nyId(s, 'c'),
          skabelonId: 'b2bMesse',
          navn: 'B2B-opgave fra messen',
          kunde: `En operatør fra ${e.navn}`,
          rolle: rng.pick(['udvikler', 'oddssaetter', 'kasinodesigner'] as const),
          stat: rng.pick(['teknik', 'matematik', 'kreativitet'] as const),
          uger: rng.int(4, 6),
          maxStaff: 2,
          betaling: Math.round(rng.range(0.3, 0.6) * st * 100) / 100,
          indsigt: 4 + 2 * st,
          udloeberUge: s.uge + 6,
        });
      }
      signal(s, { k: 'messe', expoId: e.id, stoerrelse: st, hype, indsigt, kandidater: antal, b2b });
      nyhed(s, `${s.firmaNavn} på ${e.navn}: +${hype} hype og ${indsigt} indsigt${b2b ? ', og en B2B-kunde bed på' : ''}.`, 'firma');
    }
  }
}
