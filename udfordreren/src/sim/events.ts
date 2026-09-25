// Events med valg. Et ventende event pauser spillet i UI'et, indtil spilleren vælger.
import type { GameState } from './types';
import type { Rng } from './rng';
import { EVENTS, EVENT_BY_ID, type EventDef, type EventEffect } from '../data/events';
import { CHANNEL_IDS } from '../data/acquisition';
import { aarFor } from './time';
import { aendrPres, afvis, clamp, nyhed, saetFlag, signal } from './util';
import { spillerKunderTotal, justerKunder } from './customers';
import { fjernFraOpgaver, beregnLoen } from './staff';
import { risikoAndel } from './town';
import { BY } from '../data/town';
import { fejlrate } from './agents';

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
  if (k.platform && !k.platform.includes(s.platforme.kontoplatform.model as 'whiteLabel' | 'turnkey')) return false;
  if (k.agent && !s.agenter.some((a) => k.agent!.includes(a.funktion))) return false;
  if (k.scenarie && !k.scenarie.some((x) => (s.verdensscenarier[x] ?? 0) > 0)) return false;
  if (k.hyper !== undefined && s.hyperpersonalisering.aktiv !== k.hyper) return false;
  if (k.minByRisiko !== undefined && (risikoAndel(s) ?? 0) < k.minByRisiko) return false;
  if (k.minVip !== undefined && s.vipProgram < k.minVip) return false;
  if (k.minBonus !== undefined && s.bonusNiveau < k.minBonus) return false;
  if (k.licens && s.markeder[k.licens].licens !== 'aktiv') return false;
  if (k.offshoreBrand !== undefined && s.offshoreBrand !== k.offshoreBrand) return false;
  if (k.minKapital !== undefined && s.kapital < k.minKapital) return false;
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
  // Alle events, der rammer denne uge, er lige kandidater (rækkefølgen i listen giver ingen fordel)
  const ramt: EventDef[] = [];
  for (const e of EVENTS) {
    if (e.trigger !== 'tilfaeldig' && e.trigger !== 'medarbejder') continue;
    if (!opfylderKrav(s, e)) continue;
    if (e.trigger === 'medarbejder' && !s.staff.some((m) => !m.stifter)) continue;
    if (rng.chance(e.chancePrUge)) ramt.push(e);
  }
  if (!ramt.length) return;
  const e = rng.pick(ramt);
  const ctx: Record<string, string | number> = {};
  if (e.trigger === 'medarbejder') {
    const m = rng.pick(s.staff.filter((x) => !x.stifter));
    ctx.staffId = m.id;
    ctx.navn = m.navn;
  }
  udloesEvent(s, e.id, ctx);
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
  if (eff.tillidAlle) t.push(`${fmt(eff.tillidAlle)} tilsynstillid i alle markeder`);
  if (eff.politiskPres) t.push(`politisk pres ${fmt(eff.politiskPres)}`);
  if (eff.byRisiko) t.push(eff.byRisiko > 0 ? `${Math.round(eff.byRisiko * 100)} % af de engagerede kunder glider mod risiko` : `${Math.round(-eff.byRisiko * 100)} % af kunderne i risiko kommer tilbage`);
  if (eff.agentOvervaagning) t.push(`overvågning ${fmt(eff.agentOvervaagning)} på alle agenter`);
  if (eff.agentFra) t.push('agenten slukkes');
  if (eff.hyperFra) t.push('hyperpersonaliseringen slås fra');
  if (eff.vipNiveau !== undefined) t.push(`VIP-niveau ${eff.vipNiveau}`);
  if (eff.bonusNiveau !== undefined) t.push(`bonusniveau ${eff.bonusNiveau}`);
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
  if (e.tillidAlle) for (const m of Object.values(s.markeder)) if (m.licens === 'aktiv') m.tilsynstillid = clamp(m.tilsynstillid + e.tillidAlle, 0, 100);
  if (e.politiskPres) for (const m of Object.values(s.markeder)) if (m.licens === 'aktiv') aendrPres(s, m.id, e.politiskPres, def.titel);
  if (e.byRisiko) flytBy(s, e.byRisiko);
  if (e.agentOvervaagning) for (const a of s.agenter) { a.overvaagning = clamp(Math.round((a.overvaagning + e.agentOvervaagning) * 10) / 10, 0, 1); a.fejlrate = fejlrate(a.funktion, a.overvaagning); }
  if (e.hyperFra && s.hyperpersonalisering.aktiv) { s.hyperpersonalisering.aktiv = false; s.hyperpersonalisering.startUge = null; }
  if (e.vipNiveau !== undefined) s.vipProgram = e.vipNiveau;
  if (e.bonusNiveau !== undefined) s.bonusNiveau = e.bonusNiveau;
  if (e.agentFra && typeof pending.ctx.agentId === 'string') s.agenter = s.agenter.filter((a) => a.id !== pending.ctx.agentId);
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

/** Flyt en andel af byen: positiv = engagerede/VIP → risiko, negativ = risiko/problem → tilbage (deterministisk efter id) */
function flytBy(s: GameState, andel: number): void {
  const fra = andel > 0 ? ['engageret', 'vip'] : ['risiko', 'problem'];
  const kandidater = s.by.filter((p) => fra.includes(p.profil));
  const n = Math.round(kandidater.length * Math.abs(andel));
  for (const p of kandidater.slice(0, n)) {
    p.profil = andel > 0 ? 'risiko' : p.profil === 'problem' ? 'risiko' : 'engageret';
    p.vaerdi = BY.vaerdi[p.profil];
  }
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
