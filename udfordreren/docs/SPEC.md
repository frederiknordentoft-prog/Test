# Build: Spilhuset: Udfordreren — komplet autonom spec (v2)

> **Til Claude Code:** Denne fil er både arbejdsordre og designgrundlag. Læs den helt, før du laver første commit. Byg derefter fase for fase, indtil Definition of Done er grøn.
>
> Tal i datatabellerne er startværdier til balancering og markeret:
> - **[F]**: fakta fra research
> - **[A]**: afledt af fakta, fx valutaomregnet
> - **[D]**: designestimat
>
> Bevar markeringerne som kommentarer i `src/data/`. Valutaomregning [A]: 1 EUR = 7,46 kr., 1 GBP = 8,6 kr., 1 USD = 6,9 kr., 1 SEK = 0,66 kr., 1 CAD = 5,0 kr.

---

## 1. Rolle og standard

Du er principal full-stack engineer og en erfaren tycoon-spildesigner, der kender Kairosofts **Game Dev Story** indgående.

Byg spillet fra ende til anden og uden opsyn, i produktionskvalitet. Stop aldrig op for at spørge. Tag den bedste beslutning, log den i `DECISIONS.md`, og fortsæt, indtil Definition of Done er opfyldt og verificeret.

Grøn build er et minimumskrav. Målet er et spil, der **føles som Game Dev Story**, er sjovt i 2-3 timer og er realistisk nok til, at folk fra spilbranchen genkender markeder, konkurrenter og regulering.

---

## 2. Mål, designsøjler og Game Dev Story-kontrakten

### Mål

Spilleren starter i **2012**, lige efter den danske liberalisering [F], som et **tomandsfirma i en garage** i Danmark.

- Man vælger at starte med **sportsbetting eller online kasino** og tilføjer den anden vertikal senere.
- Firmaet vokser gennem produkter, licenser, platformvalg og udlandsmarkeder.
- Undervejs kommer regulering, konkurrenter, offshore-pres, trends og konsolidering.
- Spillet slutter med **AI-æraen 2026-2035**, som er hovedakten.

Målgruppen er kolleger i en dansk spilvirksomhed. Spillet skal underholde og inspirere, og det må aldrig moralisere.

### Game Dev Story-kontrakten (ufravigelig)

Spillet skal kunne genkendes som Game Dev Story i struktur og rytme. Hver række herunder skal implementeres:

| Game Dev Story | Udfordreren |
|---|---|
| Garagekontor, der vokser i trin | Garage → kælder → kontor → etage → hovedkontor (pixelkontor, man ser folk arbejde) |
| Genre × type, "First try", niveauer, der stiger med brug | Produkttype × tema. "Første forsøg". Type- og temaniveau 1-10 stiger med brug og giver bonus |
| Udviklingsfaser med point-bobler over medarbejderne | Faser **Koncept → Design → Teknik → Test**, hvor tildelte medarbejdere sender point-bobler op |
| Parametre Fun/Creativity/Graphics/Sound + bugs | **Spænding / Originalitet / Teknik / Tryghed** + **Fejl**, der skal testes væk |
| Research data til boost og træning | **Indsigt** (tjenes ved lancering, messer og kontraktopgaver), bruges på boost, træning og forskning |
| 4 anmeldere, total /40, Hall of Fame | 4 anmeldere, total /40, **Guldkuponen** ved ≥32, **Hall of Fame** ved ≥36 |
| Ugentlig salgshitliste (Top 10) | **Ugentlig Top 10 pr. marked** med egne *og* konkurrenters produkter, pile op/ned og "NY!" |
| Konsoller med licensgebyr, markedsandel og livscyklus | **Markeder som konsoller**: licensgebyr, markedsstørrelse, afgift, strenghed og kanalisering |
| Egen konsol sent i spillet | **Egen platform**, som kan sælges B2B |
| Fans og hype | **Kunder** fordelt på segmenter + **Hype** før lancering |
| Kontraktarbejde for penge tidligt | **Kontraktopgaver** i garagen (odds-feed til lokalklub, bannere til affiliate osv.) |
| Messer (Gamedex) | **Branchemesser** (London-messen i februar, Sportsmessen i efteråret) med stande, der giver hype og indsigt |
| Global Game Awards | **Branchegallaen** i december med kategorier |
| Ansættelse via annoncer, jobskifte | Jobannoncer i tre prisniveauer, **rolleskift** (fx udvikler → AI-ingeniør fra 2026) |
| Efterfølgere | **2.0-versioner** af succesprodukter: bonus, men straf ved for tidlig relancering |
| Parodinavne på virkelige konsoller | **Parodinavne på virkelige konkurrenter** (se 6.8), genkendelige men ikke identiske |

### Designsøjler

1. **Korte, overlappende loops.** Der er altid et produkt tæt på lancering, en messe eller gallaen i sigte, og en hitliste, der skal toppes.
2. **Opdagelse.** Kombinationsbogen, nye markeder og rolleskift giver hele tiden noget at afdække.
3. **Synlige afvejninger.** Tilsynstillid, kanalisering og spillerbyens helbred kan altid ses og forklares. Der er ingen skjulte straffe.
4. **Verden som modvægt.** Afgifter, regulering, offshore og konkurrenter bremser runaway-vækst.
5. **Levende konkurrenter.** De lancerer produkter, kopierer dine, starter bonuskrige, byder på dig og forlader markeder, alt sammen efter synlige regler.
6. **Inspiration uden prædiken.** Arkivet viser virkeligheden, og eftertanke-skærmen viser, hvor din vej afveg.

---

## 3. Definition of Done (eksekverbar — kørslen er ikke færdig, før ALT er grønt)

**Kodekvalitet og build**
- [ ] `npm run typecheck` (strict) giver nul fejl, og `npm run lint` er grøn.
- [ ] `npm run build` lykkes.

**Unit tests (`npm run test`, Vitest)**
- [ ] Determinisme: samme seed og samme beslutninger giver identisk state-hash ved slut (kørt to gange).
- [ ] Save → load giver identisk hash.
- [ ] Der er unit tests for:
  - projektfaser, point og fejl
  - anmeldelser og Guldkuponen
  - type- og temaniveauer
  - hitlisten
  - kundeøkonomien (CAC, churn, BSI, hold-varians)
  - afgifter og strenghed pr. marked over tid
  - offshore-modellen
  - hver konkurrent-reaktionsregel (7.6)
  - dynamisk regulering (7.7)
  - tilsynstillid og sanktioner
  - platformmigrering
  - finansiering og opkøbstilbud
  - AI-agenter
  - verdensscenarie-trækning
  - slutninger

**Balancering**
- [ ] `npm run sim` (200 seeds pr. bot) består alle assertions i afsnit 8, også markedskalibrering og Game Dev Story-rytme.

**End-to-end (`npm run e2e`, Playwright)**
- [ ] Nyt spil → vælg stiftere og vertikal → tutorial → første produkt lanceret med anmeldelse inden for 90 sek.
- [ ] Tag en kontraktopgave → ansæt → produktet ses i Top 10.
- [ ] Debug-hop til 2016 → messe → tilføj anden vertikal.
- [ ] Debug-hop til 2019 → gå ind i Sverige.
- [ ] Debug-hop til 2026 → verdensscenarie vises → sæt en AI-agent i drift.
- [ ] Debug-hop til 2035 → slutskærm og eftertanke.
- [ ] Reload midt i spillet.

**Manuel afprøvning**
- [ ] Følgende flows virker på laptop (1440 px), iPad (1024 px) og mobil (390 px):
  - udviklingsfaser med boost
  - test og fejl
  - lancering og anmeldelse
  - hitliste
  - markedskort
  - konkurrentoversigt og nyhedsticker
  - messe og gala
  - rolleskift
  - platformvalg
  - finansiering
  - event med valg
  - AI-laboratoriet
  - Arkivet
  - gem og indlæs, eksport og import
  - 1x/2x/4x, pause og reduceret bevægelse

**Levering**
- [ ] Installerbar PWA, der virker offline.
- [ ] Rigtige firmanavne findes kun i `src/data/archive.ts` (grep-tjek, afsnit 12).
- [ ] `README.md`, `DECISIONS.md` og `sim/report.md` er skrevet.

---

## 4. Arkitektur (låst — må ikke besluttes om)

**Stack og kerne**
- **Stack:** Vite + React + TypeScript (strict) + Tailwind + Zustand + Dexie som PWA (vite-plugin-pwa). Vitest og Playwright.
- **Ren sim-kerne:** `src/sim/` er ren TS uden React-imports. `step(state, actions): GameState` er ren og deterministisk. UI sender `Action`s og læser snapshots.
- **RNG:** Én seeded `sfc32` i `src/sim/rng.ts`. Aldrig `Math.random()` i `src/sim/`. Kosmetisk tilfældighed bruger en separat RNG.

**Tid og penge**
- **Tid:** 1 tick = 1 uge. Uge 0 er første uge af 2012, og uge 1247 er udgangen af 2035.
- **Tempo:**
  - 1x = 3 sek./uge i 2012-2025 og **6 sek./uge fra 2026**.
  - 2x, 4x og pause.
  - Auto-pause ved events, faseskift, lancering, anmeldelse, ledige medarbejdere, messe, gala, kvartalsmøde og markedsåbning.
- **Penge:** mio. kr. i faste 2025-priser.

**Rendering, data og persistens**
- **Rendering:** Pixelkontoret, spillerbyen og markedskortet tegnes på `<canvas>` med procedural pixel-art (320×180, nearest-neighbor). rAF-loopet læser snapshots, og React ejer paneler og dialoger.
- **Datadrevet:** Alt, der kan tunes, ligger i typede tabeller i `src/data/`.
- **Persistens:** Dexie med `saves` (3 slots + autosave hvert kvartal) og `settings`. Eksport og import som JSON.

**Hosting og layout**
- **Hosting:** statisk, med `netlify.toml`. Ingen backend, login eller analytics.
- **Layout:** Laptop og iPad i landskab er primære. Mobil i portræt stakker kontoret øverst og faner nederst. Touch-mål på mindst 44 px.

