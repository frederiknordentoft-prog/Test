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

## ⏳ Næste
- Fase 3 — Check-in-loop.
