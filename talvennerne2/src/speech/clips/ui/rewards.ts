// What Pip says at the end of a round and around the egg, the animals and the goals (SPEC §5.8,
// §6.2–6.3, §13). Short and warm; never "only N more", never guilt, never a countdown. Sentences
// carry their own punctuation, labels and fragments carry none. Names, numbers and region names are
// added by the screens as their own clips.
import type { ClipId } from '../../../engine/types'

export const clips: Readonly<Record<ClipId, string>> = {
  // "Det lærte du" — learning comes first: the facts and numbers that moved, and how well each sits
  // (only box 5 "sits"; review r1 P2-2)
  's.reward.learned': 'Det lærte du',
  's.reward.learned.started': 'Godt begyndt!',
  's.reward.learned.moved': 'Du er blevet bedre til det her.',
  's.reward.learned.box3': 'Det går rigtig godt med det her!',
  's.reward.learned.box5': 'Det sidder helt fast nu!',
  's.reward.learned.first': 'Første gang rigtigt!',
  's.reward.learned.status': 'Du er rykket et trin op.',
  's.reward.learned.practiced': 'Du har øvet dig godt.',
  's.reward.learned.number': 'Tallet',
  's.reward.learned.after': 'Tallet efter',
  's.reward.learned.before': 'Tallet før',
  's.reward.learned.between': 'Tallet imellem',
  's.reward.learned.bigger': 'Det største tal',
  's.reward.learned.pattern': 'Et mønster',
  's.reward.learned.compareLength': 'Længst og kortest',
  's.reward.nextGoal': 'Næste mål',

  // stars, perler and points
  's.reward.stars.1': 'En ny stjerne!',
  's.reward.stars.2': 'To nye stjerner!',
  's.reward.stars.3': 'Tre nye stjerner!',
  's.reward.tally': 'Se dine perler og point.',
  's.reward.alsoToday': 'Også i dag',

  // trials, the bridge and the fog
  's.reward.trial.passed': 'Broen holder! Tågen letter.',
  's.reward.trial.ready': 'Klar, når du er.',
  's.reward.trial.best': 'Bedst',
  's.reward.trial.planks': 'planker',
  's.reward.finale.passed': 'Verdensfest! Du klarede finalen.',
  's.reward.hut': 'Træningshytten er tændt.',
  's.reward.helpBridge': 'Hjælpebroen er klar. Du kan gå videre.',
  's.reward.region.open': 'Et nyt sted er dukket op på kortet!',
  's.reward.regions.open': 'Nye steder er dukket op på kortet!',
  's.reward.world.open': 'En ny verden er dukket op!',
  's.reward.regionTier': 'Farverne kommer tilbage!',

  // medals
  's.reward.medal.bronze': 'Bronzemedalje!',
  's.reward.medal.silver': 'Sølvmedalje!',
  's.reward.medal.gold': 'Guldmedalje! Det kan du selv.',
  's.reward.allGolden': 'Alle de gyldne dyr er fundet. Her er perler.',

  // levels and titles
  's.reward.level': 'Nyt niveau!',
  's.reward.title.new': 'Ny titel!',
  's.reward.title.1': 'Nybegynder',
  's.reward.title.5': 'Opdager',
  's.reward.title.10': 'Eventyrer',
  's.reward.title.15': 'Talspejder',
  's.reward.title.20': 'Regnemester',
  's.reward.title.30': 'Talmagiker',
  's.reward.title.40': 'Stjerneregner',
  's.reward.title.50': 'Talvenne-legende',

  // things
  's.reward.item.new': 'En ny ting!',
  's.reward.item.try': 'Prøv den',
  's.reward.chest': 'Kisten er åben!',
  's.reward.wish.done': 'Dit ønske gik i opfyldelse!',
  's.reward.trophy': 'Et nyt trofæ!',

  // animals
  's.reward.animal.friend': 'En ny ven!',
  's.reward.animal.color': 'En ny farve!',
  's.reward.animal.breed': 'En ny race!',
  's.reward.animal.magic': 'Et magisk dyr!',
  's.reward.starfoal': 'Stjernefølet er kommet!',
  's.reward.gold.choose': 'Vælg et gyldent dyr.',
  's.reward.rainbow.choose': 'Vælg et regnbuedyr.',
  's.reward.name.choose': 'Hvad skal din ven hedde?',

  // the egg
  's.reward.egg.ready': 'Ægget er klar! Tryk på det.',
  's.reward.egg.choose': 'Hvilket dyr skal ægget være?',
  's.reward.egg.tap': 'Tryk igen!',
  's.reward.egg.hatched': 'Velkommen, lille ven!',
  's.reward.egg.allFound': 'Alle farver er fundet.',
  's.reward.egg.friendship': 'Varmen fra ægget gav din ven ekstra venskab.',

  // friendship and growth
  's.reward.growth.young': 'Din ven er vokset!',
  's.reward.growth.grown': 'Din ven er blevet stor!',
  's.reward.growth.star': 'Stjerneform! I er bedste venner.',
  's.reward.friendship.hop': 'Din ven har lært at hoppe!',
  's.reward.friendship.cheer': 'Din ven har sit eget jubel nu!',
  's.reward.friendship.spin': 'Din ven har lært at snurre!',
  's.reward.friendship.call': 'Hør, din ven har sit eget kald!',
  's.reward.friendship.signature': 'Din ven har lært sit helt eget trick!',
  's.reward.friendship.dance': 'Din ven har lært at danse!',

  // the three goals and the stamp book
  's.reward.goal.done': 'Mål klaret! Et stempel til stempelbogen.',
  's.reward.goal.mix': 'Spil Blandet øvelse.',
  's.reward.goal.revisit': 'Tag en tur forbi',
  's.reward.goal.streak5': 'Svar rigtigt fem gange i træk.',
  's.reward.goal.write10': 'Skriv ti svar selv.',
  's.reward.goal.stars3': 'Få tre stjerner på en tur.',
}

/** Needed from the first round on, but not pinned at start: its own sprite, fetched when needed. */
export const wave = 1
export const pack = 'rewards'
