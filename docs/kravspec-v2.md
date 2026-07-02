# KRAVSPEC — Kuglebanen 2.0

> Design-source-of-truth for genopbygningen af Kuglebanen. Skrevet som spildesign-dokument;
> den tekniske proces styres af `docs/build-prompt-v2.md`. Ved konflikt vinder dette dokument
> på *design*, build-prompten på *proces*.

---

## 1. Vision

**Kuglebanen 2.0 er et deterministisk fysik-puslespil, hvor du ingeniørerer en maskine:
spillet viser dig præcis, hvordan kuglen ankommer — resten er dit ansvar.**

### Design-søjler (alle beslutninger måles mod disse tre)

1. **Forudsigelighed ER spillet.** Determinisme er ikke en teknisk detalje men kernemekanikken.
   En ghost-preview viser kuglens bane frem til dens første kontakt med en *spiller-placeret*
   brik. Spilleren ræsonnerer sig til løsninger i stedet for at gætte. Spillet giver dig
   "inputtet" (hvordan kuglen ankommer til din maskine); du designer "funktionen" (hvad din
   maskine gør ved den).
2. **Én løsning er kun begyndelsen.** Tre stjerner pr. bane — mål, stjernemønter, par —
   giver hver bane tre sværhedslag. Alle tre lag er **maskinelt bevist opnåelige** af solveren.
   Par (minimum antal brikker) er *udledt af solveren*, aldrig gættet af designeren.
3. **Få ortogonale brikker, dyb kombinatorik.** Fem brikker der gør fem forskellige ting, plus
   tre kugler hvis fysiske egenskaber er *mekanisk meningsfulde* (jern knuser, basketball
   hopper), slår tyve overlappende brikker.

---

## 2. Læring fra v1 → svar i 2.0

| v1-problem | 2.0-svar |
|---|---|
| Gæt-og-tjek: fejlet drop lærer spilleren for lidt | Ghost-preview af kuglens ankomst (indtil første spillerbrik) — placering bliver ræsonnement |
| Binært vundet/tabt; ingen replay-grund | 3 stjerner: mål / alle mønter / inden for par. Verdener låses op med stjerner |
| Alle 4 brikker er deflektorer (samme verbum) | 5 verber: deflektér (rampe), tilfør energi (trampolin), centrér (tragt), accelerér (booster), teleportér (portal) |
| Kuglevalg er kosmetisk (masse betyder intet) | Breakable planker med impuls-tærskel: kun tunge/hurtige kugler knuser dem. Baner gater hvilke kugler der må bruges |
| Op til 7 tryk for at rotere en brik | Radial vinkelvælger: tryk på brik → ring med KUN dens gyldige vinkler → ét tryk |
| Kryds/spinner: visuelt sjov, funktionelt mudret | Udgår. Erstattes af booster + portal (klare, læsbare effekter) |
| 6 baner, flad kurve, ingen målt sværhed | 14 baner i 3 verdener; solveren måler solution density og kurven SKAL falde inden for hver verden |
| Win = banner. Ingen juice | Deterministisk juice: kollisionslyde (pitch af impact), slow-mo på målgang, partikler (seedet PRNG), mønt-plings |
| Ingen onboarding | 3-trins interaktiv tutorial på bane 1 |

**Bevares fra v1 (bevist godt):** determinisme-opskriften (fixed timestep, Matter-global-reset,
kun kuglen dynamisk, sorterede placeringer), slot-modellen, headless solver + rapport-drevne
tests, replay-af-præberegnet-trajektorie-rendering, PWA/Dexie/dansk UI, fuldskærms-iPhone-layout,
`VITE_BASE`-deploy-pipeline til Pages-hubben.

**Hvorfor stadig slots (ikke fri placering):** (a) bounded søgerum → solveren kan *bevise*
stjerne-trin; (b) store tap-targets på mobil; (c) designeren styrer løsningsrummet = designet
sværhed. Fri placering er et andet (og dårligere) spil på en telefon.