**Mappestruktur:**
```
src/sim/     step.ts rng.ts hash.ts projects.ts reviews.ts charts.ts levels.ts
             customers.ts economy.ts markets.ts regulation.ts offshore.ts
             competitors.ts reactions.ts trends.ts trust.ts investors.ts
             platforms.ts staff.ts insight.ts contracts.ts expos.ts gala.ts
             aiAgents.ts aiEra.ts worldScenario.ts town.ts events.ts endings.ts
src/data/    verticals.ts productTypes.ts themes.ts compatibility.ts roles.ts
             founders.ts research.ts markets.ts marketCurves.ts regulationTimeline.ts
             competitors.ts competitorEvents.ts reactionRules.ts offshore.ts
             trends.ts acquisition.ts costs.ts platforms.ts funding.ts trust.ts
             aiAgents.ts aiScenarios.ts worldScenarios.ts contracts.ts expos.ts
             galaCategories.ts reviewers.ts names.ts events.ts archive.ts
src/render/  office.ts town.ts marketMap.ts palette.ts particles.ts actChrome.ts
src/audio/   sfx.ts music.ts
src/ui/      screens/ panels/ dialogs/ components/
src/store/   gameStore.ts persistence.ts
sim/         runner.ts bots/ assertions.ts
tests/       unit/ e2e/
```

---

## 5. Nøglekontrakter

```ts
type Week = number;   // 0..1247
type MioKr = number;

type Vertical = 'betting' | 'kasino';
type ProductTypeId =
  | 'prematch' | 'livebetting' | 'betBuilder' | 'esport' | 'eventKontrakter'
  | 'slotsAggregator' | 'egneSlots' | 'livekasino' | 'jackpotNetvaerk' | 'aiSlots';
type ThemeId =
  | 'fodbold' | 'haandbold' | 'tennis' | 'esport' | 'formel' | 'eventyr' | 'nordisk'
  | 'retro' | 'jul' | 'rigdom' | 'popkultur' | 'natur' | 'mytologi' | 'sci-fi';
type MarketId = 'dk' | 'uk' | 'se' | 'de' | 'nl' | 'on' | 'us' | 'fi' | 'no';
type AcqChannel = 'affiliate' | 'soeg' | 'tv' | 'sponsorat' | 'sociale' | 'streamere' | 'crm' | 'aiAgentApi';

type Role =
  | 'oddssaetter' | 'udvikler' | 'kasinodesigner' | 'marketing' | 'compliance'
  | 'analytiker' | 'kundeservice' | 'aiIngenioer';
type Stats = { kreativitet: number; teknik: number; matematik: number; salg: number; ansvar: number; udholdenhed: number };

type Staff = {
  id: string; navn: string; rolle: Role; niveau: number; erfaring: number; stats: Stats;
  loenPrUge: MioKr; energi: number; ansatUge: Week; stifter?: boolean;
};

type Phase = 'koncept' | 'design' | 'teknik' | 'test';
type Params = { spaending: number; originalitet: number; teknik: number; tryghed: number };

type Project = {
  id: string; navn: string; typeId: ProductTypeId; themeId: ThemeId; markeder: MarketId[];
  margin: number; intensitet: 1 | 2 | 3 | 4 | 5; budget: MioKr;
  fase: Phase; faseTildeling: Record<Phase, string[]>;   // staff/agent-id'er pr. fase
  params: Params; fejl: number; boostBrugt: number;
  startUge: Week; efterfoelgerAf?: string;
};

type Review = { anmelder: 'branchebladet' | 'tilsynet' | 'forbrugerposten' | 'spillerforum'; score: number; citat: string };

type LiveProduct = {
  id: string; navn: string; ejer: 'spiller' | string;  // competitorId
  typeId: ProductTypeId; themeId: ThemeId; markeder: MarketId[];
  margin: number; intensitet: 1 | 2 | 3 | 4 | 5; kvalitet: number; lanceretUge: Week;
  anmeldelser: Review[]; total40: number; guldkupon: boolean; hallOfFame: boolean;
  bsiPrUge: Record<MarketId, MioKr>; samletBsi: MioKr; aktiv: boolean;
  features: string[];                  // fx 'cashout','streaming','aiPersonalisering' — til kopiregler
};

type ChartEntry = { productId: string; placering: number; forrige: number | null; ny: boolean };

type MarketState = {
  id: MarketId; aaben: boolean;
  licens: 'ingen' | 'ansoegt' | 'aktiv' | 'suspenderet' | 'inddraget';
  afgift: number;              // aktuel sats (eller 'indsats'-model for de)
  strenghed: number;           // 0..5 — bonus, grænser, reklame, KYC
  kanalisering: number;        // 0..1 pr. vertikal gennemsnit
  offshore: Record<Vertical, number>;
  tilsynstillid: number;       // 0..100, spillerens
  politiskPres: number;        // 0..5, udløser regler efter forsinkelse
  andele: Record<string, number>; // 'spiller' | competitorId | 'offshore'
  kunder: number; top10: ChartEntry[];
};

type CompetitorArchetype = 'globalGigant' | 'nordiskLicensgruppe' | 'statsselskab' | 'lokalSpecialist'
  | 'appFirst' | 'b2bBygget' | 'offshore' | 'predictionMarket' | 'aiNative';

type Competitor = {
  id: string; navn: string; arketype: CompetitorArchetype; arkivId?: string;
  markeder: MarketId[]; vertikaler: Vertical[];
  styrke: number; aggressivitet: number; innovation: number; opkoebslyst: number; compliance: number; // 1..5
  marketingMultiplikator: number;     // ændres af reaktionsregler
  tilstede: boolean; ejetAf?: string; // efter opkøb
  cooldowns: Record<string, Week>;
};

type Platform = {
  kind: 'kontoplatform' | 'sportsbook' | 'kasinoplatform';
  model: 'whiteLabel' | 'turnkey' | 'hybrid' | 'egen'; kvalitet: number;
  migreringFaerdigUge: Week | null; dataejerskab: number; b2bKunder: number;
};

type AiAgent = {
  id: string; funktion: 'trading' | 'indhold' | 'kundeservice' | 'crm' | 'risiko' | 'compliance' | 'udvikling';
  kapacitet: number; computePrUge: MioKr; fejlrate: number; overvaagning: number;
};

type TownProfile = 'rekreativ' | 'engageret' | 'vip' | 'risiko' | 'problem' | 'churnet';
type TownPerson = { id: number; x: number; y: number; profil: TownProfile; vaerdi: number; eksponering: number; marked: MarketId };

type WorldScenario = 'afgiftsvinter' | 'kanaliseringensTilbagetog' | 'pmRevolution' | 'denHaardeHaand';

type GameState = {
  version: 2; seed: number; rngState: [number, number, number, number]; uge: Week;
  firmaNavn: string; stiftere: string[]; startVertikal: Vertical;
  kapital: MioKr; indsigt: number; hype: number; omdoemme: number;
  investorer: { runde: string; ejerandelStiftere: number; pres: number; vaerdiansaettelse: MioKr };
  staff: Staff[]; kandidater: Staff[]; agenter: AiAgent[];
  projekter: Project[]; produkter: LiveProduct[];   // inkl. konkurrenters produkter
  niveauer: { type: Record<ProductTypeId, number>; tema: Record<ThemeId, number> };
  kombinationsbog: Record<string, { set: boolean; bedste40: number }>;
  platforme: Record<Platform['kind'], Platform>;
  markeder: Record<MarketId, MarketState>;
  konkurrenter: Competitor[];
  marketingMix: Record<AcqChannel, MioKr>;
  vipProgram: 0 | 1 | 2 | 3; bonusNiveau: 0 | 1 | 2 | 3; offshoreBrand: boolean;
  forskning: { ulaast: string[]; igang: { nodeId: string; resterendeUger: number } | null };
  kontor: 'garage' | 'kaelder' | 'kontor' | 'etage' | 'hovedkontor';
  kontraktopgaver: { id: string; resterendeUger: number; staff: string[] }[];
  verdensscenarier: Partial<Record<WorldScenario, number>>;
  aiScenarier: Record<string, number>;
  by: TownPerson[];
  galla: { aar: number; vundet: string[] }[];
  kvartalsmaal: { id: string; tekst: string; opfyldt: boolean | null }[];
  nyheder: { uge: Week; tekst: string; arkivId?: string }[];
  flags: string[]; eventLog: { uge: Week; eventId: string; valg: number }[];
  planlagteRegler: { marked: MarketId; regelId: string; ikrafttraedelseUge: Week }[];
  slut: { id: string; vaerdi: MioKr; eftermaele: number } | null;
};

type Action =
  | { t: 'hire'; kandidatId: string } | { t: 'fire'; staffId: string }
  | { t: 'postJobAd'; niveau: 1 | 2 | 3 } | { t: 'train'; staffId: string; stat: keyof Stats }
  | { t: 'changeRole'; staffId: string; nyRolle: Role }
  | { t: 'startProject'; project: Pick<Project, 'navn' | 'typeId' | 'themeId' | 'markeder' | 'margin' | 'intensitet' | 'budget' | 'efterfoelgerAf'> }
  | { t: 'assignPhase'; projectId: string; fase: Phase; ids: string[] }
  | { t: 'boost'; projectId: string; param: keyof Params } | { t: 'extendTest'; projectId: string; uger: number }
  | { t: 'launch'; projectId: string } | { t: 'adjustProduct'; productId: string; margin?: number; intensitet?: 1 | 2 | 3 | 4 | 5 }
  | { t: 'retireProduct'; productId: string }
  | { t: 'takeContract'; contractId: string; staff: string[] }
  | { t: 'setMarketing'; channel: AcqChannel; prUge: MioKr } | { t: 'launchCampaign'; productId: string; budget: MioKr }
  | { t: 'setVip'; niveau: 0 | 1 | 2 | 3 } | { t: 'setBonus'; niveau: 0 | 1 | 2 | 3 }
  | { t: 'applyLicense'; market: MarketId; vertical: Vertical }
  | { t: 'choosePlatform'; kind: Platform['kind']; model: Platform['model'] } | { t: 'sellPlatformB2B'; kind: Platform['kind'] }
  | { t: 'bookExpoStand'; expoId: string; stoerrelse: 1 | 2 | 3 }
  | { t: 'raiseRound' } | { t: 'acceptOffer'; competitorId: string } | { t: 'acquire'; competitorId: string }
  | { t: 'deployAgent'; funktion: AiAgent['funktion']; overvaagning: number } | { t: 'retireAgent'; agentId: string }
  | { t: 'startResearch'; nodeId: string } | { t: 'upgradeOffice' }
  | { t: 'eventChoice'; eventId: string; valg: number };
```

