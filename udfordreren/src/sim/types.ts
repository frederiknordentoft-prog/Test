// Nøglekontrakter (spec afsnit 5) + de udvidelser, fase 1-2 kræver.
// Udvidelser er markeret med `// +` og er logget i DECISIONS.md.
// Filen er ren TS: ingen runtime-kode, ingen React.

export type Week = number; // 0..1247 (uge 0 = første uge af 2012)
export type MioKr = number; // mio. kr. i faste 2025-priser

export type Vertical = 'betting' | 'kasino';
export type ProductTypeId =
  | 'prematch'
  | 'livebetting'
  | 'betBuilder'
  | 'esport'
  | 'eventKontrakter'
  | 'slotsAggregator'
  | 'egneSlots'
  | 'livekasino'
  | 'jackpotNetvaerk'
  | 'aiSlots';
export type ThemeId =
  | 'fodbold'
  | 'haandbold'
  | 'tennis'
  | 'esport'
  | 'formel'
  | 'eventyr'
  | 'nordisk'
  | 'retro'
  | 'jul'
  | 'rigdom'
  | 'popkultur'
  | 'natur'
  | 'mytologi'
  | 'sci-fi';
export type MarketId = 'dk' | 'uk' | 'se' | 'de' | 'nl' | 'on' | 'us' | 'fi' | 'no';
export type AcqChannel = 'affiliate' | 'soeg' | 'tv' | 'sponsorat' | 'sociale' | 'streamere' | 'crm' | 'aiAgentApi';

export type Role =
  | 'oddssaetter'
  | 'udvikler'
  | 'kasinodesigner'
  | 'marketing'
  | 'compliance'
  | 'analytiker'
  | 'kundeservice'
  | 'aiIngenioer';
export type StatKey = 'kreativitet' | 'teknik' | 'matematik' | 'salg' | 'ansvar' | 'udholdenhed';
export type Stats = Record<StatKey, number>;

export type Staff = {
  id: string;
  navn: string;
  rolle: Role;
  niveau: number; // 1..10
  erfaring: number; // xp mod næste niveau
  stats: Stats;
  loenPrUge: MioKr;
  energi: number; // 0..100
  ansatUge: Week;
  stifter?: boolean;
  specialisering?: 'crm'; // + marketing → CRM-specialist (stat-bonus)
  udseende: number; // + kosmetisk seed til pixelfiguren
};

export type Phase = 'koncept' | 'design' | 'teknik' | 'test';
export const PHASES: readonly Phase[] = ['koncept', 'design', 'teknik', 'test'] as const;
export type ParamKey = 'spaending' | 'originalitet' | 'teknik' | 'tryghed';
export type Params = Record<ParamKey, number>;
export const PARAM_KEYS: readonly ParamKey[] = ['spaending', 'originalitet', 'teknik', 'tryghed'] as const;

export type Project = {
  id: string;
  navn: string;
  typeId: ProductTypeId;
  themeId: ThemeId;
  markeder: MarketId[];
  margin: number;
  intensitet: 1 | 2 | 3 | 4 | 5;
  budget: MioKr;
  fase: Phase;
  faseTildeling: Record<Phase, string[]>; // staff/agent-id'er pr. fase
  params: Params;
  fejl: number;
  boostBrugt: number;
  startUge: Week;
  efterfoelgerAf?: string;
  // +
  faseUge: number; // uger brugt i nuværende fase
  faseLaengde: Record<Phase, number>; // planlagt længde pr. fase (test kan forlænges)
  klar: boolean; // test er færdig, venter på lancering
  features: string[]; // forskningsfeatures, der bygges ind
  foersteForsoeg: boolean; // kombinationen var ikke prøvet, da projektet startede
};

export type ReviewerId = 'branchebladet' | 'tilsynet' | 'forbrugerposten' | 'spillerforum';
export type Review = { anmelder: ReviewerId; score: number; citat: string };