---

## 3. Kerneloop

```
vælg bane → [preview viser ankomst] → placér brik (tap slot) → rotér (radial, ét tryk)
→ vælg kugle → [preview opdaterer live] → SLIP → run + juice → stjerner tælles op
→ næste bane ELLER forbedr (jagt ★3/par)
```

Sekundært loop: stjerner → verden 2 og 3 låses op → sværere mekanik-kombinationer.

---

## 4. Mekanik-inventar (præcise semantikker — dette er kontrakten)

### 4.1 Vinkelsystem

Én global tabel med 16 trin à 22,5° (0° … 337,5°). Hver briktype har et **domæne** af gyldige
indeks — færre meningsløse valg for spilleren, mindre søgerum for solveren:

| Brik | Domæne (indeks i 16-tabellen) | Rationale |
|---|---|---|
| Rampe | 0–7 (8 vinkler over 180°) | En planke er 180°-symmetrisk |
| Trampolin | 0–7 | Samme symmetri |
| Tragt | {0, 1, 2, 14, 15} (0°, ±22,5°, ±45°) | Kun nær-oprette hældninger er meningsfulde |
| Booster | 0–15 (fuld cirkel) | Retningen ER brikken |
| Portal-indgang | {0} (én — det er en disk) | Rotation er meningsløs |

UI'ens radiale vælger viser præcis domænet. `PlacedPiece.rotation` er altid et indeks i
16-tabellen og valideres mod domænet i både store og solver.

### 4.2 Spillerens brikker (statiske; kuglen er eneste dynamiske krop)

| Brik | Dansk | Geometri | Semantik |
|---|---|---|---|
| `ramp` | Rampe | planke 92×11 | Deflektér. Restitution 0.12 |
| `bouncer` | Trampolin | pude 66×13 | Energi: restitution 0.9 |
| `funnel` | Tragt | ∨, 34 px gab | Centrér/tilgiv: centreret kugle passerer, skæv kugle rettes ind |
| `booster` | Booster | pil 46×16 | Ved kontakt: sæt kuglens hastighed til `max(|v|, BOOST_SPEED)` langs pilens akse. Hastigheds-SÆT (ikke impuls) — forudsigeligt: "den affyrer dig DENNE vej med DENNE fart" |
| `portal` | Portal | disk r=16 (sensor) | Teleportér kuglen til banens *faste, forfattede* udgang; fart bevares; retning = udgangens vinkel; 10 ticks cooldown mod re-trigger. Spilleren placerer INDGANGEN; udgangen er en del af banen (bevarer én-brik-én-slot-modellen) |

### 4.3 Baneelementer (forfatterens; ikke placerbare)

- **Vægge & pinde** som i v1.
- **Faldgruber** (fail zones) som i v1.
- **Breakable planke**: statisk krop med `breakImpulse`-tærskel. Ved kollision: hvis
  `impactSpeed × ball.mass ≥ breakImpulse` → planken fjernes fra verdenen (deterministisk,
  midt i simuleringen), ellers opfører den sig som en væg. Tærskler forfattes så jern typisk
  knuser, basketball aldrig gør, træ afhænger af fart. **Dette er mekanikken der gør
  kuglevalget til en puslespilsnøgle.**
- **Stjernemønt**: sensor-disk r=12. Samles når kuglens centrum passerer inden for radius
  under runnet. Påvirker ikke fysikken. ★2 kræver ALLE banens mønter i et vindende run.
- **Portal-udgang**: position + retningsvinkel, tegnes altid (også når indgangen ikke er placeret).

### 4.4 Kugler

| Kugle | Dansk | r | Restitution | Masse-rolle |
|---|---|---|---|---|
| `iron` | Jern | 9 | 0.16 | Tung: knuser breakables, dødt hop, upåvirkelig |
| `wood` | Trækugle | 9 | 0.34 | Mellem: knuser kun ved høj fart |
| `basketball` | Basketball | 10 | 0.72 | Let og springsk: knuser aldrig, hopper over gab |