---

## 6. Spildesign

### 6.1 De første 90 sekunder

1. **Titelskærm:** "Garagespil ApS" (navnet kan ændres). Vælg 2 af 4 stiftere: Oddssætteren, Udvikleren, Kasinodesigneren, Markedsføreren.
2. **Vælg vertikal:**
   - **Betting:** hurtigere produkter og svingende indtjening.
   - **Kasino:** stabil indtjening, dyrere kunder og højere risiko.
3. **Rammer:** Man starter med 2 mio. kr. [D], white-label-platform og en dansk licens i ansøgning (12 uger [D]).
4. **Mentor:** En garvet brancheveteran guider i tre trin. Første trin er at tage en kontraktopgave, mens licensen behandles. Derefter starter man det første produkt og ser boblerne stige. Til sidst lancerer man og får sin første anmeldelse.

Tutorialen kan springes over.

### 6.2 Kerneloop: udviklingsfaser (Game Dev Story-hjertet)

- **Nyt produkt:**
  - Man vælger type × tema × markeder, margin (inden for markedsinterval), intensitet og budget.
  - Man kan lave en **2.0-version** af et eksisterende produkt: +20 % start-params, men −30 % hvis det sker under 52 uger efter originalen [D, inspireret af Game Dev Tycoons sequel-regel].
- **Faser og varighed:** Koncept (2 uger) → Design (3-6) → Teknik (3-6) → Test (1-4, kan forlænges). Til hver fase tildeles medarbejdere (og fra 2026 agenter).

  | Fase | Relevante stats | Påvirker primært |
  |---|---|---|
  | Koncept | kreativitet | originalitet |
  | Design | kreativitet + matematik | spænding + originalitet |
  | Teknik | teknik | teknik |
  | Test | teknik + ansvar | fjerner fejl, giver tryghed |

- **Point-bobler:** Der kommer løbende bobler over hver tildelt person med tal for de fire parametre. Tallene afhænger af stats, energi og type-/temaniveau.
- **Fejl:** Opstår i Teknik (flere ved lav teknik eller lav energi). Test fjerner dem. Lanceres der med fejl, giver det dårligere score hos Tilsynet og risiko for et hændelses-event (forkerte odds, betalingsnedbrud).
- **Boost:** Man kan bruge **Indsigt** på et boost (+X på én parameter), højst 3 pr. projekt [D].
- **Lancering:** Hype og markeder giver startkunder.

### 6.3 Anmeldelser, hitliste og priser

- **Anmeldelser:** 4 anmeldere giver hver 1-10 (total /40) med korte citater og fanfare.

  | Anmelder | Vægter |
  |---|---|
  | Branchebladet | teknik + originalitet |
  | Tilsynet | tryghed, −intensitet, −risiko |
  | Forbrugerposten | værdi (lav margin) + tryghed |
  | Spillerforum | spænding + fit |

- **Scoreberegning:** Den afhænger af de fire parametre sammenlignet med **markedets nuværende standard** (stiger med årstallet og med konkurrenternes bedste produkter). Den afhænger *ikke* af spillerens egen tidligere topscore, for Game Dev Tycoons selv-rubberband føles som straf.
- **Guldkuponen og Hall of Fame:**
  - Guldkuponen gives ved total ≥32. Den giver ekstra hype og indsigt.
  - Hall of Fame gives ved ≥36. Den giver en permanent bonus til type- og temaniveau.
- **Ugentlig Top 10 pr. marked:**
  - Listen viser både egne produkter og konkurrenters produkter med parodinavne, pile og "NY!".
  - At nå **nr. 1 i Danmark** første gang er et fejret øjeblik med konfetti og en Arkiv-oplåsning.
- **Kombinationsbog:**
  - Type × tema står som "Første forsøg", indtil kombinationen er prøvet. Derefter vises vurderingen: Ikke godt / OK / Godt / Fremragende / Genialt.
  - Eksempler: Livebetting × Fodbold = Genialt, Egne slots × Nordisk = Fremragende, Esport × Esport = Godt, Prematch × Formel = OK, Livekasino × Retro = Ikke godt.
  - **Type- og temaniveau** stiger med brug, præcis som genre-niveauer i Game Dev Story.

### 6.4 Kunder og økonomi

- **Kunder:** De kommer ind via marketingkanaler med CAC (7.10) og via hype, anmeldelser og hitlisteplacering. CAC stiger med mætning og med konkurrenternes marketingtryk (reaktionsregler).
- **BSI pr. aktiv kunde:** Den afhænger af vertikal, produktmiks, margin og intensitet.
  - **Betting:** Den ugentlige hold trækkes fra en fordeling, der giver "favoritsejre-uger". Et eksempel: det danske bettingmarked faldt 46 % år-over-år i oktober 2025 [F].
  - **Kasino:** Mere stabil. Kombispil/bet builders holder 18-25 % mod 5-6 % på 1X2 [F].
- **Churn:** Falder med kvalitet, CRM og tillid. Stiger med høj margin og fejl.
- **Kryds-salg:** Når den anden vertikal lanceres, får man adgang til eksisterende kunder med lav CAC.
- **Omkostninger:** afgift pr. marked, revenue share, betalinger, marketing, bonus, løn, licensgebyrer og compute (fra 2026).

### 6.5 Medarbejdere, indsigt og kontor

- **Jobannoncer i tre niveauer:** billig portal, branchenetværk og headhunter. Højere niveau giver bedre kandidater og koster mere.
- **Medarbejdere:** De har stats, niveau, erfaring og energi. Energien falder under projekter og genoprettes i pauser. Træning koster penge og indsigt.
- **Rolleskift** (Game Dev Storys "job change") kræver et bestemt niveau:
  - udvikler → AI-ingeniør (fra 2026)
  - analytiker → oddssætter
  - kundeservice → compliance
  - marketing → CRM-specialist (en stat-bonus)
- **Kontortrin:**

  | Kontor | Pladser | Krav |
  |---|---|---|
  | Garage | 2 | – |
  | Kælder | 5 | kapital |
  | Kontor | 10 | kapital og en Guldkupon |
  | Etage | 18 | kapital og en licens uden for Danmark |
  | Hovedkontor | 30 | kapital |

- **Indsigt:** Tjenes ved lanceringer (mere ved høj score), messer, kontraktopgaver og forskning. Bruges på boost, træning og forskning.

### 6.6 Kontraktopgaver (økonomien i garagen)

Hver uge findes 2-3 kontraktopgaver, som giver penge og indsigt, men binder folk i 2-6 uger. Eksempler:
- odds-feed til en lokal håndboldklub
- bannere til en affiliate-side
- slot-matematik til en udenlandsk studio
- QA-test for en platformleverandør

Efter 2016 bliver opgaverne færre og dårligere betalt. I garagen er de livsnødvendige, og senere er de et valg.

### 6.7 Markeder som konsoller

Hvert marked er et **markedskort** med ikon, åbningsår, størrelse, afgift, strenghed (0-5), kanalisering, CAC-faktor, licensgebyr og licenstid (7.2).

- **Adgang:** Man skal have licens pr. marked og pr. vertikal. Norge er lukket og kan kun spilles gråt via offshore-fristelsen.
- **Kortvisning:** Kortet viser en lagkage med markedsandele: spilleren, navngivne konkurrenter og en grå offshore-skive.
- **Lokale krav:**
  - **DE:** Indsatsafgift på 5,3 % og €1.000/måned i grænse, så kasino giver dårlig BSI.
  - **NL:** 37,8 % fra 2026 og stortingsgrænser.
  - **UK:** Remote gaming duty på 40 % fra april 2026.
  - **US:** Delstater åbner i bølger, afgiftsniveauet er højt, og markedet er et duopol. Prediction markets er i angreb.
  - **ON:** Åben model med 20 %.
  - **FI:** Åbner 1. juli 2027 med 22 %.

### 6.8 Konkurrenter: parodinavne og levende adfærd

- **Parodinavne:** Rigtige aktører optræder under **genkendelige parodinavne** i Game Dev Story-stil (Sonny/Intendo-princippet), fx *bet356*, *Unibit*, *Danske Lykke*, *FunDuel*. Den fulde liste står i 7.4. Arkivet fortæller den virkelige historie med rigtige navne.
- **Parametre:** Hver konkurrent har en arketype og parametre på 1-5: styrke, aggressivitet, innovation, opkøbslyst og compliance.
- **Produkter:** Konkurrenterne **lancerer selv produkter** (navn, type, tema, kvalitet) i deres markeder. Kvaliteten følger styrke + innovation + årstal. Produkterne konkurrerer i hitlisten og om kunder.
- **Historiske tiltag:** Fusioner, markedsexits og sponsorater (7.5) sker som nyheder på faste datoer. Hvis spilleren har ændret verden, kan de blive forskudt eller aflyst, fx hvis spilleren selv har købt målet.
- **Reaktionsregler (7.6)** bestemmer, hvordan konkurrenterne reagerer på spilleren: bonuskrig, kopiering, opkøbstilbud, markedsindtog og exit. Hver reaktion vises i nyhedstickeren med en forklaring, så spilleren kan lære mønstrene.
- **Konkurrentpanel:** Viser hver aktørs profil, markeder, bedste produkt og "hvad de gjorde sidst".

### 6.9 Regulering og tilsyn

