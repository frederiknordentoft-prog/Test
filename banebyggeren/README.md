# Banebyggeren ⛳

En lille, selvstændig **golf-hul-bygger** som statisk underside. Byg et hul af tiles,
lad et panel af AI-golfere spille det, og se en **deterministisk rating-motor** måle hvor
godt hullet er.

Kernidé (fra SimGolf): _"ser svært ud, spiller nemt"_ — men gjort **målbart**. Et hul er
godt fordi fysikken beviseligt kan mestres på tværs af færdighedsniveauer, ikke fordi en
skjult stat siger det.

## Kør den
Ingen build, ingen afhængigheder. Åbn `index.html` direkte i en browser, eller server
mappen statisk (fx `/banebyggeren/` på GitHub Pages). Alt kører offline; hullet gemmes
lokalt i `localStorage`.

## Sådan spiller/bygger du
1. Vælg et **værktøj** (tee, flag, green, fairway, rough, bunker, vand, træer, viskelæder).
2. **Mal** på brættet (mus eller touch). Sæt **Tee** (start) og **Flag** (hul).
3. Se **auto-par**, **design-par** og **live hul-rating** opdatere til højre.
4. Tryk **▶ Lad AI spille** for at se den bedste golfers foreslåede rute.
5. **Gem** / **Indlæs** dit hul. Løs **Dagens udfordring** (deterministisk pr. dato).

## Hvordan rating-motoren virker
Fysik-kernen (`game.js`) er ren, DOM-fri TypeScript-agtig JS og har **to forbrugere**:
den interaktive canvas-render (`ui.js`) **og** scoringen — samme simulering begge steder.

- **Determinisme:** al tilfældighed går gennem en seedet PRNG (`mulberry32`). Samme
  `(hul, golfer, seed)` giver altid samme resultat. Ingen `Math.random` i fysik/AI-stien.
- **Simulering:** hvert slag er en momentum-integrator — terræn spiser momentum (bunker
  meget, fairway lidt), vand/OOB koster strafslag, træer blokerer.
- **Rating pr. skill:** for hver færdighed (længde/præcision/fantasi) spilles et fast
  seedet panel af golfere. Ratingen = gns. slag i kohorten **uden** færdigheden minus gns.
  **med** den. Positivt tal = færdigheden sparer slag → hullet belønner den skill.
  `total = længde + præcision + fantasi`.

## Tilføj et hul / en bane
Hullene bygges i UI'en og gemmes i `localStorage` (nøgle `banebyggeren.hole.v1`).
Vil du seed'e et hul i kode, se `seedDemoIfEmpty()` i `ui.js` eller byg et `HoleDef`-objekt
via `Banebyggeren.makeEmptyHole()` og sæt `tiles`, `tee`, `pin`.

## Antagelser
- Statisk vanilla-side (ingen build/framework) for at matche de øvrige apps i repoet og
  ikke bryde deres statiske deployment.
- Rating er en let, deterministisk heuristik — ikke en fuld fysik-motor — men opfylder
  kravet: samme input + seed → samme output, og færdigheder betyder beviseligt noget.
