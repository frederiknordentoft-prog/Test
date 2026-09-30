// Kontrakten for dyre-riggen (SPEC §6.4, §7.1; kunst-forslaget §2.7/§3.1 med syntesens afvigelser:
// ingen `sad`-mood, intet `tier`-felt på ItemDef, magiske farver er gold/rainbow/starwhite).
//
// Koordinater: kanvas `viewBox 0 0 200 240`, jordlinje y = 226, sikker zone x 6–194 og y 4–234.
// Dele og genstande tegnes i *modelrummet* = artens stadie-2-ramme (standardankre + artens/racens
// overskrivninger). Riggen lægger stadiet på som faste region-transformationer (krop om fodpunktet,
// hoved om halsleddet), så tøj og dele aldrig skal justeres pr. stadie. `computeAnchors` giver de
// endelige ankre i verdensrummet (viewBox) til UI, øjne der følger fingeren og lints.
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------------------------
// Id'er (bindende for resten af spillet)

export const SPECIES_IDS = [
  'rabbit', 'cat', 'puppy', 'hedgehog', 'horse', 'lamb', 'fox', 'hamster',
  'unicorn', 'panda', 'squirrel', 'owl', 'pegasus', 'dragon', 'penguin', 'polarbear',
] as const
export type SpeciesId = (typeof SPECIES_IDS)[number]
/** Fortælleren Pip (spurv, krop `pear`) bruger samme rig, men er ikke et samleobjekt. */
export type NarratorId = 'pip'
export type CreatureId = SpeciesId | NarratorId

export const BREEDS = {
  rabbit: ['upright', 'lop', 'lionhead'],
  cat: ['domestic', 'longhair', 'mainecoon'],
  horse: ['shetland', 'fjord', 'arabian'],
  unicorn: ['foal', 'wavy', 'starhorn'],
} as const
type BreedTable = typeof BREEDS
export type BreedOf<S extends CreatureId> = S extends keyof BreedTable ? BreedTable[S][number] : 'std'
export type BreedId = BreedOf<CreatureId>

export function breedsOf(id: CreatureId): readonly BreedId[] {
  return id in BREEDS ? BREEDS[id as keyof BreedTable] : ['std']
}

/** c1–c6 = artens 6 naturlige farver i rækkefølgen fra spildesign §3.1. */
export const NATURAL_COLORWAYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const
export const MAGIC_COLORWAYS = ['gold', 'rainbow', 'starwhite'] as const
export type NaturalColorwayId = (typeof NATURAL_COLORWAYS)[number]
export type MagicColorwayId = (typeof MAGIC_COLORWAYS)[number]
export type ColorwayId = NaturalColorwayId | MagicColorwayId

export const STAGES = [1, 2, 3] as const
/** 1 = baby, 2 = ung, 3 = stor. Stjerneformen er et flag (`star`) oven på stadie 3. */
export type Stage = (typeof STAGES)[number]

/** Der findes ingen `sad` (SPEC §6.4, etik-kritikken). Blink og earTwitch kører altid. */
export const MOODS = ['idle', 'happy', 'cheer', 'think', 'oops', 'sleep', 'wave'] as const
export type Mood = (typeof MOODS)[number]

export const SLOTS = ['head', 'face', 'neck', 'body', 'back', 'hand'] as const
export type Slot = (typeof SLOTS)[number]

export const BODY_KINDS = ['round', 'pear', 'tall'] as const
export type BodyKind = (typeof BODY_KINDS)[number]

export type Family =
  | 'lagomorph' | 'feline' | 'equine' | 'canine' | 'bear' | 'rodent'
  | 'bird' | 'ovine' | 'reptile' | 'insectivore'

export type WorldId = 'eng' | 'bakke' | 'skov' | 'fjeld'
/** Klip-, node-id'er ejes af motoren (`src/engine/types.ts`, `ids.lock.json`); her kun som strenge. */
export type ClipId = string
export type NodeId = string

// ---------------------------------------------------------------------------------------------
// Geometri og ankre

export interface Pt {
  x: number
  y: number
}

