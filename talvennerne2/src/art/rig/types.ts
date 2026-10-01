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
// Id'er (bindende for resten af spillet). Kontrakten ejes af motoren (`src/engine/types.ts`, låst i
// `src/content/ids.lock.json`); kunsten genbruger dens lister og typer i stedet for at duplikere dem.

import {
  BREEDS, MAGIC_COLORWAYS, MOODS, NATURAL_COLORWAYS, SET_IDS, SLOTS, SPECIES_IDS,
} from '../../engine/types'
import type {
  BreedId, ClipId, ColorwayId, ItemId, ItemSource, Mood, NodeId, RigCharacterId, SetId as OutfitSetId,
  Slot, SpeciesId, Stage, WorldId,
} from '../../engine/types'

export { BREEDS, MAGIC_COLORWAYS, MOODS, NATURAL_COLORWAYS, SET_IDS, SLOTS, SPECIES_IDS }
export type { BreedId, ClipId, ColorwayId, ItemId, ItemSource, Mood, NodeId, OutfitSetId, Slot, SpeciesId, Stage, WorldId }

/** Fortælleren Pip (spurv, krop `pear`) bruger samme rig, men er ikke et samleobjekt. */
export type NarratorId = Exclude<RigCharacterId, SpeciesId>
export type CreatureId = RigCharacterId

type BreedTable = typeof BREEDS
export type BreedOf<S extends CreatureId> = S extends keyof BreedTable ? BreedTable[S][number] : 'std'

export function breedsOf(id: CreatureId): readonly BreedId[] {
  return id in BREEDS ? BREEDS[id as keyof BreedTable] : ['std']
}

export type NaturalColorwayId = (typeof NATURAL_COLORWAYS)[number]
export type MagicColorwayId = (typeof MAGIC_COLORWAYS)[number]

/** 1 = baby, 2 = ung, 3 = stor. Stjerneformen er et flag (`star`) oven på stadie 3. */
export const STAGES = [1, 2, 3] as const satisfies readonly Stage[]

export const BODY_KINDS = ['round', 'pear', 'tall'] as const
export type BodyKind = (typeof BODY_KINDS)[number]

export type Family =
  | 'lagomorph' | 'feline' | 'equine' | 'canine' | 'bear' | 'rodent'
  | 'bird' | 'ovine' | 'reptile' | 'insectivore'

// ---------------------------------------------------------------------------------------------
// Geometri og ankre

export interface Pt {
  x: number
  y: number
}

/** Akseparallel boks (modelrum eller verdensrum). */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
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
  /** Afstand mellem ørebaserne; hatte med `earMode: 'under'` klemmes til earGap · 1,15. */
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
  /** Pupil og øjenlinjer (husets ink fra palette.ts, aldrig ren sort). */
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
  /** Anden hårfarve: enhjørningens striber i manken, fjordhestens mørke midterstribe. */
  mane2?: string
  /** Anden mønsterfarve (calico: de mørke pletter). */
  pattern2?: string
  pattern2Outline?: string
  /** Hove (hest, enhjørning). Afledes af arten, hvis farven ikke sætter dem. */
  hoof?: string
  hoofOutline?: string
  /** Horn (enhjørning). */
  horn?: string
  hornShade?: string
  hornOutline?: string
  /** Magiske farver: glimmer i fx-laget. */
  sparkle?: string
  /** Sort silhuet (silhuet-arket). */
  silhouette?: boolean
}

/**
 * Mønstre klippet til hoved/krop (kunst-forslaget §2.3). Arten tegner selv mønstret i sine
 * `Pattern`-dele og kan læse det fra colorway'et.
 * - dutch: kaninens hollænder · tabby: striber (kat) · calico: to slags pletter (kat)
 * - dapple: skimlens æbleskimmel · pinto: brogede plader · blaze: blis og hvide sokker (hest)
 * - stars: Stjernefølets stjernemærker
 */
export type PatternKind = 'dutch' | 'none' | 'tabby' | 'calico' | 'dapple' | 'pinto' | 'blaze' | 'stars'

export interface ColorwayDef {
  id: ColorwayId
  /** Dansk farvenavn til UI og oplæsning. */
  name: string
  fur: string
  /** Enkelte farver kan overskrives, fx en varmere kontur på hvid pels. */
  overrides?: Partial<Omit<Palette, 'gradient' | 'silhouette'>>
  pattern?: PatternKind
  patternColor?: string
  /** Anden mønsterfarve (calico). */
  patternColor2?: string
  /** Regnbue: stop til den eneste tilladte statiske gradient på et væsen. */
  gradient?: readonly string[]
  sparkle?: string
}

