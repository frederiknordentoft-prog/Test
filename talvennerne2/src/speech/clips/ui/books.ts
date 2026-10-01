// Fixed clips for the four books (src/ui/screens/child/BooksScreen.tsx and books/**): the shelf, the
// collection book with "Sådan får du den" for every animal not found yet, the Kan-bog, the stamp book
// with the days played in total, and the trophies with what earns each one. Names of species, breeds,
// colours, regions, worlds, sets and trophies come from clips/names/catalog.ts; the three goals from
// clips/ui/rewards.ts. No rarity, no percentages, no comparison, never "only N more" (SPEC §13).
import { TROPHY_IDS, type ClipId, type TrophyId } from '../../../engine/types'

/** What earns each trophy, read aloud under its outline (SPEC §13.1: days in total, never a streak). */
const TROPHY_HOW: Readonly<Record<TrophyId, string>> = {
  'days-3': 'Regn på tre forskellige dage.',
  'days-7': 'Regn på syv forskellige dage.',
  'days-14': 'Regn på fjorten forskellige dage.',
  'days-30': 'Regn på tredive forskellige dage.',
  'days-100': 'Regn på hundrede forskellige dage.',
  'set-hverdag': 'Saml alle seks ting fra Hverdag-sættet.',
  'set-opdager': 'Saml alle seks ting fra Opdager-sættet.',
  'set-rytter': 'Saml alle seks ting fra Rytter-sættet.',
  'set-kongelig': 'Saml alle seks ting fra det kongelige sæt.',
  'set-astronaut': 'Saml alle seks ting fra Astronaut-sættet.',
  'set-ridder': 'Saml alle seks ting fra Ridder-sættet.',
  'set-talmagiker': 'Saml alle seks ting fra Talmagiker-sættet.',
  'set-pirat': 'Saml alle seks ting fra Pirat-sættet.',
  'set-fodbold': 'Saml alle seks ting fra Fodbold-sættet.',
  'set-vinter': 'Saml alle seks ting fra Vinter-sættet.',
  'set-fest': 'Saml alle seks ting fra Fest-sættet.',
  'world-eng': 'Klar den store fest i Engdalen.',
  'world-bakke': 'Klar den store fest i Hestebakkerne.',
  'world-skov': 'Klar den store fest i Regnbueskoven.',
  'world-fjeld': 'Klar den store fest på Stjernefjeldet.',
  'trials-10': 'Klar ti mesterprøver.',
  'first-gold': 'Få din første guldmedalje.',
  'gold-10': 'Få ti guldmedaljer.',
  'keys5-100': 'Få hundrede ting til at sidde helt fast.',
  'keys5-500': 'Få fem hundrede ting til at sidde helt fast.',
  'perfect-round': 'Spil en hel tur uden en eneste fejl.',
  'trial-perfect': 'Klar en mesterprøve uden en eneste fejl.',
  'table-complete': 'Lær hele gangetabellen, så du kan den selv.',
  'animals-5': 'Find fem dyrevenner.',
  'animals-15': 'Find femten dyrevenner.',
  'animals-30': 'Find tredive dyrevenner.',
  'first-star-form': 'Bliv så gode venner med et dyr, at det får stjerneform.',
  'all-species': 'Find alle seksten slags dyr.',
  'first-rainbow': 'Find dit første regnbuedyr.',
}

export const trophyHowClip = (id: TrophyId): ClipId => `s.books.trophy.how.${id}`

const table: Record<ClipId, string> = {
  's.books.title': 'Bøger',
  's.books.shelf': 'Vælg en bog.',
  's.books.collection': 'Samlebogen',
  's.books.can': 'Kan-bogen',
  's.books.stamps': 'Stempelbogen',
  's.books.trophies': 'Trofæerne',
  's.books.collection.about': 'Alle de dyr, du kan finde.',
  's.books.can.about': 'Alt det, du kan.',
  's.books.stamps.about': 'Dine mål og dine stempler.',
  's.books.trophies.about': 'Alle trofæerne, du kan få.',

  // the collection book
  's.books.found': 'Fundet',
  's.books.of': 'af',
  's.books.how': 'Sådan får du den',
  's.books.how.egg': 'Den kan komme ud af dit rugeæg.',
  's.books.how.meet': 'Mød den på ven-stenen i',
  's.books.how.gold': 'Du kan vælge et gyldent dyr, når du får guldmedaljer i',
  's.books.how.rainbow': 'Du kan vælge et regnbuedyr, når du har tre stjerner på alle sten et sted i',
  's.books.how.ready': 'Du kan vælge den nu i Dyrehaven!',
  's.books.how.starfoal': 'Stjernefølet kommer, når du får din allerførste guldmedalje.',
  's.books.how.breed.lop': 'Når du har to kaniner med stående ører, kan vædderkaninen komme ud af ægget.',
  's.books.how.breed.lionhead': 'Når du har to vædderkaniner, kan løvehovedet komme ud af ægget.',
  's.books.how.breed.longhair': 'Når du har to huskatte, kan den langhårede kat komme ud af ægget.',
  's.books.how.breed.mainecoon': 'Når du har to langhårede katte, kan maine coon-katten komme ud af ægget.',
  's.books.how.breed.fjord': 'Når du har to shetlandsponyer, kan fjordhesten komme ud af ægget.',
  's.books.how.breed.arabian': 'Når du har to fjordheste, kan araberen komme ud af ægget.',
  's.books.how.breed.wavy': 'Når du har to enhjørningeføl, kan bølgemanken komme ud af ægget.',
  's.books.how.breed.starhorn': 'Når du har to enhjørninger med bølgemanke, kan stjernehornet komme ud af ægget.',
  's.books.starfoal': 'Stjernefølet',
  's.books.magic': 'Magiske dyr',

  // the Kan-bog
  's.books.can.gold': 'Det kan jeg selv',
  's.books.can.silver': 'Det er jeg rigtig god til',
  's.books.can.bronze': 'Det kan jeg med lidt hjælp',
  's.books.can.empty': 'Når du bliver god til noget, kommer det i bogen her.',
  's.books.can.more': 'Jeg kan noget nyt.',

  // the stamp book
  's.books.days': 'Dage spillet i alt',
  's.books.stamps.count': 'Stempler',
  's.books.stamps.empty': 'Klar et mål, så får du dit første stempel.',
  's.books.stamp': 'Stempel nummer',
  's.books.goals': 'Næste tre mål',
  's.books.goal.done': 'Klaret',

  // the trophies
  's.books.trophies.have': 'Trofæer',
  's.books.trophy.cat.flid': 'Dage med regning',
  's.books.trophy.cat.stil': 'Hele sæt',
  's.books.trophy.cat.rejse': 'Rejsen',
  's.books.trophy.cat.laering': 'Læring',
  's.books.trophy.cat.venner': 'Dyrevenner',
}

for (const id of TROPHY_IDS) table[trophyHowClip(id)] = TROPHY_HOW[id]

export const clips: Readonly<Record<ClipId, string>> = table