export type LiveProduct = {
  id: string;
  navn: string;
  ejer: 'spiller' | string; // competitorId
  typeId: ProductTypeId;
  themeId: ThemeId;
  markeder: MarketId[];
  margin: number;
  intensitet: 1 | 2 | 3 | 4 | 5;
  kvalitet: number; // 0..1
  lanceretUge: Week;
  anmeldelser: Review[];
  total40: number;
  guldkupon: boolean;
  hallOfFame: boolean;
  bsiPrUge: Partial<Record<MarketId, MioKr>>;
  samletBsi: MioKr;
  aktiv: boolean;
  features: string[]; // fx 'cashout','streaming','aiPersonalisering' — til kopiregler
  // +
  params?: Params; // kun spillerens produkter
  fejl: number; // fejl ved lancering
  version: number; // 1 = original, 2 = 2.0 osv.
  efterfoelgerAf?: string;
  bedstePlacering: Partial<Record<MarketId, number>>;
  ugerITop10: number;
  pensioneretUge?: Week;
  /** Ugens nye spillere pr. marked — det, hitlisten rangerer efter (som ugens salg i Game Dev Story) */
  nyeSpillerePrUge?: Partial<Record<MarketId, number>>;
  hitlisteTal?: Partial<Record<MarketId, number>>; // + glidende gennemsnit af nye spillere (hitlistens rangering)
  /** Lanceringsbølge: spillere, der endnu ikke er kommet ind (frigives ca. halvdelen pr. uge) */
  ventendeSpillere?: Partial<Record<MarketId, number>>;
};

export type ChartEntry = { productId: string; placering: number; forrige: number | null; ny: boolean };

export type LicenseStatus = 'ingen' | 'ansoegt' | 'aktiv' | 'suspenderet' | 'inddraget';

export type VerticalLicense = { status: 'ingen' | 'ansoegt' | 'aktiv'; klarUge: Week | null }; // +

export type MarketState = {
  id: MarketId;
  aaben: boolean;
  licens: LicenseStatus; // markedslicensens samlede status (sanktioner rammer hele markedet)
  afgift: number; // aktuel sats (eller 'indsats'-model for de)
  afgiftPrVertikal: Record<Vertical, number>; // + UK beskatter kasino og betting forskelligt
  strenghed: number; // 0..5 — bonus, grænser, reklame, KYC
  kanalisering: number; // 0..1 pr. vertikal gennemsnit
  offshore: Record<Vertical, number>;
  tilsynstillid: number; // 0..100, spillerens
  politiskPres: number; // 0..5, udløser regler efter forsinkelse
  andele: Record<string, number>; // 'spiller' | competitorId | 'offshore'
  kunder: number;
  top10: ChartEntry[];
  // +
  vertikaler: Record<Vertical, VerticalLicense>; // tilladelse pr. vertikal
  spillerKunder: Record<Vertical, number>;
  markedsBsiPrUge: Record<Vertical, MioKr>; // hele markedets licenserede online-BSI denne uge
  spillerBsiPrUge: Record<Vertical, MioKr>;
  // + fase 3: regulering, blokering, sanktioner
  regler: string[]; // aktive regel-id'er (historiske og dynamiske)
  blokering: { dns: Week | null; betaling: Week | null; leverandoer: boolean };
  selvudelukkede: number; // 0..1 indeks (fx ROFUS)
  sanktion: { trin: 0 | 1 | 2 | 3 | 4; sidsteUge: Week | null; roligeKvartaler: number };
  suspenderetTil: Week | null;
  lavKanaliseringUger: number; // uger i træk under kanaliseringsmålet (R11)
  offshoreBrandBsiPrUge: MioKr; // spillerens grå BSI via offshore-brand i markedet
  afgiftTillaeg: number; // procentpoint fra dynamiske afgiftsregler
  presLog?: { uge: Week; kilde: string; delta: number }[]; // + hvor det politiske pres kom fra (seneste 6)
  aabnetUge: Week | null; // hvornår markedet åbnede (for spilleren)
};

export type TrendEffect = {
  bettingBsi?: number; // multiplikator-tillæg på markedets betting-BSI (fx 0,25 = +25 %)
  kasinoBsi?: number;
  offshorePp?: number; // procentpoint på offshore-andelen
  marketingRoi?: number; // tillæg på marketingeffekt (fx −0,1)
  afgiftRisiko?: number; // tillæg på sandsynligheden for afgiftsstigninger (R10)
};

export type ReaktionsRegel = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12';

