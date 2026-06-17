# Beslutningslog

Løbende log over selvstændige beslutninger truffet under bygningen, jf. autonomi-reglerne.

## Opsætning

- **Fjernede gamle filer fra branchen.** Branchen `claude/okr-system-webapp-ixwgrb` var udspaltet fra et el-pris-dashboard og indeholdt `app.js`, `index.html`, `styles.css` fra det projekt. De er slettet, da OKR-systemet er et nyt Vite-projekt og de gamle statiske filer ville kollidere (især `index.html`).
- **Stack** følger prompten: Vite + React 18 + TS, Tailwind, Zustand, Dexie, React Router, Recharts, lucide-react, date-fns.

## Domæne & beregninger

- **Confidence-tærskler differentieret på KR-type.** Aspirational: <0.4 rød / 0.4–0.7 gul / >0.7 grøn (0.7 = godt). Committed strammere: <0.5 rød / 0.5–0.8 gul / >0.8 grøn. Dette koder best practice om at "grøn" skal betyde det rigtige.
- **Faldende mål understøttes.** `rawProgress` regner baseline→target uanset retning, så KR'er som "reducér CAC fra 14 til 9 kr." får korrekt fremdrift.
- **Auto-rollup = vægtet gennemsnit** af bidragende child-KR'ers (rekursivt) rolled-up fremdrift. Hvis et KR ingen bidragydere har, bruges dets egen rå fremdrift. Cyklus-beskyttelse via `visited`-sæt.
- **"Mangler check-in"** defineres som ≥7 dage siden seneste check-in (eller aldrig).
- **Check-in opdaterer KR'ets `current`** automatisk, så fremdrift og rollup afspejler nyeste tal med det samme.

## Data

- **Seed-domæne:** fiktivt dansk mobilspil-studie "Nordlys Games" — 1 virksomhed, 3 tribes, 6 teams, realistiske spil-KPI'er (DAU, retention, CAC, ARPDAU, crash-free m.m.).
- **8 ugers check-in-historik** genereres deterministisk pr. KR (reproducerbar pseudo-støj), med sundhedsprofiler (grøn/gul/rød/fresh) der giver et varieret dashboard.
- **Persistens i IndexedDB via Dexie**, seedes én gang (flag i localStorage). Reset-funktion i UI re-seeder.

## Arkitektur

- **Hele datasættet holdes i hukommelsen** i Zustand-store og genindlæses efter hver mutation. Datasættet er lille (<200 rækker), så dette er enklere og hurtigt nok frem for granulær cache-invalidering.
