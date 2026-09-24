// De fire anmeldere (spec 6.3). Citater er [D] og må aldrig moralisere.
import type { ReviewerId } from '../sim/types';

export type ReviewerDef = {
  id: ReviewerId;
  navn: string;
  vaegter: string;
  farve: string;
  /** Citater pr. scoreinterval: [1-3], [4-5], [6-7], [8-9], [10] */
  citater: [string[], string[], string[], string[], string[]];
};

export const REVIEWERS: ReviewerDef[] = [
  {
    id: 'branchebladet', navn: 'Branchebladet', vaegter: 'Teknik + originalitet', farve: '#3f7fd6',
    citater: [
      ['Teknisk set en garage med wifi.', 'Vi har set det før, og det virkede bedre dengang.', 'Serverne sukkede højere end vi gjorde.'],
      ['Solidt håndværk, men hvor er idéen?', 'Fungerer. Mere kan man ikke sige.', 'En kopi af en kopi, men pænt kopieret.'],
      ['Et friskt pust i en travl branche.', 'Robust under motorhjelmen.', 'Her er nogen, der har tænkt sig om.'],
      ['Branchens nye benchmark? Måske.', 'Elegant arkitektur og en idé, der sidder.', 'Konkurrenterne tager noter i aften.'],
      ['Et teknisk mesterværk. Vi bøjer os.', 'Det her bliver pensum på messerne.', 'Perfekt. Ja, vi skrev perfekt.'],
    ],
  },
  {
    id: 'tilsynet', navn: 'Tilsynet', vaegter: 'Tryghed, lav intensitet, lav risiko', farve: '#8a8fd6',
    citater: [
      ['Vi har noteret os en del forhold.', 'Vi forventer en snarlig opfølgning.', 'Kontrollerne mangler i praksis.'],
      ['Acceptabelt, med plads til forbedring.', 'Grænseværktøjerne kunne være mere synlige.', 'Vi holder øje.'],
      ['Ordentlige værktøjer til kunderne.', 'Et produkt, vi kan arbejde med.', 'Tydelige rammer.'],
      ['Et forbillede for ansvarligt design.', 'Grænser og pauser sidder, hvor de skal.', 'Vi bruger det som eksempel.'],
      ['Sådan skal det gøres.', 'Intet at bemærke — og det er ros.', 'Mønstereksempel.'],
    ],
  },
  {
    id: 'forbrugerposten', navn: 'Forbrugerposten', vaegter: 'Værdi (lav margin) + tryghed', farve: '#5fb36b',
    citater: [
      ['Dyrt for pengene.', 'Læs det med småt. To gange.', 'Kunderne betaler for garagelejen.'],
      ['Middel valuta for pengene.', 'Hverken skarpt eller dyrt.', 'Priserne kunne være skarpere.'],
      ['Fair priser og tydelige vilkår.', 'God værdi i en dyr branche.', 'Kunderne bliver behandlet ordentligt.'],
      ['Markedets bedste tilbagebetaling.', 'Gennemsigtigt og generøst.', 'Her får man noget for pengene.'],
      ['Forbrugernes favorit. Punktum.', 'Så skarpe priser har vi ikke set.', 'Et køb, vi anbefaler uden forbehold.'],
    ],
  },
  {
    id: 'spillerforum', navn: 'Spillerforum', vaegter: 'Spænding + fit', farve: '#d65ca8',
    citater: [
      ['Kedeligt. Vi gik tilbage til det gamle.', 'Hvem fandt på det tema?', 'Tråden døde efter to svar.'],
      ['Helt ok til en regnvejrsdag.', 'Der mangler noget nerve.', 'Fint nok, men ikke vildt.'],
      ['Folk snakker om det i tråden.', 'Rigtig god stemning.', 'Temaet sidder lige i skabet.'],
      ['Hele forummet er ovenud.', 'Det her er stort, folkens.', 'Vi kan ikke stoppe med at snakke om det.'],
      ['Legendarisk. Tråden har 40 sider.', 'Det bedste, vi har prøvet.', 'Kult fra dag ét.'],
    ],
  },
];

export const REVIEWER_BY_ID = Object.fromEntries(REVIEWERS.map((r) => [r.id, r])) as Record<ReviewerId, ReviewerDef>;

/** Tærskler (spec 6.3) */
export const GULDKUPON_TOTAL = 32;
export const HALL_OF_FAME_TOTAL = 36;
