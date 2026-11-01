# Sportsbook X · UI-only demo

Klikbar, mobil-først demo af et sportsbook-flow. Ingen backend, ingen rigtige penge, ingen rigtige odds.
Alle sandsynligheder kommer fra en mock-model (uafhængig Poisson-målmodel pr. hold, betinget på stand og resterende forventede mål).

## Kør

```bash
npm install
npm run dev        # udvikling
npm test           # odds-model, slip-matematik, feed-kalibrering, demo-bøger, kontrast, anti-kompulsions-regler
npm run preview    # i en anden terminal, port 4173
node qa/qa.cjs     # QA: axe-core, Long Tasks, reduceret bevægelse, Escape, cash-out
npm run build      # typecheck (TypeScript 7) + produktionsbuild i dist/
```

Versioner er pinnet i `package.json` (React 19.3.1, Vite 8.3.5, TypeScript 7.0.2, Motion 14.9.0, Vitest 5.0.5).

## Hvad der er i v0.2

- Markedsbræt som forside, filtreret pr. kategori (fodbold, esport, politik, vejr, awards).
- Kampside med forløbskurve, hændelses-pins og scrub. Sandsynlighed vises kun ved scrub og er mærket modelestimat.
- Markedsdetalje med prisfakta-linje (samlet implicit og margin, beregnet fra uafrundede værdier), regelblok og ladder med "Andet" som info-række.
- Bet slip med enkeltbets som standard. "Kombinér" er en åbnet visning med samlet sandsynlighed og en antagelse om uafhængighed.
- Demo-bets gemt lokalt i fanen ("Mine bets"). Cash-out tilbydes for enkeltbets, prices i 10-minutters-trin, og et forældet tilbud giver "prisen er ændret" i stedet for udbetaling.
- Skud pr. 10 minutter som valgfri stribe under kurven. Skud er uafhængige af mål-hændelser og vægtes efter forventede mål.
- Oddsformat (decimal, brøk, amerikansk) kan skiftes på markedsdetalje.
- Motion med `motion/react`. Reduceret bevægelse giver kun opacity-skift (`MotionConfig`).
- Live-klokke (én mock-minut pr. sekund, kun når Live er slået til).
- Tests (Vitest): odds-model, prisfakta, format, feed-kalibrering, skud-uafhængighed, demo-bøger, kontrast (WCAG AAA 7:1 på alle tekstpar), anti-kompulsions-ord.
- QA (`qa/qa.cjs`, Playwright + axe-core): ingen serious/critical fund på fem skærme, Escape lukker slip, cash-out afregnes, ingen Long Task over 50 ms med Live under 4× throttling, reduceret bevægelse uden flytning (med kontrolkørsel).

Tile-størrelse følger antal valg (ladder er bred), ikke volumen. Der er ingen 1D/1W/1M, fordi mock-data ikke har historik.

## Ikke i v0.1


- Momentum-stribe under kurven.
- Oddsformat-skifte i UI'et (understøttet i `src/odds/format.ts`, men ikke koblet op).
- Sammenlignings- og recall-tests med testpersoner.

## Regler og grænser

- Ingen bet placeres. "Læg bet (demo)" viser kun en besked.
- Regelblokke er illustrative. Ingen operatør eller licensstatus er påstået.
- Designregler mod kompulsion står i planen og håndhæves delvist af `tests/compliance.test.ts`.