- **Faste tidslinjer:** Hvert marked har en fast historisk tidslinje for afgifter og regler (7.2 og 7.5), som følger virkeligheden frem til 2026. Ikrafttrædelsen annonceres 6-12 måneder før som nyhed, så spilleren kan forberede sig.
- **Dynamisk regulering (7.7):**
  - `politiskPres` pr. marked stiger ved skandaler, aggressiv branche (inklusive spilleren), prævalensmålinger og medieevents.
  - Ved pres ≥3 planlægges en ny regel, der træder i kraft efter **12-24 måneder** [F-inspireret: det hollandske reklameforbud kom ca. 20 måneder efter åbningen].
  - Lav kanalisering i 2 år kan udløse blokering eller lempelse.
- **Tilsynstillid pr. marked** (0-100, start 70) har en sanktionstrappe: påbud → bøde → gennemgang → inddragelse (7.12).
  - Mister man licensen i DK, koster det −15 i tilsynstillid i alle andre markeder.
  - AI-risikodetektion med høj overvågning halverer risikoen for påbud [D].
- **Fristelser:** VIP-program, bonusniveau, aggressive kanaler og offshore-brand. De skal være reelt fristende.

### 6.10 Offshore

- **Andelen:** Hvert marked har en offshore-andel pr. vertikal efter formlen i 7.8, drevet af afgift, strenghed, bonusforbud, selvudelukkede og licenseret produktkvalitet, og modvirket af blokering og leverandøransvar.
- **Kasino og high-rollers:** Kasino lækker ca. 3x mere end betting [F: Sverige 81 % mod 96 % kanalisering]. High-rollers flytter først, og i NL er 91-94 % af spillerne legale, men kun ca. halvdelen af pengene [F].
- **Synlighed:** Offshore vises som en grå aktør ("Steak.com & co.") i markedsandelene og i nyheder, med streamer-kampagner og krypto-bølger.
- **Offshore-fristelsen:** Spilleren kan starte et **offshore-brand** (Curaçao/krypto). Det giver hurtig BSI, men 10 % risiko pr. år for licenstab i alle regulerede markeder, og det lukker exit via statsselskaber og nordiske grupper [D].

### 6.11 Trends og sportskalender

Trend-events (7.9) hæver eller sænker markederne:
- VM og EM på de rigtige år
- favoritsejre
- covid i 2020
- inflationskrise
- mobil- og live-kasino-bølgen
- krypto-boom og krypto-krak
- streamer-gambling
- sweepstakes i USA
- prediction markets
- mediedebat og dokumentarer om ludomani
- sponsorforbud
- AI-personalisering, micro-betting og kundeagenter

Hvert event har en synlig effekt og varighed, og det står i nyhedstickeren.

### 6.12 Platforme (byg eller køb — spillets rygrad)

| Model | Tid | Revenue share | Capex | Kvalitetsloft | Dataejerskab |
|---|---|---|---|---|---|
| White-label | 0 | 30 % | – | Lavt | 0,1 |
| Turnkey | 6-12 mdr. [D] | 12 % | 15 mio. | 75 | 0,3 |
| Hybrid | 1-2 år | 5 % | 60 mio. | 85 | 0,6 |
| Egen | ca. 3 år [F] | 0 % | 200 mio. | 95 | 1,0 |

Egen platform kan sælges B2B, det er Kombi-vejen [F: sportsbook-platformen blev udskilt i 2014]. Dataejerskab styrer AI-effekten. Et modelskift kræver migrering med en periode med lavere kvalitet og risiko for nedbrud.

### 6.13 Finansiering og opkøb (let system)

- **Runder:** angel → seed → serie A → serie B → vækst (7.11). Hver runde giver kapital, udvander stifterne og hæver kvartalsmålenes vækstkrav.
- **Kvartalsmøde:** Hvert kvartal kommer 2-3 mål. Opfyldte mål giver stjerner og bedre vilkår. Manglende opfyldelse giver **investorpres**, som udløser pres-events.
- **Opkøbstilbud:** De kommer via reaktionsregel R2 (7.6). At acceptere er en gyldig slutning (*Exit*). Man kan også selv opkøbe mindre konkurrenter.

### 6.14 Spillerbyen

200 pixelpersoner repræsenterer spillerens kunder, fordelt på markeder.

**Profiler og ikoner (ikon + farve):**
- **VIP:** guld
- **Risiko:** gul
- **Problem:** rød

**Den centrale pointe:** Guldkunderne er de mest profitable, og mange af dem glider over i gul og rød, når intensitet, VIP og bonus er høje.

**Hvad der flytter folk tilbage:** Beskyttelsesværktøjer. Selvudelukkede forsvinder stille. Byhistorier er korte og respektfulde.

**Kalibrering:** Andelen med mindst lavt problemniveau ligger på 5-15 % [F-inspireret: 5,2 % i 2016 og 10,9 % i 2021 blandt danske voksne].

### 6.15 Messer og Branchegallaen

- **Messer:** London-messen (februar) og Sportsmessen (september). En stand i tre størrelser giver hype, indsigt, kandidater og en chance for B2B-kunder.
- **Branchegallaen (december):** Kategorierne er Årets produkt, Årets innovation, Årets ansvarlige operatør, Årets udfordrer og Årets platform.
  - Vinderen bestemmes af årets resultater mod konkurrenterne.
  - Sejr giver hype, indsigt, investorinteresse og et trofæ på hylden i pixelkontoret.

### 6.16 AI-akten 2026-2035 og verdensscenarier

**Akt-skift ved uge 1 i 2026:**
- Kontoret skifter udtryk, musikken ændres, og **AI-laboratoriet** åbner.
- Seedet trækker **verdensscenarier** (7.14). De kan kombineres og styrer events og kurver resten af spillet. De vises som "Verdensbilledet 2026" med sandsynligheder og forklaring.

**AI-agenter som arbejdskraft (7.13):**
- Agenter tildeles projektfaser og funktioner. De genererer egne point-bobler (glødende terminaler).
- Hver agent har kapacitet, compute (falder hvert år), fejlrate og overvågning.
- Lav overvågning giver AI-uheld.

**AI-produkter og -funktioner** (effekten skalerer med dataejerskab):
- AI-trading
- AI-slots (billige, kort halveringstid)
- AI-kundeservice
- AI-CRM
- AI-risikodetektion
- **Hyperpersonalisering**, den store fristelse

**AI-scenarier** (styrke 0-1; de vokser ud fra verden og spillerens tilstand):

| Scenarie | Mekanik | Vinderstrategi | Taberstrategi |
|---|---|---|---|
| Agent-økonomien (2028+) | Kundernes agenter shopper odds og bonus → marginpres | Agent-API + skarpe priser + tillid | Lukket platform → andelen svinder |
| AI-trading | Marginer flytter til micro- og live-markeder (+10 % live-omsætning [D]) | Egen sportsbook + AI-ingeniører | Turnkey-afhængighed |
| AI-indhold | Kasinoindhold næsten gratis | Brand og kuratering | Mængde uden kvalitet → Spillerforum straffer |
| Hyperpersonalisering | +5-10 % ARPU for førstebevægere, kopieres efter 12 mdr. [D] | Kombineres med risikodetektion og høj overvågning | Byen bliver rød → sanktioner og regler |
| Ansvarlig AI som krav (ca. 2029) | Tilsyn kræver AI-risikodetektion (70 % sandsynligt i ≥2 nordiske markeder [D]) | Tidligt investeret → forspring | Sent → påbud overalt |
| Prediction markets | Event-kontrakter tager sportsomsætning i USA [F: $44-50 mia. i volumen i 2025] | Reguleret variant hvor lovligt | Sports-BSI −5 til −15 % i USA |
| AI-native bølgen | Agentix går ind overalt billigt og hurtigt | AI-transformation eller B2B-pivot | Tung organisation → marginkollaps |

**AI-transformationen:**
- Spilleren kan omstrukturere og erstatte stillinger med agenter.
- Det giver lavere omkostninger, men et omdømme-event og tab af viden.
- Compliance og ansvarligt spil kræver menneskelig overvågning for fuld effekt.

**Tone:** AI fremstilles hverken som frelse eller trussel. Spillet viser begge sider gennem mekanik.

### 6.17 Slutninger, score, eftertanke og New Game+

**Hvornår spillet slutter:** Ved uge 1247 eller tidligere, ved konkurs, ved tabt dansk licens uden andre bærende markeder, eller ved accept af et opkøbstilbud.

**Scoren har to dele:**
- **Selskabsværdi og stifternes andel.**
- **Eftermæle**, som samler:
  - gennemsnitlig tilsynstillid
  - byens sundhed
  - Guldkuponer og Hall of Fame
  - gallapriser
  - innovationer
  - licenseret status

**Mulige slutninger:**
- Exit
- Børsnotering
- Leverandøren (B2B-pivot)
- Den ansvarlige udfordrer
- AI-native leder
- Opkøbt af Danske Lykke
- Tabt licens
- Konkurs

**Slutskærmen** viser:
- en tidslinje over produkter, markeder, runder og valg
- trofæhylden
- byens udvikling

**Eftertanke:** Tre nysgerrige kort viser, hvor din vej afveg fra den virkelige. Hvert kort linker til Arkivet.

**New Game+:** Kombinationsbogen og niveauerne bevares. To modes låses op:
- "2018-start i USA"
- "AI-native fra 2026", hvor man starter med agenter

### 6.18 Arkivet (inspiration fra virkeligheden)

- Arkivet er et opslagsværk, der låses op, når tilknyttede events eller konkurrenter dukker op. Hvert opslag er "I virkeligheden…" på 2-4 sætninger.
- **Arkivet er det eneste sted med rigtige firmanavne.** Lande og myndigheder må gerne være rigtige i hele spillet.
- Tekster skrives **kun** ud fra faktalisten i 7.15. Agenten må aldrig opfinde virkelighedsfakta.
- Arkivet kan slås fra.

### 6.19 Følelse, grafik og lyd

