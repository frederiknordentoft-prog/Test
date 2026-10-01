// Fixed clips for Dyrehaven (src/ui/screens/child/AnimalsScreen.tsx and animals/**): the meadow, the
// egg, an animal's card (friendship, tricks, forms, buddy, name) and the golden and rainbow picks.
// Species, breed, colour and decor names come from clips/names/catalog.ts, the egg and naming
// sentences shared with the end of a round from clips/ui/rewards.ts. Never hunger, care or guilt,
// never "only N more" (SPEC §6.3, §13). Sentences carry their punctuation; labels carry none.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.zoo.title': 'Dyrehaven',
  's.zoo.intro': 'Her bor dine dyr. Tryk på et dyr for at se det.',
  's.zoo.empty': 'Her kommer dine dyr til at bo.',
  's.zoo.new': 'Ny',

  // the buddy: the friend who comes along on the rounds
  's.zoo.buddy.is': 'Med på tur',
  's.zoo.buddy.choose': 'Tag med på tur',
  's.zoo.buddy.now': 'Nu er den med på tur.',

  // friendship, tricks and forms
  's.zoo.friendship': 'Venskab',
  's.zoo.friendship.level': 'Jeres venskab er på niveau',
  's.zoo.friendship.how': 'Venskabet vokser, når I regner sammen på tur.',
  's.zoo.bestFriend': 'Bedste ven',
  's.zoo.tricks': 'Tricks',
  's.zoo.trick.hop': 'Hop',
  's.zoo.trick.cheer': 'Jubel',
  's.zoo.trick.spin': 'Snurre',
  's.zoo.trick.call': 'Kald',
  's.zoo.trick.signature': 'Eget trick',
  's.zoo.trick.dance': 'Dans',
  's.zoo.trick.locked': 'Det trick kommer, når I er endnu bedre venner.',
  's.zoo.forms': 'Form',
  's.zoo.form.1': 'Baby',
  's.zoo.form.2': 'Ung',
  's.zoo.form.3': 'Stor',
  's.zoo.form.star': 'Stjerne',
  's.zoo.form.locked': 'Den form kommer, når I er endnu bedre venner.',
  's.zoo.rename': 'Nyt navn',
  's.zoo.dress': 'Klæd på',

  // naming
  's.zoo.name.own': 'Skriv selv',
  's.zoo.name.hint': 'Skriv et navn',

  // the egg
  's.zoo.egg': 'Rugeægget',
  's.zoo.egg.becomes': 'Ægget bliver til',
  's.zoo.egg.change': 'Skift dyr',
  's.zoo.egg.allFound': 'Du har fundet alle farverne. Nu giver varmen fra ægget ekstra venskab til den, der er med på tur.',

  // golden and rainbow animals
  's.zoo.magic.pick': 'Vælg den',
  's.zoo.magic.gold.about': 'Din guldmedalje giver dig et gyldent dyr.',
  's.zoo.magic.rainbow.about': 'Tre stjerner på alle sten giver dig et regnbuedyr.',
}