// ---------------------------------------------------------------------------------------------
// Ansigt

/** 'wink': venstre øje åbent, højre lukket som et smil (legende "ups"). */
export type EyeShape = 'open' | 'happy' | 'closed' | 'half' | 'sparkle' | 'wink'
/** 'tongue': lille grin med tungespidsen ude (legende "ups"). */
export type MouthShape = 'smile' | 'cat-w' | 'open-D' | 'o' | 'wobble' | 'tongue'

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
  /** Kroppen/hovedet (kontur/2 inde) – til skygger og mønstre. */
  bodyClip: string
  headClip: string
  /** Alt uden for hovedet – dele, der skal "vokse ud af" hovedet uden søm (ører, totter). */
  outsideHead: string
  /** Regnbuens gradient (kun på regnbue-farven). */
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
  /** Detaljeniveau: 'small' (≤ 64 px) dropper knurhår, tålinjer og andre hårfine streger. */
  lod: 'full' | 'small'
  /** Humørets nøglepose (samme i statisk og animeret tilstand; animationen svinger om den). */
  pose: Pose
  /** Hovedgenstand på: 'through' (ørerne gennem huller), 'under' (mellem ørerne) eller ingen. */
  hat: 'through' | 'under' | null
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

/**
 * Armen til ærmer: tegnet lodret (skulder øverst, poten nedad) i sin egen ramme, som riggen drejer
 * `rot` grader ind i potens lokale ramme (venstre side; højre spejles). `sleeve` er ærmets lukkede
 * form (armen fra skulderen til manchetten, en anelse løsere end armen), og manchetten ligger på
 * tværs ved y = `cuff.y` med halv bredde `cuff.half`.
 */
export interface Limb {
  rot: number
  sleeve: (stage: Stage) => string
  cuff: { y: number; half: number }
}

export interface SpeciesParts {
  /** Hovedets kontur (modelrum). Standard: husets bolle-form fra headCenter/headRx/headRy. */
  head?: OutlineFn
  /** Kroppens kontur. Standard: kropsskabelonen (`bodies.ts`) for artens `body`. */
  body?: OutlineFn
  /** Ét øre (venstre) i lokale koordinater: basen i (0,0), peger op (−y). */
  Ear?: SidePart
  /** Én pote (venstre) i lokale koordinater: skulderen i (0,0), hænger ned (+y). */
  Paw: SidePart
  /**
   * Løftet pote (venstre) til jubel, vink og tænker: tegnes foran hovedet med åben kontur ved
   * skulderen (roden ligger på brystet). Arten vælger form efter `mood` (bøjet albue ved vink,
   * poten på hagen ved tænker). Mangler den, roteres `Paw` i stedet.
   */
  PawUp?: SidePart
  /** Hvor den løftede pote holder en håndgenstand (lokalt, venstre side) pr. humør. */
  pawUpTip?: Partial<Record<Mood, Pt>>
  /** Arm/forben til ærmer på kropstøj (se `Limb`). */
  limb?: Limb
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
  /** Hængeører: svajer blidt i alle humør (klassen `a-hang`) i stedet for at rejse og sænke sig. */
  hang?: boolean
}

export interface BreedDef {
  id: BreedId
  /** Dansk navn ("stående ører", "vædder", "løvehoved"). */
  name: string
  anchors?: Partial<AnchorSet>
  parts?: Partial<SpeciesParts>
  ears?: EarRig
  /** Racens ansigt (fx hvilemund), lagt oven på artens. */
  face?: Partial<FaceStyle>
  /** Racens poser, lagt oven på artens (fx kortere ben, der løftes mindre). */
  poses?: Partial<Record<Mood, Pose>>
  /**
   * Racens farvetone oven på colorway'ets afledte palet (fx fjordhestens blakkede pels og
   * tofarvede manke). Silhuetten afledes bagefter, så den altid er sort.
   */
  palette?: (p: Palette, colorway: ColorwayId) => Palette
  /** Magiske farver for netop denne race (standard: artens `magic`). Stjernefølet: kun `foal`. */
  magic?: readonly MagicColorwayId[]
  /** Racens grænsebokse (overskriver artens). */
  bounds?: Partial<FigureBounds>
  /** Racens anker for tankeprikker og Z'er (overskriver artens). */
  fx?: Pt
}

/**
 * Figurens grænsebokse i modelrummet (stadie 2-rammen), delt i hovedregionen (hoved, ører, manke,
 * horn) og kroppens region (krop, poter, fødder, hale). Riggen fører dem gennem stadiets
 * transformationer til beskæringer (butikskort, små ikoner); kontaktarkets lint tjekker, at den
 * tegnede figur ligger inden for dem.
 */
