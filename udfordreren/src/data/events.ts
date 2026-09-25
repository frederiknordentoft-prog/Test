// Events med valg. Effekter er [D]. Tekster må aldrig moralisere; prisen skal være synlig.
import type { OfficeTier } from '../sim/types';

export type EventEffect = {
  kapital?: number;
  indsigt?: number;
  hype?: number;
  omdoemme?: number;
  tillid?: number; // tilsynstillid i dk
  energiAlle?: number;
  kunderPct?: number; // ændring i spillerens kunder (andel)
  pres?: number; // investorpres
  flag?: string;
  staffForlader?: boolean; // ctx.staffId forlader firmaet
  staffLoenPct?: number; // ctx.staffId får lønstigning
  staffEnergi?: number;
  revenueSharePp?: number; // midlertidig stigning i revenue share (leverandørkrise)
  marketingPct?: number; // alle marketingkanaler ganges med (1 + x)
  marketingMin?: number; // mindst så meget samlet marketing pr. uge bagefter (lægges på søgning)
  vaerdiPct?: number; // værdiansættelse
};

export type EventTrigger = 'tilfaeldig' | 'lanceringMedFejl' | 'investorPres' | 'medarbejder' | 'forsteLancering' | 'system';

export type EventDef = {
  id: string;
  titel: string;
  tekst: string; // {navn}, {produkt}, {fejl} erstattes fra ctx
  trigger: EventTrigger;
  fraAar: number;
  tilAar: number;
  chancePrUge: number; // for 'tilfaeldig' og 'medarbejder'
  engang: boolean;
  /** Uger før samme event kan komme igen (standard 26) */
  cooldownUger?: number;
  kraever?: { flagIkke?: string[]; flag?: string[]; kontor?: OfficeTier[]; minKunder?: number; runde?: boolean; minStaff?: number; platform?: ('whiteLabel' | 'turnkey')[] };
  valg: { tekst: string; forklaring: string; effekt: EventEffect }[];
};

