// Konkurrenternes reaktionsregler (spec 7.6). Tærskler og effektstørrelser; [D] medmindre andet er angivet.
import type { CompetitorArchetype, ReaktionsRegel } from '../sim/types';

export const REAKTIONS_REGLER: Record<ReaktionsRegel, { navn: string; hvis: string; saa: string; kilde: string }> = {
  R1: { navn: 'Bonuskrig', hvis: 'Jeres andel > 5 % i et marked og vækst > 30 %/år', saa: 'Største globale gigant: marketing ×1,5 i 4 kvartaler → jeres CAC +25 %', kilde: '[D]' },
  R2: { navn: 'Opkøbstilbud', hvis: 'Jeres andel > 8 % og hybrid/egen platform', saa: '20 %/kvartal: bud fra en aktør med opkøbslyst ≥ 4 på 3-5× årlig BSI. Afvist → byderen bliver mere aggressiv i 2 år', kilde: '[F-mønster: 2020-24]' },
  R3: { navn: 'Kopiering', hvis: 'I lancerer en ny feature', saa: 'Gigant kopierer efter 6-12 mdr., nordisk/appFirst 9-18 mdr., statsselskab 18-36 mdr. Fordelen halveres ved hver kopi', kilde: '[D, F-mønster]' },
  R4: { navn: 'Markedsindtog', hvis: 'Et marked åbner', saa: 'Alle giganter og appFirst går ind med marketing ×2 i 6-8 kvartaler', kilde: '[F-mønster: US, ON, NL]' },
  R5: { navn: 'Tilbagetog', hvis: 'Afgiften stiger ≥ 5 pp', saa: 'Svageste gigant/nordiske gruppe: marketing −30 %, 15 % chance for markedsexit', kilde: '[F-mønster]' },
  R6: { navn: 'Statsejet exit', hvis: 'En konkurrent købes af et statsselskab', saa: 'Den forlader grå markeder', kilde: '[F]' },
  R7: { navn: 'Sponsorauktion', hvis: 'Et stort sponsorat bliver ledigt', saa: 'Auktion; appFirst byder højest. I kan byde', kilde: '[F: Superliga]' },
  R8: { navn: 'Aggressivitetspåbud', hvis: 'Jeres aggressivitet (bonus + reklame + VIP) er høj i 2 kvartaler', saa: 'Påbud; tredje gang → ny regel for alle i markedet og branchens omdømme −1', kilde: '[D]' },
  R9: { navn: 'Medieskandale', hvis: 'En skandale rammer branchen (tilfældig eller jeres)', saa: 'Politisk pres +1', kilde: '[D]' },
  R10: { navn: 'Statskassen', hvis: 'Statsbudgettet er under pres (krise)', saa: '30 %/år: afgiftsstigning på 3-8 pp', kilde: '[F-mønster: UK +19 pp]' },
  R11: { navn: 'Kanalisering', hvis: 'Kanalisering under målet i 2 år', saa: '40 %: blokering; 20 %: lempelse', kilde: '[D]' },
  R12: { navn: 'Ansvarlig AI', hvis: 'I har AI-risikodetektion med overvågning ≥ 0,6', saa: 'Påbudsrisiko −50 %, lavere bøder, −3 % BSI fra high-rollers', kilde: '[D]' },
};

export const R1 = { andel: 0.05, vaekst: 0.3, marketing: 1.5, cac: 0.25, uger: 52 };
export const R2 = { andel: 0.08, chance: 0.2, multipel: [3, 5] as const, udloeb: 8, aggressivitet: 1, uger: 104, minOpkoebslyst: 4 };
/** Kopieringstid i uger pr. arketype (R3) */
export const R3_KOPI_UGER: Partial<Record<CompetitorArchetype, [number, number]>> = {
  globalGigant: [26, 52],
  nordiskLicensgruppe: [39, 78],
  appFirst: [39, 78],
  statsselskab: [78, 156],
  lokalSpecialist: [52, 104],
  aiNative: [13, 26],
};
export const R3_FORDEL = { pr: 0.04, maks: 0.15, maxKopister: 3 };
export const R4 = { marketing: 2, kvartaler: [6, 8] as const };
export const R5 = { afgiftPp: 5, marketing: 0.7, exitChance: 0.15, uger: 52 };
export const R7 = { varselUger: 6, appFirstBud: [1.1, 1.6] as const, cacRabat: 0.3, hypePrUge: 0.15 };
export const R8 = { taerskel: 5, kvartaler: 2, reglerEfter: 3 };
export const R9 = { chancePrAar: 0.35 };
export const R10 = { chancePrAar: 0.3 };
export const R12 = { overvaagning: 0.6, sanktionsFaktor: 0.5, bsi: -0.03 };
