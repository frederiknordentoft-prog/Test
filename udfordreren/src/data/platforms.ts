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