export interface FigureBounds {
  head: Box
  body: Box
}

/**
 * En statisk nøglepose pr. humør (keyframe 0 % i rig.css). Grader i delens lokale ramme
 * (+ = indad for ører, + = udad/op for poter).
 */
export interface PoseXf {
  x?: number
  y?: number
  rot?: number
  sx?: number
  sy?: number
}
/** En potes stilling: rotation om skulderen, evt. flyttet pivot og løftet form foran hovedet. */
export interface PawPose {
  /** Grader om skulderen (+ = udad/op). */
  rot?: number
  /** Brug artens løftede pote (`PawUp`) foran hovedet. */
  up?: boolean
}
export interface Pose {
  fig?: PoseXf
  body?: PoseXf
  head?: PoseXf
  earL?: number
  earR?: number
  /** Et tal er en rotation (hvilende pote); et objekt kan løfte poten op foran hovedet. */
  pawL?: number | PawPose
  pawR?: number | PawPose
  tail?: number
  /** Skyggens skala (hop). */
  shadow?: number
}

/**
 * Signatur-idle (SPEC §6.1). Riggen sætter ingen klasse selv; arten pakker delen i en pivot med
 * signaturens klasse: nose-wiggle → `a-sig` (kaninens næse), tail-curl → `a-curl` (kattens
 * halespids), mane-toss → `a-toss` (hestens manke), horn-glint → `a-glint` (hornets glimt).
 */
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
  /** Artens nøgleposer pr. humør, lagt oven på riggens standard (fx hovene løftes mindre). */
  poses?: Partial<Record<Mood, Pose>>
  /** Grænsebokse (modelrum); standard er et skøn ud fra ankrene. */
  bounds?: Partial<FigureBounds>
  /**
   * Ankeret (modelrum, hovedregionen) for tankeprikker og Z'er: uden for hoved og ører med ca. 8
   * enheders luft. Standard: til højre for hovedet, under øret.
   */
  fx?: Pt
  parts: SpeciesParts
}

// ---------------------------------------------------------------------------------------------
// Garderobe (SPEC §7.1)

/** Sættene (motorens `SetId`) og milepælene. Sæt-genstande hedder `<sæt>-<slot>` (præcis én pr. slot),
 * milepæle `milepael-<navn>` (motorens `ItemId`). */
export type SetId = OutfitSetId | 'milepael'

/** En genstands farvesæt. Værdierne kommer fra stofpaletten i palette.ts (ingen hex i genstandsfiler). */
export interface Colorway {
  id: string
  /** Dansk navn til omfarvning ("tomatrød"). */
  name: string
  main: string
  trim: string
  accent: string
}

/** Afledte stoffarver (samme regel som dyrene: kontur = L·0,55, C·1,1 osv.). */
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
  /**
   * true når genstanden tegnes alene (butiks-/garderobeikon) uden en bærer: ingen ørehuller, og
   * kropstøj tegner sin egen flade silhuet i stedet for at blive klippet til en krop.
   */
  solo: boolean
  /**
   * Bæreren har ører, der stikker op gennem hatten (`earMode: 'through'`): hatten tegner hullerne, og
   * riggen klipper ørerne ved hullet; `rim` lægger hullets forkant over ørets rod.
   */
  holes: boolean
  /** Bærerens stadie (kropstøj sidder lidt anderledes på babyens korte torso). */
  stage: Stage
}
export type ItemArt = (p: ItemArtProps) => ReactNode

/** Ærmet på én arm (venstre; riggen spejler det højre) i armens lodrette ramme (se `Limb`). */
export interface SleeveProps {
  c: ItemPalette
  sw: number
  /** Ærmets lukkede form og manchetten. */
  sleeve: string
  cuff: { y: number; half: number }
  /** Id på klippet med ærmets form (defineret én gang pr. rig; begge ærmer deler det). */
  clipId: string
  stage: Stage
}
export type SleeveArt = (p: SleeveProps) => ReactNode

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
  /** Hovedgenstande med ørehuller: hullernes forkant, tegnet oven på ørerne (lag 16b). */
  rim?: ItemArt
  /** Kropstøj med ærmer: tegnes på hver arm (kun arter med `limb`). */
  sleeve?: SleeveArt
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
  /**
   * Genstandens tegnede bbox i egne koordinater (x, y, w, h) ved skala 1, når den tegnes alene.
   * Butikskortet beskæres efter den, så genstanden fylder 75–80 % af kortet.
   */
  icon?: { box: readonly [number, number, number, number] }
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
