// Flere events (fase 5): fristelser, spillerbyen, AI-akten og verdensscenarierne.
// Tekster moraliserer aldrig; prisen står i forklaringen. Valg 0 er altid det afbalancerede (bots vælger valg 0).
// {navn} bruges kun i tekst og forklaring (titel og valgtekst erstattes ikke).
import type { AgentFunktion } from '../sim/types';
import type { EventDef } from './events';

const ALLE_AGENTER: AgentFunktion[] = ['trading', 'indhold', 'kundeservice', 'crm', 'risiko', 'compliance', 'udvikling'];

// ---------- Akt 1: forretning, holdet og branchen (2012-2025) ----------
const AKT1: EventDef[] = [
  {
    id: 'medarbejderOrlov', titel: 'Rygsæk og Thailand', trigger: 'medarbejder', fraAar: 2012, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { minStaff: 3 },
    tekst: '{navn} har stirret længe på et verdenskort og drømmer om tre måneder med rygsæk og strandhytter.',
    valg: [
      { tekst: 'Giv en måneds orlov', forklaring: '{navn} kommer brun og udhvilet tilbage. Kassen betaler lidt til en vikar.', effekt: { kapital: -0.03, staffEnergi: 40 } },
      { tekst: 'Arbejd remote fra stranden', forklaring: '{navn} er lykkelig. Resten af holdet ser billederne og er lidt misundelige.', effekt: { staffEnergi: 25, energiAlle: -5 } },
      { tekst: 'Ikke nu, vi har travlt', forklaring: 'Gratis, men {navn} kigger stadig på kortet.', effekt: { staffEnergi: -25 } },
    ],
  },
  {
    id: 'medarbejderSideprojekt', titel: 'Weekendprojektet', trigger: 'medarbejder', fraAar: 2013, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 78,
    tekst: '{navn} har bygget en lille oddsberegner i weekenderne. Den er faktisk ret god, og {navn} vil gerne sælge den til jer.',
    valg: [
      { tekst: 'Køb den til en fair pris', forklaring: 'I får værktøjet og en glad kollega.', effekt: { kapital: -0.05, indsigt: 8, staffEnergi: 20 } },
      { tekst: 'Den tilhører vel firmaet?', forklaring: 'Gratis indsigt, men {navn} føler sig snydt.', effekt: { indsigt: 8, staffEnergi: -35 } },
      { tekst: 'Nej tak, behold den selv', forklaring: 'Ingen indsigt, men {navn} er glad for at blive spurgt.', effekt: { staffEnergi: 10 } },
    ],
  },
  {
    id: 'kodekrigen', titel: 'Kodekrigen', trigger: 'medarbejder', fraAar: 2012, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 78,
    kraever: { minStaff: 4 },
    tekst: '{navn} nægter at bruge den nye kodestandard. Der er dukket sure kommentarer op i koden, og frokosten er blevet meget stille.',
    valg: [
      { tekst: 'Mægl over pizza', forklaring: 'En lang aften, men freden er genoprettet.', effekt: { kapital: -0.01, energiAlle: 5, staffEnergi: 10 } },
      { tekst: 'Chefen bestemmer', forklaring: 'Standarden står fast. {navn} surmuler.', effekt: { staffEnergi: -25, energiAlle: 5 } },
      { tekst: 'Lad den gamle standard vinde', forklaring: '{navn} jubler. Resten af holdet må skrive deres kode om.', effekt: { staffEnergi: 20, energiAlle: -10 } },
    ],
  },
  {
    id: 'loenstatistikken', titel: 'Nogen har læst lønstatistikken', trigger: 'medarbejder', fraAar: 2012, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { minStaff: 3 },
    tekst: '{navn} har læst den nye lønstatistik og står i døren med et print og et alvorligt ansigt.',
    valg: [
      { tekst: 'Giv 10 % mere', forklaring: '{navn} får mere i løn og arbejder med fornyet energi.', effekt: { staffLoenPct: 0.1, staffEnergi: 25 } },
      { tekst: 'Tilbyd en flot titel i stedet', forklaring: 'Gratis. "Chief Odds Officer" lyder godt, men det betaler ikke huslejen.', effekt: { staffEnergi: 5 } },
      { tekst: 'Budgettet er lukket', forklaring: 'Lønnen står stille, og det gør humøret også.', effekt: { staffEnergi: -25 } },
    ],
  },
  {
    id: 'landsholdsfeber', titel: 'Landsholdsfeber', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 78,
    kraever: { minKunder: 800 },
    tekst: 'Landsholdet er i kvartfinalen! Hele landet har malet flag på kinderne, og trafikken stiger time for time.',
    valg: [
      { tekst: 'Storskærm og hotdogs på kontoret', forklaring: 'Holdet ser kampen sammen. Billigt og hyggeligt.', effekt: { kapital: -0.01, energiAlle: 15, hype: 3 } },
      { tekst: 'Oddsboost på landsholdet', forklaring: 'Dyrt, hvis Danmark vinder. Mange nye kunder uanset hvad.', effekt: { kapital: -0.12, kunderPct: 0.03, hype: 8 } },
      { tekst: 'Business as usual', forklaring: 'Ingen udgifter. Ingen fest.', effekt: {} },
    ],
  },
  {
    id: 'forkertModtager', titel: 'Forkert modtager', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2025, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { minKunder: 1000 },
    tekst: 'En kollega har sendt et regneark med 2.000 kundenavne og indbetalinger til en forkert mailadresse. Modtageren har svaret: "Tak?"',
    valg: [
      { tekst: 'Anmeld det og skriv til kunderne', forklaring: 'Pinligt og lidt dyrt. Nogle kunder går, men tilsynet sætter pris på ærligheden.', effekt: { kapital: -0.05, omdoemme: -2, kunderPct: -0.01, tillid: 2 } },
      { tekst: 'Bed modtageren slette den', forklaring: 'Ingen omtale nu. Sagen dukker op ved næste revision, og tilsynet noterer den.', effekt: { tillid: -4 } },
    ],
  },
  {
    id: 'uanmeldtBesoeg', titel: 'Uanmeldt besøg', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2025, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { licens: 'dk', minKunder: 500 },
    tekst: 'To venlige mennesker fra Spillemyndigheden står i døren med en mappe. De vil gerne se jeres procedurer for kundekendskab.',
    valg: [
      { tekst: 'Vis alt frem', forklaring: 'Holdet bruger en hel dag på at finde papirer. Tilsynet er tilfreds.', effekt: { energiAlle: -10, tillid: 3 } },
      { tekst: 'Ring efter en compliance-konsulent', forklaring: 'Konsulenten redder dagen. Det gør fakturaen ikke.', effekt: { kapital: -0.1, tillid: 2 } },
      { tekst: 'Kan I komme igen på torsdag?', forklaring: 'Holdet kan arbejde videre, men tilsynet skriver det ned.', effekt: { tillid: -4 } },
    ],
  },
  {
    id: 'kundenMedPengene', titel: 'Kunden med de mange penge', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { minKunder: 2000 },
    tekst: 'En ny kunde har indbetalt 400.000 kr. på en uge fra tre forskellige konti. Han taber pænt og klager aldrig.',
    valg: [
      { tekst: 'Bed om dokumentation', forklaring: 'Kunden bliver lidt sur og spiller mindre. Ingen skade sket.', effekt: { kapital: 0.03 } },
      { tekst: 'Frys kontoen og indberet', forklaring: 'Kunden forsvinder med sine penge. Tilsynene noterer, at jeres kontrol virker.', effekt: { kapital: -0.02, tillidAlle: 2 } },
      { tekst: 'Han er jo en god kunde', forklaring: 'En pæn indtægt. Er pengene beskidte, er I medansvarlige, og tilsynene ser skævt til det.', effekt: { kapital: 0.25, tillidAlle: -5 } },
    ],
  },
  {
    id: 'foerstepladsenTilSalg', titel: 'Førstepladsen er til salg', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2025, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { minKunder: 500 },
    tekst: 'Et affiliate-site med listen "Top 10 danske kasinoer" tilbyder jer førstepladsen. Prisen er, som de siger, "helt uafhængig af anmeldelsen".',
    valg: [
      { tekst: 'Stå på listen på normale vilkår', forklaring: 'En lille strøm af nye kunder til normal pris.', effekt: { kunderPct: 0.01 } },
      { tekst: 'Køb førstepladsen', forklaring: 'Mange nye kunder. Tilsynet kan ikke lide betalte "uafhængige" anmeldelser.', effekt: { kapital: -0.12, kunderPct: 0.05, tillid: -2 } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'fodboldPodcast', titel: 'Podcasten søger en sponsor', trigger: 'tilfaeldig', fraAar: 2016, tilAar: 2025, chancePrUge: 0.004, engang: true,
    kraever: { minKunder: 1000 },
    tekst: 'Landets mest populære fodboldpodcast søger en sponsor. Værterne tilbyder også at give "ugens sikre spil" live i udsendelsen, med link til jer.',
    valg: [
      { tekst: 'Et klassisk sponsorat', forklaring: 'Jeres navn i introen hver uge. Pænt og sikkert.', effekt: { kapital: -0.06, hype: 6 } },
      { tekst: 'Fuld pakke med værternes spil', forklaring: 'Masser af nye kunder. Reklamereglerne er ikke begejstrede for "sikre spil".', effekt: { kapital: -0.15, hype: 12, kunderPct: 0.03, tillid: -3 } },
      { tekst: 'Nej tak', forklaring: 'Pengene bliver i kassen.', effekt: {} },
    ],
  },
  {
    id: 'branchefesten', titel: 'Branchefesten', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2025, chancePrUge: 0.004, engang: false, cooldownUger: 52,
    kraever: { minStaff: 3 },
    tekst: 'bet356 holder fest for hele branchen med livemusik og åben bar. Rygtet siger, at de bedste aftaler bliver lavet ved baren efter midnat.',
    valg: [
      { tekst: 'Send et par stykker', forklaring: 'Lidt netværk, lidt indsigt, lidt hovedpine.', effekt: { kapital: -0.01, indsigt: 4, energiAlle: -5 } },
      { tekst: 'Hele holdet tager med', forklaring: 'Masser af kontakter og idéer. Mandagen bliver lang.', effekt: { kapital: -0.04, indsigt: 8, hype: 4, energiAlle: -20 } },
      { tekst: 'Bliv hjemme og kod', forklaring: 'Frisk hold og ingen hovedpine.', effekt: { energiAlle: 5 } },
    ],
  },
  {
    id: 'aaretsGazelle', titel: 'Årets gazelle?', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2025, chancePrUge: 0.003, engang: true,
    kraever: { minKunder: 2000 },
    tekst: 'Et erhvervsmagasin ringer: I er "meget tæt på" at blive kåret som årets gazelle. Det ville hjælpe, hvis I også købte en helsidesannonce.',
    valg: [
      { tekst: 'Tak for nomineringen, ingen annonce', forklaring: 'Måske vinder I, måske ikke. Stoltheden er intakt.', effekt: { hype: 3, omdoemme: 1 } },
      { tekst: 'Køb annoncen', forklaring: 'I vinder. Mærkeligt, som det gik.', effekt: { kapital: -0.08, hype: 10 } },
    ],
  },
  {
    id: 'hedeboelge', titel: 'Hedebølge i kælderen', trigger: 'tilfaeldig', fraAar: 2012, tilAar: 2035, chancePrUge: 0.006, engang: true,
    kraever: { kontor: ['kaelder'] },
    tekst: 'Det er 31 grader udenfor og 34 inde. Serverne brummer, og halvdelen af holdet sidder i shorts med fødderne i en balje.',
    valg: [
      { tekst: 'Køb aircondition', forklaring: 'Dyrt, men alle kan tænke igen.', effekt: { kapital: -0.03, energiAlle: 15 } },
      { tekst: 'Isvafler til alle', forklaring: 'Billigt og populært. Varmen er der stadig.', effekt: { kapital: -0.002, energiAlle: 5 } },
      { tekst: 'Hjemmearbejde resten af ugen', forklaring: 'Alle er glade, men idéerne flyder langsommere uden kaffemaskinen.', effekt: { energiAlle: 10, indsigt: -2 } },
    ],
  },
  {
    id: 'bankenSigerNej', titel: 'Banken siger nej tak', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2025, chancePrUge: 0.003, engang: true,
    kraever: { minKunder: 1000 },
    tekst: 'Jeres bank har "revurderet sin risikoappetit" og vil ikke længere have spilselskaber som kunder. I har 30 dage.',
    valg: [
      { tekst: 'Find en ny dansk bank', forklaring: 'Møder, papirer og et højere gebyr, men alt er ordentligt.', effekt: { kapital: -0.08, energiAlle: -10, tillid: 1 } },
      { tekst: 'Brug en betalingsleverandør på Malta', forklaring: 'Hurtigt og billigt. Tilsynet vil gerne vide, hvor pengene er.', effekt: { kapital: -0.02, tillid: -2 } },
    ],
  },
];

// ---------- Fristelser: reelt fristende, prisen er synlig ----------
const FRISTELSER: EventDef[] = [
  {
    id: 'vipVaerten', titel: 'VIP-værten med den tykke telefonbog', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.003, engang: true,
    kraever: { minKunder: 4000 },
    tekst: 'En erfaren VIP-vært fra Unibit vil skifte til jer. Hun tager gerne sine 30 største spillere med. "De følger mig, ikke brandet."',
    valg: [
      { tekst: 'Ansæt hende uden kundelisten', forklaring: 'I får hendes erfaring, men ingen storspillere.', effekt: { kapital: -0.05, indsigt: 6 } },
      { tekst: 'Ansæt hende og tag spillerne med', forklaring: 'Storspillerne betaler godt, og VIP-programmet går til niveau 3. Flere guldkunder glider mod risiko, og tilsynene lægger mærke til det.', effekt: { kapital: 0.6, kunderPct: 0.01, vipNiveau: 3, byRisiko: 0.1, tillidAlle: -3 } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'bonusBomben', titel: '500 % velkomstbonus!', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2019, chancePrUge: 0.004, engang: false, cooldownUger: 104,
    kraever: { minKunder: 1000 },
    tekst: 'Marketing har en plan før sæsonstart: "500 % velkomstbonus". LionVegas gør det allerede, og deres bannere er overalt.',
    valg: [
      { tekst: 'En pæn kampagne: 100 % op til 500 kr.', forklaring: 'Et par nye kunder til en overskuelig pris.', effekt: { kapital: -0.05, kunderPct: 0.02 } },
      { tekst: 'Fuld gas: 500 %', forklaring: 'Bonusniveauet går til 3, og kunderne vælter ind. Bonusser koster, flere glider mod risiko, og tilsynene rynker panden.', effekt: { kapital: -0.15, kunderPct: 0.06, hype: 8, bonusNiveau: 3, byRisiko: 0.05, tillidAlle: -2 } },
      { tekst: 'Nej, vi konkurrerer på produktet', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'streamerAftalen', titel: 'Streameren ringer', trigger: 'tilfaeldig', fraAar: 2017, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { minKunder: 1500 },
    tekst: 'En streamer med 200.000 unge følgere vil spille live på jeres side hver aften. Med jeres penge, selvfølgelig. "Chatten går amok, når jeg rammer bonusrunden."',
    valg: [
      { tekst: 'En lille aftale med aldersfilter', forklaring: 'Lidt synlighed, få nye kunder, ingen ballade.', effekt: { kapital: -0.08, hype: 5, kunderPct: 0.01 } },
      { tekst: 'Fuld aftale, live hver aften', forklaring: 'Masser af hype og nye kunder. Følgerne er unge, spillet bliver intenst, og tilsynene ser med.', effekt: { kapital: -0.25, hype: 15, kunderPct: 0.05, byRisiko: 0.05, tillidAlle: -3, omdoemme: -2 } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'graaPartner', titel: 'En partner uden spørgsmål', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.003, engang: true,
    kraever: { minKunder: 2000, offshoreBrand: false },
    tekst: 'En "partner" vil køre jeres spil under sit eget brand i lande, hvor ingen har licens. I får 30 % af overskuddet hver måned. Ingen spørgsmål.',
    valg: [
      { tekst: 'Tilbyd en licenseret B2B-aftale i stedet', forklaring: 'Han griner lidt, men køber et par spil til sine lovlige markeder.', effekt: { kapital: 0.1 } },
      { tekst: 'Skriv under', forklaring: 'Rigtig gode penge. Kommer det frem, bliver tilsynene meget interesserede.', effekt: { kapital: 1.2, tillidAlle: -3, flag: 'graaPartner' } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'graaPartnerAfsloeret', titel: 'Jeres spil er dukket op', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.006, engang: true,
    kraever: { flag: ['graaPartner'] },
    tekst: 'En journalist har fundet jeres spil på et ulicenseret kasino og spurgt, hvem der egentlig leverer dem. Hun ringer igen i morgen.',
    valg: [
      { tekst: 'Opsig aftalen og fortæl det hele', forklaring: 'Dyrt og pinligt, men historien dør hurtigt.', effekt: { kapital: -0.4, omdoemme: -3, tillidAlle: -3 } },
      { tekst: 'Det er partnerens ansvar', forklaring: 'Aftalen kører videre. Det gør historien også, og politikerne læser med.', effekt: { omdoemme: -7, tillidAlle: -8, politiskPres: 0.5 } },
    ],
  },
  {
    id: 'datamaegleren', titel: 'Datamægleren', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { minKunder: 1500 },
    tekst: 'En datamægler sælger en liste med 50.000 "spilinteresserede danskere" med mail, alder og hvor ofte de spiller. "Helt lovligt samtykke. Næsten."',
    valg: [
      { tekst: 'Køb anonymiseret markedsdata', forklaring: 'Ingen nye kunder, men I lærer markedet bedre at kende.', effekt: { kapital: -0.05, indsigt: 8 } },
      { tekst: 'Køb hele listen', forklaring: 'Mange nye kunder. Nogle af dem spiller allerede for meget, og samtykket holder ikke til en revision.', effekt: { kapital: -0.1, kunderPct: 0.05, byRisiko: 0.04, tillidAlle: -4 } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'klokken2347', titel: 'Klokken 23:47', trigger: 'tilfaeldig', fraAar: 2018, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 104,
    kraever: { minKunder: 5000 },
    tekst: 'CRM har opdaget, at en push-besked om bet builders sent om aftenen får kunderne til at spille 30 % mere. De vil sende den hver aften kl. 23:47.',
    valg: [
      { tekst: 'Ja, men aldrig efter kl. 21', forklaring: 'Lidt mere omsætning og ingen natlige beskeder.', effekt: { kapital: 0.1 } },
      { tekst: 'Hver aften kl. 23:47', forklaring: 'Omsætningen stiger mærkbart. Natteravnene er ofte dem, der i forvejen spiller mest.', effekt: { kapital: 0.45, byRisiko: 0.08, tillidAlle: -2 } },
      { tekst: 'Drop idéen', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'affiliateBonuskrav', titel: 'Affiliaterne vil have mere', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { minBonus: 2, minKunder: 1000 },
    tekst: 'Jeres største affiliate-partnere skriver: "Betanu giver mere. Skru op for bonussen, eller vi flytter trafikken."',
    valg: [
      { tekst: 'Hold jeres niveau', forklaring: 'Nogle affiliates flytter. Resten bliver.', effekt: { kunderPct: -0.02 } },
      { tekst: 'Skru bonussen helt op', forklaring: 'Bonusniveauet går til 3, og trafikken bliver. Det koster, flere glider mod risiko, og tilsynene noterer det.', effekt: { kapital: -0.1, kunderPct: 0.03, bonusNiveau: 3, byRisiko: 0.04, tillidAlle: -2 } },
      { tekst: 'Skru ned og byg loyalitet', forklaring: 'Bonusniveauet går til 1. Affiliaterne går, men tilsynene og kunderne sætter pris på roen.', effekt: { kunderPct: -0.04, bonusNiveau: 1, byRisiko: -0.05, tillidAlle: 2 } },
    ],
  },
  {
    id: 'finaleturen', titel: 'Finaleturen', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 52,
    kraever: { minVip: 2 },
    tekst: 'VIP-afdelingen vil invitere de 20 største kunder til den store europæiske finale: privatfly, loge og champagne. "De spiller for millioner bagefter."',
    valg: [
      { tekst: 'Kun kunder med tjekket økonomi', forklaring: 'Færre med, ingen bekymringer. Turen tjener sig lige akkurat hjem.', effekt: { kapital: 0.05, omdoemme: 1 } },
      { tekst: 'Alle 20 med', forklaring: 'De spiller for millioner bagefter. Nogle af dem burde ikke, og tilsynene hører om turen.', effekt: { kapital: 0.6, byRisiko: 0.06, tillidAlle: -2 } },
      { tekst: 'Drop turen og skru ned for VIP', forklaring: 'VIP-niveauet går til 1. Storspillerne er skuffede, men tilsynene ånder lettet op.', effekt: { vipNiveau: 1, byRisiko: -0.06, tillidAlle: 2, omdoemme: 1 } },
    ],
  },
  {
    id: 'kryptoIndbetaling', titel: 'Indbetal med krypto', trigger: 'tilfaeldig', fraAar: 2017, tilAar: 2035, chancePrUge: 0.003, engang: true,
    kraever: { minKunder: 2000 },
    tekst: 'En betalingsleverandør tilbyder kryptoindbetalinger: lynhurtige, lave gebyrer og meget populære blandt unge mænd med store drømme.',
    valg: [
      { tekst: 'Kun med fuld ID-kontrol', forklaring: 'Et par nye kunder. Tilsynene har ingen indvendinger.', effekt: { kapital: -0.05, kunderPct: 0.01 } },
      { tekst: 'Slå det til uden ekstra kontrol', forklaring: 'Mange nye kunder og hurtige penge. Tilsynene vil gerne vide, hvor pengene kommer fra.', effekt: { kapital: 0.2, kunderPct: 0.04, tillidAlle: -4 } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
];

// ---------- Spillerbyen: korte, respektfulde historier ----------
const SPILLERBYEN: EventDef[] = [
  {
    id: 'brevMedHaandskrift', titel: 'Et brev med håndskrift', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 104,
    kraever: { minByRisiko: 0.1 },
    tekst: 'Der ligger et håndskrevet brev i posten. En kvinde skriver, at hendes bror spiller for meget hos jer. Hun spørger, om I kan gøre noget.',
    valg: [
      { tekst: 'Ring til broren og tilbyd en pause', forklaring: 'En svær samtale. Han siger ja til en pause, og I bruger samme tilgang til flere.', effekt: { kapital: -0.02, byRisiko: -0.05, omdoemme: 1 } },
      { tekst: 'Lav en fast vej for pårørende', forklaring: 'Et nyt værktøj og en medarbejder, der tager sig af det. Det koster, men mange i risiko kommer tilbage.', effekt: { kapital: -0.1, byRisiko: -0.12, tillidAlle: 2, omdoemme: 3 } },
      { tekst: 'Svar venligt, at I ikke kan udlevere oplysninger', forklaring: 'Korrekt efter reglerne. Intet ændrer sig.', effekt: {} },
    ],
  },
  {
    id: 'hjaelpelinjenRinger', titel: 'Hjælpelinjen ringer', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 156,
    kraever: { minKunder: 2000, minByRisiko: 0.08 },
    tekst: 'Hjælpelinjen for spilleproblemer laver et forskningsprojekt og beder om anonymiserede data om spillemønstre. Andre udbydere har sagt nej.',
    valg: [
      { tekst: 'Del data', forklaring: 'Lidt arbejde for holdet. Forskerne finder mønstre, I også kan bruge.', effekt: { energiAlle: -5, indsigt: 4, tillidAlle: 2, omdoemme: 2 } },
      { tekst: 'Del data og støt projektet', forklaring: 'Det koster, men I bliver nævnt i rapporten, og flere får hjælp.', effekt: { kapital: -0.1, indsigt: 5, tillidAlle: 3, omdoemme: 4, byRisiko: -0.05 } },
      { tekst: 'Data er forretningshemmelighed', forklaring: 'Gratis. Rapporten nævner, hvem der sagde nej.', effekt: { omdoemme: -2 } },
    ],
  },
  {
    id: 'efterDokumentaren', titel: 'Efter dokumentaren', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 156,
    kraever: { licens: 'dk', minByRisiko: 0.1 },
    tekst: 'En tv-dokumentar om spilleproblemer har fået rekordmange til at melde sig i ROFUS. Nogle af dem er jeres kunder.',
    valg: [
      { tekst: 'Skriv ud om jeres egne værktøjer', forklaring: 'Flere sætter grænser eller holder pause. Omsætningen daler lidt.', effekt: { kunderPct: -0.02, byRisiko: -0.1, omdoemme: 2 } },
      { tekst: 'Kør en genaktiveringskampagne til resten', forklaring: 'Kunderne kommer igen, men timingen er dårlig, og tilsynet ser det.', effekt: { kapital: -0.05, kunderPct: 0.02, byRisiko: 0.04, tillid: -3, omdoemme: -2 } },
      { tekst: 'Gør ingenting', forklaring: 'Ingen udgifter. Nogle kunder forsvinder stille.', effekt: { kunderPct: -0.02 } },
    ],
  },
  {
    id: 'opkaldsugen', titel: 'Opkaldsugen', trigger: 'medarbejder', fraAar: 2014, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { minByRisiko: 0.08, minStaff: 3 },
    tekst: '{navn} foreslår at ringe personligt til alle kunder, hvis spillemønster har ændret sig. "Bare en snak. Intet salg."',
    valg: [
      { tekst: 'Giv det en uge', forklaring: '{navn} bruger ugen i telefonen. Mange er glade for opkaldet og sætter en grænse.', effekt: { staffEnergi: -15, byRisiko: -0.12, omdoemme: 1 } },
      { tekst: 'Send en automatisk mail i stedet', forklaring: 'Billigt og hurtigt. Få læser den.', effekt: { byRisiko: -0.03 } },
      { tekst: 'Ikke nu', forklaring: '{navn} er skuffet.', effekt: { staffEnergi: -15 } },
    ],
  },
  {
    id: 'denStoreGevinst', titel: 'Den store gevinst', trigger: 'tilfaeldig', fraAar: 2013, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { minByRisiko: 0.1, minKunder: 1000 },
    tekst: 'En kunde, der har spillet meget det seneste år, har vundet 2 mio. kr. på en jackpot. Han har allerede spurgt, om hans indsatsgrænse kan hæves.',
    valg: [
      { tekst: 'Tillykke, og tilbyd en pause', forklaring: 'Han udbetaler det meste og takker jer i en mail. Byen bliver lidt roligere.', effekt: { byRisiko: -0.04, omdoemme: 2 } },
      { tekst: 'Hæv grænsen og send en VIP-velkomst', forklaring: 'Han spiller det meste tilbage. Pæne penge, men han og andre som ham glider mod risiko.', effekt: { kapital: 0.3, byRisiko: 0.05, tillidAlle: -3 } },
      { tekst: 'Lad ham være', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'graensenSomStandard', titel: 'Grænsen som standard', trigger: 'tilfaeldig', fraAar: 2015, tilAar: 2035, chancePrUge: 0.003, engang: true,
    kraever: { minByRisiko: 0.1, minKunder: 2000 },
    tekst: 'Produktholdet foreslår, at nye kunder får en indbetalingsgrænse fra start. De kan hæve den, men skal vente et døgn.',
    valg: [
      { tekst: 'Gør grænsen synlig, men frivillig', forklaring: 'Flere sætter en grænse. Kunderne bemærker det næsten ikke.', effekt: { byRisiko: -0.05, tillidAlle: 1 } },
      { tekst: 'Standardgrænse for alle nye kunder', forklaring: 'Lidt færre kunder og lavere omsætning. Byen bliver roligere, og tilsynene er begejstrede.', effekt: { kunderPct: -0.03, byRisiko: -0.15, tillidAlle: 4, omdoemme: 3 } },
      { tekst: 'Behold det som nu', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'historienIRadioen', titel: 'Historien i radioen', trigger: 'tilfaeldig', fraAar: 2014, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { minByRisiko: 0.13, minKunder: 3000 },
    tekst: 'En tidligere kunde fortæller i radioen om sit spil hos jer: bonusserne, beskederne og nætterne. Han siger, at ingen spurgte, om han var okay.',
    valg: [
      { tekst: 'Invitér ham ind og lyt', forklaring: 'Et ærligt møde. Hans råd bliver til nye rutiner, og omdømmet får et løft.', effekt: { energiAlle: -5, byRisiko: -0.08, omdoemme: 3 } },
      { tekst: 'Send en skriftlig kommentar', forklaring: 'Korrekt og kort. Lytterne er ikke overbeviste.', effekt: { omdoemme: -2 } },
      { tekst: 'Ingen kommentarer', forklaring: 'Historien kører videre uden jer, og politikerne lytter med.', effekt: { omdoemme: -5, tillidAlle: -2, politiskPres: 0.2 } },
    ],
  },
];

// ---------- AI-akten 2026-2035: hverken frelse eller undergang ----------
const AI_AKT: EventDef[] = [
  {
    id: 'computeTilSpotpris', titel: 'Compute til spotpris', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { agent: ALLE_AGENTER },
    tekst: 'En ny generation af chips er kommet, og cloudpriserne er faldet brat. Jeres compute-regning for kvartalet er næsten halveret.',
    valg: [
      { tekst: 'Brug besparelsen på overvågning', forklaring: 'Lidt penge i kassen og færre AI-uheld. Overvågningen kræver lidt flere mandetimer.', effekt: { kapital: 0.2, agentOvervaagning: 0.1 } },
      { tekst: 'Flere eksperimenter i AI-laboratoriet', forklaring: 'Pengene går til nye idéer.', effekt: { indsigt: 12 } },
      { tekst: 'Tag pengene hjem', forklaring: 'Investorerne er glade. Agenterne kører videre som før.', effekt: { kapital: 0.5, pres: -0.5 } },
    ],
  },
  {
    id: 'gpuMangel', titel: 'Der er ingen GPU\'er', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.003, engang: false, cooldownUger: 104,
    kraever: { agent: ALLE_AGENTER },
    tekst: 'Cloududbyderen har rationeret sine GPU\'er. Jeres agenter kører i slowmotion, og kundeservicechatten svarer bare "Et øjeblik ..."',
    valg: [
      { tekst: 'Betal overpris for prioritet', forklaring: 'Agenterne kører igen. Fakturaen gør ondt.', effekt: { kapital: -0.6 } },
      { tekst: 'Mennesker tager over en måned', forklaring: 'Holdet dækker hullerne. Nogle kunder bliver utålmodige.', effekt: { energiAlle: -20, kunderPct: -0.02 } },
      { tekst: 'Flyt til et billigt datacenter uden for EU', forklaring: 'Billigt og hurtigt, men kundedata forlader EU, og tilsynene vil høre hvorfor.', effekt: { kapital: -0.1, tillidAlle: -3 } },
    ],
  },
  {
    id: 'fagforeningenBankerPaa', titel: 'Fagforeningen banker på', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2033, chancePrUge: 0.004, engang: true,
    kraever: { minStaff: 8 },
    tekst: 'Fagforeningen har hørt om jeres AI-laboratorium og vil forhandle en aftale: Hvem bliver erstattet, og hvem bliver omskolet?',
    valg: [
      { tekst: 'Lav en aftale om omskoling', forklaring: 'Det koster, men holdet ved, hvor de står, og stemningen stiger.', effekt: { kapital: -0.3, energiAlle: 15, omdoemme: 2 } },
      { tekst: 'Lov ingen fyringer i to år', forklaring: 'Holdet ånder lettet op. Investorerne synes, I binder jer selv.', effekt: { energiAlle: 20, pres: 1 } },
      { tekst: 'Det er ledelsens ret', forklaring: 'Ingen udgifter. Holdet begynder at opdatere deres CV.', effekt: { energiAlle: -20, omdoemme: -2 } },
    ],
  },
  {
    id: 'kundernesAgenter', titel: 'Kundernes egne agenter', trigger: 'tilfaeldig', fraAar: 2028, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { minKunder: 5000 },
    tekst: 'Tusindvis af kunders personlige AI-agenter tjekker nu alle bookmakeres odds hvert sekund og spiller kun dér, hvor prisen er bedst. Marginen smelter.',
    valg: [
      { tekst: 'Byg et officielt agent-API', forklaring: 'Dyrt at bygge, men agenterne vælger jer, når jeres priser er skarpe.', effekt: { kapital: -0.6, kunderPct: 0.03, indsigt: 6 } },
      { tekst: 'Bloker agenterne', forklaring: 'Marginen er reddet på kort sigt. Kunderne med agenter går et andet sted hen.', effekt: { kapital: 0.3, kunderPct: -0.05, omdoemme: -2 } },
      { tekst: 'Skær marginen og kæmp på pris', forklaring: 'Agenterne elsker jer. Regnskabet gør ikke.', effekt: { kapital: -1.2, kunderPct: 0.06, hype: 6 } },
    ],
  },
  {
    id: 'deepfakeDirektoer', titel: 'Det har direktøren aldrig sagt', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.003, engang: true,
    kraever: { minKunder: 2000 },
    tekst: 'En video går viralt: jeres direktør lover "dobbelt op på alle indbetalinger i weekenden". Stemmen er perfekt. Direktøren har aldrig sagt det.',
    valg: [
      { tekst: 'Advar kunderne og politianmeld', forklaring: 'Hurtig og ærlig reaktion. Nogle kunder er skuffede.', effekt: { kapital: -0.05, kunderPct: -0.01, omdoemme: 1 } },
      { tekst: 'Indfri tilbuddet alligevel', forklaring: 'Kunderne jubler, og omtalen er god. Det er dyrt, og tilsynene har ikke godkendt bonussen.', effekt: { kapital: -1.0, hype: 10, omdoemme: 3, tillidAlle: -2 } },
      { tekst: 'Ignorer den', forklaring: 'Videoen lever videre, og kunderne bliver forvirrede.', effekt: { omdoemme: -4, kunderPct: -0.02, tillidAlle: -1 } },
    ],
  },
  {
    id: 'aiHoeringen', titel: 'Høring på Christiansborg', trigger: 'tilfaeldig', fraAar: 2027, tilAar: 2034, chancePrUge: 0.003, engang: true,
    kraever: { licens: 'dk' },
    tekst: 'Folketinget holder høring om AI i spillebranchen. I er inviteret som "den lille udfordrer, der bruger AI". Kameraerne er tændt.',
    valg: [
      { tekst: 'Vis, hvordan I overvåger agenterne', forklaring: 'Forberedelsen tager tid, men politikerne lytter, og tilsynene nikker.', effekt: { energiAlle: -10, tillidAlle: 3, politiskPres: -0.3 } },
      { tekst: 'Lobby for lempelige regler bag lukkede døre', forklaring: 'Reglerne bliver måske blødere. Journalisterne opdager møderne.', effekt: { kapital: -0.2, politiskPres: -0.5, omdoemme: -4 } },
      { tekst: 'Bliv hjemme', forklaring: 'Intet arbejde. Andre skriver reglerne for jer.', effekt: { politiskPres: 0.3 } },
    ],
  },
  {
    id: 'agentixRinger', titel: 'Agentix ringer', trigger: 'medarbejder', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 52,
    kraever: { minStaff: 4 },
    tekst: 'Agentix, det AI-native spilselskab med 11 ansatte og 400 agenter, har tilbudt {navn} dobbelt løn og aktieoptioner.',
    valg: [
      { tekst: 'Match med løn og optioner', forklaring: '{navn} bliver. Lønnen stiger 40 %, og investorerne kan ikke lide udvandingen.', effekt: { staffLoenPct: 0.4, staffEnergi: 15, vaerdiPct: -0.02 } },
      { tekst: 'Tilbyd ansvar for AI-laboratoriet', forklaring: 'Mindre løn end hos Agentix, men mere mening. {navn} bliver, og resten af holdet føler sig lidt forbigået.', effekt: { staffLoenPct: 0.15, staffEnergi: 35, indsigt: 4, energiAlle: -5 } },
      { tekst: 'Ønsk held og lykke', forklaring: '{navn} forlader firmaet.', effekt: { staffForlader: true } },
    ],
  },
  {
    id: 'agentixLander', titel: 'Agentix lander', trigger: 'tilfaeldig', fraAar: 2027, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { minKunder: 5000 },
    tekst: 'Agentix lancerer i jeres markeder med bedre odds, tusind nye slots om ugen og en app, der snakker med kunderne. De har 11 ansatte.',
    valg: [
      { tekst: 'Sats på brand og tryghed', forklaring: 'En kampagne om menneskene bag skærmen. Nogle kunder prøver Agentix alligevel.', effekt: { kapital: -0.5, omdoemme: 3, kunderPct: -0.02 } },
      { tekst: 'Match deres odds', forklaring: 'Kunderne bliver. Marginen gør ikke.', effekt: { kapital: -1.5, kunderPct: 0.01 } },
      { tekst: 'Sælg jeres platform til dem', forklaring: 'De mangler licenser og compliance. I tjener godt, men styrker en konkurrent.', effekt: { kapital: 1.0, kunderPct: -0.05, indsigt: 5 } },
    ],
  },
  {
    id: 'modellenElskerNatteravne', titel: 'Modellen elsker natteravne', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.005, engang: false, cooldownUger: 52,
    kraever: { hyper: true },
    tekst: 'Analysen viser, at hyperpersonaliseringen virker allerbedst på kunder, der spiller efter midnat. Mange af dem har risikotegn.',
    valg: [
      { tekst: 'Udeluk kunder med risikotegn', forklaring: 'Lidt lavere omsætning. Byen bliver roligere, og tilsynene bemærker det.', effekt: { kapital: -0.3, byRisiko: -0.08, tillidAlle: 2 } },
      { tekst: 'Lad modellen gøre sit arbejde', forklaring: 'Omsætningen stiger. Natteravnene glider videre mod rødt.', effekt: { kapital: 0.8, byRisiko: 0.08, tillidAlle: -3 } },
      { tekst: 'Sluk hyperpersonaliseringen', forklaring: 'I mister ARPU-forspringet. Byen falder til ro, og tilsynene ser det.', effekt: { hyperFra: true, byRisiko: -0.1, tillidAlle: 3 } },
    ],
  },
  {
    id: 'visOsModellen', titel: 'Vis os modellen', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { hyper: true },
    tekst: 'Tilsynene vil forstå, hvordan hyperpersonaliseringen vælger tilbud til den enkelte kunde. "Vis os, hvad den gør. Ikke hvad I tror, den gør."',
    valg: [
      { tekst: 'Åbn modellen og forklar', forklaring: 'Holdet bruger to uger på dokumentation. Tilsynene er imponerede.', effekt: { energiAlle: -15, tillidAlle: 4 } },
      { tekst: 'Send en overordnet beskrivelse', forklaring: 'Hurtigt og nemt. Tilsynene er ikke tilfredse.', effekt: { tillidAlle: -3 } },
      { tekst: 'Sluk den før mødet', forklaring: 'Intet at vise, intet at forklare. ARPU-forspringet er væk.', effekt: { hyperFra: true, tillidAlle: 1 } },
    ],
  },
  {
    id: 'hvordanVidsteDeDet', titel: '"Hvordan vidste de det?"', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { hyper: true, minKunder: 3000 },
    tekst: 'En kunde har opdaget, at jeres tilbud rammer præcis de nætter, hvor hun ikke kan sove. Hendes opslag er delt 40.000 gange.',
    valg: [
      { tekst: 'Forklar åbent, hvad modellen bruger', forklaring: 'Nogle kunder går, men mange sætter pris på ærligheden.', effekt: { omdoemme: 1, kunderPct: -0.02, tillidAlle: 1 } },
      { tekst: 'Giv kunderne en slukknap', forklaring: 'Det koster at bygge og lidt omsætning, men byen bliver roligere.', effekt: { kapital: -0.2, byRisiko: -0.05, omdoemme: 3 } },
      { tekst: 'Ingen kommentarer', forklaring: 'Opslaget spreder sig, og politikerne læser med.', effekt: { omdoemme: -6, politiskPres: 0.4 } },
    ],
  },
  {
    id: 'hvadSkalViNuLave', titel: 'Hvad skal vi nu lave?', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { agent: ['kundeservice'] },
    tekst: 'Kunderne elsker jeres AI-kundeservice: svar på tre sekunder, på 40 sprog, midt om natten. Det menneskelige kundeserviceteam spørger, hvad de nu skal lave.',
    valg: [
      { tekst: 'Flyt dem til ansvarligt spil', forklaring: 'De ringer til kunder i risiko. Det koster løn, men byen bliver roligere.', effekt: { kapital: -0.1, byRisiko: -0.08, tillidAlle: 2 } },
      { tekst: 'Flyt dem til VIP-pleje', forklaring: 'Storspillerne elsker personlig service. Nogle af dem spiller for meget.', effekt: { kapital: 0.3, byRisiko: 0.04 } },
      { tekst: 'Sig farvel med en god pakke', forklaring: 'Lønudgiften falder. Historien når avisen, og resten af holdet bliver urolige.', effekt: { kapital: 0.4, omdoemme: -3, energiAlle: -10 } },
    ],
  },
  {
    id: 'agentenSaaDetFoerst', titel: 'Agenten så det først', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { agent: ['risiko'], minByRisiko: 0.06 },
    tekst: 'Risikoagenten har fundet 40 kunder, hvis mønster ligner tidligere problemspilleres. Tre måneder før et menneske ville have set det. Den tager dog fejl en gang imellem.',
    valg: [
      { tekst: 'Ring til dem alle', forklaring: 'Nogle føler sig overvåget, de fleste er glade. Byen bliver roligere.', effekt: { kapital: -0.1, kunderPct: -0.01, byRisiko: -0.12, tillidAlle: 2 } },
      { tekst: 'Send en automatisk pausebesked', forklaring: 'Billigt og diskret. Effekten er mindre.', effekt: { byRisiko: -0.05 } },
      { tekst: 'Vent og se', forklaring: 'Ingen udgifter. Tilsynene vil en dag spørge, hvorfor I ikke brugte listen.', effekt: { tillidAlle: -2 } },
    ],
  },
  {
    id: 'halvtredsSlotsOmUgen', titel: '50 nye slots om ugen', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { agent: ['indhold'] },
    tekst: 'Indholdsagenten kan lave 50 nye slots om ugen. Spillerforum har allerede et navn for dem: "AI-grød".',
    valg: [
      { tekst: 'Kuratér hårdt: fem om ugen', forklaring: 'Holdet vælger de bedste ud. Kvalitet koster tid.', effekt: { kapital: 0.1, energiAlle: -5, omdoemme: 2 } },
      { tekst: 'Udgiv dem alle', forklaring: 'Masser af nyt og lidt ekstra omsætning. Spillerforum er ikke imponeret.', effekt: { kapital: 0.4, hype: 4, omdoemme: -4 } },
      { tekst: 'Mærk AI-spil tydeligt', forklaring: 'Nogle kunder undgår dem. Tilsynene kan lide gennemsigtigheden.', effekt: { kapital: 0.15, tillidAlle: 1, omdoemme: 1 } },
    ],
  },
  {
    id: 'aftenskolen', titel: 'Aftenskolen', trigger: 'medarbejder', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 52,
    tekst: '{navn} har fulgt aftenkurser i maskinlæring og bygget en lille model, der forudsiger, hvilke kunder der er ved at forlade jer. Nu vil {navn} gerne arbejde i AI-laboratoriet.',
    valg: [
      { tekst: 'Betal resten af uddannelsen', forklaring: 'En lille investering. {navn} får lidt mere i løn og masser af gejst.', effekt: { kapital: -0.04, indsigt: 8, staffLoenPct: 0.1, staffEnergi: 25 } },
      { tekst: 'Brug modellen, men ikke nu', forklaring: 'Gratis indsigt. {navn} havde håbet på mere.', effekt: { indsigt: 5, staffEnergi: -20 } },
    ],
  },
  {
    id: 'agentModAgent', titel: 'Agent mod agent', trigger: 'tilfaeldig', fraAar: 2027, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { agent: ['kundeservice'] },
    tekst: 'En kundes AI-agent har forhandlet med jeres chatbot i 40 minutter og fået den til at love en "loyalitetsbonus" på 5.000 kr. Udskriften er ret morsom.',
    valg: [
      { tekst: 'Indfri og luk hullet', forklaring: 'Kunden er glad. I skruer op for overvågningen, som koster lidt mandetimer.', effekt: { kapital: -0.05, agentOvervaagning: 0.1, omdoemme: 1 } },
      { tekst: 'Afvis bonussen', forklaring: 'Gratis, men udskriften bliver delt, og kunderne griner af jer.', effekt: { omdoemme: -2, kunderPct: -0.01 } },
    ],
  },
  {
    id: 'traetAfRobotter', titel: 'Træt af at rette robotter', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: false, cooldownUger: 78,
    kraever: { agent: ALLE_AGENTER, minStaff: 4 },
    tekst: 'Holdet bruger halvdelen af dagen på at godkende agenternes arbejde. "Den har ret 98 % af gangene. Kan vi ikke bare stole på den?"',
    valg: [
      { tekst: 'Ansæt en AI-reviewer', forklaring: 'Det koster, men holdet slipper for rutinen, og kontrollen bliver bedre.', effekt: { kapital: -0.3, energiAlle: 10, agentOvervaagning: 0.1 } },
      { tekst: 'Sænk overvågningen', forklaring: 'Holdet får luft. Agenterne laver flere fejl, og nogle af dem bliver dyre.', effekt: { energiAlle: 20, agentOvervaagning: -0.2 } },
      { tekst: 'Sådan er det', forklaring: 'Kontrollen holder. Humøret gør ikke.', effekt: { energiAlle: -10 } },
    ],
  },
];

// ---------- Verdensscenarierne (7.14) ----------
const VERDEN: EventDef[] = [
  {
    id: 'finansministerenKommer', titel: 'Finansministeren kommer forbi', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { scenarie: ['afgiftsvinter'], licens: 'dk' },
    tekst: 'Finansministeren vil besøge et "sundt spilselskab" for at vise, at branchen godt kan bære en højere afgift. Pressen følger med.',
    valg: [
      { tekst: 'Vis tallene ærligt, også offshore-truslen', forklaring: 'Ministeren lytter. Tilsynet sætter pris på åbenheden.', effekt: { energiAlle: -5, tillid: 3, politiskPres: -0.2 } },
      { tekst: 'Kagebord og fotomuligheder', forklaring: 'Flotte billeder og god omtale. Afgiften stiger nok alligevel.', effekt: { kapital: -0.02, hype: 8, omdoemme: 2 } },
      { tekst: 'Tru med at flytte til Malta', forklaring: 'Ministeren smiler stramt. Journalisterne skriver ivrigt.', effekt: { omdoemme: -4, tillid: -3, politiskPres: 0.4 } },
    ],
  },
  {
    id: 'efterMegafusionen', titel: 'Efter megafusionen', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { scenarie: ['afgiftsvinter'] },
    tekst: 'To af de store internationale grupper har fusioneret for at overleve afgiftsvinteren. 40 dygtige folk i København har fået en fyreseddel og en papkasse.',
    valg: [
      { tekst: 'Invitér de fem bedste på kaffe', forklaring: 'Gode hoveder med erfaring. Det koster lidt at lokke dem.', effekt: { kapital: -0.2, indsigt: 10, energiAlle: 5 } },
      { tekst: 'Overtag deres gamle affiliate-aftaler', forklaring: 'Nye kunder med det samme. Aftalerne er aggressive, og tilsynene kender dem.', effekt: { kapital: -0.3, kunderPct: 0.04, tillidAlle: -2 } },
      { tekst: 'Vi har nok at se til', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'boersenVilVaereVenner', titel: 'Børsen vil være venner', trigger: 'tilfaeldig', fraAar: 2027, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { scenarie: ['pmOmvaeltning'], minKunder: 5000 },
    tekst: 'Kalshee, den amerikanske eventbørs, vil ind i Europa og søger en partner med licenser og kunder. "Vi kalder det ikke betting. Det er handel."',
    valg: [
      { tekst: 'Start et lille pilotprojekt', forklaring: 'I lærer meget uden at binde jer.', effekt: { kapital: -0.2, indsigt: 10 } },
      { tekst: 'Gå all in som partner', forklaring: 'Mange penge og masser af omtale. De europæiske tilsyn er ikke sikre på, at det er "handel".', effekt: { kapital: 1.5, hype: 12, tillidAlle: -4, politiskPres: 0.3 } },
      { tekst: 'Nej tak', forklaring: 'Ingen ændring.', effekt: {} },
    ],
  },
  {
    id: 'tvDebatten', titel: 'Tv-debatten', trigger: 'tilfaeldig', fraAar: 2026, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { scenarie: ['denHaardeHaand'] },
    tekst: 'Efter skandalen skal tv debattere et totalt reklameforbud. Studiet mangler en udbyder, der tør stille op mod to politikere og en forsker.',
    valg: [
      { tekst: 'Stil op med egne forslag', forklaring: 'Svært, men I virker troværdige. Holdet har forberedt jer hele ugen.', effekt: { energiAlle: -10, omdoemme: 4, tillidAlle: 2 } },
      { tekst: 'Send branchens lobbyist', forklaring: 'Han er dygtig. Seerne kan ikke fordrage ham.', effekt: { omdoemme: -2, politiskPres: 0.2 } },
      { tekst: 'Tak nej', forklaring: 'Den tomme stol står midt i billedet hele aftenen.', effekt: { omdoemme: -3 } },
    ],
  },
  {
    id: 'oekonomitjekket', titel: 'Økonomitjekket', trigger: 'tilfaeldig', fraAar: 2027, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { scenarie: ['denHaardeHaand'], minVip: 1 },
    tekst: 'De nye regler kræver, at storspillere dokumenterer deres økonomi. VIP-afdelingen foreslår at "hjælpe dem lidt med papirerne".',
    valg: [
      { tekst: 'Følg reglerne til punkt og prikke', forklaring: 'Mange storspillere kan ikke dokumentere nok og spiller mindre. Tilsynene er tilfredse.', effekt: { kapital: -0.4, byRisiko: -0.08, tillidAlle: 3 } },
      { tekst: 'Hjælp dem med papirerne', forklaring: 'Storspillerne bliver. Kigger tilsynene efter, ser det slemt ud.', effekt: { kapital: 0.4, tillidAlle: -6 } },
      { tekst: 'Luk VIP-programmet helt', forklaring: 'VIP-niveauet går til 0. Omsætningen falder, men I er et skridt foran reglerne.', effekt: { vipNiveau: 0, byRisiko: -0.1, tillidAlle: 5, omdoemme: 2 } },
    ],
  },
  {
    id: 'tilsynetBederOmHjaelp', titel: 'Tilsynet beder om hjælp', trigger: 'tilfaeldig', fraAar: 2027, tilAar: 2035, chancePrUge: 0.004, engang: true,
    kraever: { scenarie: ['kanaliseringensTilbagetog'] },
    tekst: 'Tilsynene vil vinde spillerne tilbage fra de ulicenserede sider og foreslår en fælles kampagne med de lovlige udbydere: "Spil, hvor du er beskyttet."',
    valg: [
      { tekst: 'Deltag med budget og data', forklaring: 'Det koster, men I står forrest, når spillerne kommer tilbage.', effekt: { kapital: -0.3, kunderPct: 0.03, tillidAlle: 4 } },
      { tekst: 'Kør jeres egen kampagne', forklaring: 'Flere kunder til jer alene. Tilsynene havde håbet på samarbejde.', effekt: { kapital: -0.5, kunderPct: 0.05, tillidAlle: -1 } },
      { tekst: 'Lad de andre betale', forklaring: 'Gratis. De andre får æren og kunderne.', effekt: { omdoemme: -1 } },
    ],
  },
];

export const FLERE_EVENTS: EventDef[] = [...AKT1, ...FRISTELSER, ...SPILLERBYEN, ...AI_AKT, ...VERDEN];
