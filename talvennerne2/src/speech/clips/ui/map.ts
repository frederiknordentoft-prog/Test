// Fixed clips for the map (src/ui/screens/child/MapScreen.tsx and map/**): the node kinds, locks,
// the trial bridge, the hut, Blandet øvelse, the three goals and the HUD labels. Region, world,
// species and item names come from clips/names/catalog.ts. Never "only N more", never guilt, never a
// countdown (SPEC §13). Sentences carry their punctuation; labels and fragments carry none.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  // What a stone on the path is
  's.map.node.l1': 'Lær nyt',
  's.map.node.l2': 'Lær mere',
  's.map.node.friend': 'Ny ven',
  's.map.node.chest': 'Kisten',
  's.map.node.l3': 'Skriv selv',
  's.map.node.mix': 'Blandet tur',
  's.map.node.trial': 'Mesterprøven',
  's.map.node.finale': 'Verdensfesten',
  's.map.practice': 'Blandet øvelse',
  's.map.hut': 'Træningshytten',

  // What a stone holds (read in the stone's card)
  's.map.about.l1': 'Her lærer du noget nyt.',
  's.map.about.l2': 'Her lærer du lidt mere.',
  's.map.about.l3': 'Her skriver du selv svarene.',
  's.map.about.mix': 'En tur med lidt af det hele fra stedet.',
  's.map.about.friend': 'Her møder du en ny ven:',
  's.map.about.friendMet': 'Her fik du en ny ven:',
  's.map.about.chest': 'I kisten ligger:',
  's.map.about.chestOpen': 'Kisten er åben. Den gav dig:',
  's.map.about.trial': 'Byg broen med dine svar. Otte planker, så holder den.',
  's.map.about.skip': 'Du kan prøve broen allerede nu. Holder den, springer du frem.',
  's.map.about.finale': 'Den store fest for hele verdenen.',
  's.map.about.practice': 'En tur med lidt af alt det, du kan.',
  's.map.about.hut': 'Her øver du det, der drillede i mesterprøven.',
  's.map.about.skipped': 'Den har du sprunget over. Du kan stadig spille den.',

  // Stars on a stone
  's.map.stars.0': 'Spil og få op til tre stjerner.',
  's.map.stars.1': 'En stjerne her.',
  's.map.stars.2': 'To stjerner her.',
  's.map.stars.3': 'Tre stjerner her!',

  // The bridge (the trial)
  's.map.trial.rest': 'Spil en tur først, så er broen klar igen.',
  's.map.trial.passed': 'Broen holder!',

  // Locks: visible, never hidden, and always saying what opens them
  's.map.locked.node': 'Spil stenen før, så åbner den.',
  's.map.locked.requires': 'Det åbner, når du har klaret mesterprøven i',
  's.map.locked.more': 'Spil flere sten på kortet, så åbner det.',
  's.map.locked.world': 'Den verden åbner, når du er nået længere frem.',
  's.map.locked.finale': 'Festen åbner, når du har klaret mange af broerne.',

  // Places, worlds, the way on
  's.map.region.new': 'Nyt sted!',
  's.map.region.tier.start': 'Lær her, så kommer farverne tilbage.',
  's.map.region.tier.bronze': 'Lanternerne er tændt.',
  's.map.region.tier.silver': 'Blomsterne og vandet er tilbage.',
  's.map.region.tier.gold': 'Alle farverne er tilbage!',
  's.map.world.choose': 'Vælg en verden',
  's.map.next': 'Næste sted',
  's.map.resume': 'Fortsæt turen',
  's.map.resume.about': 'Din tur er gemt. Spil videre, hvor du slap.',

  // HUD
  's.map.level': 'Niveau',
  's.map.perler.have': 'Du har',
  's.map.perler.word': 'perler',
  's.map.buddy': 'Klæd din ven på',
  's.map.goals': 'Næste tre mål',
  's.map.goal.done': 'Klaret! Et stempel i stempelbogen.',
}