export interface AnchorSet {
  /** Fodpunktet på jordlinjen: pivot for figur-skalering, hop og kropsånding. */
  ground: Pt
  headCenter: Pt
  headRx: number
  headRy: number
  /** Slot `head`: hattens ankerpunkt og referencebredde. */
  headTop: Pt
  headWidth: number
  earBaseL: Pt
  earBaseR: Pt
  /** Afstand mellem ørebaserne; hatte med `earMode: 'under'` klemmes til earGap × 1,15. */
  earGap: number
  hornBase: Pt
  eyeL: Pt
  eyeR: Pt
  eyeRx: number
  eyeRy: number
  muzzle: Pt
  mouth: Pt
  cheekL: Pt
  cheekR: Pt
  /** Halsleddet: pivot for hovedet; slot `neck`. */
  neck: Pt
  neckWidth: number
  bodyCenter: Pt
  bodyRx: number
  bodyRy: number
  bodyWidth: number
  chest: Pt
  /** Slot `back` og vinger. */
  back: Pt
  /** Pivot for poterne (vink, jubel). */
  shoulderL: Pt
  shoulderR: Pt
  /** Slot `hand` sidder ved pawR med rotationen handRot (grader). */
  pawL: Pt
  pawR: Pt
  handRot: number
  footL: Pt
  footR: Pt
  tailBase: Pt
}

export type PointAnchorName = {
  [K in keyof AnchorSet]: AnchorSet[K] extends Pt ? K : never
}[keyof AnchorSet]
/** Genstande hæfter sig altid til et punkt-anker. */
export type AnchorName = PointAnchorName
export type ScaleBy = 'headWidth' | 'bodyWidth' | 'neckWidth' | 'fixed'

/** Stadiernes transformationer (SPEC §6.4). Alle faktorer er relative til stadie 2. */
export interface StageTransform {
  /** Hele figuren om fodpunktet. */
  fig: number
  /** Kroppen om fodpunktet (hovedet følger halsleddet). */
  body: number
  /** Hovedet om halsleddet. */
  head: number
  /** Øjnene om deres centre. */
  eye: number
  mane: number
  tail: number
  horn: number
  wings: number
}

// ---------------------------------------------------------------------------------------------
// Farver

/** Afledte farver til ét dyr. Kun `palette.ts` og colorway-filer må indeholde rå hex. */
export interface Palette {
  fur: string
  outline: string
  shade: string
  belly: string
  /** Hvid med 40 % alfa (cel-højlys). */
  highlight: string
  /** Øreinderside, trædepuder. */
  inner: string
  innerShade: string
  nose: string
  cheek: string
  /** Den subtile iris-ring i øjnene. */
  iris: string
  /** Pupil og øjenlinjer (#2B2144, aldrig ren sort). */
  ink: string
  /** Mønsterfarve (fx hollænderens pletter) og dens afledte kontur/skygge. */
  pattern: string
  patternOutline: string
  patternShade: string
  /** Farven på ørernes yderside (standard = fur; hollænderen bruger pattern). */
  earFur: string
  earOutline: string
  /** Manke/hale/tot. Er `gradient` sat, er det et id-løst stop-sæt til regnbuen. */
  mane: string
  maneOutline: string
  gradient?: readonly string[]
  /** Magiske farver: glimmer i fx-laget. */
  sparkle?: string
  /** Sort silhuet (silhuet-arket). */
  silhouette?: boolean
}

export type PatternKind = 'dutch' | 'none'

export interface ColorwayDef {
  id: ColorwayId
  /** Dansk farvenavn til UI og oplæsning. */
  name: string
  fur: string
  /** Enkelte farver kan overskrives, fx en varmere kontur på hvid pels. */
  overrides?: Partial<Omit<Palette, 'gradient' | 'silhouette'>>
  pattern?: PatternKind
  patternColor?: string
  /** Regnbue: stop til den eneste tilladte statiske gradient på et væsen. */
  gradient?: readonly string[]
  sparkle?: string
}

// ---------------------------------------------------------------------------------------------
// Ansigt

export type EyeShape = 'open' | 'happy' | 'closed' | 'half' | 'sparkle'
export type MouthShape = 'smile' | 'cat-w' | 'open-D' | 'o' | 'wobble'

export interface FaceStyle {
  /** Mund i hvile (idle). */
  idleMouth: MouthShape
  /** Fortænder i den åbne mund (kanin, hamster, egern). */
  buckTeeth?: boolean
  /** Hvilke dyr har kinder (rosa) – næsten alle. */
  cheeks?: boolean
}

// ---------------------------------------------------------------------------------------------
// Dele

/** Unikke id'er pr. rig-instans (clipPath og gradienter). */
export interface RigIds {
  uid: string
  bodyClip: string
  headClip: string
  gradient: string
}

