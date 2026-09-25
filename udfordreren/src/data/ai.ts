// AI-akten 2026-2035 (spec 6.16, 7.13, 7.14). Alle tal er [D — spekulation] medmindre andet er angivet.
import type { AgentFunktion, AiScenarieId, Phase, PlatformKind, Role, Vertical, WorldAssessment, WorldScenario } from '../sim/types';
import { ugeFor } from '../sim/time';

export type AgentDef = {
  id: AgentFunktion;
  navn: string;
  beskrivelse: string;
  kapacitet: number;
  compute2026: number; // mio. kr. pr. uge
  fejl: [number, number]; // fejlrate ved overvågning 0 → 1
  /** Hvilken platforms dataejerskab effekten skaleres med ('snit' = gennemsnit) */
  data: PlatformKind | 'snit';
  /** Point-vægt pr. projektfase (agenten kan tildeles faser) */
  faser?: Partial<Record<Phase, number>>;
  vertikal?: Vertical;
  /** Rollen, agenten kan erstatte ved AI-transformation */
  erstatter?: Role;
};

export const AGENTER: Record<AgentFunktion, AgentDef> = {
  trading: {
    id: 'trading', navn: 'Trading-agent', beskrivelse: 'Prissætter odds i realtid på micro- og livemarkeder. Højere betting-BSI pr. kunde.',
    kapacitet: 3, compute2026: 0.15, fejl: [0.06, 0.01], data: 'sportsbook', faser: { design: 0.6, teknik: 0.8 }, vertikal: 'betting', erstatter: 'oddssaetter',
  },
  indhold: {
    id: 'indhold', navn: 'Indholdsagent', beskrivelse: 'Laver kasinoindhold næsten gratis. Lavere indholdsomkostninger, og den kan arbejde på kasinoprojekter.',
    kapacitet: 5, compute2026: 0.08, fejl: [0.04, 0.01], data: 'kasinoplatform', faser: { koncept: 0.7, design: 0.9 }, vertikal: 'kasino', erstatter: 'kasinodesigner',
  },
  kundeservice: {
    id: 'kundeservice', navn: 'Kundeservice-agent', beskrivelse: 'Svarer kunderne døgnet rundt. Lavere churn.',
    kapacitet: 8, compute2026: 0.05, fejl: [0.08, 0.01], data: 'kontoplatform', erstatter: 'kundeservice',
  },
  crm: {
    id: 'crm', navn: 'CRM-agent', beskrivelse: 'Personlige beskeder og tilbud. Lavere churn og lidt højere BSI pr. kunde.',
    kapacitet: 4, compute2026: 0.06, fejl: [0.05, 0.01], data: 'kontoplatform', erstatter: 'marketing',
  },
  risiko: {
    id: 'risiko', navn: 'Risikoagent', beskrivelse: 'Finder tidlige tegn på problemspil. Byen bliver grønnere, og tilsynet stoler mere på jer. Opfylder AI-risikokrav.',
    kapacitet: 3, compute2026: 0.07, fejl: [0.05, 0.005], data: 'kontoplatform', // erstatter ingen: risikodetektion er et bevidst valg
  },
  compliance: {
    id: 'compliance', navn: 'Compliance-agent', beskrivelse: 'Tjekker KYC og markedsføring. Bedre tilsynstillid, men kræver mennesker ved roret for fuld effekt.',
    kapacitet: 2, compute2026: 0.07, fejl: [0.07, 0.01], data: 'kontoplatform',
  },
  udvikling: {
    id: 'udvikling', navn: 'Udviklingsagent', beskrivelse: 'Skriver og tester kode. Kan tildeles teknik- og testfaser.',
    kapacitet: 4, compute2026: 0.12, fejl: [0.06, 0.01], data: 'snit', faser: { design: 0.3, teknik: 1, test: 0.8 }, erstatter: 'udvikler',
  },
};

export const AGENT_IDS = Object.keys(AGENTER) as AgentFunktion[];

