# DECISIONS

Én linje pr. uspecificeret valg (spec afsnit 11).

- Spillet ligger i `udfordreren/` i repoet, så det eksisterende elpris-dashboard i roden ikke overskrives.
- `step(state, actions)` kloner med `structuredClone` og kalder en muterende `stepMut`; sim-harness bruger `stepMut` direkte for fart.
- UI-handlinger mellem ticks anvendes straks med `applyAction` (samme kode som i `step`), så pausede handlinger ses med det samme.
- Signaler (`GameState.signaler`) er kortlivede udfald fra seneste step/handling; UI bruger dem til bobler, dialoger og auto-pause.
- Licens: `MarketState.licens` er markedets samlede status (sanktioner rammer hele markedet); `vertikaler` holder tilladelsen pr. vertikal.
- UK beskatter kasino og betting forskelligt, så `MarketState` har `afgiftPrVertikal`; `afgift` er gennemsnittet til visning.
- Den danske licensansøgning er betalt før start, så startkapitalen på 2 mio. kr. er intakt.
- En fase uden tildelte medarbejdere står stille (tiden går, fasen gør ikke); nye faser arver forrige fases hold, hvis de er tomme.
- En medarbejder arbejder ét sted pr. uge: kontrakter før projekter, første projekt før senere.
- Antal samtidige projekter følger kontoret: garage/kælder 1, kontor 2, etage 3, hovedkontor 4.
- Holdeffekt: n-te person i en fase bidrager med 0,5^(n−1) (Brooks' lov), så små hold ikke er chanceløse.
- Anmeldelser sammenligner med en markedsstandard, der følger en kurve over årene (stejl i garage-årene) + konkurrenternes bedste produkt; parametre mættes (q = 1 − e^(−ratio)).
- 2.0-version: +20 % af originalens params som start; under 52 uger efter originalen ganges alle anmeldelser med 0,7; originalen lukkes ved lanceringen.
- Hall of Fame giver +1 niveau i type og tema (bump til næste tærskel).
- Kvartalsmøder holdes i starten af hvert kvartal (uge 13, 26, 39, 0); første kvartals mål er "tag en kontraktopgave" og "start et produkt".
- Investorpres opstår kun efter første runde; bootstrappede firmaer får mål uden pres.
- Kryds-salg: første lancering i en ny vertikal giver 20 % af den anden vertikals kunder, derefter 0,2 %/uge.
- Konkurrenternes brands fornyes løbende (3× halveringstid), og deres BSI deles jævnt mellem brands; spillerens produkter deles efter vægt².
- Nye produkter får en lanceringsbølge (1 + 1,5·e^(−alder/10)) af ejerens aktivitet, så hitlisten bevæger sig som i Game Dev Story.
- "Øvrige" licenserede aktører (ikke simulerede) har en fast vægt i andelsberegningen, så de navngivne konkurrenter ikke deler hele markedet.
- Indbetalinger ≈ 2 × BSI (betalingsgebyr 2 % af indbetalinger ≈ 4 % af BSI).
- Driftsomkostning pr. aktiv kunde: 2 kr./uge (KYC, support, hosting) [D].
- Konkurs: 8 uger i træk med negativ kapital.
- Fase 1-2 bruger kun Danske Lykke, bet356, Unibit og Betssen i dk (spec: "Danske Lykke og 3 konkurrenter"); resten af 7.4 kommer i fase 4.
- Kun dk kan spilles i fase 1-2; de øvrige markedskort findes i data og åbner i fase 3.
- Pixel-ikoner er 8×8 bitmaps i kode (ingen emoji, ingen eksterne assets); UI-tekst bruger systemfonte.
- Kontraktopgaver: kvalitet = (0,7 + bedste stat/60) × 1,15 ved rette rolle × (1 + 0,35 pr. ekstra person).
- Auto-pause ved faseskift sker kun, når den nye fase mangler folk, og ved ledige medarbejdere kun, når der ikke er et aktivt projekt; ellers vises en toast. Ellers ville spillet pause hvert par sekunder og bryde målet på 200-450 pauser i alt.
- Anmeldelsesscoren bruger en logistisk kurve i q-rum (k = 7,4, q0 = 0,583): Guldkupon kræver ca. 1,4× markedsstandarden på alle relevante parametre, Hall of Fame ca. 2×.
- Årets innovation tæller nye kombinationer og nye features i lancerede produkter (8 point hver) mod konkurrenternes innovation + 1,5 pr. år.
- Spillet kan hoppes frem med `debugHopTilAar`, som auto-vælger første valg i events.