**Juice:**
- point-bobler med easing
- fanfare ved anmeldelser (tallene tælles op en efter en, som i Game Dev Story)
- konfetti ved Guldkupon og nr. 1-placering
- skærmryst ved sanktioner
- squash & stretch på pixelfolk

**Akt-chrome:**
- Garage (2012-14): varm og rodet
- Vækst (2015-25): ren startup-æstetik
- AI-akten (2026+): mørk, glødende og futuristisk; kontoret forvandles synligt

**Grafik:** Al grafik er procedural pixel-art uden eksterne assets og uden emoji i det færdige look. Konkurrenter vises som farvede monogrammer, ikke logoer.

**Lyd:**
- procedurale SFX i sfxr-stil
- chiptune i Tone.js, der skifter pr. akt
- lyd-unlock ved første tryk (iOS)
- separate toggles for lyd og musik

**Tilgængelighed:**
- `prefers-reduced-motion` og manuel toggle
- ikon + farve i markeringer
- justerbar tekststørrelse
- pause ved `visibilitychange`

### 6.20 Debug-menu (`?debug=1`)

- seed
- hop til år
- sæt kapital, indsigt og tillid
- udløs event eller konkurrentreaktion efter id
- åbn marked
- tving verdens- eller AI-scenarie
- tilføj agent
- vis sim-værdier bag hitlisten

---

## 7. Datatabeller (startværdier — tunes af harnesset)

### 7.1 Produkttyper
Margin = 1 − RTP / hold. Risiko 0-10.

| id | Vertikal | År | Margin std (min-max) | Risiko | Halveringstid (uger) | Kilde |
|---|---|---|---|---|---|---|
| prematch | betting | 2012 | 0,07 (0,05-0,10) | 5 | 260 | [F] 1X2 5-6 % |
| livebetting | betting | 2012 | 0,09 (0,07-0,12) | 8 | 260 | [A] |
| betBuilder | betting | 2018 | 0,20 (0,18-0,25) | 8 | 156 | [F] 18-25 % |
| esport | betting | 2016 | 0,08 (0,06-0,12) | 7 | 156 | [D] |
| eventKontrakter | betting | 2025 | 0,04 (0,02-0,05) | 7 | 104 | [D] kun hvor lovligt |
| slotsAggregator | kasino | 2012 | 0,04 (0,03-0,06) | 9 | 20 | [F/A] RTP 94-97 % |
| egneSlots | kasino | 2015 | 0,04 (0,03-0,06) | 9 | 30 | [D] |
| livekasino | kasino | 2014 | 0,02 (0,01-0,03) | 7 | 208 | [F] RTP 97-99 % |
| jackpotNetvaerk | kasino | 2016 | 0,06 (0,04-0,08) | 8 | 104 | [D] |
| aiSlots | kasino | 2026 | 0,04 (0,03-0,06) | 9 | 8 | [D] spekulation |

Oplåsningskrav [D]:
- **Livebetting:** oddssætter niv. 2
- **Bet builder:** oddssætter niv. 4 og analytiker niv. 2
- **Egne slots:** kasinodesigner niv. 3 og hybrid-/egen kasinoplatform
- **AI-slots:** AI-ingeniør niv. 2 og dataejerskab ≥ 0,3

### 7.2 Markeder (konsolkort)

| id | Åbner | Afgift over tid | Strenghed over tid (0-5) | Kanalisering (mål) | CAC-faktor | Licens (gebyr/tid) |
|---|---|---|---|---|---|---|
| dk | 2012-01 | 20 % → 28 % (2021-01) [F] | 2 → 3 (2021) → 4 (Spilpakke 1: 2026-07, dele 2027-01) [F] | ~90 %; 91,5 % i 2024 [F] | 1,0 | 0,5 mio. / 12 uger [D] |
| uk | 2012 | RGD 15 % (2014) → 21 % (2019) → 40 % (2026-04); fjern-betting 15 % → 25 % (2027-04) [F/A] | 2 → 3 (2019) → 4 (slots £5/£2, 2025) → 4,5 (bonus 10x, affordability, 2026) [F] | ~95 % [D] | 1,6 | 1,5 mio. / 26 uger [D] |
| se | 2019-01 | 18 % → 22 % (2024-07) [F] | 3 → 3,5 (kreditforbud 2026) [F] | 86 % (2023) → 84 % (2025); betting 96 %, kasino 81 % [F] | 1,2 | 0,8 mio. / 20 uger [D] |
| de | 2021-07 | 5,3 % af **indsats** (≈ >50 % af BSI på slots) [F] | 5 (€1.000/md., €1/spin, 5-sek.-pause) [F] | Omstridt: 50-97 %; slots ~75 % [F] | 1,3 | 2 mio. / 40 uger [D] |
| nl | 2021-10 | 29 % → 30,5 % → 34,2 % (2025) → 37,8 % (2026) [F] | 3 → 4 (reklameforbud 2023) → 4,5 (grænser 2024-10) [F] | BSR 58 % → 49-53 % [F] | 1,4 | 1,5 mio. / 30 uger [D] |
| on | 2022-04 | 20 % [F] | 2,5 [D] | 86 % → 84 % → 90 %+ [F] | 1,5 | 1 mio. / 26 uger [D] |
| us | 2018-06 (delstater i bølger) | Gennemsnit 15 % → 25 % (2025-26), NY 51 % [F/A] | 2 → 3 (2025) [D] | Sweeps og offshore store [F] | 3,0 | 5 mio. pr. bølge / 40 uger [D] |
| fi | 2027-07 | 22 % [F] | 3,5 (nationalt register, affiliate-forbud, B2B 2028) [F] | <50 % før åbning [F] | 1,1 | €29.000-gebyr ≈ 0,2 mio. + tilsynsgebyr [F/A] |
| no | lukket | – | Blokering: betaling 2010, DNS 2025 [F] | Stor offshore-andel [D] | – | Kun gråt via offshore-brand |

### 7.3 Markedsstørrelse (licenseret online BSI, mia. kr., 2025-priser)

| Marked | 2012 | 2020 | 2025 | 2030 | 2035 | Kilde |
|---|---|---|---|---|---|---|
| dk (kasino / betting online) | 1,8 / 0,9 | 3,2 / 1,5 | 4,3 / 1,7 | 5,0 / 1,7 | 5,5 / 1,6 | [F] 2025 kasino 4,31; [A] resten |
| uk | 30 | 45 | 55 | 55 | 55 | [D] |
| se | – | 10 | 12 | 13 | 13 | [A] ~18 mia. SEK kommerciel online |
| de | – | – | 15 | 17 | 18 | [D] |
| nl | – | – | 9 (+9 offshore) | 9 | 10 | [A] €600 mio./halvår legalt; €1,2 mia. illegalt |
| on | – | – | 20 | 26 | 30 | [A] C$4,0 mia. 2025 |
| us (sport + iCasino) | – | 40 | 116 + 40 | 170 + 70 | 200 + 90 | [A] $16,8 mia. sport 2025; [D] iCasino |
| fi | – | – | – | 7 | 8 | [A] samlet ~€1,5 mia.; online-andel [D] |

Verdensscenarier og trends modificerer tallene. Spillerens realistiske danske andel i 2020 er 3-15 %.

### 7.4 Konkurrenter (parodinavne → arkiv)

Parametre er styrke / aggressivitet / innovation / opkøbslyst / compliance (1-5) [F-baseret vurdering fra research].

| Parodinavn | Arkiv (rigtig) | Arketype | Markeder | S | A | I | O | C |
|---|---|---|---|---|---|---|---|---|
| Danske Lykke (Oddsæt, Lykke Kasino, Haven Kasino) | Danske Spil | statsselskab | dk | 5 | 2 | 2 | 2 | 5 |
| bet356 | bet365 | globalGigant | dk uk se de nl on us | 4-5 | 4 | 4 | 1 | 4 |
| Unibit (Kinfolk Group) | Unibet/Kindred | nordiskLicensgruppe | dk uk se nl fi | 3-4 | 3 | 3 | 3 | 3 |
| Betanu | Betano | appFirst | dk (fra 2023) | 2→4 | 5 | 3 | 2 | 3 |
| LionVegas | LeoVegas | appFirst | dk se uk | 3 | 4 | 4 | 2 | 3 |
| Betssen / NordikBet | Betsson/NordicBet | nordiskLicensgruppe | dk se fi | 3 | 3 | 3 | 4 | 3 |
| Mr Grøn, KomNu, Bet52 | Mr Green, ComeOn, Bet25 | lokalSpecialist | dk se | 2 | 3 | 2 | 1 | 3 |
| Svea Spel | Svenska Spel | statsselskab | se | 5 | 2 | 2 | 1 | 5 |
| ATH | ATG | lokalSpecialist | se | 4 | 2 | 2 | 1 | 5 |
| Flitter (Paddy Flower, Betfare, Skye Bet) | Flutter | globalGigant | uk (og us via FunDuel) | 5 | 4 | 5 | 5 | 3 |
| Entrain (Ladbrooks, Koral, bwon, BetTown) | Entain | globalGigant | uk de nl | 4 | 3 | 3 | 5 | 2 |
| William Hull / evoked | William Hill/evoke | globalGigant (svækket) | uk | 3 | 3 | 2 | 2 | 2 |
| Betfried | Betfred | lokalSpecialist | uk | 3 | 2 | 2 | 1 | 3 |
| Tulipan Kasino / Totto | Holland Casino / Toto | statsselskab | nl | 4 | 2 | 2 | 2 | 5 |
| Jax | Jacks | lokalSpecialist | nl | 3 | 3 | 3 | 2 | 3 |
| Typico | Tipico | lokalSpecialist | de | 4 | 4 | 3 | 2 | 4 |
| Interwette | Interwetten | lokalSpecialist | de | 3 | 3 | 3 | 2 | 3 |
| Veikko | Veikkaus | statsselskab | fi | 5→3 | 3 | 2 | 1 | 5 |
| Norsk Tipp | Norsk Tipping | statsselskab | no | 4 | 1 | 2 | 0 | 5 |
| FunDuel | FanDuel | globalGigant | us on | 5 | 4 | 5 | 4 | 3 |
| DraftQueens | DraftKings | globalGigant/appFirst | us on | 5 | 5 | 5 | 4 | 3 |
| BetMGN, Cæsar, Fanatix, theScoop | BetMGM, Caesars, Fanatics, theScore | globalGigant/appFirst | us on | 2-3 | 3-5 | 3 | 2 | 3 |
| Kalshee, Polymarkt | Kalshi, Polymarket | predictionMarket | us (fra 2025) | 2→4 | 5 | 5 | 2 | 2 |
| Steak.com & co. | Stake / Curaçao-aktører | offshore | alle | 3 | 5 | 4 | 0 | 0 |
| Kombi | Kambi | b2bBygget (leverandør) | – | – | – | 4 | – | 4 |
| Revo Live | Evolution | b2bBygget (leverandør) | – | – | – | 5 | – | 4 |
| Agentix | (fiktiv) | aiNative | alle fra 2028 | 2→4 | 5 | 5 | 3 | 2 |