export const AI = {
  computeFaldPrAar: 0.3,
  minData: 0.3, // dataejerskab under dette giver ingen effekt
  opstart: 0.3, // mio. kr. pr. ny agent
  maxAgenterBasis: 3,
  maxPrAiIngenioer: 2,
  maxMedOrkestrering: 4,
  /** Point pr. kapacitetsenhed pr. uge i en projektfase (før fasevægt og data) */
  pointPrKapacitet: 11,
  /** Ugentlig uheldsrisiko = fejlrate × denne faktor */
  uheldFaktor: 0.2, // [D] ca. 0,4-0,6 uheld om året pr. agent med lav overvågning, 0,1 med fuld
  /** Overvågning koster 0,1 medarbejder pr. agent pr. 0,1 (spec 7.13) → løn = overvågning × snitløn */
  overvaagningLoen: 1,
  // Effekter pr. kapacitetsenhed ved dataejerskab 1
  effekt: {
    tradingArpu: 0.03, // betting-ARPU pr. kapacitet (maks 0,15)
    indholdPct: 0.02, // aggregator-andel pr. kapacitet (maks 0,08 af 0,12)
    kundeserviceChurn: 0.015, // pr. kapacitet (maks 0,15)
    crmChurn: 0.01, // pr. kapacitet (maks 0,1)
    crmArpu: 0.008,
    risikoBeskyttelse: 0.25, // pr. kapacitet × overvågning
    complianceTillid: 0.6, // pr. kapacitet pr. kvartal (maks +2)
  },
  /** Effekt af risiko/compliance-agenter: kræver mennesker ved roret (compliance-medarbejdere) for fuld effekt */
  menneskeligtTilsyn: { uden: 0.5 },
};

// ---------- Verdensbilledet 2026 (spec 7.14) ----------

export const VERDENSSCENARIER: { id: WorldScenario; navn: string; sandsynlighed: number; tekst: string; effekt: string }[] = [
  {
    id: 'afgiftsvinter', navn: 'Afgiftsvinteren', sandsynlighed: 0.5,
    tekst: 'Statskasserne i Europa er pressede, og spilafgifterne er et nemt sted at hente penge.',
    effekt: 'Afgiftsstigninger i mindst tre europæiske markeder inden 2030, lavere kanalisering, konsolidering og mere offshore.',
  },
  {
    id: 'kanaliseringensTilbagetog', navn: 'Kanaliseringens tilbagetog', sandsynlighed: 0.25,
    tekst: 'For mange spillere er flygtet offshore. Politikerne lemper for at få dem tilbage.',
    effekt: 'Holland og Tyskland lemper i 2027-29, Sverige differentierer afgiften, og de legale markeder vokser 5-8 % om året.',
  },
  {
    id: 'pmOmvaeltning', navn: 'Prediction market-omvæltningen', sandsynlighed: 0.2,
    tekst: 'Event-kontrakter på sport vokser hurtigere end nogen havde regnet med.',
    effekt: 'Den amerikanske højesteret giver den føderale råvaretilsynsmyndighed eneret (2027-28). Statsafgifterne udhules, og I kan søge børslicens i USA.',
  },
  {
    id: 'denHaardeHaand', navn: 'Den hårde hånd', sandsynlighed: 0.15,
    tekst: 'En stor skandale vender stemningen mod hele branchen.',
    effekt: 'Totalt reklameforbud, AI-risikoscoring som krav og affordability i Norden. Markedet falder 10-15 %, og statsselskaberne vinder andele.',
  },
];

export const VERDENSVURDERINGER: { id: WorldAssessment; navn: string; sandsynlighed: number; tekst: string; uger: [number, number] }[] = [
  { id: 'norgeAabner', navn: 'Norge åbner', sandsynlighed: 0.25, tekst: 'Norge indfører et licenssystem inden 2035.', uger: [ugeFor(2029, 0), ugeFor(2034, 0)] },
  { id: 'euHarmonisering', navn: 'EU-harmonisering', sandsynlighed: 0.1, tekst: 'EU indfører fælles regler for onlinespil.', uger: [ugeFor(2030, 0), ugeFor(2033, 0)] },
  { id: 'sverigeSaenker', navn: 'Sverige sænker afgiften', sandsynlighed: 0.3, tekst: 'Sverige sænker spilafgiften efter valget i 2026.', uger: [ugeFor(2027, 0), ugeFor(2027, 26)] },
];

// ---------- AI-scenarier (spec 6.16) ----------

