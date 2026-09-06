/**
 * Alt indhold i modellen ligger her — ingen tekst er hardcodet i komponenter.
 * Ret teksterne ét sted uden at røre kode.
 */

export type ComponentId =
  | 'kunde'
  | 'arbejdsgange'
  | 'mennesker'
  | 'teknologi'
  | 'buildbuyown'
  | 'governance'
  | 'maaling'

export type Pips = 1 | 2 | 3 | 4 | 5 | 6

export type ModelComponent = {
  id: ComponentId
  title: string // dansk
  kicker: string // én sætning, vises som panelets ingress
  questions: string[] // 4-6 spørgsmål
  pips: Pips | null // null = kernen (urværket)
}

export const COMPONENTS: readonly ModelComponent[] = [
  {
    id: 'kunde',
    title: 'Kunde og værdi',
    kicker: 'Hvilken reel værdi skal AI skabe?',
    pips: 1,
    questions: [
      'Hvilken reel værdi skal AI skabe?',
      'Hvilken kundeoplevelse forbedres?',
      'Hvilken friktion fjernes?',
      'Hvilket forretningsmål påvirkes?',
    ],
  },
  {
    id: 'arbejdsgange',
    title: 'Arbejdsgange',
    kicker: 'Værdien opstår, når arbejdsgangen bygges om',
    pips: null,
    questions: [
      'Hvordan ser processen ud i dag?',
      'Hvilke trin kan fjernes?',
      'Hvilke trin kan automatiseres?',
      'Hvilke aktiviteter kan ske parallelt?',
      'Hvor opstår ventetid og overleveringer?',
      'Hvor flytter flaskehalsen hen?',
    ],
  },
  {
    id: 'mennesker',
    title: 'Mennesker, roller og mandat',
    kicker: 'AI ændrer arbejdsdelingen, ikke kun opgaverne',
    pips: 2,
    questions: [
      'Hvad gør mennesket?',
      'Hvad gør AI?',
      'Hvem træffer beslutningen?',
      'Hvem ejer processen?',
      'Hvilke kompetencer bliver vigtigere?',
      'Hvem har mandat til at redesigne arbejdsgangen?',
    ],
  },
  {
    id: 'teknologi',
    title: 'Teknologi og data',
    kicker: 'Understøttende infrastruktur — ikke slutproduktet',
    pips: 3,
    questions: [
      'Hvilke modeller og værktøjer skal understøtte processen?',
      'Hvilke data kræves?',
      'Hvilken fælles AI-infrastruktur skal genbruges?',
      'Hvad skal standardiseres én gang i stedet for at løses i hvert projekt?',
    ],
  },
  {
    id: 'buildbuyown',
    title: 'Build / Buy / Own',
    kicker: 'AI ændrer magtbalancen med leverandørerne',
    pips: 4,
    questions: [
      'Hvad kan vi nu udvikle selv?',
      'Hvilken domæneviden er en reel konkurrencefordel?',
      'Hvad bør vi købe på markedet?',
      'Hvilke leverandørafhængigheder kan reduceres?',
      'Hvilke komponenter skal vi selv eje?',
    ],
  },
  {
    id: 'governance',
    title: 'Governance og ansvarlighed',
    kicker: 'Designparameter, ikke en efterfølgende bremse',
    pips: 5,
    questions: [
      'Hvilke risici skal håndteres?',
      'Hvor kræves menneskeligt tilsyn?',
      'Hvilke beslutninger skal kunne forklares?',
      'Hvad skal dokumenteres?',
      'Hvordan bygger vi ansvarlighed ind i arbejdsgangen fra starten?',
    ],
  },
  {
    id: 'maaling',
    title: 'Måling og værdirealisering',
    kicker: 'Mål udfald, ikke aktivitet',
    pips: 6,
    questions: [
      'Hvad var baseline?',
      'Hvad er det ønskede outcome?',
      'Hvordan måler vi kvalitet og effekt?',
      'Hvad sker der med den frigjorte tid?',
      'Hvordan omsættes kapaciteten til vækst, bedre kvalitet eller lavere omkostninger?',
      'Hvad er stopkriteriet?',
    ],
  },
]

export const COMPONENT_IDS: readonly ComponentId[] = COMPONENTS.map((c) => c.id)

const BY_ID = new Map<ComponentId, ModelComponent>(COMPONENTS.map((c) => [c.id, c]))

export function getComponent(id: ComponentId): ModelComponent {
  const c = BY_ID.get(id)
  if (!c) throw new Error(`Ukendt komponent: ${id}`)
  return c
}

export function isComponentId(value: unknown): value is ComponentId {
  return typeof value === 'string' && BY_ID.has(value as ComponentId)
}

/** Kernen — den komponent, der ligger inde i maskinen. */
export const CORE_ID: ComponentId = 'arbejdsgange'

/** Overskriften, der vises når terningen er samlet. */
export const HEADLINE = {
  title: 'AI VALUE CREATION',
  subtitle: 'Fra teknologi til redesignede arbejdsgange, højere kapacitet og stærkere kundeoplevelser.',
} as const

/** Al øvrig UI-tekst. */
const UI_TITLE = { appTitle: 'Terningen', appSubtitle: 'AI-transformation 2027' } as const

export const UI = {
  ...UI_TITLE,
  coreLabel: 'KERNE',
  faceLabel: (pips: number) => `Side ${pips}`,
  assemble: 'Saml',
  explode: 'Eksplodér',
  prev: '‹ Forrige',
  next: 'Næste ›',
  close: 'Luk',
  bottleneckTag: 'FLASKEHALS',
  setBottleneck: 'Markér som flaskehals',
  clearBottleneck: 'Fjern flaskehals',
  questionsHeading: 'Spørgsmål til ledelsesdiskussionen',
  hints: '← → mellemrum: fortællingen · klik: åbn side · Esc: luk · højreklik: flaskehals · B: flaskehals på den åbne side',
  ariaOpenFace: (title: string) => `Åbn ${title}`,
  ariaCloseFace: (title: string) => `Luk ${title}`,
  ariaWithBottleneck: (label: string) => `${label} — markeret som flaskehals`,
  ariaPrev: 'Forrige',
  ariaNext: 'Næste',
  ariaCube: 'Terningen — AI-transformationsmodellen',
  ariaControls: 'Styring af fortællingen',
  beatOf: (n: number, total: number) => `${n} / ${total}`,
  documentTitle: `${UI_TITLE.appTitle} · ${UI_TITLE.appSubtitle}`,
} as const
