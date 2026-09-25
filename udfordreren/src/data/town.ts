// Spillerbyen (spec 6.14): 200 pixelpersoner, der repræsenterer spillerens kunder. Tal er [D]; kalibreret, så andelen
// med mindst lavt problemniveau (risiko + problem) ligger på 5-15 % ved neutrale valg [F-inspireret: 5,2 % i 2016, 10,9 % i 2021].
import type { TownProfile } from '../sim/types';

export const BY = {
  antal: 200,
  interval: 4, // uger mellem opdateringer
  /** Relativ værdi (BSI) pr. profil — guld er mest profitabel, gul og rød er også dyre kunder */
  vaerdi: { rekreativ: 1, engageret: 2.2, vip: 7, risiko: 4.5, problem: 5.5, churnet: 0 } as Record<TownProfile, number>,
  /** Overgange pr. 4 uger ved neutral drift (intensitet 3, ingen bonus/VIP, ingen værktøjer) */
  op: { rekreativEngageret: 0.05, engageretVip: 0.012, engageretRisiko: 0.018, vipRisiko: 0.022, risikoProblem: 0.055, rekreativRisiko: 0.004 },
  ned: { engageretRekreativ: 0.035, vipEngageret: 0.025, risikoEngageret: 0.07, problemRisiko: 0.04 },
  /** Churn pr. 4 uger pr. profil (erstattes af nye rekreative kunder) */
  churn: { rekreativ: 0.08, engageret: 0.04, vip: 0.02, risiko: 0.03, problem: 0.03, churnet: 0 } as Record<TownProfile, number>,
  /** Selvudelukkelse pr. 4 uger (× 1,5 i markeder med et register) → forsvinder stille */
  selvudelukkelse: { risiko: 0.01, problem: 0.04 },
  /** Skadesdrivere */
  intensitet: 0.35, // pr. trin over/under 3
  bonus: 0.15, // pr. niveau
  vipKonvertering: 0.8, // engageret → VIP pr. VIP-niveau
  vipRisiko: 0.3, // VIP → risiko pr. VIP-niveau
  hyper: 4, // risikoovergange ved hyperpersonalisering uden risikoagent (spec 6.16: "byen bliver rød")
  hyperMedRisiko: 0.15,
  hyperBedring: 0.4, // bedring (gul → engageret, rød → gul) ganges med dette ved hyper uden risikoagent: tilbuddene bliver ved
  aggressiv: 0.1,
  /** Beskyttelse (divisor på skade, multiplikator på bedring) */
  beskyttelse: { compliancePrPerson: 0.04, complianceMaks: 0.2, affordabilityRegel: 0.2 },
  /** ARPU-effekt af byens sammensætning: 0,75 + 0,25 × (gennemsnitsværdi / neutral) */
  arpuVaegt: 0.25,
  neutralVaerdi: 2.03, // gennemsnitsværdi i ligevægt ved neutrale valg
  /** Hvor mange af de 200, der er kunder: 40 × log10(kunder) */
  aktivePrDekade: 40,
  /** Tillid: spec 7.12's −8 × (andel − 0,08) × 3, dvs. −0,24 pr. procentpoint over 8 % */
  tillidTaerskel: 0.08,
  tillidPrPp: -0.24,
  tillidMaks: -6,
  /** Politisk pres, når en stor udbyder har en rød by */
  presTaerskel: 0.2,
  presAndel: 0.03,
  presPrKvartal: 0.2,
  /** Højst én byhistorie pr. så mange uger */
  historieMellemrum: 6,
};

export const PROFIL_NAVN: Record<TownProfile, string> = {
  rekreativ: 'Rekreativ',
  engageret: 'Engageret',
  vip: 'VIP',
  risiko: 'Risiko',
  problem: 'Problem',
  churnet: 'Holdt op',
};

/** Korte, respektfulde byhistorier. {navn} og {alder} erstattes. Aldrig moraliserende. */
export const BYHISTORIER: Record<'vip' | 'risiko' | 'problem' | 'bedring' | 'selvudelukket', string[]> = {
  vip: [
    '{navn}, {alder}, er blevet VIP og har fået en fast kontaktperson.',
    '{navn}, {alder}, fik en invitation til landskampen i VIP-logen.',
    '{navn}, {alder}, spiller for mere end nogensinde og får personlige tilbud hver uge.',
  ],
  risiko: [
    '{navn}, {alder}, har indbetalt mere end planlagt tre måneder i træk.',
    '{navn}, {alder}, spiller nu mest om natten.',
    '{navn}, {alder}, har hævet sin indbetalingsgrænse to gange i denne måned.',
  ],
  problem: [
    '{navn}, {alder}, har lånt penge af sin søster for at dække et tab.',
    '{navn}, {alder}, jagter tabene fra sidste måned.',
    '{navn}, {alder}, har ikke fortalt sin partner, hvor meget der er røget.',
  ],
  bedring: [
    '{navn}, {alder}, satte selv en grænse efter en besked fra jer og spiller nu kun til de store kampe.',
    '{navn}, {alder}, tog en pause på 30 dage og er tilbage med et lavere budget.',
    '{navn}, {alder}, fik et opkald fra kundeservice og har skruet ned.',
  ],
  selvudelukket: [
    '{navn}, {alder}, har meldt sig i registret over selvudelukkede. Kontoen lukker stille.',
    '{navn}, {alder}, har valgt at stoppe helt. Kontoen er lukket.',
  ],
};
