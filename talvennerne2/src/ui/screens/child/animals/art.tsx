// Pictures of animals for Dyrehaven and the books (SPEC §6.4). An animal is either an animated
// <Rig> (only the buddy and at most two others per screen) or a still picture: the rig rendered once
// to an SVG blob and shown as <img>, so a meadow of thirty animals stays far below the DOM budget.
// Species and items load on demand. A species that is not drawn yet is shown as a neutral shadow of
// its body shape — never as another animal — until its drawing exists.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Rig } from '../../../../art/rig/Rig'
import type { RigCrop } from '../../../../art/rig/Rig'
import { rigBlobUrl } from '../../../../art/rig/staticSvg'
import type { BreedId, ItemDef, Outfit, SpeciesDef } from '../../../../art/rig/types'
import { AVAILABLE_ITEMS, loadItem } from '../../../../art/items/registry'
import { AVAILABLE_SPECIES, loadSpecies } from '../../../../art/species/registry'
import { SPECIES_BY_ID } from '../../../../content/catalog'
import { hashSeed } from '../../../../engine/rng'
import type { Animal, ColorwayId, ItemId, Mood, SpeciesId, Stage } from '../../../../engine/types'
import { isCalm } from '../../../design/motion'
import { cx } from '../../../design/cx'
import './art.css'

export type SpeciesDefs = Partial<Record<SpeciesId, SpeciesDef>>
export type ItemDefs = Partial<Record<ItemId, ItemDef>>

export const isDrawn = (species: SpeciesId): boolean => (AVAILABLE_SPECIES as readonly string[]).includes(species)

// ─── Loading art ────────────────────────────────────────────────────────────

const speciesReady = new Map<SpeciesId, SpeciesDef>()
const speciesLoading = new Map<SpeciesId, Promise<unknown>>()
const itemsReady = new Map<ItemId, ItemDef>()
const itemsLoading = new Map<ItemId, Promise<unknown>>()

/** Art handed in up front (tests, previews): nothing is loaded, everything renders at once. */
export const ArtContext = createContext<{ species?: SpeciesDefs; items?: ItemDefs } | null>(null)

function useLoaded<K extends string, V>(
  ids: readonly K[],
  ready: Map<K, V>,
  loading: Map<K, Promise<unknown>>,
  load: (id: K) => Promise<V>,
  given: Partial<Record<K, V>> | undefined,
): Partial<Record<K, V>> {
  const want = useMemo(() => [...new Set(ids)].sort(), [ids])
  const key = want.join(',')
  const [version, bump] = useState(0)
  useEffect(() => {
    if (given) return
    const missing = want.filter((id) => !ready.has(id))
    if (missing.length === 0) return
    let alive = true
    const jobs = missing.map((id) => {
      let job = loading.get(id)
      if (!job) {
        job = load(id).then(
          (def) => void ready.set(id, def),
          () => undefined,
        )
        loading.set(id, job)
      }
      return job
    })
    void Promise.all(jobs).then(() => {
      if (alive) bump((n) => n + 1)
    })
    return () => {
      alive = false
    }
    // `want` is keyed by its content
  }, [key, given])
  return useMemo(() => {
    if (given) return given
    const out: Partial<Record<K, V>> = {}
    for (const id of want) {
      const def = ready.get(id)
      if (def) out[id] = def
    }
    return out
    // version: a load finished
  }, [key, given, version])
}

/** The drawn species among `ids`, as they finish loading. */
export function useSpeciesDefs(ids: readonly SpeciesId[]): SpeciesDefs {
  const given = useContext(ArtContext)?.species
  const drawn = useMemo(() => ids.filter(isDrawn), [ids])
  return useLoaded(drawn, speciesReady, speciesLoading, loadSpecies, given)
}

/** The drawn items worn by `animals`, as they finish loading. */
export function useItemDefs(animals: readonly Pick<Animal, 'outfit'>[]): ItemDefs {
  const given = useContext(ArtContext)?.items
  const key = animals.map((a) => Object.values(a.outfit).map((w) => w?.item).join('+')).join(',')
  const ids = useMemo(
    () => [...new Set(animals.flatMap((a) => Object.values(a.outfit).map((w) => w!.item)))].filter((id) => AVAILABLE_ITEMS.includes(id)),
    // keyed by the worn items
    [key],
  )
  return useLoaded(ids, itemsReady, itemsLoading, loadItem, given)
}

