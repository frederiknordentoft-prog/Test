// Animals and things as pictures for the map and the end of the round. Only the buddy animates its
// parts (SPEC §6.4); every other animal is rendered once to an <img> (rigBlobUrl). Species and items
// load on demand; one that is not drawn yet shows a plain icon instead of a stand-in animal.
import { useEffect, useMemo, useState } from 'react'
import type { Animal, ItemId, Mood, SpeciesId } from '../../../../engine/types'
import type { RigCrop } from '../../../../art/rig/Rig'
import { ItemIcon } from '../../../../art/rig/ItemIcon'
import { rigBlobUrl } from '../../../../art/rig/staticSvg'
import type { ItemDef, Outfit, SpeciesDef } from '../../../../art/rig/types'
import { AVAILABLE_ITEMS, loadItem } from '../../../../art/items/registry'
import { AVAILABLE_SPECIES, loadSpecies } from '../../../../art/species/registry'
import { Icon } from '../../../design/Icon'
import type { IconName } from '../../../design/icons'
import { cx } from '../../../design/cx'

const speciesReady = new Map<SpeciesId, SpeciesDef>()
const itemsReady = new Map<ItemId, ItemDef>()

export const isDrawn = (species: SpeciesId): boolean => AVAILABLE_SPECIES.includes(species)

/** The species' art, or null while loading and for a species that is not drawn yet. */
export function useSpeciesDef(species: SpeciesId | null | undefined): SpeciesDef | null {
  const drawn = !!species && isDrawn(species)
  const [def, setDef] = useState<SpeciesDef | null>(() => (species && speciesReady.get(species)) || null)
  useEffect(() => {
    if (!species || !drawn) {
      setDef(null)
      return
    }
    const known = speciesReady.get(species)
    if (known) {
      setDef(known)
      return
    }
    let alive = true
    loadSpecies(species).then(
      (d) => {
        speciesReady.set(species, d)
        if (alive) setDef(d)
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [species, drawn])
  return drawn ? def : null
}

/** An item's art, or null while loading and for an item that is not drawn yet. */
export function useItemDef(item: ItemId | null | undefined): ItemDef | null {
  const drawn = !!item && AVAILABLE_ITEMS.includes(item)
  const [def, setDef] = useState<ItemDef | null>(() => (item && itemsReady.get(item)) || null)
  useEffect(() => {
    if (!item || !drawn) {
      setDef(null)
      return
    }
    const known = itemsReady.get(item)
    if (known) {
      setDef(known)
      return
    }
    let alive = true
    loadItem(item).then(
      (d) => {
        itemsReady.set(item, d)
        if (alive) setDef(d)
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [item, drawn])
  return drawn ? def : null
}

/** The animal's outfit with the item art loaded (items not drawn yet are left off). */
export function useOutfit(animal: Pick<Animal, 'outfit'> | null | undefined): Outfit | undefined {
  const key = animal ? JSON.stringify(animal.outfit) : ''
  const [outfit, setOutfit] = useState<Outfit | undefined>(undefined)
  useEffect(() => {
    const worn = animal ? Object.entries(animal.outfit) : []
    if (worn.length === 0) {
      setOutfit(undefined)
      return
    }
    let alive = true
    Promise.all(
      worn.map(([slot, w]) =>
        w && AVAILABLE_ITEMS.includes(w.item)
          ? loadItem(w.item).then((item) => [slot, { item, colorway: w.color }] as const, () => null)
          : Promise.resolve(null),
      ),
    ).then((list) => {
      if (!alive) return
      const out: Outfit = {}
      for (const e of list) if (e) out[e[0] as keyof Outfit] = e[1]
      setOutfit(Object.keys(out).length > 0 ? out : undefined)
    })
    return () => {
      alive = false
    }
    // keyed by the outfit's content
  }, [key])
  return outfit
}

export interface AnimalPictureProps {
  /** A whole animal (colours, form, outfit) or just a species in its first colour. */
  animal?: Animal | null
  species?: SpeciesId
  crop?: RigCrop
  mood?: Mood
  /** Rendered size in CSS px (the picture keeps its crop's aspect). */
  size: number
  /** Shown instead while loading or when the species is not drawn yet. */
  fallback?: IconName
  className?: string
}

/** A still picture of an animal (an <img> from a blob URL; never animated parts). */
export function AnimalPicture({ animal, species, crop = 'head', mood = 'happy', size, fallback = 'paw', className }: AnimalPictureProps) {
  const id = animal?.species ?? species ?? null
  const def = useSpeciesDef(id)
  const outfit = useOutfit(animal)
  const src = useMemo(() => {
    if (!def || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
    const stage = animal ? (animal.shown === 'star' ? 3 : animal.shown) : 2
    return rigBlobUrl({
      species: def,
      breed: animal?.breed,
      colorway: animal?.colorway ?? 'c1',
      stage,
      star: animal?.shown === 'star',
      mood,
      outfit,
      crop,
      seed: 3,
    })
  }, [def, animal, outfit, mood, crop])
  if (!src) {
    return (
      <span className={cx('tv-pic tv-pic--icon', className)} style={{ width: size, height: size }} aria-hidden>
        <Icon name={fallback} size="62%" strokeWidth={2.2} />
      </span>
    )
  }
  return <img className={cx('tv-pic', className)} src={src} width={size} height={crop === 'full' || crop === 'fit' ? Math.round(size * 1.2) : size} alt="" draggable={false} />
}

/** A thing from the wardrobe as its icon (or a gift while it is not drawn). */
export function ItemPicture({ item, size, className }: { item: ItemId; size: number; className?: string }) {
  const def = useItemDef(item)
  if (!def) {
    return (
      <span className={cx('tv-pic tv-pic--icon', className)} style={{ width: size, height: size }} aria-hidden>
        <Icon name="gift" size="62%" strokeWidth={2.2} />
      </span>
    )
  }
  return (
    <span className={cx('tv-pic', className)} style={{ width: size, height: size }} aria-hidden>
      <ItemIcon item={def} size={size} />
    </span>
  )
}