/** En aktiv konkurrentreaktion (spec 7.6) med synlig effekt og udløb */
export type AktivReaktion = {
  id: string;
  regel: ReaktionsRegel;
  competitorId?: string;
  marked?: MarketId;
  startUge: Week;
  slutUge: Week;
  effekt: { marketingMult?: number; cacSpiller?: number; aggressivitet?: number };
  tekst: string;
};

export type Opkoebstilbud = { competitorId: string; pris: MioKr; udloeberUge: Week; markedsandel: number };
export type Sponsorat = { id: string; navn: string; marked: MarketId; ejer: string; slutUge: Week; bud: MioKr };
export type SponsorAuktion = { id: string; navn: string; marked: MarketId; afgoeresUge: Week; mindstebud: MioKr; spillerBud: MioKr | null; varighedUger: number };

export type AktivTrend = { id: string; startUge: Week; slutUge: Week; markeder: MarketId[] | 'alle'; effekt: TrendEffect; titel: string }; // +

export type CompetitorArchetype =
  | 'globalGigant'
  | 'nordiskLicensgruppe'
  | 'statsselskab'
  | 'lokalSpecialist'
  | 'appFirst'
  | 'b2bBygget'
  | 'offshore'
  | 'predictionMarket'
  | 'aiNative';

export type Competitor = {
  id: string;
  navn: string;
  arketype: CompetitorArchetype;
  arkivId?: string;
  markeder: MarketId[];
  vertikaler: Vertical[];
  styrke: number;
  aggressivitet: number;
  innovation: number;
  opkoebslyst: number;
  compliance: number; // 1..5
  marketingMultiplikator: number; // ændres af reaktionsregler
  tilstede: boolean;
  ejetAf?: string; // efter opkøb
  cooldowns: Record<string, Week>;
  // +
  farve: string; // monogramfarve
  monogram: string; // 1-3 tegn
  naesteLanceringUge: Week;
  sidsteHandling: string;
};

export type PlatformKind = 'kontoplatform' | 'sportsbook' | 'kasinoplatform';
export type PlatformModel = 'whiteLabel' | 'turnkey' | 'hybrid' | 'egen';
export type Platform = {
  kind: PlatformKind;
  model: PlatformModel;
  kvalitet: number;
  migreringFaerdigUge: Week | null;
  dataejerskab: number;
  b2bKunder: number;
  migrererTil: PlatformModel | null; // + mål for igangværende migrering
  migreringStartUge: Week | null; // +
  sidsteB2bUge: Week | null; // +
};

export type AgentFunktion = 'trading' | 'indhold' | 'kundeservice' | 'crm' | 'risiko' | 'compliance' | 'udvikling';
export type AiAgent = {
  id: string;
  funktion: AgentFunktion;
  kapacitet: number;
  computePrUge: MioKr;
  fejlrate: number;
  overvaagning: number;
  navn?: string; // + visningsnavn (fx "Agent Tre")
  startUge?: Week; // +
  uheld?: number; // + antal AI-uheld
};

export type TownProfile = 'rekreativ' | 'engageret' | 'vip' | 'risiko' | 'problem' | 'churnet';
export type TownPerson = {
  id: number;
  x: number;
  y: number;
  profil: TownProfile;
  vaerdi: number;
  eksponering: number;
  marked: MarketId;
};

export type WorldScenario = 'afgiftsvinter' | 'kanaliseringensTilbagetog' | 'pmOmvaeltning' | 'denHaardeHaand';
/** Øvrige vurderinger i verdensbilledet 2026 (spec 7.14) */
export type WorldAssessment = 'norgeAabner' | 'euHarmonisering' | 'sverigeSaenker';
export type AiScenarieId = 'agentOekonomi' | 'aiTrading' | 'aiIndhold' | 'hyperpersonalisering' | 'ansvarligAi' | 'predictionMarkets' | 'aiNative';
/** Planlagt verdenshændelse (fra scenarier og vurderinger) */
export type VerdensHaendelse = { id: string; uge: Week; udfoert: boolean };
export type TidslinjePunkt = { uge: Week; tekst: string; kind: 'produkt' | 'marked' | 'firma' | 'pris' | 'ai' | 'verden' | 'krise' };
export type ByHistorie = { uge: Week; tekst: string; profil: TownProfile; marked: MarketId };