### 7.5 Historiske tiltag og regler (tidsstemplede events, i spillet med parodinavne)

**2012-2019**
- **2012-01** DK åbner. Unibit køber en dansk bookmaker. Haven Kasino lanceres.
- **2014-06** Kombi udskilles fra Unibit, og B2B-arketypen åbner.
- **2016** Første EM med stort bettingboost (EM 2016).
- **2018-05** USA's højesteret fjerner forbuddet, og delstaterne begynder at åbne.
- **2019-01** Sverige åbner (18 %). UK RGD stiger til 21 %.

**2020-2022**
- **2020-03** Covid stopper sporten i ca. 3 måneder.
- **2020-05** Flitter og Stjernegruppen fusionerer.
- **2020-12** Revo Live køber NetEnd.
- **2021-01** DK-afgiften stiger til 28 %. MGN's bud på Entrain afvises.
- **2021-07** DE-licenssystem.
- **2021-10** NL åbner. DraftQueens trækker sit bud på Entrain.
- **2022-04** Ontario åbner.
- **2022-07** 777 køber William Hull.
- **2022-09** MGN køber LionVegas.

**2023-2025**
- **2023** NL-reklameforbud. Entrain køber BetTown m.fl. Unibit beordres ud af Norge.
- **2024-07** SE-afgiften stiger til 22 %. Illinois-lignende progressiv afgift i US.
- **2024-10** Et fransk statslotteri (FLJ) køber Kinfolk Group. NL-stortingsgrænser.
- **2025**
  - NL 34,2 %
  - UK-slotgrænser
  - Norge indfører DNS-blokering
  - DK B2B-licens
  - Sweepstakes-forbud i flere US-stater
  - Flitter ejer 100 % af FunDuel
  - Betanu overtager Superliga-sponsoratet
  - Spilpakke 1-aftale (oktober)
  - Kalshee-sportskontrakter
- **2025-12** SPN Bet lukker og relanceres som theScoop Bet.

**2026-2028**
- **2026**
  - NL 37,8 %
  - UK 40 % (april)
  - Premier League-lignende forbud mod spilsponsor på brystet (2026/27)
  - DK Spilpakke 1 træder i kraft (juli)
  - SE kreditforbud
  - Kalshee-sagen splitter appeldomstolene (august)
  - SE-valg med afgiftsdebat
- **2027** UK fjern-betting 25 % (april). Finland åbner (juli).
- **2028** FI B2B-licenskrav.

Efter 2026 styres historien af verdensscenarier og reaktionsregler.

### 7.6 Konkurrenternes reaktionsregler (kontrolleres hvert kvartal)

| # | Hvis | Så | Kilde |
|---|---|---|---|
| R1 | Spillerens andel > 5 % i et marked og vækst > 30 %/år | Største globalGigant i markedet: marketing ×1,5 i 4 kvartaler → spillerens CAC +25 % ("bonuskrig") | [D] |
| R2 | Spillerens andel > 8 % og platformmodel hybrid/egen | 20 %/kvartal: opkøbstilbud fra en aktør med O ≥ 4, pris 3-5× årlig BSI. Afvises tilbuddet, giver den byder aggressivitet +1 i 2 år | [F-mønster: 2020-24] |
| R3 | Spilleren lancerer en ny feature | globalGigant kopierer efter 6-12 mdr., nordisk/appFirst efter 9-18 mdr., statsselskab efter 18-36 mdr. Fordelen halveres ved hver kopi | [D, F-mønster] |
| R4 | Et marked åbner | Alle globalGigant og appFirst går ind i åbningskvartalet med marketing ×2 i 6-8 kvartaler, derefter normalisering | [F-mønster: US, ON, NL] |
| R5 | Afgiften stiger ≥ 5 pp | Svageste gigant/nordiske gruppe: marketing −30 %, 15 % chance for markedsexit | [F-mønster: evoke UK] |
| R6 | Konkurrent opkøbt af statsselskab | Den forlader grå markeder (no) | [F: Kindred/FDJ] |
| R7 | Stort sponsorat bliver ledigt | Auktion; appFirst byder højest. Spilleren kan byde | [F: Superliga] |
| R8 | Spillerens aggressivitetsindeks (bonus + reklame + VIP) > tærskel i 2 kvartaler | Påbud; tredje gang → ny regel for **alle** i markedet, branchens omdømme −1 | [D] |
| R9 | Medieskandale (tilfældig eller udløst af spilleren) | politiskPres +1 | [D] |
| R10 | Statsbudget under pres (krise-event) | 30 %/år: afgiftsstigning på 3-8 pp | [F-mønster: UK +19 pp] |
| R11 | Kanalisering under mål (dk 90 %, se 90 %, nl 80 %) i 2 år | 40 %: blokering (DNS/betaling); 20 %: lempelse | [D] |
| R12 | Spilleren har AI-risikodetektion med overvågning ≥ 0,6 | Påbudsrisiko −50 %, bøder lavere, −3 % BSI fra high-rollers | [D] |

### 7.7 Dynamisk regulering [D]

`politiskPres` stiger ved R8/R9, prævalensmåling (2021, 2026, 2031), dokumentar-events og hver gang offshore-streamere får omtale. Ved pres ≥ 3 planlægges en regel fra puljen, som træder i kraft efter 52-104 uger, hvorefter presset nulstilles til 1.

**Reglernes pulje:**

| Regel | Effekt |
|---|---|
| Reklamevindue | CAC tv/sponsorat +40 % |
| Bonusloft | Bonusniveau maks. 1 |
| Indsatsgrænse kasino | Kasino-BSI pr. kunde −15 % |
| Affordability | High-roller-BSI −20 % |
| Afgift +3-8 pp | – |
| Streamer-forbud | Kanal lukket |
| AI-risikokrav | Uden risikoagent: påbud |

### 7.8 Offshore-model [F-kalibreret, D-formel]

```ts
// procentpoint pr. marked og vertikal
offshorePct = basis[marked]
  + 0.6 * (afgiftPct - 20)
  + 4   * (strenghed - 2)
  + 5   * (bonusloft ? 1 : 0)
  + 3   * selvudelukkedeIndeks        // 0..1
  - blokeringEffekt                   // DNS -4 (halveres efter 2 år), betaling -5, leverandøransvar -5 permanent
  - 8   * (licenseretKvalitet - 0.5); // bedste licenserede produkts kvalitet 0..1
offshoreKasino  = offshorePct * 1.5;
offshoreBetting = offshorePct * 0.5;
```

**Kalibreringsmål:**

| Marked | Offshore-andel |
|---|---|
| dk | ~9 % |
| se | ~16 % (kasino 19 %, betting 4 %) |
| nl | ~50 % målt på BSI |
| de | kasino 25-50 % |
| fi | >50 % før åbning |
| on | 10-16 % |
| uk | ~5 % før 2026, stigende efter afgiften |

Krypto-boom giver +5 pp i 12 mdr. Streamer-bølger giver +3 pp for 18-24-årige.

### 7.9 Trend-events [F-mønster, D-størrelser]

| Event | Effekt | Varighed | Hyppighed |
|---|---|---|---|
| VM/EM | Betting-BSI +15-30 % i måneden, kasino +3 % | 1-2 mdr. | EM 2012/16/21/24/28/32, VM 2014/18/22/26/30/34 |
| Favoritsejre | Betting-BSI −20 til −45 % i måneden | 1 mdr. | 2-3/år tilfældigt |
| Covid | Betting −60 %, online kasino +20 % | 3-12 mdr. | 2020-03 |
| Inflation/krise | Alle −5 %, afgiftsrisiko +30 % | 1-2 år | 2022-23 + 1 tilfældig/årti |
| Mobil-/live-kasino-bølgen | Kasino +10 %/år strukturelt | 2013-2025 | Permanent |
| Krypto-boom / krak | Offshore +5 pp / −3 pp | 12 / 6-12 mdr. | 2017, 2021, 2024-25 |
| Streamer-gambling | Offshore +3 pp (unge), politisk pres +1 | 1-2 år | 2021-23 |
| Sweepstakes-boom (us) | Konkurrerende udbud, derefter forbud | 2022-25 | Historisk |
| Prediction markets | US-betting −5 til −15 % (ved PM-sejr) | Permanent | 2025-28 |
| Dokumentar/debat | Pres +1, marketing-ROI −10 % | 6 mdr. | 1-2/år |
| Sponsorforbud (uk) | Marketing-effektivitet −10 % | Permanent | 2026/27 |
| AI-personalisering | +5-10 % ARPU for førstebevægere | 2026-30 | Forskning |
| Micro-betting / AI-odds | Live-omsætning +10 % | 2027+ | Forskning |
| Kundeagenter | +3 % BSI, −2 % margin | 2029+ | Forskning |

### 7.10 Kundeanskaffelse (CAC pr. ny indbetalende kunde i dk 2012, ganges med markedets CAC-faktor) [D]

