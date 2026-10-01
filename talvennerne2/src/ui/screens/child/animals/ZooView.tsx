// Dyrehaven for one profile: golden and rainbow picks waiting at the top, the egg, and the meadow
// with all the child's animals and decor. Tapping an animal says its name, makes it hop and opens its
// card; a hatch or a pick shows the new friend and its naming. The animation plan keeps at most three
// animated rigs on the screen (SPEC §6.4) — the open card's animal counts as one of them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Animal, ClipId, ProfileDoc, SpeciesId } from '../../../../engine/types'
import { pendingChoices } from '../../../../meta/animals'
import { SpokenText } from '../../../design/SpokenText'
import { isCalm } from '../../../design/motion'
import { useSpeech } from '../../../design/speech'
import { TopBar } from '../../../shell/TopBar'
import { AnimalSheet } from './AnimalSheet'
import { isDrawn, outfitOf, useItemDefs, useSpeciesDefs } from './art'
import { BornSheet } from './BornSheet'
import { ChoiceCard } from './ChoiceCard'
import { EggCard } from './EggCard'
import { Meadow } from './Meadow'
import { eggModel, meadowCells, planAnimation } from './model'

/** An animal found within this long counts as new on the meadow. */
const NEW_FOR_MS = 24 * 3600_000

export interface ZooViewProps {
  profile: ProfileDoc
  /** Open this animal's card at once (the route's uid). */
  openUid?: string | null
  /** Time used for "Ny" (tests pass a fixed clock). */
  now?: number
  onDress(uid: string): void
}

export function ZooView({ profile, openUid = null, now, onDress }: ZooViewProps) {
  const speech = useSpeech()
  const [sheetUid, setSheetUid] = useState<string | null>(() => (openUid && profile.animals.some((a) => a.uid === openUid) ? openUid : null))
  const [born, setBorn] = useState<{ animal: Animal; title: ClipId } | null>(null)
  const [focus, setFocus] = useState<string[]>([])
  const [hop, setHop] = useState<{ uid: string; n: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openUid && profile.animals.some((a) => a.uid === openUid)) setSheetUid(openUid)
    // only when the route asks for another animal
  }, [openUid])

  const cells = useMemo(() => meadowCells(profile), [profile.animals, profile.buddyUid, profile.decor])
  // only drawn species can move their parts; the others never take an animation slot
  const order = useMemo(() => cells.flatMap((c) => (c.kind === 'animal' && isDrawn(c.animal.species) ? [c.animal.uid] : [])), [cells])
  const egg = useMemo(() => eggModel(profile), [profile.animals, profile.economy])
  const pending = useMemo(() => pendingChoices(profile), [profile.animals, profile.skillMedals, profile.nodes])

  const species = useMemo(() => {
    const all = new Set<SpeciesId>(profile.animals.map((a) => a.species))
    for (const s of egg.options) all.add(s)
    for (const c of pending) for (const s of c.options) all.add(s)
    return [...all]
  }, [profile.animals, egg.options, pending])
  const defs = useSpeciesDefs(species)
  const items = useItemDefs(profile.animals)
  const outfits = useMemo(() => Object.fromEntries(profile.animals.map((a) => [a.uid, outfitOf(a, items)])), [profile.animals, items])

  // the animal in front (a new friend, or an open card) animates there; a shadow of a species not
  // drawn yet takes no slot
  const front = born?.animal ?? profile.animals.find((a) => a.uid === sheetUid) ?? null
  const plan = planAnimation(order, profile.buddyUid, { focus, sheet: front && isDrawn(front.species) ? front.uid : null })
  const clock = now ?? Date.now()
  const newest = profile.animals.reduce<Animal | null>((best, a) => (!best || a.foundAt > best.foundAt ? a : best), null)
  const newUid = newest && clock - newest.foundAt < NEW_FOR_MS && profile.animals.length > 1 ? newest.uid : null

  const touch = useCallback((uid: string) => {
    setFocus((f) => [uid, ...f.filter((x) => x !== uid)].slice(0, 2))
    setHop((h) => ({ uid, n: (h?.n ?? 0) + 1 }))
  }, [])

  const welcome = (animal: Animal, title: ClipId) => {
    touch(animal.uid)
    setBorn({ animal, title })
  }

  /** After the welcome: bring the new friend's place on the meadow into view (only this list scrolls). */
  const showOnMeadow = (uid: string) => {
    const box = scroller.current
    const cell = box?.querySelector<HTMLElement>(`[data-uid="${uid}"]`)
    if (!box || !cell) return
    const top = cell.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - box.clientHeight / 4
    box.scrollTo?.({ top: Math.max(0, top), behavior: isCalm() ? 'auto' : 'smooth' })
  }

  const sheetAnimal = sheetUid ? (profile.animals.find((a) => a.uid === sheetUid) ?? null) : null
  const bornAnimal = born ? (profile.animals.find((a) => a.uid === born.animal.uid) ?? born.animal) : null

  return (
    <div className="zoo" data-zoo="">
      <TopBar className="zoo-bar" leading={<SpokenText as="h1" clip="s.zoo.title" className="zoo__title" />} onReplay={() => speech.speak([{ clip: 's.zoo.intro' }])} />
      <div className="zoo__scroll" ref={scroller}>
        <div className="zoo__inner">
          {(pending.length > 0 || egg.options.length > 0 || egg.allFound) && (
            <div className="zoo__top">
              {pending.map((c) => (
                <ChoiceCard key={`${c.kind}-${c.world}`} choice={c} defs={defs} onChosen={(a) => welcome(a, 's.reward.animal.magic')} />
              ))}
              {(egg.options.length > 0 || egg.allFound) && <EggCard egg={egg} defs={defs} onHatched={(a) => welcome(a, 's.reward.egg.hatched')} />}
            </div>
          )}
          {cells.length > 0 ? (
            <Meadow
              cells={cells}
              plan={plan}
              defs={defs}
              outfits={outfits}
              newest={newUid}
              hop={hop}
              onAnimal={(a) => {
                touch(a.uid)
                setSheetUid(a.uid)
              }}
            />
          ) : (
            <div className="zoo-empty">
              <SpokenText clip="s.zoo.empty" />
            </div>
          )}
        </div>
      </div>
      <AnimalSheet
        animal={sheetAnimal}
        open={!!sheetAnimal && !born}
        isBuddy={!!sheetAnimal && sheetAnimal.uid === profile.buddyUid}
        def={sheetAnimal ? defs[sheetAnimal.species] : undefined}
        outfit={sheetAnimal ? outfits[sheetAnimal.uid] : undefined}
        onClose={() => setSheetUid(null)}
        onDress={onDress}
      />
      <BornSheet
        animal={bornAnimal}
        title={born?.title ?? 's.reward.egg.hatched'}
        def={bornAnimal ? defs[bornAnimal.species] : undefined}
        outfit={bornAnimal ? outfits[bornAnimal.uid] : undefined}
        onClose={() => {
          const uid = born?.animal.uid
          setBorn(null)
          if (uid) requestAnimationFrame(() => showOnMeadow(uid))
        }}
      />
    </div>
  )
}
