// Tilsynstillid pr. kvartal (spec 7.12) [D]
export const TRUST = {
  start: 70,
  // Tunet [D]: spec 7.12's −1,5/−2/−2/−1,5 gjorde det umuligt for en grådig udbyder at overleve til 2020 (assertion 1)
  bonusNiveau: -1.0, // ved niveau 3 (forholdsmæssigt for lavere)
  vipProgram: -1.2, // ved niveau 3
  intensitetOver3: -1.2,
  aggressivKanal: -1.0,
  /** [D] Tilsynet ser mest på de store: adfærdsposterne vejer 30 % for en lille udbyder, fuldt fra 5 % markedsandel */
  synlighedMin: 0.3,
  synlighedAndel: 0.05,
  risikoProblemAndel: -8, // × (andel - 0.08) hvis > 0 (se BY.tillid* i data/town.ts)
  lanceringMedFejl: -2,
  complianceNiveau: +0.8, // maks +3
  ansvarsforskning: +0.4, // maks +2
  aiRisikoMedOvervaagning: +2,
  aiUheld: -6,
  offshoreBrand: -10,
  sanktioner: { paabud: 55, boede: 40, gennemgang: 25, inddragelse: 10 },
  /** [D] Efter en sanktion strammer firmaet op under tilsynets øjne: tilliden løftes lidt (pr. trin 1-3) */
  sanktionLoeft: [0, 5, 8, 12] as const,
  /** [D] Mindst så mange uger mellem to trin på trappen */
  sanktionPause: 26,
  dkLicensTabSmitte: -15,
  /** [D] andel af afstanden til 70, som tilliden trækkes tilbage pr. kvartal */
  genopretning: 0.1,
  /** [D] hyperpersonalisering uden risikoagent med overvågning ≥ 0,6 (pr. kvartal) */
  hyperUdenRisiko: -6,
  /** [D] Antal fejl ved lancering, der tæller som "lancering med fejl" */
  fejlTaerskel: 5,
};