export type OfficeTier = 'garage' | 'kaelder' | 'kontor' | 'etage' | 'hovedkontor';

export type FundingRound = 'ingen' | 'angel' | 'seed' | 'serieA' | 'serieB' | 'vaekst';

export type ContractOffer = {
  // +
  id: string;
  skabelonId: string;
  navn: string;
  kunde: string;
  rolle: Role; // foretrukken rolle (giver bonus)
  stat: StatKey; // afgørende stat
  uger: number;
  maxStaff: number;
  betaling: MioKr; // basisbetaling ved middel kvalitet
  indsigt: number;
  udloeberUge: Week;
};

export type RunningContract = {
  id: string;
  resterendeUger: number;
  staff: string[];
  // +
  tilbud: ContractOffer;
};

export type QuarterGoal = {
  id: string;
  tekst: string;
  opfyldt: boolean | null;
  // +
  kind: 'lancer' | 'kunder' | 'bsi' | 'top10' | 'tillid' | 'overskud' | 'anmeldelse' | 'guldkupon' | 'kontrakt' | 'projekt';
  maal: number;
};

export type NewsItem = { uge: Week; tekst: string; arkivId?: string; kind?: 'konkurrent' | 'marked' | 'firma' | 'verden' };

export type ExpoBooking = { expoId: string; aar: number; stoerrelse: 1 | 2 | 3 }; // +

export type GalaResult = {
  aar: number;
  vundet: string[];
  // +
  kategorier: { id: string; vinder: string; spillerNomineret: boolean }[];
};

export type PendingEvent = { eventId: string; uge: Week; ctx: Record<string, string | number> }; // +

export type Milestone =
  | 'foersteKontrakt'
  | 'foersteProjekt'
  | 'foersteLancering'
  | 'foersteTop10'
  | 'foersteNr1Dk'
  | 'foersteGuldkupon'
  | 'foersteHallOfFame'
  | 'foersteGallapris'
  | 'andenVertikal'
  | 'foersteRunde'
  | 'kaelder'
  | 'kontor'; // +

export type LedgerWeek = {
  // + ugens regnskab, vises i Firma-panelet
  bsi: MioKr;
  kontrakter: MioKr;
  afgift: MioKr;
  revenueShare: MioKr;
  betalinger: MioKr;
  bonus: MioKr;
  indhold: MioKr;
  marketing: MioKr;
  loen: MioKr;
  licenser: MioKr;
  compute?: MioKr; // + AI-agenternes compute (fra 2026)
  oevrigt: MioKr;
  resultat: MioKr;
};

export type QuarterHistory = {
  // + kvartalsvis historik til grafer og mål
  aar: number;
  kvartal: number;
  bsi: MioKr;
  resultat: MioKr;
  kapital: MioKr;
  kunder: number;
  lanceringer: number;
  bedsteTotal40: number;
  top10: boolean;
};

