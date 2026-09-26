// Arkivet (spec 6.18): "I virkeligheden…" — det ENESTE sted i koden med rigtige firmanavne.
// Alle tekster er skrevet ud fra faktalisten i spec 7.15 og intet andet. Opslagene låses op, når tilknyttede
// events, konkurrenter eller markeder dukker op i spillet.

export type ArkivOpslag = { id: string; titel: string; tekst: string; kilde: string };

export const ARKIV: ArkivOpslag[] = [
  {
    id: 'a1', titel: 'Danmark åbner', kilde: '7.15 nr. 1',
    tekst: 'I virkeligheden åbnede Danmark for online betting og kasino den 1. januar 2012, mens lotteri forblev statsmonopol. Afgiften var 20 %, og den blev hævet til 28 % i 2021.',
  },
  {
    id: 'a2', titel: 'Det danske marked i 2025', kilde: '7.15 nr. 2',
    tekst: 'I virkeligheden havde det danske marked 11,5 mia. kr. i BSI i 2025. Online kasino var størst med 4,31 mia. kr. (+12,1 %), mens sportsbetting lå på 2,13 mia. kr. (−11,5 %). Online udgjorde 73 % mod 33 % i 2012, kanaliseringen var 91,5 % i 2024, og ROFUS havde 68.026 registrerede ved udgangen af 2025.',
  },
  {
    id: 'a3', titel: 'Statsselskabet', kilde: '7.15 nr. 3',
    tekst: 'I virkeligheden havde Danske Spil 5.158 mio. kr. i BSI og sit højeste resultat nogensinde (2.008 mio. kr. efter skat) i 2025, selv om sportsspil var under pres fra internationale aktører. Tivoli Casino blev lanceret i 2012 og senere overtaget af Danske Spil.',
  },
  {
    id: 'a4', titel: 'Superligaen og påbud', kilde: '7.15 nr. 4',
    tekst: 'I virkeligheden overtog Betano sponsoratet af 3F Superligaen fra sæson 2025/26. Kindred/Unibet fik påbud fra Spillemyndigheden i 2021 og 2022 for mangler i hvidvaskprocedurerne.',
  },
  {
    id: 'a5', titel: 'Spilpakke 1', kilde: '7.15 nr. 5',
    tekst: 'I virkeligheden blev Spilpakke 1 aftalt i oktober 2025 (lovforslag L 127). Den udvider whistle-to-whistle-forbuddet, forbyder brand-ambassadører under 25 år og free-to-play-velkomstbonusser og træder i kraft 1. juli 2026 med dele fra 1. januar 2027.',
  },
  {
    id: 'a6', titel: 'Sverige', kilde: '7.15 nr. 6',
    tekst: 'I virkeligheden åbnede Sverige i 2019 med en afgift på 18 %, som blev hævet til 22 % i juli 2024. Kanaliseringen var 84 % i 2025 (betting 96 %, kasino 81 %). Svenska Spel lukkede sit sidste kasino i april 2025.',
  },
  {
    id: 'a7', titel: 'Storbritannien', kilde: '7.15 nr. 7',
    tekst: 'I virkeligheden stiger den britiske remote gaming duty til 40 % fra april 2026, og fjern-betting stiger til 25 % fra april 2027. Online slots fik indsatsgrænser på £5/£2 i 2025, og Premier League-klubberne fjerner spilsponsorer fra brystet fra 2026/27.',
  },
  {
    id: 'a8', titel: 'Holland', kilde: '7.15 nr. 8',
    tekst: 'I virkeligheden åbnede Holland i oktober 2021 og har Europas højeste afgift på 37,8 % (2026). Kanaliseringen målt på BSR faldt til ca. 49-53 %, og en afgiftsstigning, der skulle give 108 mio. euro, gav ca. 2 mio. euro.',
  },
  {
    id: 'a9', titel: 'Tyskland', kilde: '7.15 nr. 9',
    tekst: 'I virkeligheden har Tyskland siden 2021 haft en indsatsafgift på 5,3 % og en månedsgrænse på €1.000. Myndighed og branche er meget uenige om kanaliseringen, der vurderes til alt fra ca. 50 % til 97 %.',
  },
  {
    id: 'a10', titel: 'Finland', kilde: '7.15 nr. 10',
    tekst: 'I virkeligheden åbner Finland den 1. juli 2027 med 22 % afgift og forbud mod affiliate-markedsføring. Omkring 50 operatører har søgt licens, og mere end halvdelen af finnernes digitale spilforbrug går i dag til offshore.',
  },
  {
    id: 'a11', titel: 'Norge', kilde: '7.15 nr. 11',
    tekst: 'I virkeligheden har Norge bevaret monopolet med betalingsblokering siden 2010 og DNS-blokering fra 2025. Kindred forlod Norge efter at være blevet opkøbt af FDJ.',
  },
  {
    id: 'a12', titel: 'Ontario', kilde: '7.15 nr. 12',
    tekst: 'I virkeligheden åbnede Ontario i april 2022 med 20 % til provinsen og havde C$4,0 mia. i NAGGR i 2025. Kanaliseringen er målt til 84-90 % eller mere.',
  },
  {
    id: 'a13', titel: 'USA', kilde: '7.15 nr. 13',
    tekst: 'I virkeligheden fjernede USA\'s højesteret forbuddet mod sportsbetting i 2018. DraftKings og FanDuel har tilsammen ca. 68 % af indsatserne (2026), og New York har en afgift på 51 %. ESPN Bet blev lukket og relanceret som theScore Bet i december 2025.',
  },
  {
    id: 'a14', titel: 'Prediction markets', kilde: '7.15 nr. 14',
    tekst: 'I virkeligheden omsatte prediction markets for $44-50 mia. i 2025, og sport har udgjort ca. 80 % af Kalshis volumen. I august 2026 dømte to føderale appeldomstole modsat, så sagen peger mod Supreme Court.',
  },
  {
    id: 'a15', titel: 'De store opkøb', kilde: '7.15 nr. 15',
    tekst: 'I virkeligheden blev branchen samlet gennem store opkøb: Flutter–The Stars Group (2020), Evolution–NetEnt (2020), 888–William Hill International (2022), MGM–LeoVegas (2022) og FDJ–Kindred (2024, ca. €2,5 mia.). Flutter overtog 100 % af FanDuel i 2025.',
  },
  {
    id: 'a16', titel: 'Byg eller køb platformen', kilde: '7.15 nr. 16',
    tekst: 'I virkeligheden blev Kambi udskilt fra Unibet i 2014 som B2B-sportsbookleverandør, og Kindred byggede senere sin egen sportsbook over ca. tre år.',
  },
  {
    id: 'a17', titel: 'Prævalens', kilde: '7.15 nr. 17',
    tekst: 'I virkeligheden havde 5,2 % af voksne danskere mindst et lavt niveau af pengespilsproblemer i 2016 og 10,9 % i 2021. Problemspillere foretrækker online kasino og online væddemål.',
  },
  {
    id: 'a18', titel: 'Hold og RTP', kilde: '7.15 nr. 18',
    tekst: 'I virkeligheden holder kombispil typisk 18-25 %, mens 1X2 på fodbold holder 5-6 %. Live-kasino har en RTP på 97-99 % og slots 94-97 %.',
  },
];