| Kanal | CAC (kr.) | Tilsynsrisiko | Note |
|---|---|---|---|
| affiliate | 1.500 | middel | Omsætningsbaseret provision forbudt i dk fra Spilpakke 1 [F]; affiliate-forbud i fi [F] |
| soeg | 1.200 | lav | – |
| tv | 2.500 | middel-høj | Whistle-to-whistle i dk fra 2026 [F] |
| sponsorat | 3.000 | middel | Giver brandkendskab |
| sociale | 1.000 | middel | – |
| streamere | 800 | høj | Regulering af gamefluencere [F] |
| crm | – | lav | Fastholdelse |
| aiAgentApi | 400 | lav | Fra 2028, kræver dataejerskab ≥ 0,6 |

CAC ganges desuden med (1 + andel² · 3) og med konkurrenternes marketingtryk.

### 7.11 Omkostninger og finansiering [D medmindre andet er angivet]

| Post | Værdi |
|---|---|
| Startkapital | 2 mio. |
| Betalinger | 2 % af indbetalinger |
| Bonus | 0 / 5 / 10 / 18 % af BSI pr. niveau (loft efter regler) |
| Kasino-content via aggregator | 12 % af kasino-BSI |

**Finansieringsrunder:**

| Runde | Kapital | Udvanding |
|---|---|---|
| Angel | 5 mio. | 15 % |
| Seed | 20 mio. | 15 % |
| Serie A | 80 mio. | 20 % |
| Serie B | 250 mio. | 15 % |
| Vækst | 800 mio. | 10 % |

**Opkøb:**
- Opkøbstilbud til spilleren: 3-5× årlig BSI [F-spænd].
- Spillerens opkøb af mindre konkurrenter: ca. 3× deres årlige BSI.
- **Messestande:** 0,2 / 0,6 / 1,5 mio.

### 7.12 Tilsynstillid (pr. kvartal) [D]

```ts
export const TRUST = {
  start: 70,
  bonusNiveau: -1.5, vipProgram: -2, intensitetOver3: -2, aggressivKanal: -1.5,
  risikoProblemAndel: -8,       // × (andel - 0.08) hvis > 0
  lanceringMedFejl: -2,
  complianceNiveau: +0.8,       // maks +3
  ansvarsforskning: +0.4,       // maks +2
  aiRisikoMedOvervaagning: +2, aiUheld: -6, offshoreBrand: -10,
  sanktioner: { paabud: 55, boede: 40, gennemgang: 25, inddragelse: 10 },
  dkLicensTabSmitte: -15,
};
```

### 7.13 AI-agenter (fra 2026) [D — spekulation]

| Funktion | Kapacitet | Compute/uge 2026 | Fejlrate ved overvågning 0 → 1 |
|---|---|---|---|
| trading | 3 | 0,15 mio. | 0,06 → 0,01 |
| indhold | 5 | 0,08 mio. | 0,04 → 0,01 |
| kundeservice | 8 | 0,05 mio. | 0,08 → 0,01 |
| crm | 4 | 0,06 mio. | 0,05 → 0,01 |
| risiko | 3 | 0,07 mio. | 0,05 → 0,005 |
| compliance | 2 | 0,07 mio. | 0,07 → 0,01 |
| udvikling | 4 | 0,12 mio. | 0,06 → 0,01 |

- Compute falder 30 % om året.
- Overvågning koster 0,1 medarbejder pr. agent pr. 0,1.
- Effekten skaleres med dataejerskab, og der kræves mindst 0,3.

### 7.14 Verdensscenarier (trækkes med seed i uge 0 af 2026; kan kombineres) [D-sandsynligheder]

| Scenarie | Sandsynlighed | Effekt |
|---|---|---|
| **Afgiftsvinteren** | 50 % | ≥1 afgiftsstigning i ≥3 europæiske markeder inden 2030. Kanalisering −3 til −8 pp. Konsolidering (≥1 mega-deal pr. 2 år). Offshore/krypto vokser |
| **Kanaliseringens tilbagetog** | 25 % | NL/DE lemper (2027-29). SE differentierer afgiften. Legale markeder +5-8 %/år. Udfordrere med godt produkt vinder |
| **Prediction market-revolutionen** | 20 % | Den amerikanske højesteret giver CFTC eksklusiv jurisdiktion (2027-28). Statsafgifter udhules. Spilleren kan få "børslicens" som ny vertikal i us. EU-debat |
| **Den hårde hånd** | 15 % | Stor skandale → totalt reklameforbud, AI-risikoscoring som krav og affordability i Norden. Markedet −10-15 %. Statsselskaber vinder andele |

Øvrige vurderinger [D]:
- Norge åbner licenssystem inden 2035: 25 %
- EU-harmonisering: 10 %
- Sverige sænker afgiften efter valget i 2026: 30 %

### 7.15 Faktaliste til Arkivet (eneste tilladte virkelighedsgrundlag; rigtige navne)

**Danmark**
1. Danmark åbnede online betting og kasino 1. januar 2012, og lotteri forblev statsmonopol. Afgiften var 20 % og blev hævet til 28 % i 2021.
2. Det danske marked havde 11,5 mia. kr. i BSI i 2025. Online kasino var størst med 4,31 mia. kr. (+12,1 %), sportsbetting lå på 2,13 mia. kr. (−11,5 %), og online udgjorde 73 % mod 33 % i 2012. Kanaliseringen var 91,5 % i 2024, og ROFUS havde 68.026 registrerede ved udgangen af 2025.
3. Danske Spil havde 5.158 mio. kr. i BSI og sit højeste resultat nogensinde (2.008 mio. kr. efter skat) i 2025. Sportsspil var under pres fra internationale aktører. Tivoli Casino blev lanceret i 2012 og senere overtaget af Danske Spil.
4. Betano overtog sponsoratet af 3F Superligaen fra sæson 2025/26. Kindred/Unibet fik påbud fra Spillemyndigheden i 2021 og 2022 for mangler i hvidvaskprocedurer.
5. Spilpakke 1 (aftalt i oktober 2025, lovforslag L 127) udvider whistle-to-whistle-forbuddet, forbyder brand-ambassadører under 25 år og free-to-play-velkomstbonusser og træder i kraft 1. juli 2026 med dele fra 1. januar 2027.

**Sverige, UK og Holland**

6. Sverige åbnede i 2019 med 18 % og hævede afgiften til 22 % i juli 2024. Kanaliseringen var 84 % i 2025 (betting 96 %, kasino 81 %). Svenska Spel lukkede sit sidste kasino i april 2025.
7. UK's remote gaming duty stiger til 40 % fra april 2026, og fjern-betting stiger til 25 % fra april 2027. Online slots fik indsatsgrænser på £5/£2 i 2025. Premier League-klubberne fjerner spilsponsorer fra brystet fra 2026/27.
8. Holland åbnede i oktober 2021 og har Europas højeste afgift på 37,8 % (2026). Kanaliseringen målt på BSR faldt til ca. 49-53 %. En afgiftsstigning, der skulle give 108 mio. euro, gav ca. 2 mio. euro.

**Tyskland, Finland, Norge og Ontario**

9. Tyskland har siden 2021 haft en indsatsafgift på 5,3 % og en månedsgrænse på €1.000. Myndighed og branche er meget uenige om kanaliseringen (fra ca. 50 % til 97 %).
10. Finland åbner 1. juli 2027 med 22 % afgift og forbud mod affiliate-markedsføring. Omkring 50 operatører har søgt licens, og mere end halvdelen af finnernes digitale spilforbrug går i dag til offshore.
11. Norge har bevaret monopolet med betalingsblokering siden 2010 og DNS-blokering fra 2025. Kindred forlod Norge efter at være blevet opkøbt af FDJ.
12. Ontario åbnede i april 2022 med 20 % til provinsen og havde C$4,0 mia. i NAGGR i 2025. Kanaliseringen er målt til 84-90 %+.

**USA**

13. USA's højesteret fjernede forbuddet mod sportsbetting i 2018. DraftKings og FanDuel har tilsammen ca. 68 % af indsatserne (2026), og New York har en afgift på 51 %. ESPN Bet blev lukket og relanceret som theScore Bet i december 2025.
14. Prediction markets omsatte for $44-50 mia. i 2025, og sport har udgjort ca. 80 % af Kalshis volumen. I august 2026 dømte to føderale appeldomstole modsat, så sagen peger mod Supreme Court.

**Konsolidering og leverandører**

15. Store opkøb:
   - Flutter–The Stars Group (2020)
   - Evolution–NetEnt (2020)
   - 888–William Hill International (2022)
   - MGM–LeoVegas (2022)
   - FDJ–Kindred (2024, ca. €2,5 mia.)
   - Flutter overtog 100 % af FanDuel i 2025
16. Kambi blev udskilt fra Unibet i 2014 som B2B-sportsbookleverandør, og Kindred byggede senere sin egen sportsbook over ca. 3 år.

**Spillere og produkter**

17. Prævalens: 5,2 % af voksne danskere havde mindst et lavt niveau af pengespilsproblemer i 2016 og 10,9 % i 2021. Problemspillere foretrækker online kasino og online væddemål.
18. Kombispil holder typisk 18-25 %, mens 1X2 på fodbold holder 5-6 %. Live-kasino har en RTP på 97-99 % og slots 94-97 %.

---

## 8. Balanceringsharness (`npm run sim`)

Der er 6 bots, som hver kører 200 seeds:

| Bot | Strategi |
|---|---|
| Grådig | Maks bonus/VIP/intensitet, aggressive kanaler, offshore-brand, alle runder |
| Forsigtig | Bootstrap, lav intensitet, få markeder |
| Balanceret | Tilpasser sig tilsynstilliden, hybrid/egen platform, udvider efter afgift og kanalisering, bruger AI fra 2026 med høj overvågning |
| AI-afviser | Som Balanceret, men uden AI |
| AI-hensynsløs | Som Balanceret, men med hyperpersonalisering og lav overvågning fra 2026 |
| Tilfældig | – |

**Assertions:**

