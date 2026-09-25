// Forskningstræ. Koster indsigt og tid; giver features og bonusser [D].
import type { Vertical } from '../sim/types';

export type ResearchNode = {
  id: string;
  navn: string;
  beskrivelse: string;
  indsigt: number;
  uger: number;
  fraAar: number;
  kraever: string[];
  vertikal?: Vertical;
  /** Feature-tag, som nye produkter får (bruges til kopiregler R3) */
  feature?: string;
  effekt: {
    paramBonus?: Partial<Record<'spaending' | 'originalitet' | 'teknik' | 'tryghed', number>>; // multiplikator-tillæg på point
    fejl?: number; // multiplikator-tillæg på fejl (negativ = færre)
    churn?: number;
    cac?: number;
    arpu?: number;
    indsigt?: number; // tillæg på indsigt-indtjening
    boost?: number; // tillæg på boost-effekt
    tillid?: number; // tilsynstillid pr. kvartal
    by?: number; // beskyttelse i spillerbyen (færre glider over i risiko/problem, flere kommer tilbage)
  };
  /** Låser op for en AI-agentfunktion, hyperpersonalisering eller agent-API (fase 5) */
  laaser?: 'trading' | 'indhold' | 'risiko' | 'hyper' | 'agentApi' | 'orkestrering';
};

