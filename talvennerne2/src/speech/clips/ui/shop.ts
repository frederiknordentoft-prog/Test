// Fixed clips for the shop (src/ui/screens/child/ShopScreen.tsx and shop/**): the perler, the three
// shelves (clothes, colours, decor), the buying sheet with its clear yes/no, the wish and the warm
// line about where perler come from. Prices and amounts are their own number parts, so no text here
// holds a digit. Fixed prices only: no countdown, no "today only", no rarity, no real money, never
// guilt and never "only N more" (SPEC §5.7, §13). Sentences carry their punctuation; labels and
// fragments carry none (`.end` fragments close a sentence).
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  's.shop.title': 'Butikken',
  's.shop.perler.have': 'Du har',
  's.shop.perler.end': 'perler',

  // The shelves
  's.shop.tab.clothes': 'Tøj',
  's.shop.tab.colors': 'Farver',
  's.shop.tab.decor': 'Pynt',
  's.shop.clothes.about': 'Tøj til dine dyr. Prisen står under hver ting.',
  's.shop.colors.about': 'Køb en ny farve til dit tøj.',
  's.shop.colors.none': 'Når du har fået tøj, kan du købe nye farver til det her.',
  's.shop.decor.about': 'Pynt til Dyrehaven.',
  's.shop.set.done': 'Hele sættet er dit!',

  // A thing on the shelf
  's.shop.owned': 'Din',
  's.shop.owned.about': 'Den er din. Du kan tage den på i garderoben.',
  's.shop.decor.owned': 'Den står i Dyrehaven.',
  's.shop.color.owned': 'Den farve er din.',
  's.shop.colors.all': 'Du har alle farverne.',

  // Buying: the sheet asks first
  's.shop.cost': 'Den koster',
  's.shop.color.cost': 'En ny farve koster',
  's.shop.buy.ask': 'Vil du købe den?',
  's.shop.buy.yes': 'Ja, køb den',
  's.shop.buy.no': 'Nej tak',
  's.shop.bought': 'Den er din nu!',
  's.shop.color.bought': 'Den nye farve er din!',
  's.shop.decor.bought': 'Pynten står nu i Dyrehaven.',
  's.shop.tryOn': 'Prøv den på',
  's.shop.decor.see': 'Se Dyrehaven',
  's.shop.later': 'Den kan du købe, når du har samlet flere perler.',
  's.shop.earn': 'Perler får du, når du regner. Hver gang du svarer rigtigt, får du en perle.',

  // The wish
  's.shop.wish': 'Ønsk dig den',
  's.shop.wish.title': 'Dit ønske',
  's.shop.wish.none': 'Du kan ønske dig en ting. Tryk på den, og vælg Ønsk dig den.',
  's.shop.wish.meter': 'Bjælken fyldes, når du regner.',
  's.shop.wish.ready': 'Nu kan du købe dit ønske!',
  's.shop.wish.set': 'Nu er den dit ønske.',
  's.shop.wish.remove': 'Fjern ønsket',
}