/** An animal's outfit with the art that is loaded (items not drawn yet are left off). */
export function outfitOf(animal: Pick<Animal, 'outfit'>, items: ItemDefs): Outfit | undefined {
  const out: Outfit = {}
  for (const [slot, w] of Object.entries(animal.outfit) as [keyof Outfit, Animal['outfit'][keyof Outfit]][]) {
    const def = w ? items[w.item] : undefined
    if (w && def) out[slot] = { item: def, colorway: w.color }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

// ─── Figures ────────────────────────────────────────────────────────────────

/** What a picture shows: a species in a breed, colour and form (an owned animal or a book card). */
export interface Look {
  species: SpeciesId
  breed?: BreedId
  colorway?: ColorwayId
  stage?: Stage
  star?: boolean
}

export const lookOf = (a: Pick<Animal, 'species' | 'breed' | 'colorway' | 'shown'>): Look => ({
  species: a.species,
  breed: a.breed,
  colorway: a.colorway,
  stage: a.shown === 'star' ? 3 : a.shown,
  star: a.shown === 'star',
})

/** The breed when the art knows it (an imported or older profile may carry another one). */
function breedFor(def: SpeciesDef, breed: BreedId | undefined): BreedId | undefined {
  return breed && def.breeds.some((b) => b.id === breed) ? breed : undefined
}

export interface FigureProps {
  look: Look
  def: SpeciesDef | undefined
  outfit?: Outfit
  /** An animated rig (the buddy and at most two others) or a still picture. */
  animated?: boolean
  mood?: Mood
  /** Black silhouette (an animal not found yet in the collection book). */
  silhouette?: boolean
  crop?: RigCrop
  /** CSS px the picture is drawn at (small pictures get the thicker small-size outline). */
  px?: number
  /** Phase of the idle loops. */
  seed?: number
  className?: string
  style?: CSSProperties
}

/**
 * One animal as a picture. While its species loads, an empty box of the same size holds the place;
 * a species that is not drawn yet shows its neutral shadow.
 */
export function Figure({ look, def, outfit, animated = false, mood = 'idle', silhouette = false, crop = 'full', px = 128, seed, className, style }: FigureProps) {
  const drawn = isDrawn(look.species)
  const props = useMemo(() => {
    if (!def) return null
    return {
      species: def,
      breed: breedFor(def, look.breed),
      stage: look.stage ?? 2,
      colorway: (silhouette ? 'c1' : (look.colorway ?? 'c1')) as ColorwayId,
      star: !silhouette && !!look.star,
      mood,
      outfit: silhouette ? undefined : outfit,
      silhouette,
      crop,
      seed: seed ?? 3,
    }
  }, [def, look.breed, look.stage, look.colorway, look.star, mood, outfit, silhouette, crop, seed])

  if (!drawn) {
    return <StandIn species={look.species} stage={look.stage ?? 2} tone={silhouette ? 'shadow' : toneOf(look.colorway)} crop={crop} className={className} style={style} />
  }
  if (!props) return <span className={cx('zoo-fig zoo-fig--wait', crop === 'head' && 'zoo-fig--square', className)} style={style} aria-hidden />
  if (animated) {
    return (
      <span className={cx('zoo-fig', className)} style={style} aria-hidden>
        <Rig {...props} mode="animated" size="100%" className={isCalm() ? 'rig-calm' : undefined} />
      </span>
    )
  }
  const src = blobUrlFor({ ...props, mode: 'static', size: px })
  return (
    <span className={cx('zoo-fig', crop === 'head' && 'zoo-fig--square', className)} style={style} aria-hidden>
      {src && <img className="zoo-fig__img" src={src} alt="" draggable={false} />}
    </span>
  )
}

/** rigBlobUrl where blobs exist (not in a server render without URL.createObjectURL). */
function blobUrlFor(props: Parameters<typeof rigBlobUrl>[0]): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  return rigBlobUrl(props)
}

/** Phase for an animal's loops from its uid, so neighbours never move in step. */
export const seedOf = (uid: string): number => (hashSeed(uid) % 9) + 1

// ─── The neutral shadow of a species that is not drawn yet ──────────────────

export type StandInTone = 'shadow' | 'gold' | 'rainbow' | 'starwhite'

const toneOf = (c: ColorwayId | undefined): StandInTone => (c === 'gold' || c === 'rainbow' || c === 'starwhite' ? c : 'shadow')

/**
 * A soft shadow in the species' body shape (round, pear or tall, SPEC §6.4) on the rig's ground line,
 * scaled like the stages. Only ellipses: it hints at size and shape, never at a wrong animal.
 */
export function StandIn({ species, stage = 2, tone = 'shadow', crop = 'full', className, style }: { species: SpeciesId; stage?: Stage; tone?: StandInTone; crop?: RigCrop; className?: string; style?: CSSProperties }) {
  const body = SPECIES_BY_ID[species].body
  const k = stage === 1 ? 0.86 : stage === 3 ? 1.06 : 1
  const box = crop === 'head' ? '30 20 140 140' : '0 0 200 240'
  return (
    <span className={cx('zoo-fig', crop === 'head' && 'zoo-fig--square', className)} style={style} aria-hidden>
      <svg className={cx('zoo-standin', `zoo-standin--${tone}`)} viewBox={box} data-standin={species}>
        <ellipse className="zoo-standin__ground" cx="100" cy="226" rx={58 * k} ry="8" />
        <g transform={`translate(100 226) scale(${k}) translate(-100 -226)`}>
          {body === 'round' && (
            <>
              <ellipse className="zoo-standin__shape" cx="100" cy="180" rx="62" ry="46" />
              <ellipse className="zoo-standin__shape" cx="100" cy="110" rx="48" ry="44" />
            </>
          )}
          {body === 'pear' && (
            <>
              <ellipse className="zoo-standin__shape" cx="100" cy="172" rx="50" ry="54" />
              <ellipse className="zoo-standin__shape" cx="100" cy="96" rx="40" ry="38" />
            </>
          )}
          {body === 'tall' && (
            <>
              <ellipse className="zoo-standin__shape" cx="106" cy="174" rx="56" ry="40" />
              <ellipse className="zoo-standin__shape" cx="84" cy="98" rx="34" ry="40" />
            </>
          )}
        </g>
      </svg>
    </span>
  )
}
