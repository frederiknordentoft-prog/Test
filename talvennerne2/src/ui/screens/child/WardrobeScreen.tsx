// The `wardrobe` route (SPEC §7, §8): one animal stands big in the middle — the buddy, or the one the
// route names — and the six slots are tabs below it. A tap on one of the child's things puts it on at
// once (a tap on what is on takes it off); the three colours of the thing that is on sit beside the
// animal, the bought ones choosable and the others in the shop. Everything else is an outline that
// says how to get it. `item` (a new thing after a level-up, "Prøv den på") opens its tab and points at
// it with a soft ring and a hand; so does the Hverdag hat the very first time. Nothing is forced.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { ITEM_BY_ID } from '../../../content/catalog'
import type { ItemColor, ItemId, Mood, ProfileDoc, Slot, SpeechPart } from '../../../engine/types'
import { AVAILABLE_ITEMS, loadItem } from '../../../art/items/registry'
import { useMeta } from '../../../state/useMeta'
import { useProfile } from '../../../state/useProfile'
import { SpokenText } from '../../design/SpokenText'
import { useSpeech } from '../../design/speech'
import { TopBar } from '../../shell/TopBar'
import { markGuided, wasGuided } from './wardrobe/guided'
import {
  SLOTS, animalsInOrder, canWishFor, cardAction, colorAction, guideItem, howToGetColor, howToGetItem, itemNameSpeech,
  pickAnimal, slotLocked, slotModel, startSlot, type TapAction,
} from './wardrobe/model'
import { AnimalPicker, ColorBar, DressedAnimal, HowSheet, OffButton, SlotPanel, SlotTabs, type HowTarget } from './wardrobe/WardrobeView'
import './wardrobe/wardrobe.css'

/** How long the animal cheers after putting something on. */
const CHEER_MS = 1400

export default function WardrobeScreen({ route }: ScreenProps<RouteOf<'wardrobe'>>) {
  const profile = useProfile((s) => s.profile)
  useEffect(() => {
    if (!profile) useNav.getState().root({ id: 'profiles' }, 'back')
  }, [profile])
  return profile ? <Wardrobe profile={profile} route={route} /> : null
}

export interface WardrobeProps {
  profile: ProfileDoc
  route: RouteOf<'wardrobe'>
}

