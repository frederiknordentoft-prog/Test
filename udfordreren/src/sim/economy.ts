// Økonomi (spec 6.4): BSI minus afgift, revenue share, betalinger, bonus, indhold, marketing, løn og licenser.
import type { GameState, LedgerWeek, MarketId } from './types';
import { PRODUCT_TYPES } from '../data/productTypes';
import { PLATFORM_MODELS } from '../data/platforms';
import { AGGREGATOR_PCT, BETALINGER_PCT, BONUS_PCT, INDBETALING_PR_BSI, KONKURS_UGER, OFFICE_BY_ID, VIP_PCT } from '../data/costs';
import { CHANNEL_IDS } from '../data/acquisition';
import type { KundeUge } from './customers';
import { kanalTilgaengelig, spillerKunderTotal } from './customers';
import { BALANCE } from '../data/balance';
import { licensAarsgebyr } from './markets';
import { effektivBonus, effektivVip } from './regulation';
import { OFFSHORE_BRAND } from '../data/offshore';
import { nyhed, signal } from './util';

export const tomtRegnskab = (): LedgerWeek => ({
  bsi: 0, kontrakter: 0, afgift: 0, revenueShare: 0, betalinger: 0, bonus: 0, indhold: 0,
  marketing: 0, loen: 0, licenser: 0, oevrigt: 0, resultat: 0,
});

/** Effektiv afgiftssats af BSI (indsatsmodel for de: 5,3 % af indsats ≈ sats / margin) */
export function effektivAfgift(s: GameState, m: MarketId, v: 'betting' | 'kasino', margin: number): number {
  const ms = s.markeder[m];
  const sats = ms.afgiftPrVertikal[v] + ms.afgiftTillaeg / 100;
  if (m === 'de') return Math.min(0.9, sats / Math.max(0.01, margin));
  return Math.max(0, sats);
}

export function ugentligOekonomi(s: GameState, kunder: KundeUge, kontraktIndtaegt: number, offshoreBsi = 0): LedgerWeek {
  const r = tomtRegnskab();
  r.kontrakter = kontraktIndtaegt;
  r.bsi = kunder.bsiIalt + offshoreBsi;
  let kasinoBsi = 0;
  let egneSlotsBsi = 0;
  for (const m of Object.keys(kunder.bsi) as MarketId[]) {
    for (const v of ['betting', 'kasino'] as const) {
      const b = kunder.bsi[m][v];
      if (b <= 0) continue;
      const prods = s.produkter.filter((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && PRODUCT_TYPES[p.typeId].vertikal === v);
      const margin = prods.length ? prods.reduce((a, p) => a + p.margin, 0) / prods.length : 0.05;
      r.afgift += b * effektivAfgift(s, m, v, margin);
      r.bonus += b * (BONUS_PCT[effektivBonus(s, m)] + VIP_PCT[effektivVip(s, m)]);
      if (v === 'kasino') {
        kasinoBsi += b;
        for (const p of prods) if (p.typeId === 'egneSlots') egneSlotsBsi += p.bsiPrUge[m] ?? 0;
      }
    }
  }
  r.revenueShare = kunder.bsiIalt * PLATFORM_MODELS[s.platforme.kontoplatform.model].revenueShare;
  r.betalinger = kunder.bsiIalt * INDBETALING_PR_BSI * BETALINGER_PCT;
  // Offshore-brandets grå BSI: licens, betalinger og hosting uden dansk afgift
  const offshoreOmk = offshoreBsi * OFFSHORE_BRAND.omkostning;
  r.betalinger += offshoreOmk;
  r.indhold = Math.max(0, kasinoBsi - egneSlotsBsi) * AGGREGATOR_PCT;
  for (const k of CHANNEL_IDS) if (kanalTilgaengelig(s, k)) r.marketing += s.marketingMix[k] ?? 0;
  r.loen = s.staff.reduce((a, m) => a + m.loenPrUge, 0);
  r.licenser = licensAarsgebyr(s);
  const husleje = OFFICE_BY_ID[s.kontor].husleje + (spillerKunderTotal(s) * BALANCE.driftPrKunde) / 1e6;
  const drift = r.afgift + r.revenueShare + r.betalinger + r.bonus + r.indhold + r.marketing + r.loen + r.licenser + husleje;
  const driftsresultat = r.bsi + r.kontrakter - drift;
  s.kapital += driftsresultat;
  r.oevrigt = s.engangsUge + husleje;
  s.engangsUge = 0;
  r.resultat = driftsresultat - (r.oevrigt - husleje);

  // Historik til værdiansættelse og mål
  s.bsiHistorik.push(r.bsi);
  if (s.bsiHistorik.length > 13) s.bsiHistorik.shift();
  s.kvartalAkk.bsi += r.bsi;
  s.kvartalAkk.resultat += r.resultat;
  s.kvartalAkk.drift = (s.kvartalAkk.drift ?? 0) + driftsresultat;

  // Konkurs, hvis kapitalen er negativ for længe
  if (s.kapital < 0) {
    s.negativUger += 1;
    if (s.negativUger === 1) {
      signal(s, { k: 'advarsel', tekst: 'Kassen er tom! Skaf penge inden for otte uger — kontraktopgaver, en runde eller lavere omkostninger.' });
      nyhed(s, `${s.firmaNavn} er i minus. Banken ringer.`, 'firma');
    }
    if (s.negativUger >= KONKURS_UGER && !s.slut) {
      s.slut = { id: 'konkurs', vaerdi: 0, eftermaele: 0 };
      signal(s, { k: 'slut', id: 'konkurs' });
    }
  } else {
    s.negativUger = 0;
  }
  s.regnskab = r;
  return r;
}

/** Annualiseret BSI ud fra de seneste 13 uger */
export function aarligBsi(s: GameState): number {
  if (s.bsiHistorik.length === 0) return 0;
  const snit = s.bsiHistorik.reduce((a, b) => a + b, 0) / s.bsiHistorik.length;
  return snit * 52;
}
