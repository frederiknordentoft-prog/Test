// Platforme (spec 6.12): white-label → turnkey → hybrid → egen. Migrering tager tid, koster capex, sænker
// kvaliteten undervejs og kan give nedbrud. Egen platform kan sælges B2B (Kombi-vejen).
import type { GameState, PlatformKind, PlatformModel, Vertical } from './types';
import type { Rng } from './rng';
import { PLATFORM_MODELS, PLATFORM_KINDS, MIGRERING, PLATFORM_KRAV, B2B } from '../data/platforms';
import { afvis, betal, clamp, nyhed, signal } from './util';
import { justerKunder } from './customers';

const RAEKKE: PlatformModel[] = ['whiteLabel', 'turnkey', 'hybrid', 'egen'];
export const kindNavn = (k: PlatformKind): string => PLATFORM_KINDS.find((x) => x.id === k)?.navn ?? k;

/** Revenue share på en vertikals BSI: halvdelen fra kontoplatformen, halvdelen fra produktplatformen */
export function revenueShare(s: GameState, v: Vertical): number {
  const konto = PLATFORM_MODELS[s.platforme.kontoplatform.model].revenueShare;
  const produkt = PLATFORM_MODELS[s.platforme[v === 'betting' ? 'sportsbook' : 'kasinoplatform'].model].revenueShare;
  const leverandoer = s.flags.includes('dyrLeverandoer') ? 0.03 : s.flags.includes('dyrLeverandoerHalv') ? 0.015 : 0;
  const tillaeg = s.platforme.kontoplatform.model === 'whiteLabel' || s.platforme.kontoplatform.model === 'turnkey' ? leverandoer : 0;
  return 0.5 * konto + 0.5 * produkt + tillaeg;
}

/** Effektiv kvalitet (0-100) inkl. migreringsdyk */
export function platformKvalitet(s: GameState, kind: PlatformKind): number {
  const p = s.platforme[kind];
  return p.migrererTil ? p.kvalitet * MIGRERING.kvalitetUnder : p.kvalitet;
}

export function gennemsnitligPlatformKvalitet(s: GameState): number {
  return (platformKvalitet(s, 'kontoplatform') + platformKvalitet(s, 'sportsbook') + platformKvalitet(s, 'kasinoplatform')) / 3;
}

export function platformStatus(s: GameState, kind: PlatformKind, model: PlatformModel): { ok: boolean; grund?: string; pris: number; uger: [number, number] } {
  const def = PLATFORM_MODELS[model];
  const p = s.platforme[kind];
  const res = { pris: def.capex, uger: def.uger };
  if (p.migrererTil) return { ok: false, grund: `Migrering til ${PLATFORM_MODELS[p.migrererTil].navn.toLowerCase()} er i gang.`, ...res };
  if (p.model === model) return { ok: false, grund: 'I bruger allerede den model.', ...res };
  if (model === 'whiteLabel') return { ok: true, ...res };
  const krav = PLATFORM_KRAV[model];
  const flag = krav.flag?.[kind];
  if (flag && !s.flags.includes(flag)) return { ok: false, grund: 'Ingen leverandør tilbyder det endnu (Kombi udskilles i 2014).', ...res };
  const udviklere = s.staff.filter((m) => m.rolle === 'udvikler' || m.rolle === 'aiIngenioer').length;
  if (udviklere < krav.udviklere) return { ok: false, grund: `Kræver mindst ${krav.udviklere} udviklere (I har ${udviklere}).`, ...res };
  if (s.kapital < def.capex) return { ok: false, grund: `Kræver ${def.capex} mio. kr. i kassen.`, ...res };
  return { ok: true, ...res };
}

export function choosePlatform(s: GameState, rng: Rng, kind: PlatformKind, model: PlatformModel): boolean {
  const p = s.platforme[kind];
  if (!p) return afvis(s, 'Ukendt platform.');
  // Afbryd en igangværende migrering ved at vælge den nuværende model
  if (p.migrererTil && model === p.model) {
    const refusion = PLATFORM_MODELS[p.migrererTil].capex * MIGRERING.afbrydRefusion;
    s.kapital += refusion;
    nyhed(s, `${s.firmaNavn} afbryder migreringen af ${kindNavn(kind).toLowerCase()}en. Halvdelen af investeringen kommer retur.`, 'firma');
    p.migrererTil = null;
    p.migreringFaerdigUge = null;
    p.migreringStartUge = null;
    return true;
  }
  const st = platformStatus(s, kind, model);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke skifte platform.');
  const def = PLATFORM_MODELS[model];
  if (!betal(s, def.capex, `${def.navn.toLowerCase()}-platformen`)) return false;
  const uger = rng.int(def.uger[0], def.uger[1]);
  if (uger === 0) {
    faerdiggoer(s, kind, model);
    return true;
  }
  p.migrererTil = model;
  p.migreringStartUge = s.uge;
  p.migreringFaerdigUge = s.uge + uger;
  nyhed(s, `${s.firmaNavn} går i gang med at flytte ${kindNavn(kind).toLowerCase()}en til ${def.navn.toLowerCase()}. Forventet færdig om ${uger} uger.`, 'firma');
  signal(s, { k: 'platform', kind, model, faerdig: false });
  return true;
}

