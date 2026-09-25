// Centrale balanceringskonstanter for kerneloopet. Alt er [D] og tunes af harnesset.

export const BALANCE = {
  // --- Point og faser ---
  /** Holdvægte: n-te person i en fase bidrager med VAEGT^(n-1) (Brooks' lov) */
  holdVaegt: 0.5,
  /** Point-skala pr. person-uge */
  pointSkala: 1.0,
  /** Tilfældig variation på point */
  pointVariation: 0.15,
  /** Budgetfaktor = 1 + budgetLog · log2(budget / minBudget), loftet ved budgetMax */
  budgetLog: 0.12,
  budgetMax: 1.4,
  /** Minimumsbudget stiger pr. år siden 2012 */
  budgetInflation: 0.1,
  /** Type-/temaniveau giver +x point pr. niveau over 1 */
  niveauBonus: 0.04,
  koncetUger: 2,
  testUger: 2,
  /** Projekterne vokser med tiden (større produkter): faselængder × (1 + x pr. år efter 2012), højst `projektVaekstMaks` */
  projektVaekstPrAar: 0.15,
  projektVaekstMaks: 3,
  /** Hjemmebane på hitlisten: statsselskabets produkter i hjemmemarkedet tæller × dette til og med 2015, aftagende til 1 i 2018.
   *  Butikskunderne flytter online (33 % online i 2012, 73 % i 2025, arkiv a2), så statsselskabet topper hitlisten de første år. */
  hjemmebane: 3,
  hjemmebaneFuldTil: 2016,
  hjemmebaneSlut: 2018,
  maxTestUger: 8,
  /** Fordeling af point på parametre pr. fase */
  fordeling: {
    koncept: { spaending: 0.25, originalitet: 0.75, teknik: 0, tryghed: 0 },
    design: { spaending: 0.5, originalitet: 0.35, teknik: 0, tryghed: 0.15 },
    teknik: { spaending: 0.1, originalitet: 0, teknik: 0.85, tryghed: 0.05 },
    test: { spaending: 0, originalitet: 0, teknik: 0.25, tryghed: 0.75 },
  },
  // --- Fejl ---
  fejlBasis: 1.6,
  testFjernBasis: 1.5,
  testFjernTeknik: 0.05,
  testFjernAnsvar: 0.04,
  // --- Energi og erfaring ---
  energiTabProjekt: 3.2,
  energiTabKontrakt: 4,
  energiHvile: 18,
  xpProjekt: 10,
  xpKontrakt: 8,
  // --- Markedsstandard (anmeldelser) ---
  /** Markedsstandard pr. parameter over tid [år, point] — stejl i garage-årene, flader ud senere */
  standardKurve: [[2012, 92], [2013, 190], [2014, 292], [2015, 358], [2016, 385], [2017, 420], [2018, 445], [2019, 460], [2020, 470], [2022, 490], [2026, 540], [2030, 610], [2035, 700]] as [number, number][],
  standardKonkurrent: 0.5, // tillæg pr. kvalitet over 0.6 hos bedste konkurrent
  /** Logistisk kurve i q-rum: score = 1 + 9 / (1 + e^(−k·(q − q0))), q = 1 − e^(−ratio) */
  scoreK: 7.4,
  scoreQ0: 0.66,
  scoreStoej: 0.45,
  // --- Kunder ---
  /** Lanceringsbølge: andel af markedets kunder ved en gennemsnitlig anmeldelse (før anmeldelsesfaktor) */
  startKunderAndel: 0.0022,
  /** Andel af den ventende bølge, der kommer ind pr. uge */
  boelgeFrigivelse: 0.5,
  hypeOrganisk: 0.000004, // pr. hype-point pr. uge (andel af markedet)
  top10Organisk: 0.00015,
  mundTilMund: 0.0015,
  /** Driftsomkostning pr. aktiv kunde pr. uge i kr. (KYC, support, hosting) */
  driftPrKunde: 2,
  krydsSalgStart: 0.2,
  krydsSalgUge: 0.002,
  maksAndel: 0.7,
  /** Styrke af produktporteføljen: 1 − e^(−k · Σ kvalitet · friskhed) */
  portefoeljeK: 1.3,
  friskhedGulv: 0.1,
  /** Lanceringsbølge: nye produkter får (1 + x·e^(−alder/uger)) af ejerens aktivitet */
  lanceringsBoelge: 1.5,
  lanceringsBoelgeUger: 10,
  // --- Konkurrenter ---
  oevrigeVaegt: 15, // ikke-simulerede licenserede aktører i dk
  styrkeExp: 2.2,
  konkurrentHalveringGange: 3, // konkurrenters brands fornyes løbende
  konkurrentLanceringInterval: 1.6, // år ved innovation ~ 3
  maxProdukterPrVertikal: 3,
  /** Konkurrenters faste tilgang = kunder × churn × denne faktor (loyale kunder) */
  konkurrentTilgang: 0.35,
  // --- Hype ---
  hypeForfald: 0.96,
} as const;
