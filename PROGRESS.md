# Fremdrift

## ✅ Fase 1 — Fundament
- Vite + React + TS + Tailwind + Zustand + Dexie + Router + Recharts opsat.
- Domænetyper (`src/types/domain.ts`): Cycle, Objective, KeyResult, Initiative, CheckIn, AlignmentLink + afledte view-modeller.
- OKR-logik (`src/lib/okr.ts`): fremdrift, confidence→sundhed, auto-rollup, formatering, nudge-heuristik.
- Dexie-schema + repository-lag (CRUD + seeding).
- Seed-data: Nordlys Games — 1 virksomhed, 3 tribes, 6 teams, 24 KR'er, initiativer, alignment-koblinger, 8 ugers check-ins.
- Zustand-store med afledte maps og computed KR-værdier.
- **Verificeret:** `npm run build` grøn, `npm run dev` svarer 200, rå OKR-liste renderer.

## ✅ Fase 2 — Trævisning + detaljevisning
- Layout med sidebar/bundnav, cyklus-vælger, reset.
- Genbrugskomponenter: ProgressBar, HealthBadge, KrTypePill, Sparkline (Recharts), Modal, KrCard.
- Trævisning: rekursive objective-noder company→tribe→team, foldbare, med samlet fremdrift og sundhed; stribet bjælke = auto-rollup.
- ObjectiveDetail: header, KR-grid, child-objektiver, bløde grænse-advarsler.
- KrDetail: metrik-stat, stor sparkline, check-in-historik, initiativ-liste (arbejde adskilt fra mål), alignment op/ned.
- Routing (React Router) + UI-store til modaler.
- **Verificeret:** build grøn, alle ruter svarer 200.

## ✅ Fase 3 — Check-in-loop
- CheckInModal: ny værdi + confidence-slider (live farve/sundhed) + kommentar + indrapportør. Mobilvenlig (slide-up, bundforankrede knapper).
- Gemmer til historik og opdaterer KR'ets current → sparkline og fremdrift opdateres live overalt.
- "Mangler check-in"-chips på KR-kort + påmindelsesbanner i trævisningen med direkte genvej.
- **Verificeret:** build grøn.

## ✅ Fase 4 — Alignment + auto-rollup
- AlignModal: kobl et KR op mod et eller flere overordnede KR'er (mange-til-mange) med vægt; tilføj/fjern.
- Rekursiv vægtet auto-rollup (lib/okr) genberegnes ved hver mutation → team-KR-ændring forplanter sig op til company-niveau.
- Visuel markering i træ/kort: stribet fremdriftsbjælke + "Auto-rollup · N"-chip med bidragyder-antal.
- **Verificeret:** build grøn.

## ✅ Fase 5 — Ledelses-dashboard
- KPI-kort: gns. fremdrift, på-sporet, mål i drift, mangler check-in.
- Sundhedsdonut (Recharts) + committed/aspirational-opdeling + samlet sundhedsbar.
- "Mål i drift"-liste sorteret efter alvor med direkte check-in-genvej.
- Filter på tribe/team (inkl. descendants) + cyklus (global).
- **Verificeret:** build grøn.

## ✅ Fase 6 — CRUD + polish
- Editor-modaler for Objective, Key Result og Initiativ (opret/redigér/slet).
- Blød grænse-advarsel (objectives pr. niveau, KR pr. objective) + live nudge mod udfaldsformulering på KR-titler.
- Cyklus-skift via global vælger (Q1/Q2); tom cyklus viser empty-state med opret-knap.
- Polish: konsistent designsprog, empty states, hover/scale/slide-animationer, mobil bundnav.
- PWA: manifest + service worker (installerbar, offline-skal) + ikoner.
- README med kør-instruktion.
- **Verificeret:** build grøn.

## Status: alle 6 faser færdige ✅

## ✅ Opfølgning — tom start, guide & redesign
- Appen starter tom (kun én aktiv kvartalscyklus); eksempel-data er nu opt-in.
- Ny guide-side (`/guide`) med how-to; førstegangsbesøg lander der.
- Salesforce-inspireret redesign i Danske Spil-grøn/gul.
- Rige empty-states med CTA'er (opret / indlæs eksempel / guide).
- **Verificeret:** build grøn.