export const EVENTS: EventDef[] = [
  {
    id: 'forkerteOdds', titel: 'Forkerte odds!', trigger: 'lanceringMedFejl', fraAar: 2012, tilAar: 2035, chancePrUge: 0, engang: false,
    tekst: '{produkt} gik live med {fejl} fejl. En fejl i oddsmotoren har givet kunder 40 i odds på en favorit. Kunderne har allerede spillet.',
    valg: [
      { tekst: 'Udbetal alle gevinster', forklaring: 'Dyrt, men kunderne og tilsynet husker det.', effekt: { kapital: -0.25, omdoemme: 4, tillid: 2 } },
      { tekst: 'Annullér spillene efter vilkårene', forklaring: 'Billigt, men Spillerforum koger over.', effekt: { omdoemme: -5, kunderPct: -0.06, tillid: -1 } },
    ],
  },
  {
    id: 'betalingsnedbrud', titel: 'Betalingsnedbrud', trigger: 'lanceringMedFejl', fraAar: 2012, tilAar: 2035, chancePrUge: 0, engang: false,
    tekst: 'Udbetalingerne på {produkt} har stået stille i to døgn. Kundeservice er begravet i henvendelser.',
    valg: [
      { tekst: 'Alle mand på dæk', forklaring: 'Holdet bruger weekenden på det. Energien daler.', effekt: { energiAlle: -30, tillid: 1 } },
      { tekst: 'Hyr et konsulenthus', forklaring: 'Penge løser problemet hurtigt.', effekt: { kapital: -0.15 } },
      { tekst: 'Vent på leverandøren', forklaring: 'Gratis, men kunderne forsvinder imens.', effekt: { kunderPct: -0.08, omdoemme: -3, tillid: -2 } },
    ],
  },
  {
    id: 'garageLaekage', titel: 'Det drypper fra loftet', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.02, engang: true,
    kraever: { kontor: ['garage'] },
    tekst: 'Regnen finder vej gennem garagetaget, lige over serveren.',
    valg: [
      { tekst: 'Køb en presenning', forklaring: 'Billig og grim løsning.', effekt: { kapital: -0.01 } },
      { tekst: 'Flyt serveren ind i stuen', forklaring: 'Gratis, men ingen sover godt.', effekt: { energiAlle: -20 } },
    ],
  },
  {
    id: 'espresso', titel: 'Kaffemaskinen er død', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.012, engang: true,
    tekst: 'Holdets eneste kaffemaskine har givet op. Stemningen er mærkbart dårligere.',
    valg: [
      { tekst: 'Køb en rigtig espressomaskine', forklaring: 'En investering i moralen.', effekt: { kapital: -0.02, energiAlle: 25, flag: 'espresso' } },
      { tekst: 'Pulverkaffe må gøre det', forklaring: 'Holdet klarer sig. Mere eller mindre.', effekt: { energiAlle: -10 } },
    ],
  },
  {
    id: 'journalist', titel: 'En journalist ringer', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.012, engang: false,
    kraever: { minKunder: 500 },
    tekst: 'Et erhvervsmedie vil skrive om "de nye udfordrere på spillemarkedet".',
    valg: [
      { tekst: 'Stil op til interview', forklaring: 'God omtale, men alle kan læse jeres tal.', effekt: { hype: 12, omdoemme: 2 } },
      { tekst: 'Send en skriftlig kommentar', forklaring: 'Sikkert og kedeligt.', effekt: { hype: 3 } },
    ],
  },
  {
    id: 'lokalklub', titel: 'Den lokale klub mangler en sponsor', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2025, chancePrUge: 0.01, engang: false,
    tekst: 'Håndboldklubben nede ad vejen tilbyder navnet på trøjerne for en slik.',
    valg: [
      { tekst: 'Skriv under', forklaring: 'Lokal synlighed og god stemning.', effekt: { kapital: -0.05, hype: 8, omdoemme: 2 } },
      { tekst: 'Takker nej', forklaring: 'Pengene bliver i kassen.', effekt: {} },
    ],
  },
  {
    id: 'headhunt', titel: 'Konkurrenten lokker', trigger: 'medarbejder', fraAar: 2012, tilAar: 2035, chancePrUge: 0.008, engang: false,
    kraever: { minStaff: 3 },
    tekst: '{navn} har fået et tilbud fra en stor konkurrent med 30 % mere i løn.',
    valg: [
      { tekst: 'Match tilbuddet', forklaring: 'Lønnen stiger 30 %, men {navn} bliver.', effekt: { staffLoenPct: 0.3, staffEnergi: 20 } },
      { tekst: 'Ønsk held og lykke', forklaring: '{navn} forlader firmaet.', effekt: { staffForlader: true } },
    ],
  },
  {
    id: 'bonusjaegere', titel: 'Bonusjægerne er landet', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.01, engang: false,
    kraever: { minKunder: 1500 },
    tekst: 'Et forum deler en metode til at malke jeres velkomstbonus. Hundredvis af nye konti på et døgn.',
    valg: [
      { tekst: 'Stram KYC og luk kontiene', forklaring: 'I mister nogle rigtige kunder på vejen.', effekt: { kunderPct: -0.03, tillid: 1 } },
      { tekst: 'Lad dem være', forklaring: 'Bonusserne koster, men kundetallet ser flot ud.', effekt: { kapital: -0.12, kunderPct: 0.02 } },
    ],
  },
  {
    id: 'affiliateAftale', titel: 'Et fristende affiliate-tilbud', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2025, chancePrUge: 0.008, engang: true,
    kraever: { minKunder: 300 },
    tekst: 'Et stort affiliate-netværk tilbyder en livstidsaftale med revenue share. Mange kunder, lav pris i starten.',
    valg: [
      { tekst: 'Skriv under', forklaring: '+10 % kunder nu. Tilsynet kan ikke lide aggressiv affiliate.', effekt: { kunderPct: 0.1, tillid: -3 } },
      { tekst: 'Forhandl en fast CPA', forklaring: 'Færre kunder, men ingen bindinger.', effekt: { kunderPct: 0.04 } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'angelSnuser', titel: 'En angel-investor snuser', trigger: 'forsteLancering', fraAar: 2012, tilAar: 2035, chancePrUge: 0, engang: true,
    tekst: 'En tidligere bookmakerdirektør har set jeres første produkt og vil gerne mødes over en kop kaffe.',
    valg: [
      { tekst: 'Mød op med tal', forklaring: 'Angel-runden bliver mulig og lidt mere værd.', effekt: { vaerdiPct: 0.1, flag: 'angelKontakt' } },
      { tekst: 'Vi bootstrapper', forklaring: 'Fuld kontrol, lidt stolthed.', effekt: { omdoemme: 1 } },
    ],
  },
  {
    id: 'investorPres', titel: 'Bestyrelsen er utålmodig', trigger: 'investorPres', fraAar: 2012, tilAar: 2035, chancePrUge: 0, engang: false,
    tekst: 'Investorerne har set kvartalstallene og kræver en plan. Stemningen på bestyrelsesmødet er kølig.',
    valg: [
      { tekst: 'Skru op for marketing', forklaring: 'Marketing +30 % (mindst 50 t. kr./uge). Vækst koster.', effekt: { marketingPct: 0.3, marketingMin: 0.05, pres: -1.5 } },
      { tekst: 'Skær i omkostningerne', forklaring: 'Marketing −30 % og stram styring. Holdet mærker det.', effekt: { marketingPct: -0.3, energiAlle: -15, pres: -1.5 } },
      { tekst: 'Lov bedre tal næste kvartal', forklaring: 'Køber tid. Værdiansættelsen falder lidt.', effekt: { vaerdiPct: -0.05, pres: -0.5 } },
    ],
  },
  {
    id: 'hackathon', titel: 'Hackathon-weekend', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2035, chancePrUge: 0.008, engang: false,
    kraever: { minStaff: 3 },
    tekst: 'Holdet foreslår en hackathon-weekend med pizza og nye idéer.',
    valg: [
      { tekst: 'Kør det!', forklaring: 'Idéer bliver til indsigt, men alle er trætte mandag.', effekt: { indsigt: 8, energiAlle: -15, kapital: -0.02 } },
      { tekst: 'Hellere en fridag', forklaring: 'Alle kommer udhvilede tilbage.', effekt: { energiAlle: 20 } },
    ],
  },
  {
    id: 'rekordweekend', titel: 'Rekordweekend', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.008, engang: false,
    kraever: { minKunder: 2000 },
    tekst: 'Weekendens kampe gik jeres vej, og trafikken slog alle rekorder.',
    valg: [
      { tekst: 'Fejr det med holdet', forklaring: 'Kage og god stemning.', effekt: { kapital: -0.01, energiAlle: 15, hype: 4 } },
      { tekst: 'Brug momentum på marketing', forklaring: 'Kør en ekstra kampagne mens det er varmt.', effekt: { kapital: -0.1, hype: 12 } },
    ],
  },
  {
    id: 'serverTilbud', titel: 'Billig serverplads', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2020, chancePrUge: 0.006, engang: true,
    tekst: 'En hostingudbyder tilbyder et års serverplads til halv pris, hvis I skriver under i dag.',
    valg: [
      { tekst: 'Skriv under', forklaring: 'Stabil drift: 10 % færre fejl i alle fremtidige projekter.', effekt: { kapital: -0.05, indsigt: 3, flag: 'server' } },
      { tekst: 'Vi bliver hos white-label', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
];

EVENTS.push(
  {
    id: 'leverandoerNedbrud', titel: 'Leverandøren er nede', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.006, engang: false,
    kraever: { minKunder: 1000, platform: ['whiteLabel', 'turnkey'] },
    tekst: 'Jeres platformleverandør har haft nedbrud hele lørdag aften. Kunderne kunne hverken spille eller udbetale.',
    valg: [
      { tekst: 'Kompensér kunderne', forklaring: 'Free spins og en undskyldning. Dyrt, men kunderne bliver.', effekt: { kapital: -0.15, omdoemme: 1 } },
      { tekst: 'Henvis til leverandøren', forklaring: 'Gratis, men nogle kunder skifter.', effekt: { kunderPct: -0.04, omdoemme: -2 } },
    ],
  },
  {
    id: 'leverandoerPris', titel: 'Leverandøren hæver prisen', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.004, engang: false,
    kraever: { minKunder: 3000, platform: ['whiteLabel', 'turnkey'] },
    tekst: 'Platformleverandøren er blevet købt og vil have en større bid af omsætningen.',
    valg: [
      { tekst: 'Accepter', forklaring: 'Revenue share stiger 3 procentpoint. Det er prisen for ikke at eje sin platform.', effekt: { flag: 'dyrLeverandoer' } },
      { tekst: 'Forhandl hårdt', forklaring: 'Et konsulenthus forhandler. Leverandøren giver sig delvist.', effekt: { kapital: -0.3, flag: 'dyrLeverandoerHalv' } },
    ],
  },
  {
    id: 'medieskandaleEgen', titel: 'Journalisten har jeres storspillere', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2035, chancePrUge: 0.004, engang: false,
    kraever: { minKunder: 5000 },
    tekst: 'Et dagblad har fået fat i mails om jeres VIP-behandling af en storspiller. Historien kører i morgen.',
    valg: [
      { tekst: 'Stil op og tag ansvar', forklaring: 'I stopper VIP-tilbuddene til ham og fortæller åbent om det. Tilliden bevares.', effekt: { tillid: 2, omdoemme: -1 } },
      { tekst: 'Ingen kommentarer', forklaring: 'Historien vokser, og politikerne bliver interesserede.', effekt: { omdoemme: -5, tillid: -4 } },
    ],
  },
);

EVENTS.push({
  id: 'offshoreAfsloeret', titel: 'Afsløret!', trigger: 'system', fraAar: 2012, tilAar: 2035, chancePrUge: 0, engang: false,
  tekst: 'En journalist har fulgt pengene fra kryptokasinoet til jeres konto. Tilsynene i alle regulerede markeder har inddraget licenserne.',
  valg: [{ tekst: 'Det var prisen', forklaring: 'Licenserne er væk. I kan søge igen, men tilliden skal genopbygges.', effekt: { omdoemme: -15 } }],
});

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as Record<string, EventDef>;