export const ARKIV_BY_ID: Record<string, ArkivOpslag> = Object.fromEntries(ARKIV.map((a) => [a.id, a]));

/** Konkurrenternes og hændelsernes arkiv-id'er → opslag (kun hvor faktalisten siger noget) */
export const ARKIV_ALIAS: Record<string, string> = {
  'dk-statsselskab': 'a3',
  'nordisk-gruppe-1': 'a16',
  'app-first-1': 'a15',
  'app-first-2': 'a4',
  'se-statsselskab': 'a6',
  'se-lokal': 'a6',
  'global-gigant-2': 'a15',
  'global-gigant-4': 'a15',
  'uk-lokal': 'a7',
  'global-gigant-3': 'a7',
  'nl-statsselskab': 'a8',
  'nl-lokal': 'a8',
  'de-lokal-1': 'a9',
  'de-lokal-2': 'a9',
  'fi-statsselskab': 'a10',
  'no-statsselskab': 'a11',
  'us-gigant-1': 'a13',
  'us-gigant-2': 'a13',
  'us-gruppe': 'a13',
  'us-pm': 'a14',
  'b2b-sportsbook': 'a16',
  'b2b-live': 'a15',
};

/** Markedernes opslag (låses op, når markedet åbner) */
export const ARKIV_MARKED: Record<string, string> = { dk: 'a1', se: 'a6', uk: 'a7', nl: 'a8', de: 'a9', fi: 'a10', no: 'a11', on: 'a12', us: 'a13' };

export function arkivId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return ARKIV_BY_ID[id] ? id : ARKIV_ALIAS[id];
}