export interface PartCtx {
  pal: Palette
  /** Modelrummets ankre (stadie 2-rammen). */
  a: AnchorSet
  stage: Stage
  mood: Mood
  breed: BreedId
  colorway: ColorwayId
  /** Stregbredde i delens lokale enheder, kompenseret for skalering → altid 3,2 i verdensrummet. */
  sw: number
  ids: RigIds
  /** true i statisk tilstand (billeder, album): ingen animationsklasser. */
  still: boolean
}

export type Part = (p: PartCtx) => ReactNode
export type Side = 'L' | 'R'
export interface SidePartCtx extends PartCtx {
  side: Side
}
/** Tegnes i lokale koordinater om pivoten; riggen spejler højre side (scale(-1,1)). */
export type SidePart = (p: SidePartCtx) => ReactNode

/** Konturfunktion: modelrummets ankre → path. `inflate` udvider formen (tøj-klip = +2). */
export type OutlineFn = (a: AnchorSet, inflate: number, stage: Stage) => string

export interface SpeciesParts {
  /** Hovedets kontur (modelrum). Standard: husets bolle-form fra headCenter/headRx/headRy. */
  head?: OutlineFn
  /** Kroppens kontur. Standard: kropsskabelonen (`bodies.ts`) for artens `body`. */
  body?: OutlineFn
  /** Ét øre (venstre) i lokale koordinater: basen i (0,0), peger op (−y). */
  Ear?: SidePart
  /** Én pote (venstre) i lokale koordinater: skulderen i (0,0), hænger ned (+y). */
  Paw: SidePart
  /** Begge fødder i modelrummet (bag kroppen). */
  Feet: Part
  /** Halen i lokale koordinater om tailBase (bag kroppen). */
  Tail?: Part
  /** Snude, næse, knurhår (ansigtslaget, modelrum). Næsen kan pakkes i signatur-pivot. */
  Muzzle?: Part
  /** Ekstra på hovedet efter grundform og skygge (tufter, striber). */
  HeadDeco?: Part
  /** Ekstra på kroppen efter grundform (mave-tot osv.). */
  BodyDeco?: Part
  ManeBack?: Part
  ManeFront?: Part
  /** Horn i lokale koordinater om hornBase. */
  Horn?: Part
  /** Vinger i lokale koordinater om back. */
  Wings?: Part
  /** Mønstre klippet til hoved/krop, valgt af colorway'ets `pattern`. */
  Pattern?: { head?: Part; body?: Part }
}

/** Grader for ørernes hvilestilling (udad = positiv) pr. race. */
export interface EarRig {
  /** Rotation udad i grader (venstre øre roteres −splay, højre +splay). */
  splay: number
  /**
   * Klip ørerne til "uden for hovedet" (standard true): øret tegnes med fuld kontur, og roden
   * forsvinder sømløst i hovedet. Hængeører (vædder) der ligger foran hovedet, sætter false.
   */
  clip?: boolean
}

export interface BreedDef {
  id: BreedId
  /** Dansk navn ("stående ører", "vædder", "løvehoved"). */
  name: string
  anchors?: Partial<AnchorSet>
  parts?: Partial<SpeciesParts>
  ears?: EarRig
}

/** Signatur-idle (SPEC §6.1) – kører på gruppen med klassen `a-sig`. */
export type Signature =
  | 'nose-wiggle' | 'tail-curl' | 'head-tilt' | 'spikes' | 'mane-toss' | 'ear-flop'
  | 'tail-swish' | 'cheek-puff' | 'horn-glint' | 'paw-wave' | 'tail-flick' | 'head-turn'
  | 'wing-flap' | 'smoke-puff' | 'wing-clap' | 'sniff'

export interface SpeciesDef {
  id: CreatureId
  /** Dansk navn ("Kanin"). */
  name: string
  nameClip: ClipId
  family: Family
  body: BodyKind
  breeds: readonly BreedDef[]
  /** 6 naturlige farver (c1–c6) + evt. artsspecifikke magiske. Fælles magiske ligger i palette.ts. */
  colorways: Record<NaturalColorwayId, ColorwayDef> & Partial<Record<MagicColorwayId, ColorwayDef>>
  /** Magiske farver arten findes i (gold + rainbow for alle; starwhite kun enhjørningen). */
  magic: readonly MagicColorwayId[]
  anchors?: Partial<AnchorSet>
  /** Pegasus, drage og ugle: ['back'] (slottet er låst). */
  occupies?: readonly Slot[]
  face: FaceStyle
  ears?: EarRig
  signature?: Signature
  parts: SpeciesParts
}

// ---------------------------------------------------------------------------------------------
// Garderobe (SPEC §7.1)

