# Spilhuset: Udfordreren

En Game Dev Story-inspireret tycoon om en dansk spiludbyder. Du starter i en garage i januar 2012, lige efter liberaliseringen,
og bygger produkter, ansætter folk, jagter anmeldelser og Top 10 — og (i senere faser) markeder, regulering, konkurrenter og AI-æraen.

> **Status:** fase 1-2 af 8 er bygget (garagen, kerneloopet, vækst, niveauer og belønninger). Se `PLAN.md`.

## Kør spillet

```bash
cd udfordreren
npm install
npm run dev        # http://localhost:5173
```

Byg og preview:

```bash
npm run build && npm run preview
npm run build:single   # én selvstændig HTML-fil i dist-single/ (til deling)
```

## Kvalitet

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint (sim-kernen må ikke bruge Math.random/Date.now/React)
npm run test        # Vitest: determinisme, save/load, faser, anmeldelser, niveauer, hitliste, økonomi …
npx tsx sim/quick.ts 40 2022   # hurtig rytmetest med den balancerede bot (fase 1-2)
```

## Arkitektur

- `src/sim/` — ren, deterministisk simulationskerne. `step(state, actions)` returnerer en ny `GameState`. Én seedet `sfc32` i `rng.ts`.
- `src/data/` — alle tunbare tabeller med markeringer: **[F]** fakta, **[A]** afledt, **[D]** designestimat. Balancering sker kun her.
- `src/store/` — Zustand-store (tidsloop, pauser, dialogkø) og Dexie-persistens (3 slots + autosave hvert kvartal, JSON-eksport/-import).
- `src/ui/` — React-paneler og dialoger. `src/render/` — procedural pixel-grafik på canvas.
- `tests/unit/` — Vitest. `sim/` — bots og balanceringsscripts.

## Debug-menu

Tilføj `?debug=1` til URL'en: hop til et år, sæt kapital/indsigt/tillid, udløs events, se sim-værdierne bag hitlisten.

## Parodinavne

Rigtige firmaer optræder kun under parodinavne (fx Danske Lykke, bet356, Unibit, Betssen). Rigtige navne må kun stå i `src/data/archive.ts` (Arkivet, fase 6).
Lande og myndigheder (Spillemyndigheden, ROFUS m.fl.) er rigtige.
