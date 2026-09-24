// Kundeanskaffelse (spec 7.10). CAC pr. ny indbetalende kunde i dk 2012, i kr. [D]
import type { AcqChannel } from '../sim/types';

export type ChannelDef = {
  id: AcqChannel;
  navn: string;
  cac: number | null; // kr.; null = fastholdelse
  risiko: 'lav' | 'middel' | 'middel-høj' | 'høj';
  aggressiv: boolean; // tæller i aggressivitetsindeks og tillid
  fraAar: number;
  /** Mætning: ugentligt forbrug (mio.), hvor effekten er halveret [D] */
  maetning: number;
  /** Hype pr. mio. kr. pr. uge (brandkendskab) [D] */
  hype: number;
  note: string;
};

export const CHANNELS: Record<AcqChannel, ChannelDef> = {
  affiliate: { id: 'affiliate', navn: 'Affiliate', cac: 1500, risiko: 'middel', aggressiv: false, fraAar: 2012, maetning: 0.25, hype: 0, note: 'Omsætningsbaseret provision forbudt i dk fra Spilpakke 1 [F]; affiliate-forbud i fi [F]' },
  soeg: { id: 'soeg', navn: 'Søgning', cac: 1200, risiko: 'lav', aggressiv: false, fraAar: 2012, maetning: 0.12, hype: 0, note: '–' },
  tv: { id: 'tv', navn: 'Tv', cac: 2500, risiko: 'middel-høj', aggressiv: true, fraAar: 2012, maetning: 1.0, hype: 6, note: 'Whistle-to-whistle i dk fra 2026 [F]' },
  sponsorat: { id: 'sponsorat', navn: 'Sponsorat', cac: 3000, risiko: 'middel', aggressiv: false, fraAar: 2012, maetning: 0.8, hype: 10, note: 'Giver brandkendskab' },
  sociale: { id: 'sociale', navn: 'Sociale medier', cac: 1000, risiko: 'middel', aggressiv: false, fraAar: 2012, maetning: 0.15, hype: 2, note: '–' },
  streamere: { id: 'streamere', navn: 'Streamere', cac: 800, risiko: 'høj', aggressiv: true, fraAar: 2016, maetning: 0.1, hype: 3, note: 'Regulering af gamefluencere [F]' },
  crm: { id: 'crm', navn: 'CRM', cac: null, risiko: 'lav', aggressiv: false, fraAar: 2012, maetning: 0.1, hype: 0, note: 'Fastholdelse: sænker churn' },
  aiAgentApi: { id: 'aiAgentApi', navn: 'Agent-API', cac: 400, risiko: 'lav', aggressiv: false, fraAar: 2028, maetning: 0.3, hype: 0, note: 'Fra 2028, kræver dataejerskab ≥ 0,6' },
};

export const CHANNEL_IDS = Object.keys(CHANNELS) as AcqChannel[];
/** CAC ganges med (1 + andel² · 3) [spec 7.10] */
export const CAC_ANDEL_FAKTOR = 3;
/** CRM: maksimal churn-reduktion og mætning [D] */
export const CRM_MAX_CHURN_REDUKTION = 0.35;