export type Signal =
  // + kortlivede udfald fra seneste step/handling. UI bruger dem til juice og auto-pause.
  | { k: 'point'; projectId: string; staffId: string; params: Params; fejl: number; fjernet: number }
  | { k: 'fase'; projectId: string; til: Phase; tomtHold?: boolean } // tomtHold: ingen tildelt i den nye fase
  | { k: 'klar'; projectId: string }
  | { k: 'lanceret'; productId: string }
  | { k: 'anmeldelse'; productId: string; foersteForsoeg?: boolean; indsigt?: number }
  | { k: 'guldkupon'; productId: string }
  | { k: 'hallOfFame'; productId: string }
  | { k: 'top10'; productId: string; marked: MarketId; placering: number; foersteGang?: boolean }
  | { k: 'nr1'; productId: string; marked: MarketId }
  | { k: 'ledig'; staffIds: string[]; ingenOpgaver?: boolean } // ingenOpgaver: intet aktivt projekt at gå til
  | { k: 'kontraktFaerdig'; contractId: string; navn: string; betaling: MioKr; indsigt: number }
  | { k: 'licens'; marked: MarketId; vertikal: Vertical }
  | { k: 'niveauOp'; staffId: string; niveau: number }
  | { k: 'typeNiveau'; typeId: ProductTypeId; niveau: number }
  | { k: 'temaNiveau'; themeId: ThemeId; niveau: number }
  | { k: 'messeVarsel'; expoId: string }
  | { k: 'messe'; expoId: string; stoerrelse: 0 | 1 | 2 | 3; hype: number; indsigt: number; kandidater: number; b2b: boolean }
  | { k: 'galla'; aar: number; vundet: string[] }
  | { k: 'kvartal'; aar: number; kvartal: number; opfyldt: number; ialt: number }
  | { k: 'event'; eventId: string }
  | { k: 'forskning'; nodeId: string }
  | { k: 'kontor'; tier: OfficeTier }
  | { k: 'runde'; runde: FundingRound; kapital: MioKr }
  | { k: 'advarsel'; tekst: string }
  | { k: 'fejl'; tekst: string } // afvist handling
  | { k: 'slut'; id: string }
  // + fase 3
  | { k: 'markedAabner'; marked: MarketId }
  | { k: 'regel'; marked: MarketId; regelId: string; varsel: boolean; pp?: number } // pp: afgiftsstigningens størrelse
  | { k: 'afgift'; marked: MarketId; vertikaler: Vertical[]; fra: number; til: number; varsel: boolean; uge: Week } // faste afgiftstrin (spec 6.9); kun når spilleren har licens i markedet
  | { k: 'sanktion'; marked: MarketId; trin: 1 | 2 | 3 | 4; boede?: MioKr }
  | { k: 'trend'; id: string; titel: string }
  // + fase 4
  | { k: 'reaktion'; regel: ReaktionsRegel; tekst: string; competitorId?: string; marked?: MarketId }
  | { k: 'tilbud'; competitorId: string; pris: MioKr }
  | { k: 'sponsorAuktion'; navn: string; marked: MarketId }
  | { k: 'sponsorResultat'; navn: string; marked: MarketId; vinder: string; spillerVandt: boolean }
  | { k: 'platform'; kind: PlatformKind; model: PlatformModel; faerdig: boolean }
  | { k: 'opkoeb'; competitorId: string; pris: MioKr }
  | { k: 'konkurrentNyhed'; tekst: string; arkivId?: string }
  // + fase 5
  | { k: 'aktSkift'; scenarier: WorldScenario[]; vurderinger: WorldAssessment[] }
  | { k: 'verdensNyhed'; id: string; titel: string; tekst: string }
  | { k: 'agent'; agentId: string; funktion: AgentFunktion; handling: 'ny' | 'pensioneret' }
  | { k: 'byhistorie'; tekst: string; profil: TownProfile }
  | { k: 'aiScenarie'; id: AiScenarieId; titel: string }
  | { k: 'transformation'; erstattet: number };