/** The wardrobe of one child (the screen hands it the loaded profile). */
export function Wardrobe({ profile, route }: WardrobeProps) {
  const speech = useSpeech()
  const [uid, setUid] = useState<string | null>(route.uid ?? null)
  const [slot, setSlot] = useState<Slot>(() => startSlot(route.item))
  const [guide, setGuide] = useState<ItemId | null>(() => guideItem(profile, route.item, wasGuided(profile.id)))
  const [how, setHow] = useState<HowTarget | null>(null)
  const [mood, setMood] = useState<Mood>('happy')
  const [picked, setPicked] = useState<Partial<Record<ItemId, ItemColor>>>({})
  const cheer = useRef(0)
  const panel = useRef<HTMLDivElement>(null)

  // A new route on the same screen (another animal, another new thing).
  const [seen, setSeen] = useState({ uid: route.uid, item: route.item })
  if (seen.uid !== route.uid || seen.item !== route.item) {
    setSeen({ uid: route.uid, item: route.item })
    if (route.uid) setUid(route.uid)
    if (route.item) {
      setSlot(startSlot(route.item))
      setGuide(guideItem(profile, route.item, true))
    }
  }

  // The drawings of the things that exist, so a tap dresses the animal without a wait.
  useEffect(() => {
    for (const id of AVAILABLE_ITEMS) void loadItem(id).catch(() => undefined)
  }, [])

  useEffect(() => () => window.clearTimeout(cheer.current), [])

  const animal = pickAnimal(profile, uid)
  const animals = useMemo(() => animalsInOrder(profile), [profile])
  const model = slotModel(profile, animal, slot)

  // The pointed-at thing: in view, said once (when the child likes things read aloud), remembered.
  const guideOn = !!(guide && animal?.outfit[ITEM_BY_ID[guide].slot]?.item === guide)
  useEffect(() => {
    if (!guide) return
    markGuided(profile.id)
    panel.current?.querySelector(`[data-item="${guide}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (profile.settings.autoSpeak) speech.speak([{ clip: guideOn ? 's.wardrobe.guide.on' : 's.wardrobe.guide' }])
    // once per pointed-at thing
  }, [guide])

  const celebrate = () => {
    setMood('cheer')
    window.clearTimeout(cheer.current)
    cheer.current = window.setTimeout(() => setMood('happy'), CHEER_MS)
  }

  const showHow = (item: ItemId, color: ItemColor | null) => {
    const parts: SpeechPart[] = color === null ? howToGetItem(item) : howToGetColor()
    speech.speak([...itemNameSpeech(item), ...parts])
    setHow({ item, color, speech: parts })
  }

  const run = (action: TapAction) => {
    if (!animal) return
    switch (action.kind) {
      case 'wear': {
        if (!useMeta.getState().wear(animal.uid, action.item, action.color)) return
        setPicked((p) => ({ ...p, [action.item]: action.color }))
        const guided = action.item === guide
        speech.speak([...itemNameSpeech(action.item), ...(guided ? [{ clip: 's.wardrobe.guide.on' }] : [])])
        if (guided) setGuide(null)
        celebrate()
        return
      }
      case 'takeOff':
        if (useMeta.getState().takeOff(animal.uid, action.slot)) speech.speak([{ clip: 's.wardrobe.off' }])
        return
      case 'how':
        showHow(action.item, action.color)
        return
      case 'locked':
        speech.speak([{ clip: 's.wardrobe.wings' }])
        return
      case 'none':
        return
    }
  }

  const worn: Partial<Record<Slot, boolean>> = {}
  const locked: Partial<Record<Slot, boolean>> = {}
  for (const s of SLOTS) {
    worn[s] = !!animal?.outfit[s]
    locked[s] = slotLocked(animal, s)
  }
  const on = model.worn
  const onColors = on ? (model.owned.find((o) => o.meta.id === on.item)?.colors ?? [0 as ItemColor]) : []

  return (
    <div className="tv-wr" data-wardrobe={animal?.uid ?? ''} data-slot={slot}>
      <TopBar
        leading="back"
        onLeading={() => useNav.getState().back()}
        center={
          animals.length > 1 ? (
            <AnimalPicker animals={animals} selected={animal?.uid ?? null} buddyUid={profile.buddyUid} onPick={(a) => setUid(a.uid)} />
          ) : (
            <SpokenText as="h1" clip="s.wardrobe.title" className="tv-wr-title" />
          )
        }
        className={animals.length > 1 ? 'tv-wr__top' : 'tv-wr__top tv-wr__top--title'}
      />
      <div className="tv-wr__stage">
        <DressedAnimal animal={animal} mood={mood} />
        {on && <OffButton item={on.item} onOff={() => run({ kind: 'takeOff', slot })} />}
        {on && <ColorBar item={on.item} owned={onColors} on={on.color} onPick={(c) => run(colorAction(profile, animal, on.item, c))} />}
      </div>
      <div className="tv-wr__tabs">
        <SlotTabs active={slot} worn={worn} locked={locked} onPick={setSlot} />
      </div>
      <div className="tv-wr__panel" ref={panel}>
        <SlotPanel
          model={model}
          guide={guide}
          colorOf={(item) => picked[item] ?? 0}
          onCard={(item) => run(cardAction(profile, animal, item, picked[item] ?? 0))}
          onOther={(item) => showHow(item, null)}
        />
      </div>
      <HowSheet
        target={how}
        wished={!!how && profile.economy.wish === how.item}
        canWish={!!how && canWishFor(profile, how.item)}
        onClose={() => setHow(null)}
        onShop={() => {
          setHow(null)
          useNav.getState().go({ id: 'shop' })
        }}
        onWish={() => {
          if (how && useMeta.getState().setWish(how.item)) speech.speak([{ clip: 's.shop.wish.set' }])
        }}
      />
    </div>
  )
}