export const SET_IDS = [
  'hverdag', 'opdager', 'rytter', 'kongelig', 'astronaut', 'ridder',
  'talmagiker', 'pirat', 'fodbold', 'vinter', 'fest',
] as const
export type OutfitSetId = (typeof SET_IDS)[number]
export type SetId = OutfitSetId | 'milepael'
/** Sæt-genstande hedder `<sæt>-<slot>` (præcis én pr. slot); milepæle `milepael-<navn>`. */
export type ItemId = `${OutfitSetId}-${Slot}` | `milepael-${string}`

export type ItemSource =
  | { kind: 'level'; level: number }
  | { kind: 'chest'; nodeId: NodeId }
  | { kind: 'finale'; world: WorldId }
  | { kind: 'medal'; tier: 'silver' | 'gold'; count: number }
  | { kind: 'shop'; price: 80 | 120 | 180 }

/** En genstands farvesæt. Værdierne kommer fra stofpaletten i palette.ts (ingen hex i genstandsfiler). */
export interface Colorway {
  id: string
  /** Dansk navn til omfarvning ("tomatrød"). */
  name: string
  main: string
  trim: string
  accent: string
}

/** Afledte stoffarver (samme regel som dyrene: kontur = L×0,55, C×1,1 osv.). */
export interface ItemPalette {
  main: string
  mainShade: string
  outline: string
  trim: string
  trimShade: string
  trimOutline: string
  accent: string
  accentShade: string
  accentOutline: string
  highlight: string
  ink: string
}

export interface ItemArtProps {
  c: ItemPalette
  /** Bærerens modelankre (fx til ørehuller). */
  a: AnchorSet
  /** Modelpunkt → genstandens lokale koordinater (invers af pasformen). */
  local: (p: Pt) => Pt
  /** Stregbredde i lokale enheder (3,2 i verdensrummet). */
  sw: number
  body: BodyKind
  earMode: EarMode
  ids: RigIds
  /**
   * Kropstøj (fit-regel 3): bærerens kropskontur tegnet igen i genstandens konturfarve, allerede
   * transformeret til genstandens lokale ramme. Genstanden klipper den selv til sit eget område.
   */
  restroke: (color?: string) => ReactNode
}
export type ItemArt = (p: ItemArtProps) => ReactNode

export type EarMode = 'through' | 'under'

export interface FitOverride {
  dx?: number
  dy?: number
  scale?: number
  rot?: number
}

export interface ItemFit {
  anchor: AnchorName
  scaleBy: ScaleBy
  baseScale: number
  /** Genstandens bredde i egne enheder ved skala 1. */
  baseWidth: number
  /** Kun hovedgenstande. 'through' (standard): ørerne stikker gennem huller. 'under': mellem ørerne. */
  earMode?: EarMode
  /** Slås op pr. art og derefter pr. familie. Højst 10 % af (genstand, art)-par. */
  overrides?: Partial<Record<CreatureId | Family, FitOverride>>
}

/**
 * Genstandens tegning. Tegnes om (0,0) = ankeret, ved referencebredderne (headWidth 104,
 * bodyWidth 100, neckWidth 58).
 * - `front`: hovedlaget for slottet (head → lag 15, face → 13, neck → 9, body → 6, hand → 7, back → 2).
 * - `back`: valgfri bagdel (head → lag 10 bag hovedet, back → foran i lag 9 som spænder/stropper,
 *   neck → lag 2 bag kroppen).
 * - `bodyShapes`: kropsgenstande har én grundform pr. kropsskabelon (fit-regel 4).
 */
export interface ItemArtSet {
  front: ItemArt
  back?: ItemArt
  bodyShapes?: Record<BodyKind, ItemArt>
}

export interface ItemDef {
  id: ItemId
  set: SetId
  slot: Slot
  nameClip: ClipId
  source: ItemSource
  /** 0 = standard, 1–2 = omfarvning. */
  colorways: readonly [Colorway, Colorway, Colorway]
  art: ItemArtSet
  fit: ItemFit
  hides?: readonly ('mane-front' | 'ears')[]
}

/** Ét stykke tøj på dyret: genstanden og valgt farvesæt (0–2). */
export interface Worn {
  item: ItemDef
  colorway?: 0 | 1 | 2
}
export type Outfit = Partial<Record<Slot, Worn>>

/** Resultatet af fit-algoritmen i modelrummet. */
export interface FitResult {
  x: number
  y: number
  scale: number
  /** Grader. */
  rot: number
  earMode: EarMode
  /** Hvilken overskrivning der blev brugt (art eller familie), hvis nogen. */
  override: CreatureId | Family | null
}
