// Tilsynstillid pr. kvartal (spec 7.12) [D]
export const TRUST = {
  start: 70,
  bonusNiveau: -1.5,
  vipProgram: -2,
  intensitetOver3: -2,
  aggressivKanal: -1.5,
  risikoProblemAndel: -8, // × (andel - 0.08) hvis > 0
  lanceringMedFejl: -2,
  complianceNiveau: +0.8, // maks +3
  ansvarsforskning: +0.4, // maks +2
  aiRisikoMedOvervaagning: +2,
  aiUheld: -6,
  offshoreBrand: -10,
  sanktioner: { paabud: 55, boede: 40, gennemgang: 25, inddragelse: 10 },
  dkLicensTabSmitte: -15,
  /** [D] tilbagevenden mod 70 pr. kvartal, når intet trækker */
  genopretning: 0.5,
  /** [D] Antal fejl ved lancering, der tæller som "lancering med fejl" */
  fejlTaerskel: 5,
};
