// Platformmodeller (spec 6.12).
import type { PlatformKind, PlatformModel } from '../sim/types';

export type PlatformModelDef = {
  id: PlatformModel;
  navn: string;
  uger: [number, number]; // migreringstid
  revenueShare: number;
  capex: number; // mio.
  kvalitetsloft: number;
  dataejerskab: number;
  kilde: string;
};

export const PLATFORM_MODELS: Record<PlatformModel, PlatformModelDef> = {
  whiteLabel: { id: 'whiteLabel', navn: 'White-label', uger: [0, 0], revenueShare: 0.3, capex: 0, kvalitetsloft: 55, dataejerskab: 0.1, kilde: '[D] "Lavt" loft' },
  turnkey: { id: 'turnkey', navn: 'Turnkey', uger: [26, 52], revenueShare: 0.12, capex: 15, kvalitetsloft: 75, dataejerskab: 0.3, kilde: '[D] 6-12 mdr.' },
  hybrid: { id: 'hybrid', navn: 'Hybrid', uger: [52, 104], revenueShare: 0.05, capex: 60, kvalitetsloft: 85, dataejerskab: 0.6, kilde: '[D] 1-2 år' },
  egen: { id: 'egen', navn: 'Egen platform', uger: [156, 156], revenueShare: 0, capex: 200, kvalitetsloft: 95, dataejerskab: 1.0, kilde: '[F] ca. 3 år' },
};

export const PLATFORM_KINDS: { id: PlatformKind; navn: string }[] = [
  { id: 'kontoplatform', navn: 'Kontoplatform' },
  { id: 'sportsbook', navn: 'Sportsbook' },
  { id: 'kasinoplatform', navn: 'Kasinoplatform' },
];

/** Migrering og drift [D] */
export const MIGRERING = {
  kvalitetUnder: 0.85, // kvalitet under migrering (andel)
  nedbrudPrUge: 0.01, // risiko for nedbrud pr. uge under migrering
  nedbrudKunder: -0.03,
  startKvalitet: 0.8, // andel af loftet efter migrering; vokser mod loftet
  vaekstPrUge: 0.25, // kvalitetspoint pr. uge mod loftet
  afbrydRefusion: 0.5, // refusion af capex ved afbrudt migrering
};

/** Krav til modeller [D] */
export const PLATFORM_KRAV: Record<'turnkey' | 'hybrid' | 'egen', { udviklere: number; flag?: Partial<Record<'sportsbook' | 'kontoplatform' | 'kasinoplatform', string>> }> = {
  turnkey: { udviklere: 0, flag: { sportsbook: 'kombiB2B' } },
  hybrid: { udviklere: 2 },
  egen: { udviklere: 4 },
};

/** B2B-salg af egen platform (Kombi-vejen) [D] */
export const B2B = {
  minKvalitet: 70,
  indtaegtPrKundePrUge: 0.03, // mio. kr. ved kvalitet 100
  cooldownUger: 13,
  maxKunder: 12,
  licensGebyr: 0.5, // dk fra 2025 og fi fra 2028
  salgsChance: 0.55, // pr. forsøg ved kvalitet 85 og omdømme 60
};
