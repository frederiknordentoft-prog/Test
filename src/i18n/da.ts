// Flat Danish string table. Short, plain language — never walls of text.

export const da = {
  appTitle: 'Vindtunnel',
  windLabel: 'Vind',
  windUnit: 'm/s',
  weightLabel: 'Vægt',
  weightLight: 'Let',
  weightHeavy: 'Tung',
  angleLabel: 'Vinkel',
  tempoLabel: 'Tempo',
  tempoHint: '1× er slowmotion — skru op for at se hvirvelgaden i hurtigere takt, eller ned for at studere den',
  lockLabel: 'Lås pind',
  lockedHint: 'Pinden er låst — ren måling',
  freeHint: 'Pinden giver efter for vinden',
  pause: 'Pause',
  play: 'Kør',
  resetFlow: 'Nulstil luft',
  clearShape: 'Ryd form',

  toolDraw: 'Tegn',
  toolCircle: 'Cirkel',
  toolSquare: 'Firkant',
  toolPlate: 'Plade',
  toolTeardrop: 'Dråbe',
  toolProbe: 'Probe',

  overlayLabel: 'Vis felt',
  overlayNone: 'Kun røg',
  overlaySpeed: 'Fart',
  overlayVorticity: 'Hvirvler',
  overlayPressure: 'Tryk',
  overlayStreamlines: 'Strømlinjer',
  smokeLabel: 'Røg',

  drag: 'Modstand',
  lift: 'Løft',
  perMeter: 'N pr. m dybde',

  advanced: 'Avanceret',
  cdLabel: 'Cd (modstandskoefficient)',
  clLabel: 'Cl (løftkoefficient)',
  reLabel: 'Reynolds-tal',
  gridLabel: 'Gitter',
  fpsLabel: 'Billeder/s',
  backendLabel: 'Motor',
  shedLabel: 'Hvirvelfrekvens',
  deflectLabel: 'Udsving',
  honesty:
    '2D-simulering: kræfter er pr. meter dybde. Objektets bevægelse påvirker luften kvasi-statisk (randens egen fart medregnes ikke). Et lærerigt legetøj — ikke certificeret CFD.',

  probeSpeed: 'Fart',
  probePressure: 'Tryk (rel.)',
  probeHint: 'Tryk et sted i tunnelen for at måle',

  drawHintClosed: 'Tegn en lukket form',
  drawHintTooSmall: 'Formen er for lille — prøv igen',
  flowReset: 'Strømningen blev nulstillet',
  cpuFallback: 'Kører i kompatibilitetstilstand (mindre gitter, enklere grafik)',

  labelStagnation: 'Stagnationspunkt: luften bremses helt op',
  labelVortexStreet: 'Hvirvelgade',
  labelsToggle: 'Forklaringer',

  compare: 'Sammenlign',
  compareClose: 'Luk sammenligning',
  compareA: 'Form A',
  compareB: 'Form B',
  yourDrawing: 'Din tegning',

  challenges: 'Udfordringer',
  challengeDone: 'Klaret!',

  bubbleFirstShape:
    'Vinden skubber på din form. Pilen viser modstanden (drag) — prøv at gøre formen mere strømlinet og se tallet falde.',
  bubblePressure: 'Rødt = højt tryk (luften bremses), blåt = lavt tryk. Se det høje tryk på forkanten — det er stagnationspunktet.',
  bubbleVorticity: 'Bag stumpe former river luften sig løs og danner hvirvler i takt — en hvirvelgade.',
  bubbleAngle: 'Skråtstil formen og se løftet ændre sig. For stejl vinkel → luften slipper — det kaldes stall.',
  bubbleWeight: 'Samme vind, samme kraft — men et tungt objekt svinger mindre. Det er F = m·a i praksis.',
  gotIt: 'Forstået',
};

export type Strings = typeof da;
