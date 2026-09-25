// Slutninger og eftermæle (spec 6.17). Tal er [D].

export type SlutId = 'exit' | 'boersnotering' | 'leverandoer' | 'ansvarligUdfordrer' | 'aiNativeLeder' | 'danskeLykke' | 'tabtLicens' | 'konkurs';

export const SLUTNINGER: Record<SlutId, { titel: string; tekst: string; tone: 'godt' | 'blandet' | 'skidt' }> = {
  exit: { titel: 'Exit', tone: 'godt', tekst: 'I solgte firmaet til en større aktør. Stifterne går derfra med en god check, og garagen er et minde.' },
  boersnotering: { titel: 'Børsnotering', tone: 'godt', tekst: 'Klokken ringer på børsen. Udfordreren fra garagen er nu et børsnoteret selskab med aktionærer, analytikere og kvartalsrapporter.' },
  leverandoer: { titel: 'Leverandøren', tone: 'godt', tekst: 'I blev dem, de andre bygger på. Jeres platform kører hos operatører i hele Europa, og B2B-kontrakterne bærer firmaet.' },
  ansvarligUdfordrer: { titel: 'Den ansvarlige udfordrer', tone: 'godt', tekst: 'Tilsynene bruger jer som eksempel, byen er grøn, og kunderne bliver. I beviste, at man kan vokse uden at jagte de sårbare.' },
  aiNativeLeder: { titel: 'AI-native leder', tone: 'blandet', tekst: 'Et lille hold mennesker og en flåde af agenter driver et af branchens mest effektive selskaber. Konkurrenterne studerer jer.' },
  danskeLykke: { titel: 'Opkøbt af Danske Lykke', tone: 'blandet', tekst: 'Statsselskabet købte udfordreren. Jeres brand lever videre som en afdeling i det store hus.' },
  tabtLicens: { titel: 'Tabt licens', tone: 'skidt', tekst: 'Tilsynet trak licensen, og der var ingen andre markeder at falde tilbage på. Kunderne er væk, og holdet er spredt for alle vinde.' },
  konkurs: { titel: 'Konkurs', tone: 'skidt', tekst: 'Pengene slap op. Banken lukkede kassen, og garagen står tom igen. Men kombinationsbogen husker, hvad I lærte.' },
};

export const SLUT_IDS = Object.keys(SLUTNINGER) as SlutId[];

/** Grænser for slutningerne ved spillets afslutning (uge 1247) */
export const SLUT_KRAV = {
  boersVaerdi: 1500, // mio. kr. i selskabsværdi
  ansvarligEftermaele: 88,
  ansvarligRisiko: 0.06,
  aiAgenter: 8,
  aiAndel: 0.4, // agenter / (agenter + medarbejdere)
  leverandoerKunder: 5,
  /** Danske Lykke byder på en mindre udfordrer (kvartalsvis chance) */
  danskeLykkeChance: 0.03,
  danskeLykkeAndel: [0.005, 0.12] as const,
  danskeLykkeMultipel: [2, 3] as const,
};

/** Eftermælets dele (maks point) */
export const EFTERMAELE = { tillid: 25, by: 20, guld: 15, galla: 15, innovation: 10, licens: 15 };
