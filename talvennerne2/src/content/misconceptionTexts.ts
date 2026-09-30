// Parent-facing texts for the 31 misconceptions (SPEC §4.2–4.3, §9.1; pædagogik-forslaget §3.2).
// The child never sees any of this. Concepts are shown as "Vi har set tegn på …" (at most two),
// slips together under "Typiske fejl lige nu" in a neutral tone: they are normal while a skill settles.
import type { MisconceptionId } from '../engine/types'

export interface MisconceptionText {
  /**
   * 'mixed' is digitSwap: a concept in hear*, tensOnes and placeValue1000, a slip elsewhere —
   * natureFor(id, skill) in src/engine/misconceptions.ts decides per skill.
   */
  nature: 'concept' | 'slip' | 'mixed'
  /** Short label, e.g. after "Vi har set tegn på, at barnet …" or as a row in "Typiske fejl lige nu". */
  title: string
  /** A typical answer, written with the app's notation (·, :, −). */
  example: string
  /** One or two calm sentences for the parent: what happens and why it is common. */
  parent: string
  /** Something concrete to do at home — play and everyday things, never homework. */
  homeTip: string
}

export const MISCONCEPTION_TEXTS: Readonly<Record<MisconceptionId, MisconceptionText>> = {
  concatNumberWords: {
    nature: 'concept',
    title: 'skriver talordene efter hinanden',
    example: '»et hundrede og fire« skrives 1004',
    parent: 'Når barnet hører »et hundrede og fire«, skriver det 100 og 4 lige efter hinanden. Det er en naturlig fase, mens de store tal falder på plads.',
    homeTip: 'Byg tallet med tre bægre mærket H, T og E og læg klodser i: 1 hundrede, 0 tiere og 4 enere. Sig tallet højt og skriv det bagefter. Husnumre og sidetal er gode at øve på.',
  },
  zeroPlaceholder: {
    nature: 'concept',
    title: 'springer nullet over som pladsholder',
    example: '304 skrives 34 eller 340',
    parent: 'Barnet dropper eller flytter nullet i tal som 304. Nullet fortæller, at der ingen tiere er, og det er svært at se meningen med i starten.',
    homeTip: 'Læg tallet i tre bægre (H, T og E) og lad et tomt bæger blive til et 0. Kig efter tal med nul i midten på priser og sidetal, fx 104 og 140.',
  },
  faceValue: {
    nature: 'concept',
    title: 'blander cifret og det, cifret er værd',
    example: '7-tallet i 472 er 7 (og ikke 70)',
    parent: 'Barnet svarer med selve cifret i stedet for det, cifret er værd på sin plads. Det er et vigtigt skridt at forstå, at pladsen giver værdien.',
    homeTip: 'Læg 472 kr. med legepenge: 4 hundredkroner, 7 tikroner og 2 enkroner. Spørg: Hvor mange kroner er tikronerne værd tilsammen?',
  },
  addsPlaceParts: {
    nature: 'concept',
    title: 'lægger tiere og enere sammen som almindelige tal',
    example: '4 tiere og 7 enere bliver 11',
    parent: 'Barnet lægger antallet af tiere og enere sammen (4 + 7) i stedet for at se, at 4 tiere og 7 enere er 47.',
    homeTip: 'Bundt ispinde eller sugerør i tiere med en elastik. Tæl bundterne »ti, tyve, tredive, fyrre« og læg de løse til bagefter.',
  },
  forgotCarry: {
    nature: 'concept',
    title: 'glemmer tieren, der skal med',
    example: '38 + 45 bliver 73',
    parent: 'Når enerne tilsammen bliver 10 eller mere, kommer den ekstra tier ikke med. Det er en af de mest almindelige fejl, mens tierovergangen læres.',
    homeTip: 'Regn med mønter: 38 kr. og 45 kr. Når der ligger ti enkroner eller flere, så byt dem til en tikrone. Lad barnet selv lave byttet.',
  },
  smallerFromLarger: {
    nature: 'concept',
    title: 'trækker det mindste ciffer fra det største',
    example: '53 − 27 bliver 34',
    parent: 'I hver kolonne trækker barnet det mindste ciffer fra det største, også når det øverste ciffer er det mindste. Svaret ser rimeligt ud, men er forkert.',
    homeTip: 'Leg butik: Du har 53 kr. og skal betale 27 kr. Der er kun 3 enkroner, så en tikrone må veksles til ti enkroner først. Lad barnet veksle.',
  },
  borrowNoDecrement: {
    nature: 'concept',
    title: 'veksler en tier uden at tage den fra',
    example: '53 − 27 bliver 36',
    parent: 'Barnet veksler en tier til ti enere, men regner videre, som om tierne stadig er der alle sammen.',
    homeTip: 'Leg butik med tikroner og enkroner. Når en tikrone veksles, så læg den synligt over i en skål, så man kan se, at der er én tikrone mindre.',
  },
  placeMisalign: {
    nature: 'concept',
    title: 'lægger enerne til tierne',
    example: '38 + 5 bliver 88',
    parent: 'Barnet lægger et enkeltcifret tal til tierne i stedet for til enerne, fordi cifrene kommer til at stå forkert i forhold til hinanden.',
    homeTip: 'Skriv regnestykker på ternet papir med ét ciffer i hvert tern og enerne lige under hinanden. Eller læg dem med tierbundter og løse ispinde.',
  },
  mulAsAdd: {
    nature: 'concept',
    title: 'lægger sammen, hvor der skal ganges',
    example: '6 · 7 bliver 13',
    parent: 'Barnet lægger tallene sammen, når der skal ganges. Gange er nyt, og plus er det velkendte.',
    homeTip: 'Tal om grupper i hverdagen: 3 tallerkener med 4 kartofler på hver. Hvor mange kartofler er der i alt? Sig det som »3 gange 4«.',
  },
  equalsAsAnswer: {
    nature: 'concept',
    title: 'læser lighedstegnet som »nu kommer svaret«',
    example: '8 + 4 = __ + 5 besvares med 12',
    parent: 'Barnet læser = som »svaret er« i stedet for »det samme som«. Så bliver regnestykker som 8 + 4 = __ + 5 forvirrende.',
    homeTip: 'Lav en vægt af en bøjle med en pose i hver side og ens klemmer. Sig »er lig med« som »vejer det samme som«. Skriv også regnestykker med svaret først, fx 7 = 3 + 4.',
  },
  halfPastNext: {
    nature: 'concept',
    title: 'læser »halv tre« som »tre og en halv«',
    example: 'halv tre stilles til 3:30',
    parent: 'På dansk betyder halv tre halvvejs hen mod tre, altså 2:30. Mange børn hører det som tre og en halv time, fordi det lyder sådan.',
    homeTip: 'Brug et rigtigt ur ved måltiderne: »Nu er klokken halv seks. Den lille viser står midt mellem fem og seks, på vej hen mod seks.«',
  },
  quarterDirection: {
    nature: 'concept',
    title: 'blander »kvart over« og »kvart i«',
    example: 'kvart i tre stilles til kvart over tre',
    parent: 'Barnet bytter om på kvart over og kvart i, så svaret bliver en halv time forkert.',
    homeTip: 'Tegn en urskive og farv højre halvdel »over« og venstre halvdel »i«. Øv med tider, der betyder noget: »Kvart over otte går vi hjemmefra.«',
  },
  handsSwapped: {
    nature: 'concept',
    title: 'bytter om på den lille og den store viser',
    example: '3:00 aflæses som 12:15',
    parent: 'Barnet aflæser den store viser som timer og den lille som minutter.',
    homeTip: 'Kald den lille viser »timeviseren, den korte« og den store »minutviseren, den lange«. Lad barnet stille et legetøjsur, mens I snakker om dagens planer.',
  },
  firstDigitCompare: {
    nature: 'concept',
    title: 'sammenligner kun det første ciffer',
    example: '69 vælges som større end 102',
    parent: 'Barnet ser på første ciffer og vælger 69 frem for 102, fordi 6 er større end 1.',
    homeTip: 'Sammenlign priser eller husnumre: Hvad er dyrest, 69 kr. eller 102 kr.? Tæl cifrene først: Et tal med flere cifre er størst.',
  },
  coinsAsCount: {
    nature: 'concept',
    title: 'tæller mønterne i stedet for det, de er værd',
    example: '10 kr. + 5 kr. + 2 kr. bliver 3',
    parent: 'Barnet tæller, hvor mange mønter der er, i stedet for at lægge deres værdi sammen.',
    homeTip: 'Tøm en pung og sortér mønterne efter værdi. Tæl de største først: ti, femten, sytten. Lad barnet betale for noget småt i butikken.',
  },
  rulerEnd: {
    nature: 'concept',
    title: 'aflæser, hvor tingen slutter, ikke hvor lang den er',
    example: 'fra 2 til 9 på linealen bliver 9',
    parent: 'Når tingen ikke starter ved 0 på linealen, aflæser barnet slutmærket eller tæller stregerne i stedet for afstanden.',
    homeTip: 'Mål blyanter og klodser, hvor I med vilje starter ved 2 eller 3. Tæl hoppene mellem stregerne sammen: Ét hop er én centimeter.',
  },
  lengthByEnd: {
    nature: 'concept',
    title: 'ser kun på den ene ende, når ting sammenlignes',
    example: 'den, der stikker længst ud, vælges som længst',
    parent: 'Når tingene ikke står på linje, vælger barnet den, der stikker længst ud, uanset hvor den starter.',
    homeTip: 'Sammenlign sko, skeer eller snore. Stil dem op ved en fælles startlinje, fx kanten af bordet, før I siger, hvad der er længst.',
  },
  sizeIsWeight: {
    nature: 'concept',
    title: 'tror, at store ting altid er tungest',
    example: 'ballonen vælges som tungere end stenen',
    parent: 'Barnet tror, at den største ting også er den tungeste. Store, lette ting som en ballon eller en pude driller.',
    homeTip: 'Gæt og mærk efter: en stor pude og en lille flaske vand. Hvad er tungest? Prøv med en køkkenvægt eller en bøjle med en pose i hver side.',
  },
  unequalParts: {
    nature: 'concept',
    title: 'kalder to dele for halve, også når de ikke er lige store',
    example: 'en skæv deling kaldes halve',
    parent: 'Barnet tror, at to dele altid er to halve. Halve betyder to lige store dele.',
    homeTip: 'Del en pandekage eller en skive brød i to og spørg, om det er retfærdigt. Læg stykkerne oven på hinanden og se, om de er lige store.',
  },
  prototypeOnly: {
    nature: 'concept',
    title: 'genkender kun figurer, der står »pænt«',
    example: 'et drejet kvadrat overses',
    parent: 'Barnet genkender en trekant eller et kvadrat, når figuren står som i bøgerne, men ikke når den er drejet, strakt eller lille.',
    homeTip: 'Gå på figurjagt efter vejskilte, vinduer og fliser. Drej en figur klippet i papir rundt og spørg, om den stadig er et kvadrat.',
  },
  biggerDenominator: {
    nature: 'concept',
    title: 'tror, at 1/8 er mere end 1/4, fordi 8 er større',
    example: '1/8 vælges som større end 1/4',
    parent: 'Barnet sammenligner tallene under brøkstregen som hele tal og tror, at flere dele giver større stykker.',
    homeTip: 'Del en pizza eller et æble: Bliver stykkerne størst, når vi deler i 4 eller i 8? Jo flere der deler, jo mindre bliver hvert stykke.',
  },
  denominatorAsAnswer: {
    nature: 'concept',
    title: 'svarer med tallet under brøkstregen',
    example: '1/4 af 12 bliver 4',
    parent: 'Barnet svarer med nævneren i stedet for at dele mængden i lige store dele.',
    homeTip: 'Del 12 rosiner mellem 4 bamser, én ad gangen. Hvor mange får hver bamse? Det er en fjerdedel af 12.',
  },
  areaAsPerimeter: {
    nature: 'concept',
    title: 'tæller kanten i stedet for fladen',
    example: 'et felt på 3 · 4 bliver 14',
    parent: 'Barnet tæller rundt langs kanten (omkredsen) i stedet for at tælle felterne indeni (arealet).',
    homeTip: 'Dæk en bog med sedler eller en byggeplade med klodser. Arealet er, hvor mange der skal til for at dække det hele.',
  },
  tensZero: {
    nature: 'concept',
    title: 'mister nullet eller sætter et nul for meget',
    example: '3 · 40 bliver 12 eller 1200',
    parent: 'Barnet regner 3 · 4 rigtigt, men mister eller tilføjer et nul, når der ganges med hele tiere.',
    homeTip: 'Brug tikroner: 3 bunker med 4 tikroner i hver. Hvor mange tikroner er der? Hvor mange kroner er det?',
  },
  digitComplement10: {
    nature: 'concept',
    title: 'finder, hvad hvert ciffer mangler op til 10',
    example: '100 − 37 bliver 73',
    parent: 'Barnet regner ud, hvad hvert ciffer mangler op til 10, og får 73 i stedet for 63.',
    homeTip: 'Hop på en tegnet tallinje: Fra 37 op til 40 er 3, og fra 40 op til 100 er 60. Tilsammen 63. Leg byttepenge med en hundredkrone.',
  },
  digitSwap: {
    nature: 'mixed',
    title: 'bytter om på tiere og enere',
    example: '53 skrives 35',
    parent: 'Barnet skriver enerne før tierne. Det er meget almindeligt på dansk, hvor vi siger enerne først: tre-og-halvtreds.',
    homeTip: 'Sig tallet og peg: fem-og-TREDIVE. Tredive er tierne, og de skrives først. Leg »hvilket tal siger jeg?« med husnumre.',
  },
  tableNeighbour: {
    nature: 'slip',
    title: 'svarer med et tal fra nabotabellen',
    example: '6 · 7 bliver 48',
    parent: 'Svaret ligger lige ved siden af, fx fra 6- eller 8-tabellen. Det er helt normalt, mens tabellen sætter sig.',
    homeTip: 'Sig tabellen som et rim på bilture, eller tæl i spring op ad trappen. Korte runder tit virker bedre end lange.',
  },
  countFromFirst: {
    nature: 'slip',
    title: 'tæller starttallet med',
    example: '5 + 3 bliver 7',
    parent: 'Barnet tæller op fra starttallet og tæller det med, så svaret bliver én for lidt (ved minus én for meget). Det er normalt, mens man tæller på fingrene.',
    homeTip: 'Hop på en tegnet tallinje: Stå på 5 og hop 3 hop. Tæl hoppene, ikke det tal, I står på.',
  },
  hourHandMisread: {
    nature: 'slip',
    title: 'aflæser den lille viser, når den er tæt på næste tal',
    example: '2:45 aflæses som 3:45',
    parent: 'Når timeviseren nærmer sig næste tal, læser barnet det næste tal som timen. Det er en almindelig fejl ved kvarter og minutter.',
    homeTip: 'Stil et legetøjsur på kvart i tre og se sammen, at den lille viser endnu ikke er nået til tre. Snak om, hvilket tal den lige har passeret.',
  },
  skipStepOne: {
    nature: 'slip',
    title: 'fortsætter med 1 i stedet for springet',
    example: '5, 10, 15 fortsættes med 16',
    parent: 'Barnet mister springet og tæller videre med 1. Det sker tit, når rækken er lang.',
    homeTip: 'Tæl i spring med klap eller trin på trappen: to, fire, seks. Brug hænderne til 5-springet og tikroner til 10-springet.',
  },
  wrongOperation: {
    nature: 'slip',
    title: 'bruger den forkerte regneart',
    example: '9 − 3 bliver 12',
    parent: 'Barnet lægger sammen, hvor der skal trækkes fra, eller omvendt. Det sker ofte efter mange ens opgaver i træk.',
    homeTip: 'Lad barnet sige tegnet højt, før det regner: »ni minus tre«. Bland plus og minus i små regnehistorier ved middagsbordet.',
  },
}
