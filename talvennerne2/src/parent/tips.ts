// Home tips for the recommendations (SPEC §9.1): short, concrete, away from the screen, built from
// play and everyday things — never homework. Each tip is an "at …" phrase, so it completes
// "Prøv …"; `{navn}` becomes the child's name.
import { SKILL_BY_ID } from '../content/skills'
import type { DomainId, SkillId } from '../engine/types'
import { nameOf } from './format'

export const DOMAIN_TIPS: Readonly<Record<DomainId, string>> = {
  number: 'at tælle ting i hverdagen sammen – trappetrin, knapper, biler – og nogle gange baglæns',
  place: 'at bundte sugerør eller ispinde i tiere med en elastik og tælle bundterne først og de løse bagefter',
  addsub: 'at slå med to terninger ved bordet og sige summen, før I tæller prikkerne',
  muldiv: 'at lægge ting i lige store bunker – fx 3 bunker med 4 – og tælle bunkerne i spring',
  algebra: 'at lave mønstre med perler, bestik eller klodser og lade {navn} fortsætte dem',
  fractions: 'at dele mad i lige store stykker – en pizza, et æble – og snakke om halve og fjerdedele',
  shapes: 'at gå på figurjagt efter cirkler, trekanter og firkanter på vej hjem',
  clock: 'at kigge på et rigtigt ur ved måltiderne og sige, hvad klokken er',
  money: 'at lade {navn} betale for noget småt med mønter og tælle byttepengene efter',
  measure: 'at måle ting derhjemme med skridt, klodser eller en lineal og sammenligne',
}

const SKILL_TIPS: Readonly<Partial<Record<SkillId, string>>> = {
  count10: 'at tælle 5–10 ting op og flytte hver ting væk, mens I tæller',
  count20: 'at lægge ting i rækker af ti, fx i en æggebakke, og tælle videre efter ti',
  hear20: 'at lege »hvilket tal siger jeg?«: du siger et tal, og {navn} skriver det eller viser det med fingrene',
  order20: 'at spørge »hvad kommer efter 13?« og »hvad kommer før 9?« på gåturen',
  hear100: 'at lege »hvilket tal siger jeg?« med husnumre og sidetal',
  order100: 'at finde ét mere og ti mere på husnumre eller i en kalender',
  addTo10: 'at slå med to terninger og sige summen, før I tæller prikkerne',
  subTo10: 'at fortælle små minushistorier: Der er 8 kiks, og vi spiser 3. Hvor mange er der tilbage?',
  tenFriends: 'at vise fingre: du viser 7, og {navn} viser, hvor mange der mangler op til 10',
  doubles: 'at bruge dominobrikker med ens sider og sige dobbelten hurtigt',
  halves: 'at dele et lige antal ting ud til to: én til dig, én til mig',
  addSub20Simple: 'at tælle videre fra ti med to hænder eller to æggebakker: 10 + 4 og 14 − 4',
  addTo20: 'at regne plus over tieren i to hop: først op til 10 og så resten (8 + 5 er 8 + 2 + 3)',
  subTo20: 'at regne minus over tieren i to hop: først ned til 10 og så resten (13 − 5 er 13 − 3 − 2)',
  tens100: 'at regne med tikroner: 30 kr. og 20 kr. mere',
  add100NoCarry: 'at lægge beløb sammen med tikroner og enkroner',
  sub100NoBorrow: 'at lege butik med tikroner og enkroner og betale med præcis det, der står på prisen',
  add100Carry: 'at lægge beløb sammen med mønter og bytte ti enkroner til en tikrone, når der er nok',
  sub100Borrow: 'at lege butik og veksle en tikrone til ti enkroner, når der mangler enere',
  missingPart10: 'at gemme nogle af 10 ting under en kop og lade {navn} sige, hvor mange der gemmer sig',
  skipCount: 'at tælle i spring med klap eller trin på trappen: to, fire, seks',
  groupsOf: 'at lægge ting i lige store bunker og tælle bunkerne i spring',
  mul2510: 'at tælle i spring med 2, 5 og 10 – på trappen, med hænderne eller med tikroner',
  shareEqually: 'at dele ting ligeligt ud – én til hver, rundt og rundt – og se, om der bliver nogen tilbage',
  mul34: 'at sige 3- og 4-tabellen som et rim i bilen eller på trappen – korte runder tit',
  mul6to9: 'at sige én tabel ad gangen som et rim, fx ét trin pr. tal op ad trappen – korte runder tit',
  div2510: 'at dele ting ligeligt ud – fx 20 rosiner til 5 bamser – og tælle, hvor mange hver får',
  divAll: 'at bruge gangestykker baglæns: 6 · 7 er 42, så 42 delt i 7 bunker giver 6 i hver',
  patterns: 'at lave mønstre med perler, bestik eller klodser og lade {navn} fortsætte dem',
  shapes2D: 'at gå på figurjagt efter cirkler, trekanter og firkanter – også de skæve og drejede',
  sidesCorners: 'at tælle sider og hjørner på vinduer, skilte og fliser',
  shapes3D: 'at finde kugler, terninger og cylindre i køkkenet',
  clockHour: 'at sige klokken højt ved måltiderne og lade {navn} stille et legetøjsur',
  clockHalf: 'at sige klokken højt ved måltiderne og vise, at den lille viser står midt mellem to tal ved halv',
  clockQuarter: 'at sige »kvart over« og »kvart i« om tider, der betyder noget, fx sengetid',
  coinNames: 'at tømme en pung og sortere mønterne efter værdi',
  countCoins: 'at tælle mønter i en pung – de største først',
  payExact: 'at lade {navn} betale for noget småt med præcis det rigtige beløb',
  change: 'at lege butik og regne byttepengene ud sammen',
  compareLength: 'at sammenligne sko, skeer eller snore ved en fælles startlinje',
  weightCompare: 'at gætte og mærke efter: en stor pude og en lille flaske vand – hvad er tungest?',
  measureUnits: 'at måle bordet eller sofaen med klodser, skridt eller hænder',
  rulerRead: 'at måle blyanter og legetøj med en lineal – også når I starter ved et andet tal end 0',
  halfShape: 'at dele en pandekage eller en skive brød og spørge, om stykkerne er lige store',
}

const fill = (tip: string, name: string) => tip.replaceAll('{navn}', nameOf(name))

/** A home tip for a skill (its own, else its domain's), as an "at …" phrase. */
export function tipFor(skill: SkillId, name: string): string {
  return fill(SKILL_TIPS[skill] ?? DOMAIN_TIPS[SKILL_BY_ID[skill].domain], name)
}

/** One times table, said as a rhyme. */
export function tableTip(n: number): string {
  return `at sige ${n}-tabellen som et rim, fx ét trin pr. tal op ad trappen – korte runder tit`
}

/** Practising without cards to choose from: the step from "Med støtte" to "Kan selv". */
export function productionTip(name: string): string {
  return `at stille opgaverne mundtligt, så ${nameOf(name)} finder svaret selv uden kort at vælge imellem`
}

/** Every tip text, for the house-rule tests. */
export const ALL_TIPS: readonly string[] = [...Object.values(DOMAIN_TIPS), ...Object.values(SKILL_TIPS)]