/** Eftertanke (spec 6.17): tre nysgerrige kort om, hvor din vej afveg fra den virkelige. Betingelserne vurderes i src/sim/endings.ts. */
export const EFTERTANKE: { id: string; titel: string; tekst: string; arkivId: string }[] = [
  { id: 'overhaledeStat', titel: 'I overhalede statsselskabet', tekst: 'I blev nr. 1 i Danmark. I virkeligheden havde Danske Spil sit højeste resultat nogensinde i 2025.', arkivId: 'a3' },
  { id: 'koebteUnibit', titel: 'I købte Unibit', tekst: 'I kom først. I virkeligheden blev Kindred købt af FDJ i 2024 for ca. €2,5 mia.', arkivId: 'a15' },
  { id: 'vandtLiga', titel: 'Superligaen var jeres', tekst: 'I vandt sponsoratet. I virkeligheden overtog Betano sponsoratet af 3F Superligaen fra sæson 2025/26.', arkivId: 'a4' },
  { id: 'egenPlatform', titel: 'I byggede selv', tekst: 'I byggede jeres egen platform. I virkeligheden tog det Kindred ca. tre år at bygge sin egen sportsbook, efter at Kambi var udskilt i 2014.', arkivId: 'a16' },
  { id: 'offshore', titel: 'Den grå vej', tekst: 'I prøvede et offshore-brand. I virkeligheden var den danske kanalisering 91,5 % i 2024.', arkivId: 'a2' },
  { id: 'byRoed', titel: 'Byen blev rød', tekst: 'Mange af jeres kunder endte i risiko eller problem. I virkeligheden havde 10,9 % af voksne danskere mindst et lavt problemniveau i 2021.', arkivId: 'a17' },
  { id: 'byGroen', titel: 'Byen holdt sig grøn', tekst: 'Få af jeres kunder endte i risiko eller problem. I virkeligheden steg andelen med mindst et lavt problemniveau fra 5,2 % i 2016 til 10,9 % i 2021.', arkivId: 'a17' },
  { id: 'norgeAabnede', titel: 'Norge åbnede', tekst: 'I jeres verden faldt monopolet. I virkeligheden har Norge bevaret det med betalingsblokering siden 2010 og DNS-blokering fra 2025.', arkivId: 'a11' },
  { id: 'hoejesteret', titel: 'Event-kontrakterne vandt', tekst: 'I jeres verden gav højesteret den føderale myndighed eneret. I virkeligheden dømte to appeldomstole modsat i august 2026.', arkivId: 'a14' },
  { id: 'usaStor', titel: 'I tog USA', tekst: 'I fik en stor andel i USA. I virkeligheden har DraftKings og FanDuel tilsammen ca. 68 % af indsatserne (2026).', arkivId: 'a13' },
  { id: 'hollandAfgift', titel: 'Afgiftsvinteren i Holland', tekst: 'Afgifterne steg i jeres Europa. I virkeligheden gav en hollandsk afgiftsstigning, der skulle give 108 mio. euro, ca. 2 mio. euro.', arkivId: 'a8' },
  { id: 'ontario', titel: 'Ontario', tekst: 'I gik ind i Ontario. I virkeligheden havde provinsen C$4,0 mia. i NAGGR i 2025.', arkivId: 'a12' },
  { id: 'sverige', titel: 'Sverige', tekst: 'I gik ind i Sverige. I virkeligheden hævede Sverige afgiften fra 18 % til 22 % i 2024, og Svenska Spel lukkede sit sidste kasino i 2025.', arkivId: 'a6' },
  { id: 'kombispil', titel: 'Kombispillenes magi', tekst: 'Jeres bet builders holdt godt. I virkeligheden holder kombispil typisk 18-25 %, mens 1X2 holder 5-6 %.', arkivId: 'a18' },
  { id: 'dlKoebte', titel: 'Statsselskabet købte jer', tekst: 'Danske Lykke købte jer til sidst. I virkeligheden havde Danske Spil sit højeste resultat nogensinde i 2025.', arkivId: 'a3' },
  { id: 'byMidt', titel: 'Byen i balance', tekst: 'De fleste af jeres kunder spillede for sjov, men nogle endte i risiko eller problem. I virkeligheden havde 10,9 % af voksne danskere mindst et lavt problemniveau i 2021.', arkivId: 'a17' },
  { id: 'licenseretVej', titel: 'Den licenserede vej', tekst: 'I holdt jer til licenserne hele vejen. I virkeligheden var den danske kanalisering 91,5 % i 2024.', arkivId: 'a2' },
  { id: 'opkoebt', titel: 'I blev købt', tekst: 'I solgte firmaet. I virkeligheden blev branchen samlet gennem store opkøb, fx MGM–LeoVegas og 888–William Hill International i 2022.', arkivId: 'a15' },
  { id: 'danmarkStart', titel: 'Hvor det begyndte', tekst: 'I startede i en garage i 2012. I virkeligheden åbnede Danmark for online betting og kasino den 1. januar 2012.', arkivId: 'a1' },
];