export const AI_SCENARIER: { id: AiScenarieId; navn: string; fraAar: number; vaekstPrAar: number; mekanik: string; vinder: string; taber: string }[] = [
  { id: 'agentOekonomi', navn: 'Agent-økonomien', fraAar: 2028, vaekstPrAar: 0.2, mekanik: 'Kundernes egne AI-agenter shopper odds og bonusser.', vinder: 'Agent-API, skarpe priser og tillid.', taber: 'Lukket platform: andelen svinder.' },
  { id: 'aiTrading', navn: 'AI-trading', fraAar: 2026, vaekstPrAar: 0.2, mekanik: 'Marginerne flytter til micro- og livemarkeder (+10 % live-omsætning).', vinder: 'Egen sportsbook og AI-ingeniører.', taber: 'Afhængighed af turnkey.' },
  { id: 'aiIndhold', navn: 'AI-indhold', fraAar: 2026, vaekstPrAar: 0.25, mekanik: 'Kasinoindhold er næsten gratis at lave.', vinder: 'Brand og kuratering.', taber: 'Mængde uden kvalitet: Spillerforum straffer.' },
  { id: 'hyperpersonalisering', navn: 'Hyperpersonalisering', fraAar: 2026, vaekstPrAar: 0, mekanik: '+5-10 % BSI pr. kunde for dem, der går først. Kopieres efter 12 måneder.', vinder: 'Kombineret med risikodetektion og høj overvågning.', taber: 'Byen bliver rød: sanktioner og regler.' },
  { id: 'ansvarligAi', navn: 'Ansvarlig AI som krav', fraAar: 2028, vaekstPrAar: 0.15, mekanik: 'Tilsynene kræver AI-risikodetektion (70 % sandsynligt i mindst to nordiske markeder omkring 2029).', vinder: 'Tidligt investeret: forspring.', taber: 'Sent: påbud overalt.' },
  { id: 'predictionMarkets', navn: 'Prediction markets', fraAar: 2026, vaekstPrAar: 0.15, mekanik: 'Event-kontrakter tager sportsomsætning i USA.', vinder: 'Reguleret variant, hvor det er lovligt.', taber: 'Sports-BSI −5 til −15 % i USA.' },
  { id: 'aiNative', navn: 'AI-native-bølgen', fraAar: 2028, vaekstPrAar: 0.2, mekanik: 'Agentix går ind overalt, billigt og hurtigt.', vinder: 'AI-transformation eller B2B-pivot.', taber: 'Tung organisation: marginerne kollapser.' },
];

export const AI_SCENARIE_BY_ID = Object.fromEntries(AI_SCENARIER.map((x) => [x.id, x])) as Record<AiScenarieId, (typeof AI_SCENARIER)[number]>;

/** Størrelser for AI-scenariernes mekanik [D] */
export const AI_EFFEKT = {
  agentOekonomiMargin: 0.12, // ARPU-pres ved styrke 1 uden agent-API
  agentOekonomiChurnLukket: 0.3, // ekstra churn ved lukket kontoplatform
  agentApiTilgang: 0.25, // ekstra tilgang ved agent-API
  aiTradingLive: 0.1, // live-omsætning
  aiTradingVinder: 0.08, // betting-ARPU for egen/hybrid sportsbook + trading-agent
  aiTradingTaber: 0.05, // betting-ARPU-tab ved white-label/turnkey
  aiIndholdStraf: 1, // Spillerforum-point pr. AI-slot ud over 3 på et år
  hyperArpu: [0.05, 0.1] as const, // førstebevæger
  hyperKopiUger: 52,
  hyperEfterKopi: 0.4, // andel af fordelen, der er tilbage efter kopien
  ansvarligAiChance: 0.7,
  ansvarligAiTillid: -5, // pr. kvartal i markeder med kravet uden risikoagent (overvågning ≥ 0,6)
  predictionSport: [0.05, 0.15] as const, // sports-BSI-tab i us
  aiNativeMargin: 0.12, // ARPU-pres ved styrke 1 for en tung organisation
  aiNativeMarketing: 1, // Agentix' marketing × (1 + styrke)
};

/** AI-transformation (spec 6.16): erstat stillinger med agenter [D] */
export const TRANSFORMATION = {
  andele: [0.25, 0.5] as const,
  indsigtTab: 3, // pr. erstattet medarbejder × niveau/5
  omdoemme: -6,
  fratraedelseUger: 12, // løn i fratrædelse
  overvaagning: 0.5, // standardovervågning for de nye agenter
};

/** Børslicens i USA (kun med prediction market-omvæltningen) */
export const BOERSLICENS = { gebyr: 8, uger: 26, afgift: 0.02 };
