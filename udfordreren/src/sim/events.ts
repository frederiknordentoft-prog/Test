// Events med valg. Et ventende event pauser spillet i UI'et, indtil spilleren vælger.
import type { GameState } from './types';
import type { Rng } from './rng';
import { EVENTS, EVENT_BY_ID, type EventDef, type EventEffect } from '../data/events';
import { CHANNEL_IDS } from '../data/acquisition';
import { aarFor } from './time';
import { afvis, clamp, nyhed, saetFlag, signal } from './util';
import { spillerKunderTotal, justerKunder } from './customers';
import { fjernFraOpgaver, beregnLoen } from './staff';

export function udloesEvent(s: GameState, eventId: string, ctx: Record<string, string | number>): void {
  if (!EVENT_BY_ID[eventId]) return;
  if (s.ventendeEvents.some((e) => e.eventId === eventId)) return;
  s.ventendeEvents.push({ eventId, uge: s.uge, ctx });
  signal(s, { k: 'event', eventId });
}

export const EVENT_COOLDOWN = 26;
export const EVENT_MELLEMRUM = 4;

function opfylderKrav(s: GameState, e: EventDef): boolean {
  const aar = aarFor(s.uge);
  if (aar < e.fraAar || aar > e.tilAar) return false;
  if (e.engang && s.eventLog.some((l) => l.eventId === e.id)) return false;
  const cd = e.cooldownUger ?? EVENT_COOLDOWN;
  if (s.eventLog.some((l) => l.eventId === e.id && s.uge - l.uge < cd)) return false;
  const k = e.kraever;
  if (!k) return true;
  if (k.flagIkke && k.flagIkke.some((f) => s.flags.includes(f))) return false;
  if (k.flag && !k.flag.every((f) => s.flags.includes(f))) return false;
  if (k.kontor && !k.kontor.includes(s.kontor)) return false;
  if (k.minKunder !== undefined && spillerKunderTotal(s) < k.minKunder) return false;
  if (k.runde && s.investorer.runde === 'ingen') return false;
  if (k.minStaff !== undefined && s.staff.length < k.minStaff) return false;
  return true;
}

/** Ugentlig trækning af tilfældige events (højst ét nyt ad gangen) */
export function ugentligeEvents(s: GameState, rng: Rng): void {
  // Angel-investoren dukker op fire uger efter første lancering
  if (s.milepaele.foersteLancering !== undefined && s.uge === s.milepaele.foersteLancering + 4) {
    const e = EVENT_BY_ID.angelSnuser;
    if (e && opfylderKrav(s, e)) {
      udloesEvent(s, e.id, {});
      return;
    }
  }
  if (s.ventendeEvents.length > 0) return;
  if (s.uge < 6) return; // lad garagen komme i gang først
  // Mindst fire uger mellem tilfældige events
  const sidste = s.eventLog.length ? s.eventLog[s.eventLog.length - 1].uge : -99;
  if (s.uge - sidste < EVENT_MELLEMRUM) return;
  for (const e of EVENTS) {
    if (e.trigger !== 'tilfaeldig' && e.trigger !== 'medarbejder') continue;
    if (!opfylderKrav(s, e)) continue;
    if (!rng.chance(e.chancePrUge)) continue;
    const ctx: Record<string, string | number> = {};
    if (e.trigger === 'medarbejder') {
      const kandidater = s.staff.filter((m) => !m.stifter);
      if (kandidater.length === 0) continue;
      const m = rng.pick(kandidater);
      ctx.staffId = m.id;
      ctx.navn = m.navn;
    }
    udloesEvent(s, e.id, ctx);
    return;
  }
}