Hver bane deklarerer `balls: BallType[]` — hvilke kugler spilleren må vælge imellem (1–3).
Baner hvor valget ER puslespillet, tilbyder flere og kræver det rigtige.

### 4.5 Preview-reglen (én regel, aldrig undtaget)

Ghost-preview = stiplet kurve af kuglens bane fra droppunktet **indtil første kollision med en
spiller-placeret brik**; rammes ingen spillerbrik, vises hele banen (capped på MAX_STEPS).
Previewet simulerer med den aktuelt valgte kugle og alle nuværende placeringer (inkl.
breakables — de er baneelementer) og opdateres live ved enhver ændring (placér/rotér/fjern/
kugleskift). Sværhed styres af banedesign — aldrig ved at pille ved preview-reglen.

---

## 5. Stjerner, par & progression

- **★1**: kuglen rammer målet.
- **★2**: ★1 + alle banens stjernemønter i samme run. (Baner uden mønter — kun tutorial-bane
  1–2 — giver ★2 sammen med ★1.)
- **★3**: ★2 opnået med **≤ par** brikker. `par` = det mindste antal brikker, som solveren
  fandt en mønt-komplet vindende løsning med (iterativ uddybning: 0-brikker, 1-brik, 2, …).
  Stjernerne er altså nestede: ★3 ⊆ ★2 ⊆ ★1. UI viser "Par: N brikker" på banekortet.
- **Progression**: Verden 2 låses op ved **6★**, verden 3 ved **16★**. Max 42★ (14 baner × 3).
- Stjerner persisteres pr. bane (Dexie), vises på banekort + samlet tæller.

---

## 6. Indhold: 14 baner, 3 verdener (design-intent pr. bane)

Hver bane har ét formål ("intent") og introducerer højst ÉN ny ting. Kurven inden for hver
verden skal have faldende solution density (solveren måler og håndhæver).

**Verden 1 — Værkstedet (lær; 5 baner)**
1. *Første kast* — tutorial: placér, rotér, slip. Én rampe. (ingen mønter)
2. *Begge veje* — rotation betyder alt: samme slot, to mulige mål-retninger. (ingen mønter)
3. *Stjernevejen* — mønter introduceres: den lige vej vinder ★1, omvejen over mønten ★2.
4. *Blød landing* — tragten: fang en skæv ankomst.
5. *Opspring* — trampolinen: op over en mur som en rampe ikke kan klare.

**Verden 2 — Maskinhallen (kombinér; 5 baner)**
6. *Fuld fart* — booster: en for langsom kugle skal accelereres for at nå tværs over.
7. *Gennembrud* — breakable + kuglevalg: jern knuser sig igennem; basketball må udenom. To veje, én mekanisk pointe.
8. *Hul i væggen* — portal: eneste vej gennem en massiv mur.
9. *To trin* — kæd to brikker: første deflektion skal levere kuglen præcist til den anden.
10. *Sparsommelighed* — par-pres: mange slots, fristende at bruge 3, par er 2.

**Verden 3 — Mesterprøven (mestr; 4 baner)**
11. *Slalom 2.0* — faldgruber flankerer den eneste sikre korridor.
12. *Nålestik* — lille target, smal tolerance; tragt-præcision.
13. *Maskinen* — 3-briks kæde inkl. breakable timing.
14. *Mesterværket 2.0* — alle mekanikker; lavest density i pakken; finalen.

**Indholdskrav (maskinelt håndhævet af solveren):**
- Alle 14 baner: ★1, ★2 og ★3 bevist opnåelige; par ≤ 3 overalt.
- Ingen bane kan vindes med 0 brikker med NOGEN tilladt kugle.
- Solution density (★1-vindere/kandidater) falder monotont inden for hver verden.
- Slots ≤ 5 og samlet inventar ≤ 4 pr. bane (holder solveren hurtig og valgene meningsfulde).