1. **Grådig** har den højeste BSI i 2012-2020, men **aldrig** det højeste eftermæle. Den får mindst en bøde i mindst 60 % af seeds.
2. **Balanceret** har det højeste eftermæle og ligger i top 2 på selskabsværdi. Den beholder en aktiv dansk licens til 2035 i mindst 85 % af seeds.
3. **AI-afviser** ender med mindst 30 % lavere selskabsværdi end Balanceret i 2035 i mindst 70 % af seeds.
4. **AI-hensynsløs** har højere BSI end Balanceret i 2026-29, men lavere eftermæle og mindst ét påbud i mindst 60 % af seeds.
5. **Forsigtig** overlever i mindst 70 % af seeds, men ligger under Balanceret.
6. Balanceret med betting-start og med kasino-start ligger inden for ±20 % af hinanden i median-eftermæle.
7. **Intet dødt indhold og alle udfald dækket:**
   - Hver produkttype, kanal, platformmodel og hvert marked giver positivt afkast for mindst én bot i mindst én periode.
   - Alle slutninger forekommer.
   - Alle 12 reaktionsregler udløses mindst 50 gange samlet.
   - Alle verdensscenarier forekommer.
8. **Markedskalibrering** (median uden spillerpåvirkning):
   - dk-kanalisering 88-93 % i 2024
   - se 82-87 % i 2025 (kasino < betting)
   - nl BSI-kanalisering 45-58 % i 2025
   - on 82-92 % i 2025
   - dk online kasino-BSI 3,8-4,8 mia. kr. i 2025
   - Danske Lykke er nr. 1 i dk-andel i mindst 90 % af seeds frem til 2025
   - Spillerens (Balanceret) dk-andel i 2020 er 3-15 %
9. **Game Dev Story-rytme** (Balanceret):
   - Første lancering inden for 90 sek.
   - Gennemsnitligt en lancering hver 2-4 min. i realtid.
   - Første Top 10-placering inden 2014.
   - Første Guldkupon i 2015-2019.
   - Nr. 1 i dk er muligt, men først efter 2016.
   - Første Hall of Fame tidligst i 2018.
   - Mindst én gallapris i mindst 70 % af seeds.
10. **Pacing:**
    - 2012-2025: 728 uger × 3 sek. ≈ 36 min.
    - 2026-2035: 520 uger × 6 sek. ≈ 52 min.
    - 200-450 beslutningspauser i alt, heraf mindst 40 % i AI-akten.
    - Det giver 2-3 timer for et menneske.

`sim/report.md` viser nøgletal pr. bot og år samt hvor ofte hver regel udløses. Balancering sker kun i `src/data/`.

---

## 9. Plan: vertikale slices med gate efter hver

### Fase 1: Garagen og Game Dev Story-kernen 2012-2014
**Byg:**
- sim-kerne, store og autosave
- valg af stifter og vertikal
- white-label og dk-licens
- kontraktopgaver
- projektfaser med tildeling, point-bobler, fejl, test og boost
- 4 anmeldere /40
- Top 10 for dk (med Danske Lykke og 3 konkurrenter)
- kundemotor
- tid og pause
- simpelt UI og pixelkontor (placeholder)

**Gate:** 2012-2014 kan spilles. Første lancering sker inden for 90 sek. Unit tests for faser, anmeldelser og hitliste er grønne.

### Fase 2: Vækst, niveauer og belønninger
**Byg:**
- alle roller, jobannoncer, træning, energi og rolleskift
- kontortrin
- kombinationsbog og niveauer
- 2.0-versioner
- Guldkupon og Hall of Fame
- messer og Branchegallaen
- anden vertikal med kryds-salg
- finansiering og kvartalsmål

**Gate:** Unit tests for niveauer, efterfølgere, gala og runder. Man kan starte i den ene vertikal og tilføje den anden.

### Fase 3: Markeder, regulering og offshore
**Byg:**
- alle 9 markedskort med tidslinjer (7.2, 7.3, 7.5)
- licenser og markedsandels-lagkage
- dynamisk regulering (7.7)
- tilsynstillid og sanktioner
- offshore-model (7.8)
- trend-events (7.9)
- sportskalender
- nyhedsticker

**Gate:** Markedskalibreringen (assertion 8) holder allerede med en passiv bot.

### Fase 4: Levende konkurrenter og platforme
**Byg:**
- alle konkurrenter (7.4) med produktgenerering
- historiske tiltag (7.5)
- 12 reaktionsregler (7.6)
- konkurrentpanel
- opkøb og tilbud
- platformmodeller, migrering, B2B-salg og leverandørkriser

**Gate:** Unit test for hver regel. Et manuelt spil viser mindst én bonuskrig, én kopiering og ét opkøbstilbud før 2020.

### Fase 5: Spillerbyen og AI-akten
**Byg:**
- spillerbyen
- ansvarsforskning og fristelser
- akt-skift 2026 med verdensscenarier
- AI-laboratoriet og agenter i faser
- AI-produkter og AI-scenarier
- AI-transformation
- kundeagenter og prediction markets
- mindst 60 events i alt

**Gate:** 2026-2035 føles markant anderledes, når man spiller det manuelt. Unit tests for agenter og scenarier.

### Fase 6: Slutninger, Arkiv og balancering
**Byg:**
- slutninger, scorer og slutskærm
- eftertanke og New Game+
- Arkivet (kun 7.15)
- 6 bots, alle assertions og rapport
- tuning

**Gate:** `npm run sim` består alle 10 assertions.

### Fase 7: Følelse, grafik og lyd
**Byg:**
- pixelkontor i 5 trin
- trofæhylde
- akt-chrome og AI-forvandling
- juice
- lyd pr. akt
- mentor-tutorial
- tilgængelighed og responsivt layout

**Gate:** Manuel gennemgang af de første 10 minutter, første Guldkupon og akt-skiftet på tre bredder. ≥55 fps ved 4x.

### Fase 8: Hærdning og levering
**Byg:**
- PWA og offline
- eksport og import
- iOS/iPad Safari-tjek
- Playwright
- `netlify.toml`, README og DECISIONS

**Gate:** Hele Definition of Done er grøn.

---

## 10. Selvverifikation (efter HVER fase)

Kør `npm run typecheck && npm run lint && npm run build`, derefter tests (fra fase 6 også `npm run sim`). Spil derefter den nye del som spiller.

**Edge cases, der skal afprøves:**
- nul kapital
- projekt uden tildeling i en fase
- lancering med mange fejl
- licens suspenderet midt i en kampagne
- markedsexit hos en konkurrent med produkter i hitlisten
- opkøb af en konkurrent, som et historisk event refererer til (skal aflyses pænt)
- migrering, der afbrydes
- 0 % og 100 % overvågning
- reload midt i et event
- hop hen over 2025-2026
- korrupt save-fil
- hastighedsskift under en animation

Alt rødt rettes, før du går videre.

**Efter sidste fase** læses afsnit 2 og 3 igen, og hvert punkt i Game Dev Story-kontrakten efterprøves i det kørende spil. Spørg dig selv:
- *Kunne en Game Dev Story-fan sætte sig ned og straks forstå loopet?*
- *Føles konkurrenterne levende?*
- *Føles 2026 som et paradigmeskift?*

---

## 11. Autonomi og beslutningspolitik

- Stop aldrig for at spørge. Uspecificerede valg afgøres i tråd med afsnit 2 og logges som én linje i `DECISIONS.md`.
- Ét mål pr. commit, engelske commit-beskeder, reviewbare diffs. Ingen brede refaktoreringer uden tests.
- Hold en kort todo i `PLAN.md`. Brug separate scratch-passes.
- Hvis der findes en CLAUDE.md eller loop-harness (code-loop-excellence), gælder dens regler og grænser.

---

## 12. Scope og guardrails

**Ikke i scope:**
- multiplayer, backend, login, leaderboards og analytics
- rigtige penge
- spilbare pengespil (ingen slots eller roulette at spille på)
- andre sprog end dansk
- lotteri som produkt (Danske Lykkes monopol)

**Navne:**
- Lande og offentlige myndigheder må være rigtige, fx Spillemyndigheden, ROFUS, Spelinspektionen, UKGC, Ksa, GGL og CFTC.
- Private og statslige **firmaer** optræder kun under parodinavne fra 7.4, uden logoer og kun som monogrammer.
- Parodinavnene skal være venlige og må ikke gøre nogen til grin.

**Grep-tjek:** Søg i hele `src/` **undtagen** `src/data/archive.ts`, uden forskel på store og små bogstaver, efter mindst:

> Danske Spil, bet365, Unibet, Kindred, Betsson, NordicBet, LeoVegas, Betano, Mr Green, ComeOn, Bet25, Tivoli Casino, Svenska Spel, ATG, Flutter, Paddy Power, Betfair, Sky Bet, Entain, Ladbrokes, Coral, bwin, BetCity, William Hill, evoke, 888, Betfred, Holland Casino, Jacks, Tipico, Interwetten, Veikkaus, Norsk Tipping, FanDuel, DraftKings, BetMGM, Caesars, Fanatics, theScore, ESPN, Kalshi, Polymarket, Stake, Kambi, Evolution, NetEnt, FDJ, MGM, PokerStars

Ingen træffere er tilladt.

**Arkivet:** Må kun bruge 7.15. Opfind aldrig virkelighedsfakta.

**Tone:**
- Spillet må ikke glorificere aggressiv vækst eller latterliggøre spillere med problemer.
- Fristelserne skal være reelt fristende, men prisen skal være synlig.
- AI fremstilles hverken som frelse eller undergang.
- Spillet skal kunne vises på et internt ledelsesmøde.

**Må aldrig røres:** secrets, filer uden for projektmappen, destruktive kommandoer. Commit aldrig secrets.

---

## 13. Leverance

Et kørende, installerbart spil, der kan deployes statisk, plus:
- `README.md`: kørsel, build og deploy; balancering via `src/data/` og `npm run sim`; debug-menuen; parodinavne ↔ arkiv; liste over [D]-værdier og tal, der bør verificeres
- `DECISIONS.md`
- `sim/report.md`

Stop først, når hvert punkt i Definition of Done er afkrydset og verificeret.
