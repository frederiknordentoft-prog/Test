# ⚖️ Vægtskålen

Et dansk læringsspil om atommasse: en gammeldags messing-skålvægt med to skåle.
Træk grundstoffer ned i skålene, og bjælken tipper **fysisk** efter grundstoffernes
faktiske atomvægt. Læringen er kropslig — for at balancere ét uranatom (238,03 u)
skal du selv hælde ca. 236 brintatomer (1,008 u) i den anden skål og mærke, hvor
skævt det står undervejs.

Installerbar PWA. Ingen backend, ingen konti — alt gemmes lokalt på enheden.

## Spiltilstande

| Tilstand | Mål |
| --- | --- |
| **Fri leg** | Udforsk frit — læg grundstoffer i begge skåle |
| **Balancér** | Venstre skål er forudfyldt og låst; gør højre lige så tung |
| **Ram vægten** | Byg højre skål op til en målmasse (vist som messinglod) — evt. med *færrest brikker* |
| **Molekyle** | Balancér Vand, CO₂, Glukose m.fl. med de **rigtige** atomer |

Streak, antal løste og bedste "færrest brikker" gemmes (Dexie/IndexedDB) og
genskabes ved reload.

## Kør lokalt

```bash
npm install
npm run dev        # udviklingsserver
npm run build      # genererer PWA-ikoner + typechecker + bygger til dist/
npm run preview    # servér produktions-build

npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest: masse-matematik, fysik, solvability, scoring
```

## Arkitektur

- **Vite + React 18 + TypeScript (strict) + Tailwind + Zustand + Dexie.**
- Spil-loop og fysik ligger i et framework-agnostisk modul `src/engine/` og kører
  på `requestAnimationFrame` med fixed timestep-accumulator (dt = 1/120 s) mod ét
  `<canvas>`. React ejer kun meta-UI (mode-vælger, aflæsning, overlays) og får
  `BeamState` via callback → Zustand — kun når settled/balanced/masser skifter,
  aldrig pr. frame.
- **Fysik** (`src/engine/physics.ts`): underdampet vinkelfjeder mod målvinklen
  `θ_target = θ_max · tanh(Δm / S)` hvor skalaen S vokser med totalmassen. Det
  giver wobble → ro, streng monotoni i massedifferencen og blød mætning.
- **Masse-matematik** foregår i heltal (mikro-u, 1 u = 100 000 µu), så
  H₂O === O + 2·H er *eksakt* og uden float-drift.
- **Challenges** genereres *by construction*: løsnings-multisettet trækkes først
  (seeded RNG), og udfordringen afledes af det — hver udfordring er løselig pr.
  design. "Færrest brikker"-optimum findes med iterativ uddybning (IDDFS).
- **Render** er 100 % proceduralt Canvas2D (børstet messing, valnød, pergament,
  graverede diske) og **lyd** er 100 % Web Audio-syntese — ingen eksterne assets.
  Lyden låses op ved første berøring (iOS), og appen pauser/resumer rent på
  `visibilitychange`.

## Tilgængelighed

- `prefers-reduced-motion` (og manuel indstilling): næsten kritisk dæmpet bjælke,
  ingen partikler/shake/fly-animationer.
- Kategorifarver er colorblind-sikre (Okabe–Ito) og står aldrig alene: hver
  kategori har også en **form** (cirkel, diamant, trekant, …) og tekstlabel.
- Touch-targets ≥ 44 px; brikker kan lægges med tap eller Enter (uden præcisions-
  drag), og hold-inde hælder mange i ad gangen. Hver lydcue har en visuel makker
  (klink ↔ squash, balanceklang ↔ glød + partikler).

## Data

Standard-atomvægte (IUPAC, forkortet) for 16 grundstoffer fra Brint (1,008 u) til
Uran (238,02891 u), og 7 molekyler hvis molarmasser går nøjagtigt op med
tray-værdierne. Se `src/data/`.