export const RESEARCH: ResearchNode[] = [
  { id: 'mobilApp', navn: 'Mobil-app', beskrivelse: 'Produkter på telefonen. Flere kunder pr. krone.', indsigt: 8, uger: 4, fraAar: 2012, kraever: [], feature: 'mobil', effekt: { cac: -0.08 } },
  { id: 'fejlsporing', navn: 'Fejlsporing', beskrivelse: 'Automatiske tests. Færre fejl i teknikfasen.', indsigt: 10, uger: 4, fraAar: 2012, kraever: [], effekt: { fejl: -0.2 } },
  { id: 'cashout', navn: 'Cash out', beskrivelse: 'Kunden kan lukke sit spil før tid.', indsigt: 12, uger: 6, fraAar: 2013, kraever: ['mobilApp'], vertikal: 'betting', feature: 'cashout', effekt: { paramBonus: { spaending: 0.12 } } },
  { id: 'kasinoLobby', navn: 'Kasinolobby 2.0', beskrivelse: 'Personlige anbefalinger af spil.', indsigt: 12, uger: 6, fraAar: 2013, kraever: ['mobilApp'], vertikal: 'kasino', feature: 'lobby', effekt: { paramBonus: { spaending: 0.08, originalitet: 0.06 } } },
  { id: 'abTest', navn: 'A/B-test', beskrivelse: 'Boosts virker 25 % bedre.', indsigt: 10, uger: 4, fraAar: 2013, kraever: [], effekt: { boost: 0.25 } },
  { id: 'ansvarligtSpil1', navn: 'Ansvarligt spil', beskrivelse: 'Indbetalingsgrænser og pauser. Mere tryghed og tillid.', indsigt: 10, uger: 5, fraAar: 2012, kraever: [], feature: 'ansvar', effekt: { paramBonus: { tryghed: 0.1 }, tillid: 0.4, by: 0.15 } },
  { id: 'crmMotor', navn: 'CRM-motor', beskrivelse: 'Segmenteret kommunikation. Lavere churn.', indsigt: 14, uger: 6, fraAar: 2013, kraever: ['mobilApp'], effekt: { churn: -0.08 } },
  { id: 'dataplatform', navn: 'Dataplatform', beskrivelse: 'Mere indsigt fra alt, I laver.', indsigt: 16, uger: 8, fraAar: 2014, kraever: ['fejlsporing'], effekt: { indsigt: 0.25 } },
  { id: 'streaming', navn: 'Livestreaming', beskrivelse: 'Se kampen, mens du spiller.', indsigt: 18, uger: 8, fraAar: 2014, kraever: ['cashout'], vertikal: 'betting', feature: 'streaming', effekt: { paramBonus: { spaending: 0.1, teknik: 0.05 } } },
  { id: 'oddsModel', navn: 'Kvantitativ oddsmodel', beskrivelse: 'Skarpere priser og færre fejl i odds.', indsigt: 16, uger: 8, fraAar: 2014, kraever: ['dataplatform'], vertikal: 'betting', effekt: { paramBonus: { teknik: 0.1 }, arpu: 0.03 } },
  { id: 'gamification', navn: 'Gamification', beskrivelse: 'Missioner og badges i kasinoet.', indsigt: 16, uger: 8, fraAar: 2015, kraever: ['kasinoLobby'], vertikal: 'kasino', feature: 'gamification', effekt: { paramBonus: { spaending: 0.1, originalitet: 0.08 } } },
  { id: 'ansvarligtSpil2', navn: 'Adfærdsovervågning', beskrivelse: 'Tidlige tegn på problemspil fanges.', indsigt: 18, uger: 8, fraAar: 2016, kraever: ['ansvarligtSpil1', 'dataplatform'], feature: 'adfaerd', effekt: { paramBonus: { tryghed: 0.12 }, tillid: 0.4, by: 0.25 } },
  { id: 'personalisering', navn: 'Personalisering', beskrivelse: 'Forsider og tilbud tilpasset den enkelte.', indsigt: 22, uger: 10, fraAar: 2017, kraever: ['crmMotor', 'dataplatform'], feature: 'personalisering', effekt: { arpu: 0.04, churn: -0.05 } },
  // --- Ansvarsforskning (fase 5): koster lidt BSI fra de dyreste kunder, men byen og tilsynet takker ---
  { id: 'tidligIntervention', navn: 'Tidlig intervention', beskrivelse: 'Kundeservice ringer, før det går galt. Flere kommer tilbage fra gul.', indsigt: 20, uger: 8, fraAar: 2019, kraever: ['ansvarligtSpil2'], feature: 'intervention', effekt: { tillid: 0.4, by: 0.25, arpu: -0.01 } },
  { id: 'affordabilityTjek', navn: 'Affordability-tjek', beskrivelse: 'Økonomiske tjek af de største kunder. Færre bliver røde, men VIP-indtjeningen falder.', indsigt: 24, uger: 10, fraAar: 2021, kraever: ['tidligIntervention'], feature: 'affordability', effekt: { tillid: 0.4, by: 0.2, arpu: -0.02 } },
  // --- AI-laboratoriet (fra 2026) ---
  { id: 'aiRisikodetektion', navn: 'AI-risikodetektion', beskrivelse: 'Låser op for risikoagenten. Opfylder kommende AI-krav.', indsigt: 26, uger: 8, fraAar: 2026, kraever: ['ansvarligtSpil2', 'dataplatform'], feature: 'aiRisiko', effekt: { tillid: 0.3 }, laaser: 'risiko' },
  { id: 'aiTrading', navn: 'AI-trading', beskrivelse: 'Låser op for trading-agenten: odds i realtid på micro-markeder.', indsigt: 26, uger: 8, fraAar: 2026, kraever: ['oddsModel'], vertikal: 'betting', feature: 'aiTrading', effekt: { paramBonus: { teknik: 0.06 } }, laaser: 'trading' },
  { id: 'aiIndholdsmotor', navn: 'AI-indholdsmotor', beskrivelse: 'Låser op for indholdsagenten: kasinoindhold næsten gratis.', indsigt: 24, uger: 8, fraAar: 2026, kraever: ['kasinoLobby'], vertikal: 'kasino', feature: 'aiIndhold', effekt: { paramBonus: { originalitet: 0.04 } }, laaser: 'indhold' },
  { id: 'agentOrkestrering', navn: 'Agent-orkestrering', beskrivelse: 'Fire ekstra pladser til agenter.', indsigt: 30, uger: 10, fraAar: 2027, kraever: ['dataplatform'], effekt: {}, laaser: 'orkestrering' },
  { id: 'hyperpersonalisering', navn: 'Hyperpersonalisering', beskrivelse: 'AI skræddersyr hvert tilbud og hver besked. +5-10 % BSI pr. kunde for dem, der går først. Byen mærker det.', indsigt: 28, uger: 10, fraAar: 2026, kraever: ['personalisering'], feature: 'aiPersonalisering', effekt: {}, laaser: 'hyper' },
  { id: 'agentApi', navn: 'Agent-API', beskrivelse: 'Kundernes egne AI-agenter kan handle direkte hos jer. Åbner kanalen Agent-API.', indsigt: 26, uger: 8, fraAar: 2028, kraever: ['dataplatform'], feature: 'agentApi', effekt: { cac: -0.03 }, laaser: 'agentApi' },
];

export const RESEARCH_BY_ID: Record<string, ResearchNode> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));
