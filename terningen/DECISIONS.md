# DECISIONS.md — Terningen

Én linje per uspecificeret forgrening: beslutning + hvorfor. Kronologisk.

1. **Projektet ligger i `terningen/`** — repo-roden indeholder allerede en anden app (elpris-dashboard); intet uden for projektmappen røres.
2. **Toolchain pinnet til Vite 7 / TypeScript 5.9 / Vitest 4 / ESLint 9 / Tailwind 4** — nyeste majors (Vite 8, TS 7, Vitest 5) var udgivet få uger før build; de kendte versioner er stabile sammen med typescript-eslint og React-plugins.
3. **`npm install --legacy-peer-deps`** — npm 10.9.7 fejlede med en intern arborist-fejl (`edgesOut` på null) under peer-opløsning; flaget omgår det uden at ændre de installerede versioner.
4. **Beat-rækkefølge = specifikationens tabel: øjne 1→6, kernen sidst (beat 8)** — deep-link-eksemplet `#beat=4&open=teknologi` (3 øjne) fastlægger beat = øjne + 1; Arbejdsgange som finale matcher fortællingen "værdien opstår, når arbejdsgangen bygges om".
5. **Ugyldigt deep-link ⇒ hele tilstanden falder tilbage til beat 0** (også ved delvist gyldige værdier og ved `beat`/`open` der modsiger hinanden) — DoD siger "fald tilbage til beat 0"; forudsigeligt frem for halvt gættet tilstand. Hashen skrives altid om til kanonisk form (`#beat=…&open=…&bottleneck=…`).
6. **Storen initialiseres synkront fra URL-hashen** — så et deep-link viser præcis tilstanden fra første render uden indgangsanimation eller bremseramp.
7. **Hash skrives med `history.replaceState`** — ingen historikstøj ved hvert klik; `hashchange` lytter stadig, så URL-redigering og deep-links virker.
8. **Terningen drejer, så den åbnede side kommer frontalt i ¾-perspektiv** — bagsiderne (4, 5, 6) kan ellers ikke nås fra ét fast kamera. Drejningen tager altid korteste vej (`nearestAngle`).
9. **Sider svinger om højre kant (+52°); låg og bund svinger om den kant, der vender mod kameraet** — giver forsiden mod beskueren i alle seks visninger; ren venstre-hængsling viste fladens bagside.
10. **Ét `<svg>` per tandhjul** — rotationen bliver en composited transform på et HTML-element i stedet for repaint af hele SVG'en; ingen SVG-filtre (Safari-framerate).
11. **Bremsning = rampe på CSS-animationernes `playbackRate` via Web Animations API (1,2 s ease-out)** — rotationen forbliver ren CSS-animation; kun rampen kører et kort rAF-loop. `animationstart` arver hastigheden, så en bremset maskine ikke starter, hvis reduced-motion slås fra midt i en session.
12. **Urværket er billboardet (modroteret) mod kameraet** — et fladt urværk skal kunne ses uanset hvilken side terningen drejes til. Skala 0,5 når terningen er samlet, så boksen ligger inden for den indskrevne kugle (ingen plan-skæring og dermed ingen synlige sømme i fladerne).
13. **Kompoundhjul (koaksialt bagerste lag) i tandhjulskæden** — seks hjul i indgreb er geometrisk verificeret med en unit-test (`meshProblems`), inkl. kollisionsfrihed i samme lag.
14. **Flaskehals-UX: knap i panelet + højreklik på flade/urværk + tasten B** — én af mulighederne i specifikationen (knap) plus de to hurtige veje til en oplægsholder foran storskærm.
15. **Dæmpning (35 %) kun i eksploderet tilstand** — i samlet tilstand ville halvgennemsigtige flader afsløre urværket; flaskehalsen lyser stadig amber når samlet.
16. **Små titler på fladerne** (ud over øjnene) — publikum skal kunne koble øjne og komponent uden at åbne siden.
17. **Panelet er et overlay; terningen glider 13 vw til venstre med samme easing** — ingen reflow, derfor ingen layout-hop ved skift mellem to komponenter; panelet bevarer bredde og position.
18. **Systemgrotesk (Inter/SF Pro/Helvetica-stak), ingen webfont** — ingen netværksafhængighed på storskærm; tydelig vægtkontrast 800/500/400.
19. **Fokus fjernes efter museklik (`blurIfPointer`)** — ellers gentager mellemrum/Enter det sidst klikkede element i stedet for at styre fortællingen; tastaturaktivering beholder fokus.
20. **Enter/mellemrum på en fokuseret flade eller knap aktiverer elementet, ikke fortællingen** — forventet tastaturadfærd; piletaster styrer altid fortællingen.
21. **Amber bruges kun på flaskehalsens flade/urværk, FLASKEHALS-mærkat og flaskehalsknappen** — knappen er den handling, der sætter flaskehalsen, og amber betyder derfor stadig kun "flaskehals".
22. **Safari kan ikke køres i build-miljøet** — verificeret i Chromium; Safari-kendte faldgruber undgået (ingen opacity/overflow/filter på preserve-3d-elementer, `-webkit-backface-visibility`, ingen SVG-filtre, individuelle CSS-egenskaber undgået). Se README.
23. **DoD-flows automatiseret som Playwright-script (`npm run e2e`)** — de manuelle afprøvninger i DoD er kodet som 75 kontroller med skærmbilleder, så gaten kan køres igen efter hver ændring; Playwright er devDependency, browseren installeres separat.