export type GameState = {
  version: 2;
  seed: number;
  rngState: [number, number, number, number];
  uge: Week;
  firmaNavn: string;
  stiftere: string[];
  startVertikal: Vertical;
  kapital: MioKr;
  indsigt: number;
  hype: number; // 0..100
  omdoemme: number; // 0..100
  investorer: {
    runde: string;
    ejerandelStiftere: number;
    pres: number;
    vaerdiansaettelse: MioKr;
    stjerner: number; // +
    rundeUge: Week | null; // + ugen for seneste runde
    vaerdiBonus: number; // + tillæg til værdiansættelse fra gallaer og events
  };
  staff: Staff[];
  kandidater: Staff[];
  agenter: AiAgent[];
  projekter: Project[];
  produkter: LiveProduct[]; // inkl. konkurrenters produkter
  niveauer: { type: Record<ProductTypeId, number>; tema: Record<ThemeId, number> };
  niveauXp: { type: Record<ProductTypeId, number>; tema: Record<ThemeId, number> }; // +
  kombinationsbog: Record<string, { set: boolean; bedste40: number }>;
  platforme: Record<PlatformKind, Platform>;
  markeder: Record<MarketId, MarketState>;
  konkurrenter: Competitor[];
  marketingMix: Record<AcqChannel, MioKr>;
  vipProgram: 0 | 1 | 2 | 3;
  bonusNiveau: 0 | 1 | 2 | 3;
  offshoreBrand: boolean;
  forskning: { ulaast: string[]; igang: { nodeId: string; resterendeUger: number } | null };
  kontor: OfficeTier;
  kontraktopgaver: RunningContract[];
  verdensscenarier: Partial<Record<WorldScenario, number>>;
  aiScenarier: Record<string, number>;
  by: TownPerson[];
  // + fase 5: spillerbyen og AI-akten
  verdensVurderinger: Partial<Record<WorldAssessment, number>>; // uge for udfaldet
  verdensHaendelser: VerdensHaendelse[];
  byHistorier: ByHistorie[]; // seneste 12
  byTaeller: number; // id-tæller for nye bypersoner
  hyperpersonalisering: { aktiv: boolean; startUge: Week | null; foersteUge: Week | null };
  boerslicens: { status: 'ingen' | 'ansoegt' | 'aktiv'; klarUge: Week | null };
  transformation: { uge: Week; erstattet: number }[];
  aiUheld: number;
  // + fase 6: slutninger, eftermæle og Arkivet
  eftermaeleAkk: { tillidSum: number; tillidUger: number; risikoSum: number; risikoProever: number; maxSanktion: number; dkTabt: boolean };
  tidslinje: TidslinjePunkt[];
  byAarlig: { aar: number; rekreativ: number; engageret: number; vip: number; risiko: number; problem: number }[];
  arkiv: string[]; // ulåste arkivopslag
  mode: 'normal' | 'usa2018' | 'aiNative2026';
  galla: GalaResult[];
  kvartalsmaal: QuarterGoal[];
  nyheder: NewsItem[];
  flags: string[];
  eventLog: { uge: Week; eventId: string; valg: number }[];
  planlagteRegler: { marked: MarketId; regelId: string; ikrafttraedelseUge: Week; annonceret?: boolean; dynamisk?: boolean; pp?: number }[];
  trends: AktivTrend[]; // + fase 3
  // + fase 4: levende konkurrenter og platforme
  reaktioner: AktivReaktion[];
  reaktionsTaeller: Record<ReaktionsRegel, number>;
  opkoebstilbud: Opkoebstilbud | null;
  featureFordele: Record<string, { kopier: number; lanceretUge: Week }>;
  planlagteKopier: { feature: string; competitorId: string; marked: MarketId; uge: Week }[];
  andelHistorik: Partial<Record<MarketId, number[]>>; // spillerens andel pr. kvartal (seneste 5)
  afgiftHistorik: Partial<Record<MarketId, number>>; // forrige kvartals afgift (R5)
  aggressionKvartaler: Partial<Record<MarketId, number>>; // R8
  r8Antal: Partial<Record<MarketId, number>>;
  sponsorater: Sponsorat[];
  sponsorAuktion: SponsorAuktion | null;
  konkurrentHistorik: string[]; // udførte historiske konkurrentevents
  b2bIndtaegtPrUge: MioKr;
  historiskeRegler: string[]; // + id'er på historiske regler, der er annonceret eller trådt i kraft
  offshoreBrandStartUge: Week | null; // + fase 3
  slut: { id: string; vaerdi: MioKr; eftermaele: number; stifterVaerdi?: MioKr; uge?: Week } | null;
  // +
  kontraktTilbud: ContractOffer[];
  messeBookinger: ExpoBooking[];
  ventendeEvents: PendingEvent[];
  signaler: Signal[];
  milepaele: Partial<Record<Milestone, Week>>;
  regnskab: LedgerWeek; // seneste uge
  historik: QuarterHistory[];
  kvartalAkk: { bsi: MioKr; resultat: MioKr; lanceringer: number; bedsteTotal40: number; startKunder: number; startBsi: MioKr; drift?: MioKr; top10Uger?: number };
  /** Seneste kvartalsmødes evaluerede mål (til kvartalsdialogen) */
  forrigeKvartalsmaal?: QuarterGoal[];
  aarAkk: {
    aar: number;
    nyeKombinationer: number;
    nyeFeatures: number;
    lanceringer: number;
    bedsteTotal40: number;
    startKunder: number;
    tillidSum: number;
    tillidUger: number;
  };
  negativUger: number; // uger i træk med negativ kapital
  engangsUge: MioKr; // engangsudgifter fra handlinger siden sidste step (til regnskabet)
  travleSidst: string[]; // staff-id'er, der arbejdede sidste uge (til 'ledig'-signal)
  bsiHistorik: MioKr[]; // spillerens samlede BSI pr. uge, seneste 13 uger
  holdFaktor: Partial<Record<MarketId, Record<Vertical, number>>>; // ugens hold-varians pr. marked
  naesteId: number; // id-tæller (deterministisk)
  mentor: 'aktiv' | 'sprunget' | 'faerdig';
};

