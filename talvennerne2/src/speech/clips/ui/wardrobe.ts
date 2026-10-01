// Fixed clips for the wardrobe (src/ui/screens/child/WardrobeScreen.tsx and wardrobe/**): the six
// slots, what a tile does, the guided dressing and "Sådan får du den" for every kind of source.
// Item, set, region and world names come from clips/names/catalog.ts; numbers are their own parts,
// so no text here holds a digit. Never "only N more", never guilt, never a countdown (SPEC §13).
// Sentences carry their punctuation; labels and fragments carry none (`.end` fragments close a
// sentence and get their full stop from the generator).
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.wardrobe.title': 'Garderoben',

  // The six slots (tabs)
  's.wardrobe.slot.head': 'Hoved',
  's.wardrobe.slot.face': 'Ansigt',
  's.wardrobe.slot.neck': 'Hals',
  's.wardrobe.slot.body': 'Krop',
  's.wardrobe.slot.back': 'Ryg',
  's.wardrobe.slot.hand': 'Hånd',

  // The panel under the tabs
  's.wardrobe.mine': 'Dit tøj',
  's.wardrobe.more': 'Det kan du få',
  's.wardrobe.empty': 'Her har du ikke noget endnu. Tryk på en ting, så hører du, hvordan du får den.',
  's.wardrobe.off': 'Tag af',
  's.wardrobe.colors': 'Farver',
  's.wardrobe.wings': 'Den har sine egne vinger. Der er ikke plads til noget på ryggen.',
  's.wardrobe.new': 'Ny',

  // Guided dressing (a new thing after a level-up, or the first time)
  's.wardrobe.guide': 'Tryk på din nye ting, så prøver din ven den på.',
  's.wardrobe.guide.on': 'Se, din ven har den på!',

  // "Sådan får du den"
  's.wardrobe.how': 'Sådan får du den',
  's.wardrobe.how.level': 'Den får du på niveau',
  's.wardrobe.how.chest': 'Den ligger i kisten i',
  's.wardrobe.how.chest.map': 'Den ligger i en kiste på kortet.',
  's.wardrobe.how.finale': 'Den får du til den store fest i',
  's.wardrobe.how.medal': 'Den får du, når du har fået',
  's.wardrobe.how.silver.one.end': 'sølvmedalje',
  's.wardrobe.how.silver.end': 'sølvmedaljer',
  's.wardrobe.how.gold.one.end': 'guldmedalje',
  's.wardrobe.how.gold.end': 'guldmedaljer',
  's.wardrobe.how.shop': 'Den kan du købe i butikken for',
  's.wardrobe.how.color': 'Den farve kan du købe i butikken for',

  // Buttons in the sheet
  's.wardrobe.toShop': 'Til butikken',
  's.wardrobe.wish': 'Ønsk dig den',
  's.wardrobe.wished': 'Det er dit ønske',
}
