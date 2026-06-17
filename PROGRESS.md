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

## ⏳ Næste
- Fase 4 — Alignment + auto-rollup (rollup-logik er på plads; tilføj kobling-UI + visuel markering).