export function effektTekst(eff: EventEffect): string[] {
  const t: string[] = [];
  const fmt = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(v)).replace('.', ',');
  if (eff.kapital) t.push(`${eff.kapital > 0 ? '+' : '−'}${Math.round(Math.abs(eff.kapital) * 1000)} t. kr.`);
  if (eff.indsigt) t.push(`${fmt(eff.indsigt)} indsigt`);
  if (eff.hype) t.push(`${fmt(eff.hype)} hype`);
  if (eff.omdoemme) t.push(`${fmt(eff.omdoemme)} omdømme`);
  if (eff.tillid) t.push(`${fmt(eff.tillid)} tilsynstillid`);
  if (eff.energiAlle) t.push(`${fmt(eff.energiAlle)} energi til alle`);
  if (eff.kunderPct) t.push(`${fmt(Math.round(eff.kunderPct * 100))} % kunder`);
  if (eff.marketingPct) t.push(`marketing ${fmt(Math.round(eff.marketingPct * 100))} %`);
  if (eff.pres) t.push(`investorpres ${fmt(eff.pres)}`);
  if (eff.marketingMin) t.push(`mindst ${Math.round(eff.marketingMin * 1000)} t. kr./uge i marketing`);
  if (eff.vaerdiPct) t.push(`værdiansættelse ${fmt(Math.round(eff.vaerdiPct * 100))} %`);
  if (eff.staffLoenPct) t.push(`løn ${fmt(Math.round(eff.staffLoenPct * 100))} %`);
  if (eff.staffForlader) t.push('medarbejderen forlader firmaet');
  return t;
}

export function eventChoice(s: GameState, eventId: string, valg: number): boolean {
  const idx = s.ventendeEvents.findIndex((e) => e.eventId === eventId);
  if (idx < 0) return afvis(s, 'Eventet er ikke aktivt.');
  const def = EVENT_BY_ID[eventId];
  const pending = s.ventendeEvents[idx];
  const v = def?.valg[valg];
  if (!def || !v) return afvis(s, 'Ugyldigt valg.');
  const e = v.effekt;
  if (e.kapital) {
    s.kapital += e.kapital;
    if (e.kapital < 0) s.engangsUge += -e.kapital;
  }
  if (e.indsigt) s.indsigt = Math.max(0, s.indsigt + e.indsigt);
  if (e.hype) s.hype = clamp(s.hype + e.hype, 0, 100);
  if (e.omdoemme) s.omdoemme = clamp(s.omdoemme + e.omdoemme, 0, 100);
  if (e.tillid) s.markeder.dk.tilsynstillid = clamp(s.markeder.dk.tilsynstillid + e.tillid, 0, 100);
  if (e.energiAlle) for (const m of s.staff) m.energi = clamp(m.energi + e.energiAlle, 0, 100);
  if (e.kunderPct) justerKunder(s, e.kunderPct);
  if (e.pres) s.investorer.pres = clamp(s.investorer.pres + e.pres, 0, 5);
  if (e.flag) saetFlag(s, e.flag);
  if (e.vaerdiPct) s.investorer.vaerdiBonus += e.vaerdiPct;
  if (e.marketingPct) for (const k of CHANNEL_IDS) s.marketingMix[k] = Math.max(0, Math.round(s.marketingMix[k] * (1 + e.marketingPct) * 1000) / 1000);
  if (e.marketingMin) {
    const total = CHANNEL_IDS.reduce((a, k) => a + s.marketingMix[k], 0);
    if (total < e.marketingMin) s.marketingMix.soeg = Math.round((s.marketingMix.soeg + e.marketingMin - total) * 1000) / 1000;
  }
  const staffId = typeof pending.ctx.staffId === 'string' ? pending.ctx.staffId : undefined;
  const m = staffId ? s.staff.find((x) => x.id === staffId) : undefined;
  if (m && e.staffLoenPct) {
    m.loenPrUge = beregnLoen(m.rolle, m.niveau, m.stats, m.stifter) * (1 + e.staffLoenPct);
  }
  if (m && e.staffEnergi) m.energi = clamp(m.energi + e.staffEnergi, 0, 100);
  if (m && e.staffForlader) {
    fjernFraOpgaver(s, m.id);
    s.staff = s.staff.filter((x) => x.id !== m.id);
    nyhed(s, `${m.navn} forlader ${s.firmaNavn} til fordel for en konkurrent.`, 'firma');
  }
  s.eventLog.push({ uge: s.uge, eventId, valg });
  s.ventendeEvents.splice(idx, 1);
  return true;
}

/** Brugt af debug-hop og bots: vælg første mulighed for alle ventende events */
export function autoloesEvents(s: GameState): void {
  while (s.ventendeEvents.length > 0) {
    const e = s.ventendeEvents[0];
    if (!eventChoice(s, e.eventId, 0)) s.ventendeEvents.shift();
  }
}

export function eventTekst(tekst: string, ctx: Record<string, string | number>): string {
  return tekst.replace(/\{(\w+)\}/g, (_, k: string) => String(ctx[k] ?? ''));
}
