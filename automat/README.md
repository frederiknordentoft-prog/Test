# NORDLYS · SOLSTORM G5

NORDLYS er en UI-demo af en casino-automat, der kører med legepenge. Al grafik og lyd er genereret i kode.

Himlen over Møns Klint er progressionsbaren. Hver gevinst knuser iskrystaller, og ladningen fra dem flyver op i nordlyset. Når Kp når 9, eller når der lander 4 sole, rammer **SOLSTORM · G5 EKSTREM**. Skærmen knuses, og et smeltet 8×8-kabinet samler sig på beatet.

## Kør lokalt

```bash
npm install
npm run dev              # http://127.0.0.1:5173
npm test                 # vitest: matematik, præsentationsregler, grænser mellem lag
npm run sim              # Monte Carlo for matematikmodellen
npm run build:artifact   # dist/nordlys.html: én selvstændig fil til en claude.ai Artifact
```

## Deep links

Artifacts modtager kun et rent `#anker`. Flags skrives derfor som tokens, der kan kombineres med `_`:

| Link | Effekt |
|---|---|
| `#solstorm` | Demo-stormen starter automatisk 2 s efter "Tænd himlen" |
| `#clean` | Skjuler demo-pillen til optagelser. Vandmærket "DEMO" i canvas bliver stående |
| `#fullfx` | Fuld effekt, selvom systemet beder om reduceret bevægelse |
| `#fps` | Viser FPS i et overlay |
| `#autostart` | Springer splash-skærmen over. Bruges kun til QA |

**Taster:** Mellemrum = spin · ↑↓ = indsats · E = demo · M = lyd · Esc = spring over.

## Arkitektur

```
src/math/      Outcome-motor: ren TypeScript, seedet xoshiro128**, isomorf og RGS-klar
src/game/      Game (state machine, penge, måler, storme, demo), World (render-ejer), store, tiers
src/present/   schedule (ren: SpinResult → Beat[]), director (GSAP), celebration, Solstorm-cinematic, clock
src/render/    Pixi v8: sky, symbol-art, Isfont, grid/frame, Kp-bue, post (bloom + uber), partikler/skår
src/audio/     Rå WebAudio: FM-klokker, pre-renderede stems, adaptive lag, stormmusik
src/ui/        DOM-HUD: skarp tekst, a11y, regulatoriske strips, menu, regler, demo-værktøjer
```

**Principper:**
- Outcome og præsentation er adskilt. `src/present` og `src/render` må aldrig importere outcome-RNG'en; det sikres af en test.
- Mindst 3,0 s pr. spil. Der er ingen turbo, autoplay eller bonus buy.
- Gevinster, der er lig med eller mindre end indsatsen, får den neutrale RETURN-profil og bliver ikke fejret (LDW-reglen).
- Der er ingen konstruerede near-misses. Anticipation følger en fast regel, der kan ses i reglerne.
- Solstorm-cinematic'en er slavet til lyd-uret, og hit-stops fryser kun effekter.
- Demo-knappen kører på en in-memory kopi af state. Den krediteres ikke saldoen, og den rigtige måler gendannes bagefter.

Se [PLAN.md](PLAN.md) for designet og [docs/CONTRACTS.md](docs/CONTRACTS.md) for modulgrænserne.
