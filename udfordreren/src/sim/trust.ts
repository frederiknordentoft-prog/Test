// Tilsynstillid (spec 6.9 og 7.12). Fase 1-2: kvartalsvis drift; sanktionstrappen kommer i fase 3.
import type { GameState, MarketId } from './types';
import { TRUST } from '../data/trust';
import { CHANNELS, CHANNEL_IDS } from '../data/acquisition';
import { clamp } from './util';
import { forskningsEffekt } from './insight';
import { passiveEffekter } from './staff';

export type TillidsPost = { tekst: string; vaerdi: number };

/** Kvartalets tillidsposter for et marked — synlige, så spilleren kan se hvorfor */
export function tillidsPoster(s: GameState, m: MarketId): TillidsPost[] {
  const ms = s.markeder[m];
  const poster: TillidsPost[] = [];
  if (s.bonusNiveau > 0) poster.push({ tekst: `Bonusniveau ${s.bonusNiveau}`, vaerdi: TRUST.bonusNiveau * s.bonusNiveau });
  if (s.vipProgram > 0) poster.push({ tekst: `VIP-program ${s.vipProgram}`, vaerdi: TRUST.vipProgram * s.vipProgram });
  const hoejIntensitet = s.produkter.some((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && p.intensitet > 3);
  if (hoejIntensitet) poster.push({ tekst: 'Produkter med intensitet over 3', vaerdi: TRUST.intensitetOver3 });
  const aggressiv = CHANNEL_IDS.some((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0);
  if (aggressiv) poster.push({ tekst: 'Aggressive kanaler (tv/streamere)', vaerdi: TRUST.aggressivKanal });
  const comp = passiveEffekter(s).compliance;
  if (comp > 0) poster.push({ tekst: `Compliance-medarbejdere (${comp})`, vaerdi: Math.min(3, TRUST.complianceNiveau * comp) });
  const eff = forskningsEffekt(s);
  if (eff.ansvarNoder > 0) poster.push({ tekst: 'Ansvarsforskning', vaerdi: Math.min(2, eff.tillid) });
  if (s.offshoreBrand) poster.push({ tekst: 'Offshore-brand', vaerdi: TRUST.offshoreBrand });
  const sum = poster.reduce((a, p) => a + p.vaerdi, 0);
  // Langsom tilbagevenden mod startniveau, når intet andet trækker
  if (sum === 0 && ms.tilsynstillid !== TRUST.start) {
    poster.push({ tekst: 'Normalisering', vaerdi: ms.tilsynstillid < TRUST.start ? TRUST.genopretning : -TRUST.genopretning });
  }
  return poster;
}

export function kvartalsTillid(s: GameState): void {
  for (const m of Object.keys(s.markeder) as MarketId[]) {
    const ms = s.markeder[m];
    if (ms.licens !== 'aktiv') continue;
    const delta = tillidsPoster(s, m).reduce((a, p) => a + p.vaerdi, 0);
    ms.tilsynstillid = clamp(ms.tilsynstillid + delta, 0, 100);
  }
}
