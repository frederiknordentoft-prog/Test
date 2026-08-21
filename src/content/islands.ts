import type { SkillId, TaskKind } from '../engine/types'
import { factsForSkills } from '../engine/facts'

/** One "tur" — a single sitting of about 60–90 seconds. */
export interface Level {
  id: string
  name: string
  skills: SkillId[]
  /** most characteristic presentation first */
  kinds: TaskKind[]
  size: number
  /** only use facts this easy or easier (see Fact.rank); omit for the whole pool */
  rankMax?: number
  /** the closing party round: mixes in everything learned so far */
  festival?: boolean
}

export interface IslandPalette {
  skyFrom: string
  skyTo: string
  ground: string
  accent: string
  glow: string
}

export interface Island {
  id: string
  name: string
  tagline: string
  emoji: string
  skills: SkillId[]
  levels: Level[]
  /** the school year this island belongs to — lets a grown-up open the right ones */
  grade: 0 | 1 | 2
  palette: IslandPalette
  /** how many turer must be done here before the next island opens */
  unlockAfter: number
  /** the creatures that live here — appearance is generated from the id */
  species: { id: string; name: string }[]
}

const lvl = (
  id: string,
  name: string,
  skills: SkillId[],
  kinds: TaskKind[],
  rankMax?: number,
  festival?: boolean,
): Level => ({ id, name, skills, kinds, size: 10, rankMax, festival })