export type Action =
  | { t: 'hire'; kandidatId: string }
  | { t: 'fire'; staffId: string }
  | { t: 'postJobAd'; niveau: 1 | 2 | 3 }
  | { t: 'train'; staffId: string; stat: keyof Stats }
  | { t: 'changeRole'; staffId: string; nyRolle: Role }
  | {
      t: 'startProject';
      project: Pick<Project, 'navn' | 'typeId' | 'themeId' | 'markeder' | 'margin' | 'intensitet' | 'budget' | 'efterfoelgerAf'>;
    }
  | { t: 'assignPhase'; projectId: string; fase: Phase; ids: string[] }
  | { t: 'boost'; projectId: string; param: keyof Params }
  | { t: 'extendTest'; projectId: string; uger: number }
  | { t: 'launch'; projectId: string }
  | { t: 'adjustProduct'; productId: string; margin?: number; intensitet?: 1 | 2 | 3 | 4 | 5 }
  | { t: 'retireProduct'; productId: string }
  | { t: 'takeContract'; contractId: string; staff: string[] }
  | { t: 'setMarketing'; channel: AcqChannel; prUge: MioKr }
  | { t: 'launchCampaign'; productId: string; budget: MioKr }
  | { t: 'setVip'; niveau: 0 | 1 | 2 | 3 }
  | { t: 'setBonus'; niveau: 0 | 1 | 2 | 3 }
  | { t: 'applyLicense'; market: MarketId; vertical: Vertical }
  | { t: 'choosePlatform'; kind: Platform['kind']; model: Platform['model'] }
  | { t: 'sellPlatformB2B'; kind: Platform['kind'] }
  | { t: 'bookExpoStand'; expoId: string; stoerrelse: 1 | 2 | 3 }
  | { t: 'raiseRound' }
  | { t: 'acceptOffer'; competitorId: string }
  | { t: 'acquire'; competitorId: string }
  | { t: 'deployAgent'; funktion: AiAgent['funktion']; overvaagning: number }
  | { t: 'retireAgent'; agentId: string }
  | { t: 'startResearch'; nodeId: string }
  | { t: 'upgradeOffice' }
  | { t: 'eventChoice'; eventId: string; valg: number }
  // + ikke i spec-listen, men nødvendige for fase 1-2
  | { t: 'cancelProject'; projectId: string }
  | { t: 'setMentor'; status: 'aktiv' | 'sprunget' | 'faerdig' }
  | { t: 'setOffshoreBrand'; aktiv: boolean }
  | { t: 'afvisTilbud' }
  | { t: 'bydSponsorat'; bud: MioKr }
  // + fase 5
  | { t: 'setOvervaagning'; agentId: string; overvaagning: number }
  | { t: 'setHyperpersonalisering'; aktiv: boolean }
  | { t: 'aiTransformation'; andel: number }
  | { t: 'applyBoersLicens' };

export type NewGameOptions = {
  seed: number;
  firmaNavn: string;
  stiftere: [string, string]; // founder-id'er
  startVertikal: Vertical;
  tutorial: boolean;
  /** New Game+ (spec 6.17): startmode og arv fra tidligere spil */
  mode?: 'normal' | 'usa2018' | 'aiNative2026';
  arv?: NewGamePlusArv;
};

/** Det, der bevares i New Game+: kombinationsbogen og niveauerne */
export type NewGamePlusArv = {
  kombinationsbog: Record<string, { set: boolean; bedste40: number }>;
  niveauer: { type: Record<ProductTypeId, number>; tema: Record<ThemeId, number> };
  niveauXp: { type: Record<ProductTypeId, number>; tema: Record<ThemeId, number> };
};