function faerdiggoer(s: GameState, kind: PlatformKind, model: PlatformModel): void {
  const p = s.platforme[kind];
  const def = PLATFORM_MODELS[model];
  const foerRang = RAEKKE.indexOf(p.model);
  p.model = model;
  p.migrererTil = null;
  p.migreringFaerdigUge = null;
  p.migreringStartUge = null;
  p.kvalitet = RAEKKE.indexOf(model) > foerRang ? Math.max(p.kvalitet, def.kvalitetsloft * MIGRERING.startKvalitet) : Math.min(p.kvalitet, def.kvalitetsloft);
  p.dataejerskab = def.dataejerskab;
  if (model !== 'egen') p.b2bKunder = 0;
  nyhed(s, `${kindNavn(kind)}en kører nu på ${def.navn.toLowerCase()}. Revenue share ${Math.round(def.revenueShare * 100)} %, dataejerskab ${def.dataejerskab.toFixed(1).replace('.', ',')}.`, 'firma');
  signal(s, { k: 'platform', kind, model, faerdig: true });
}

/** Ugentlig: migreringer, nedbrud, kvalitet mod loftet og B2B-indtægt */
export function ugentligePlatforme(s: GameState, rng: Rng): number {
  let b2b = 0;
  for (const kind of ['kontoplatform', 'sportsbook', 'kasinoplatform'] as PlatformKind[]) {
    const p = s.platforme[kind];
    if (p.migrererTil) {
      if (rng.chance(MIGRERING.nedbrudPrUge)) {
        justerKunder(s, MIGRERING.nedbrudKunder);
        nyhed(s, `Nedbrud under migreringen af ${kindNavn(kind).toLowerCase()}en. Nogle kunder giver op.`, 'firma');
      }
      if (p.migreringFaerdigUge !== null && s.uge >= p.migreringFaerdigUge) faerdiggoer(s, kind, p.migrererTil);
    } else {
      const loft = PLATFORM_MODELS[p.model].kvalitetsloft;
      if (p.kvalitet < loft) p.kvalitet = Math.min(loft, p.kvalitet + MIGRERING.vaekstPrUge);
    }
    if (p.model === 'egen' && p.b2bKunder > 0) b2b += p.b2bKunder * B2B.indtaegtPrKundePrUge * (p.kvalitet / 100);
  }
  s.b2bIndtaegtPrUge = b2b;
  return b2b;
}

export function b2bStatus(s: GameState, kind: PlatformKind): { ok: boolean; grund?: string; licens: number } {
  const p = s.platforme[kind];
  let licens = 0;
  if (s.flags.includes('dkB2bLicens') && !s.flags.includes('b2bLicensDk')) licens += B2B.licensGebyr;
  if (s.flags.includes('fiB2bLicens') && !s.flags.includes('b2bLicensFi')) licens += B2B.licensGebyr;
  if (kind === 'kontoplatform') return { ok: false, grund: 'Kun sportsbook og kasinoplatform kan sælges B2B.', licens };
  if (p.model !== 'egen') return { ok: false, grund: 'Kræver egen platform.', licens };
  if (p.kvalitet < B2B.minKvalitet) return { ok: false, grund: `Kræver platformkvalitet ${B2B.minKvalitet}.`, licens };
  if (p.b2bKunder >= B2B.maxKunder) return { ok: false, grund: 'Alle relevante operatører er allerede kunder.', licens };
  if (p.sidsteB2bUge !== null && s.uge - p.sidsteB2bUge < B2B.cooldownUger) return { ok: false, grund: `Salgsteamet er klar igen om ${B2B.cooldownUger - (s.uge - p.sidsteB2bUge)} uger.`, licens };
  return { ok: true, licens };
}

export function sellPlatformB2B(s: GameState, rng: Rng, kind: PlatformKind): boolean {
  const st = b2bStatus(s, kind);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke sælge platformen.');
  if (st.licens > 0) {
    if (!betal(s, st.licens, 'B2B-licensen')) return false;
    if (s.flags.includes('dkB2bLicens')) s.flags.push('b2bLicensDk');
    if (s.flags.includes('fiB2bLicens')) s.flags.push('b2bLicensFi');
  }
  const p = s.platforme[kind];
  p.sidsteB2bUge = s.uge;
  const chance = clamp(B2B.salgsChance * (p.kvalitet / 85) * (0.6 + s.omdoemme / 150), 0.1, 0.9);
  if (rng.chance(chance)) {
    p.b2bKunder += 1;
    nyhed(s, `${s.firmaNavn} lander en ny B2B-kunde på sin ${kindNavn(kind).toLowerCase()} (nu ${p.b2bKunder}).`, 'firma');
  } else {
    nyhed(s, `Salgsmødet om ${s.firmaNavn}s ${kindNavn(kind).toLowerCase()} endte uden aftale. Prøv igen senere.`, 'firma');
  }
  return true;
}