export const ISLANDS: Island[] = [
  {
    id: 'skov',
    name: 'Tælleskoven',
    tagline: 'Tæl alt hvad du møder',
    emoji: '🌲',
    skills: ['count', 'neighbour'],
    unlockAfter: 4,
    grade: 0,
    palette: { skyFrom: '#0e3b2e', skyTo: '#1d7a5a', ground: '#0a2a20', accent: '#7df5b8', glow: '#34d399' },
    species: [
      { id: 'skov-mos', name: 'Mosmis' },
      { id: 'skov-kogle', name: 'Koglebo' },
      { id: 'skov-svamp', name: 'Svampe-Sne' },
      { id: 'skov-graen', name: 'Grenling' },
      { id: 'skov-ugle', name: 'Tælleugle' },
    ],
    levels: [
      lvl('skov-1', 'Kurven', ['count'], ['count', 'choice'], 4),
      lvl('skov-2', 'Hvor mange?', ['count'], ['choice', 'count'], 9),
      lvl('skov-3', 'Én mere', ['neighbour'], ['choice'], 5),
      lvl('skov-4', 'Én mindre', ['neighbour'], ['choice', 'numberline']),
      lvl('skov-5', 'Hele skoven', ['count', 'neighbour'], ['choice', 'count', 'numberline']),
      lvl('skov-6', 'Skovfest', ['count', 'neighbour'], ['choice', 'count', 'numberline'], undefined, true),
    ],
  },
  {
    id: 'eng',
    name: 'Plusengen',
    tagline: 'Læg sammen i det høje græs',
    emoji: '🌼',
    skills: ['addTo10'],
    unlockAfter: 4,
    grade: 0,
    palette: { skyFrom: '#3d5a12', skyTo: '#8fc422', ground: '#2c4210', accent: '#fff07c', glow: '#c6f24e' },
    species: [
      { id: 'eng-bi', name: 'Plusbi' },
      { id: 'eng-maelke', name: 'Mælkepust' },
      { id: 'eng-groed', name: 'Græshoppe-Gry' },
      { id: 'eng-sol', name: 'Solsikkesus' },
      { id: 'eng-frø', name: 'Engefrø' },
    ],
    levels: [
      lvl('eng-1', 'Små bunker', ['addTo10'], ['choice'], 5),
      lvl('eng-2', 'Op til syv', ['addTo10'], ['choice'], 7),
      lvl('eng-3', 'Helt til ti', ['addTo10'], ['choice']),
      lvl('eng-4', 'Skriv selv', ['addTo10'], ['keypad', 'choice']),
      lvl('eng-5', 'Hurtigt nu', ['addTo10'], ['choice', 'keypad']),
      lvl('eng-6', 'Engfest', ['addTo10', 'count', 'neighbour'], ['choice', 'keypad'], undefined, true),
    ],
  },
  {
    id: 'mose',
    name: 'Minusmosen',
    tagline: 'Noget forsvinder i tågen',
    emoji: '🪻',
    skills: ['subTo10'],
    unlockAfter: 4,
    grade: 0,
    palette: { skyFrom: '#2b1b4d', skyTo: '#5b3fa0', ground: '#1a1030', accent: '#c4b5fd', glow: '#a78bfa' },
    species: [
      { id: 'mose-tåge', name: 'Tågetrold' },
      { id: 'mose-frø', name: 'Kvækkert' },
      { id: 'mose-lygte', name: 'Lygtemand' },
      { id: 'mose-siv', name: 'Sivsus' },
      { id: 'mose-snegl', name: 'Minusnegl' },
    ],
    levels: [
      lvl('mose-1', 'Lidt væk', ['subTo10'], ['choice'], 5),
      lvl('mose-2', 'Op til syv', ['subTo10'], ['choice'], 7),
      lvl('mose-3', 'Helt til ti', ['subTo10'], ['choice']),
      lvl('mose-4', 'Skriv selv', ['subTo10'], ['keypad', 'choice']),
      lvl('mose-5', 'Plus og minus', ['subTo10', 'addTo10'], ['choice', 'keypad']),
      lvl('mose-6', 'Mosefest', ['subTo10', 'addTo10', 'count'], ['choice', 'keypad'], undefined, true),
    ],
  },
  {
    id: 'hule',
    name: 'Tiervennernes hule',
    tagline: 'To tal der hører sammen',
    emoji: '💎',
    skills: ['tenFriends'],
    unlockAfter: 4,
    grade: 1,
    palette: { skyFrom: '#3b2410', skyTo: '#a9631c', ground: '#241505', accent: '#ffd166', glow: '#fbbf24' },
    species: [
      { id: 'hule-krystal', name: 'Krystalkim' },
      { id: 'hule-flager', name: 'Flagermis' },
      { id: 'hule-drys', name: 'Guldrys' },
      { id: 'hule-sten', name: 'Stenknold' },
      { id: 'hule-ekko', name: 'Ekkoline' },
    ],
    levels: [
      lvl('hule-1', 'Find makkeren', ['tenFriends'], ['pair'], 3),
      lvl('hule-2', 'Flere makkere', ['tenFriends'], ['pair', 'choice'], 6),
      lvl('hule-3', 'Alle ti', ['tenFriends'], ['pair', 'choice']),
      lvl('hule-4', 'Skriv makkeren', ['tenFriends'], ['keypad', 'choice']),
      lvl('hule-5', 'Hurtige venner', ['tenFriends'], ['choice', 'pair', 'keypad']),
      lvl('hule-6', 'Hulefest', ['tenFriends', 'addTo10', 'subTo10'], ['choice', 'pair', 'keypad'], undefined, true),
    ],
  },
  {
    id: 'bjerg',
    name: 'Dobbeltbjerget',
    tagline: 'Alt findes to gange heroppe',
    emoji: '⛰️',
    skills: ['doubles', 'halves'],
    unlockAfter: 4,
    grade: 1,
    palette: { skyFrom: '#123a5c', skyTo: '#5fb2e6', ground: '#0d2740', accent: '#e0f2fe', glow: '#7dd3fc' },
    species: [
      { id: 'bjerg-sne', name: 'Snefnug-Sam' },
      { id: 'bjerg-gede', name: 'Dobbeltged' },
      { id: 'bjerg-is', name: 'Istap-Tulle' },
      { id: 'bjerg-ørn', name: 'Fjeldørn' },
      { id: 'bjerg-klip', name: 'Klippeklump' },
    ],
    levels: [
      lvl('bjerg-1', 'Dobbelt op', ['doubles'], ['choice'], 3),
      lvl('bjerg-2', 'Alle dobbelte', ['doubles'], ['choice', 'numberline']),
      lvl('bjerg-3', 'Del i to', ['halves'], ['choice'], 5),
      lvl('bjerg-4', 'Alle halve', ['halves'], ['choice', 'keypad']),
      lvl('bjerg-5', 'Op og ned', ['doubles', 'halves'], ['choice', 'keypad', 'numberline']),
      lvl('bjerg-6', 'Bjergfest', ['doubles', 'halves', 'addTo10'], ['choice', 'keypad'], undefined, true),
    ],
  },
  {
    id: 'bro',
    name: 'Tyvebroen',
    tagline: 'Over tieren og videre',
    emoji: '🌉',
    skills: ['addTo20', 'subTo20'],
    unlockAfter: 6,
    grade: 1,
    palette: { skyFrom: '#5c1a2e', skyTo: '#e2703a', ground: '#33101c', accent: '#ffd6a5', glow: '#fb7185' },
    species: [
      { id: 'bro-lygte', name: 'Brolygte' },
      { id: 'bro-trold', name: 'Brotrold' },
      { id: 'bro-maage', name: 'Tyvemåge' },
      { id: 'bro-reb', name: 'Rebnisse' },
      { id: 'bro-sol', name: 'Aftensol' },
    ],
    levels: [
      lvl('bro-1', 'Første skridt over', ['addTo20'], ['choice'], 3),
      lvl('bro-2', 'Hele vejen over', ['addTo20'], ['choice']),
      lvl('bro-3', 'Tilbage igen', ['subTo20'], ['choice'], 3),
      lvl('bro-4', 'Hele vejen tilbage', ['subTo20'], ['choice', 'keypad']),
      lvl('bro-5', 'Frem og tilbage', ['addTo20', 'subTo20'], ['choice', 'keypad']),
      lvl('bro-6', 'Brofest', ['addTo20', 'subTo20', 'tenFriends', 'doubles'], ['choice', 'keypad'], undefined, true),
    ],
  },
  {
    id: 'hav',
    name: 'Hundredehavet',
    tagline: 'Dybt vand og store tal',
    emoji: '🌊',
    skills: ['tensAndOnes', 'addTo100', 'subTo100'],
    unlockAfter: 6,
    grade: 2,
    palette: { skyFrom: '#062a4a', skyTo: '#1d84c4', ground: '#03182b', accent: '#a5f3fc', glow: '#22d3ee' },
    species: [
      { id: 'hav-blaek', name: 'Blækket' },
      { id: 'hav-vandmand', name: 'Vandmand-Vilma' },
      { id: 'hav-krabbe', name: 'Tierkrabbe' },
      { id: 'hav-søhest', name: 'Søhest-Sofus' },
      { id: 'hav-boble', name: 'Boblebo' },
    ],
    levels: [
      lvl('hav-1', 'Tiere og enere', ['tensAndOnes'], ['choice', 'keypad'], 4),
      lvl('hav-2', 'Store tal', ['tensAndOnes'], ['keypad', 'choice']),
      lvl('hav-3', 'Hele tiere', ['addTo100'], ['choice'], 10),
      lvl('hav-4', 'Læg til', ['addTo100'], ['choice', 'keypad']),
      lvl('hav-5', 'Træk fra', ['subTo100'], ['choice', 'keypad']),
      lvl('hav-6', 'Havfest', ['addTo100', 'subTo100', 'tensAndOnes'], ['choice', 'keypad'], undefined, true),
    ],
  },
]

export const ISLAND_BY_ID = new Map(ISLANDS.map((i) => [i.id, i]))
export const LEVEL_BY_ID = new Map(ISLANDS.flatMap((i) => i.levels.map((l) => [l.id, { island: i, level: l }] as const)))

/**
 * The facts a level may ask. A festival round reaches back into every island the
 * child has already been through, which is what makes it feel like a celebration
 * rather than just another ten sums.
 */
export function factsForLevel(level: Level, islandIndex: number): ReturnType<typeof factsForSkills> {
  const skills = level.festival
    ? [...new Set([...ISLANDS.slice(0, islandIndex).flatMap((i) => i.skills), ...level.skills])]
    : level.skills
  const pool = factsForSkills(skills)
  return level.rankMax === undefined ? pool : pool.filter((f) => f.rank <= level.rankMax!)
}