---

## 7. UX & flows

- **Radial vinkelvælger**: tryk på en placeret brik → ring omkring brikken med kun dens
  domæne-vinkler; ét tryk vælger; preview opdaterer med det samme. Fjern-knap (×) bevares.
- **Kuglevælger**: kun banens tilladte kugler; valgt kugle vises ved droppunktet og i preview.
- **Tutorial (bane 1)**: tre overlays i sekvens (peg på slot: "Tryk for at placere" → på brik:
  "Tryk igen for at rotere" → på knappen: "Slip kuglen"). Vises kun til ★1 første gang.
- **Level select**: tre verdens-sektioner med lås + krav ("6★ for at åbne"), stjerner pr. kort,
  par pr. kort, samlet stjernetæller.
- **Resultat**: stjerner tæller op én ad gangen med lyd; "Prøv igen" foreslår ★-målet man
  mangler ("Prøv med ≤ 2 brikker for ★3").
- **Fuld skærm på iPhone**: bevar v1-løsningen (100dvh, safe-areas, board skalerer til højde,
  aldrig scroll i spil-viewet; verificeret ved 390×844).
- **Lyd-toggle** i level select; persisteres.

---

## 8. Juice (alt deterministisk)

- **Kollisionslyde**: WebAudio-oscillatorer (ingen assets). Pitch/volumen = funktion af
  impact-hastighed udledt af trajektorie-deltaer. Materialefarvet: metallisk klik (jern),
  træ-tok, gummi-boing (basketball).
- **Mønt**: pentatonisk pling, stigende tone pr. mønt i samme run.
- **Målgang**: slow-mo på de sidste ~25 ticks af replayet (kun afspilningshastighed — banen er
  præberegnet), partikelburst i målfarven (seedet PRNG fra bane-id — ingen ægte tilfældighed),
  arpeggio.
- **Fail**: kort thud; kuglen blinker rødt.
- **Ingen haptics**: iOS Safari understøtter ikke `navigator.vibrate` — bevidst fravalgt.

---

## 9. Teknisk arv & migration

- Determinisme-opskrift, slot-model, solver-arkitektur, rapport-drevne tests, canvas-replay,
  PWA/Dexie, `VITE_BASE`-deploy: **genbrug fra v1** (se build-prompten for detaljer).
- **Dexie-migration er obligatorisk**: spillet er live med rigtige brugere. `version(2)` med
  `upgrade`-sti der aldrig smider exceptions på v1-rækker. Beslutning: v1-fremgang nulstilles
  bevidst (nyt indhold, ny stjerneøkonomi) men lyd/kugle-præferencer bevares hvor muligt.
- Solver-budget: hele pakken verificeres på **≤ 5 min** lokalt. Overskrides det → redesign
  banen (færre slots/typer), aldrig svækket verifikation.

## 10. Ikke-mål (uændret + nye)

Level editor, deling/backend, multiplayer, konti, monetarisering, ægte tilfældighed,
fri placering, samtidige kugler. **Stretch (kun hvis ALT andet er grønt):** multi-drop-baner
(to kugler i sekvens gennem samme maskine mod hver sit mål).

## 11. Accept-kriterier (maskinelle — spejles i build-promptens Definition of Done)

1. `solve:levels` beviser ★1/★2/★3 pr. bane, udleder par, måler density-kurven, exit 0, ≤ 5 min.
2. Determinisme-test: bit-identiske trajektorier inkl. breakables, portaler, mønter og alle kugler.
3. Preview-korrekthed: previewets kurve er præfiks af det faktiske runs trajektorie (test).
4. Playwright ved 390×844: tutorial → placér/rotér (radial) → mønt → stjerner → verden-lås-op →
   reload-restore → ingen scroll-overflow.
5. Redeploy til `/Test/kuglebanen/` uden at røre `vm/`, `elpriser/` eller hub-forsiden.
