// Animals on the screens before the map: a child's animal (animated, or as a static image with its
// outfit) and the neutral egg-shaped stand-in for a species that is not drawn yet (the puppy today).
// The stand-in switches to the real drawing by itself once the species file lands in
// src/art/species/.
//
//   <AnimalArt look={lookOf(animal)} mood="happy" />                    animated (≤ 3 per screen)
//   <AnimalArt look={lookOf(animal)} mode="static" crop="fit" />        an <img>, as many as needed
//   const url = useAnimalImage(look, { crop: 'head' })                 for an SVG <image> (eggs)
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { rigBlobUrl } from '../../../../art/rig/staticSvg'
import { Rig } from '../../../../art/rig/Rig'
import type { RigCrop, RigProps } from '../../../../art/rig/Rig'
import type { CreatureId, Outfit, SpeciesDef } from '../../../../art/rig/types'
import { loadItem } from '../../../../art/items/registry'
import { AVAILABLE_SPECIES, loadSpecies } from '../../../../art/species/registry'
import { blob, circle, ellipse, join } from '../../../../art/materials/geom'
import type { V2 } from '../../../../art/materials/geom'
import type { Animal, BreedId, ColorwayId, ItemColor, ItemId, Mood, Slot, SpeciesId, Stage } from '../../../../engine/types'
import { cx } from '../../../design/cx'
import { isCalm } from '../../../design/motion'

// ─── Species and outfits on demand ───────────────────────────────────────────

const loaded = new Map<CreatureId, SpeciesDef>()

/** True when the species has a drawing (otherwise the stand-in is shown). */
export const isDrawn = (id: CreatureId): boolean => AVAILABLE_SPECIES.includes(id)

