# Sportsbook X · UI-only demo

Klikbar, mobil-først demo af et sportsbook-flow. Ingen backend, ingen rigtige penge, ingen rigtige odds.
Alle sandsynligheder kommer fra en mock-model (uafhængig Poisson-målmodel pr. hold, betinget på stand og resterende forventede mål).

## Kør

```bash
npm install
npm run dev        # udvikling
npm test           # odds-model, slip-matematik, feed-kalibrering, anti-kompulsions-regler
npm run build      # typecheck (TypeScript 7) + produktionsbuild i dist/
```

Versioner er pinnet i `package.json` (React 19.3.1, Vite 8.3.5, TypeScript 7.0.2, Motion 14.9.0, Vitest 5.0.5).

## Hvad der er i v0.1

- Markedsbræt som forside, filtreret pr. kategori (fodbold, esport, politik, vejr, awards).
- Kampside med forløbskurve, hændelses-pins og scrub. Sandsynlighed vises kun ved scrub og er mærket modelestimat.
- Markedsdetalje med prisfakta-linje (samlet implicit og margin, beregnet fra uafrundede værdier), regelblok og ladder med "Andet" som info-række.
- Bet slip med enkeltbets som standard. "Kombinér" er en åbnet visning med samlet sandsynlighed og en antagelse om uafhængighed.
- Live-klokke (én mock-minut pr. sekund, kun når Live er slået til). Priser opdateres i 10-minutters trin.
- Tests: odds-model, prisfakta, feed-kalibrering over 2 000 seeds, slip-matematik og en regeltest mod anti-kompulsions-ord.

## Ikke i v0.1

- Cash-out-skærm og konto-stub (ansvarligt spil).
- Momentum-stribe under kurven.
- Oddsformat-skifte i UI'et (understøttet i `src/odds/format.ts`, men ikke koblet op).
- Sammenlignings- og recall-tests med testpersoner.

## Regler og grænser

- Ingen bet placeres. "Læg bet (demo)" viser kun en besked.
- Regelblokke er illustrative. Ingen operatør eller licensstatus er påstået.
- Designregler mod kompulsion står i planen og håndhæves delvist af `tests/compliance.test.ts`.