/** The species' drawing, loaded on demand; null while loading or when it is not drawn. */
export function useSpeciesDef(id: CreatureId | null | undefined): SpeciesDef | null {
  const want = id && isDrawn(id) ? id : null
  const [def, setDef] = useState<SpeciesDef | null>(() => (want ? (loaded.get(want) ?? null) : null))
  const [prev, setPrev] = useState(want)
  if (prev !== want) {
    setPrev(want)
    setDef(want ? (loaded.get(want) ?? null) : null)
  }
  useEffect(() => {
    if (!want || loaded.has(want)) return
    let alive = true
    loadSpecies(want)
      .then((d) => {
        loaded.set(want, d)
        if (alive) setDef(d)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [want])
  return def
}

/** Start loading drawings before they are needed (the four starters on the egg step). */
export function preloadSpecies(ids: readonly CreatureId[]): void {
  for (const id of ids) {
    if (!isDrawn(id) || loaded.has(id)) continue
    loadSpecies(id)
      .then((d) => loaded.set(id, d))
      .catch(() => undefined)
  }
}

type WornIds = Animal['outfit']

/** The worn items' drawings (an empty outfit stays undefined). */
export function useOutfit(worn: WornIds | undefined): Outfit | undefined {
  const [outfit, setOutfit] = useState<Outfit | undefined>(undefined)
  const key = worn ? JSON.stringify(worn) : ''
  useEffect(() => {
    const list = worn ? (Object.entries(worn) as [Slot, { item: ItemId; color: ItemColor }][]) : []
    if (list.length === 0) {
      setOutfit(undefined)
      return
    }
    let alive = true
    Promise.all(list.map(([slot, w]) => loadItem(w.item).then((item) => [slot, { item, colorway: w.color }] as const).catch(() => null))).then(
      (items) => {
        if (!alive) return
        const out: Outfit = {}
        for (const e of items) if (e) out[e[0]] = e[1]
        setOutfit(out)
      },
    )
    return () => {
      alive = false
    }
    // keyed by content: a new object with the same items is the same outfit
  }, [key])
  return outfit
}

// ─── An animal ───────────────────────────────────────────────────────────────

/** What decides how an animal looks. */
export interface AnimalLook {
  species: SpeciesId
  breed?: BreedId
  colorway?: ColorwayId
  stage?: Stage
  star?: boolean
  outfit?: WornIds
}

/** The look of an owned animal in the form the child chose to show. */
export function lookOf(a: Animal): AnimalLook {
  return {
    species: a.species,
    breed: a.breed,
    colorway: a.colorway,
    stage: a.shown === 'star' ? 3 : a.shown,
    star: a.shown === 'star',
    outfit: a.outfit,
  }
}

interface ArtOptions {
  mood?: Mood
  crop?: RigCrop
}

function rigProps(def: SpeciesDef, look: AnimalLook, outfit: Outfit | undefined, o: ArtOptions): RigProps {
  return {
    species: def,
    breed: look.breed && def.breeds.some((b) => b.id === look.breed) ? look.breed : undefined,
    stage: look.stage ?? 2,
    colorway: look.colorway ?? 'c1',
    star: look.star,
    mood: o.mood ?? 'idle',
    outfit,
    crop: o.crop,
  }
}

function imageUrl(def: SpeciesDef | null, look: AnimalLook | null, outfit: Outfit | undefined, o: ArtOptions): string | null {
  const wearing = !!look?.outfit && Object.keys(look.outfit).length > 0
  if (!look || !def || def.id !== look.species || (wearing && !outfit)) return null
  return rigBlobUrl({ ...rigProps(def, look, outfit, o), mode: 'static' })
}

/** A blob URL of the animal as a static picture (null while loading or when not drawn). */
export function useAnimalImage(look: AnimalLook | null, o: ArtOptions = {}): string | null {
  const def = useSpeciesDef(look?.species)
  const outfit = useOutfit(look?.outfit)
  return imageUrl(def, look, outfit, o)
}

export interface AnimalArtProps extends ArtOptions {
  look: AnimalLook
  /** animated: a live <Rig> (the buddy and at most two others per screen); static: an <img>. */
  mode?: 'animated' | 'static'
  /** Accessible name; decorative without it. */
  title?: string
  className?: string
  style?: CSSProperties
}

export function AnimalArt({ look, mode = 'animated', mood, crop = 'fit', title, className, style }: AnimalArtProps) {
  const def = useSpeciesDef(look.species)
  const outfit = useOutfit(look.outfit)
  const box = cx('tv-art', className)
  if (!isDrawn(look.species)) {
    return (
      <span className={box} style={style} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
        <Critter mood={mood} />
      </span>
    )
  }
  if (!def || def.id !== look.species) return <span className={box} style={style} aria-hidden />
  if (mode === 'static') {
    const url = imageUrl(def, look, outfit, { mood, crop })
    return (
      <span className={box} style={style}>
        {url && <img src={url} alt={title ?? ''} draggable={false} className="tv-art__img" />}
      </span>
    )
  }
  return (
    <span className={box} style={style}>
      <Rig {...rigProps(def, look, outfit, { mood, crop })} size="100%" title={title} seed={7} className={isCalm() ? 'rig-calm' : undefined} />
    </span>
  )
}

// ─── The stand-in for a species without a drawing ────────────────────────────

/** viewBox 0 0 200 240 like the rig, standing on the same ground line (y = 226). */
const CRITTER: V2[] = [[100, 70], [138, 86], [158, 134], [154, 188], [128, 222], [100, 228], [72, 222], [46, 188], [42, 134], [62, 86]]

export interface CritterProps {
  mood?: Mood
  className?: string
  /** A part of the 200 by 240 canvas (e.g. only the face when it peeks out of an egg). */
  viewBox?: string
  /** Placement when nested inside another SVG. */
  x?: number
  y?: number
  width?: number
  height?: number
}

/**
 * A neutral egg-shaped little creature: no ears, no species, just a friendly face. It stands where
 * an undrawn species would stand, so layouts do not change when the drawing arrives.
 */
export function Critter({ mood = 'idle', className, viewBox = '0 0 200 240', ...place }: CritterProps) {
  const happy = mood === 'happy' || mood === 'cheer' || mood === 'wave'
  return (
    <svg viewBox={viewBox} className={cx('tv-critter', className)} aria-hidden {...place}>
      <ellipse cx="100" cy="228" rx="52" ry="7" className="tv-critter__shadow" />
      <path d={blob(CRITTER, 0.9)} className="tv-critter__body" />
      <path d={ellipse(100, 186, 34, 30)} className="tv-critter__belly" />
      <path d={join(circle(80, 140, 9), circle(120, 140, 9))} className="tv-critter__eye" />
      <path d={join(circle(83, 136, 3.2), circle(123, 136, 3.2))} className="tv-critter__glint" />
      <path d={join(ellipse(66, 160, 9, 5.5), ellipse(134, 160, 9, 5.5))} className="tv-critter__cheek" />
      <path d={happy ? 'M88 158q12 13 24 0' : 'M91 160q9 7 18 0'} className="tv-critter__mouth" />
    </svg>
  )
}
