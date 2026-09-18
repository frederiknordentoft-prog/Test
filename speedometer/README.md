# Speedometer til PowerPoint

Et lille, selvstændigt browserværktøj til at lave "Samlet temperatur"-speedometeret dynamisk. Du indtaster den nuværende værdi (0–100 %) og den forrige værdi, og speedometeret tegnes med det samme – med et bevægelsesspor, der viser hvor langt pilen har flyttet sig siden sidst. Derfra kopierer eller downloader du det direkte ind i PowerPoint.

Ingen installation, ingen server, ingen konto. Alt sker lokalt i din browser og virker offline.

## Sådan åbner du det

1. Dobbeltklik på `dist/speedometer.html` – det åbner i din standardbrowser (Chrome, Edge, Safari eller Firefox).
2. Filen kan ligge hvor som helst (skrivebord, OneDrive, et delt drev) og sendes som én fil til kolleger.

`index.html` i roden er udviklingsversionen, som indlæser de enkelte filer i `src/` og `vendor/`. Til daglig brug skal du kun bruge `dist/speedometer.html`.

PPTX-eksport henter biblioteket PptxGenJS fra et CDN første gang og kræver derfor internet den første gang. Alt andet er indbygget i filen.

## Arbejdsgang

1. Indtast **Nuværende værdi** og **Forrige værdi**. Både komma og punktum virker som decimaltegn (fx `62,5`). Skyderne kan finjusteres med piletasterne.
2. Kig på forhåndsvisningen: sporet viser bevægelsen fra forrige måling til nu, den stiplede pil markerer den præcise forrige position, og chippen under navet viser ændringen i procentpoint (fx `▲ +14 pp`).
3. Klik **Kopiér som billede** og indsæt i PowerPoint med `Ctrl+V` (`⌘V` på Mac).
4. Sæt **Baggrund** til **Gennemsigtig**, så speedometeret kan lægges direkte oven på kortet i din slide. Vælg **Kort** hvis du vil have hele kortet med.
5. **Afspil bevægelse** viser animationen fra forrige til nuværende værdi, så du kan vurdere sporet inden du eksporterer.

Under **Avanceret** kan du justere zonegrænserne, sporstyrken og en valgfri undertekst.

## Eksportformater

| Format | Brug til | Bemærk |
|---|---|---|
| **Kopiér som billede** | Den hurtigste vej ind i en slide | Lægger en PNG i høj opløsning (3×) med gennemsigtig baggrund i udklipsholderen. Firefox tillader ikke billedkopiering – brug Download PNG i stedet. |
| **PNG** | Statiske slides | Vælg 2×, 3× eller 4× (2000, 3000 eller 4000 px bred). Baggrunden følger indstillingen Baggrund. |
| **GIF (animeret)** | Bevægelse i slideshow | Afspilles kun i fremvisningstilstand i PowerPoint. GIF kan ikke være gennemsigtig, så vælg baggrundsfarve (Hvid, Kortfarve eller egen farve) og om den skal køre én gang eller uendeligt. |
| **PPTX** | Redigerbare figurer | Slide 1 indeholder speedometeret som rigtige PowerPoint-former (buer, pil, nav, chip), som du kan farve og flytte. Slide 2 indeholder samme speedometer som PNG. Kræver internet første gang. |
| **SVG** | Designere og vektorgrafik | Skarpt i alle størrelser. PowerPoint 2016 og nyere kan indsætte SVG direkte. |

## Tips

- **Næste måned:** klik **Brug sidste eksport som forrige**. Værktøjet husker den sidste værdi, du eksporterede eller kopierede, så forrige position altid er korrekt.
- **Link med værdier:** åbn filen med `?value=62&prev=48` efter filnavnet (fx `speedometer.html?value=62&prev=48`) for at forudfylde felterne – praktisk i en tjekliste eller en genvej.
- Dine indstillinger huskes i browseren mellem besøg. Slet browserens webstedsdata for at nulstille.
- Slå **Vis tal** og **Undertekst** til, hvis værdien og en tekst som "RESULTATER" skal med i selve billedet. Overskriften i forhåndsvisningen er kun til skærmen.
- **Sporstyrke** styrer hvor markant bevægelsessporet er: 0,5 er diskret, 1,5 er dramatisk.
- Værktøjet respekterer browserens indstilling for reduceret bevægelse og springer i så fald animationen over.

## Sådan er farverne og zonerne sat

- Skiven er en halvcirkel med tre zoner: **rød** 0–33,3 %, **gul** 33,3–66,7 % og **grøn** 66,7–100 %. Grænserne ændres under Avanceret ("Rød til" og "Gul til").
- Farverne er faste i eksporten: rød `#DE3E2E`, gul `#F0A62E`, grøn `#1D9C4E`, pil og nav `#1C1C1E`. Der er et lille mellemrum på 2,4° mellem zonerne, skåret lige som på slidesne.
- Pilen peger mod venstre ved 0 %, lige op ved 50 % og mod højre ved 100 %.
- Ændringen vises altid som pil og tal ("▲ +14 pp", "▼ −9 pp", "● ±0 pp"), aldrig kun med farve.
- Tekst i eksporten bruger systemskrifttyper (Segoe UI/Helvetica/Arial og Georgia), så billedet ser ens ud på alle maskiner. Selve appen bruger IBM Plex Sans og Source Serif 4, når der er internet, og falder ellers tilbage til systemets skrifttyper.

## For udviklere

Ren vanilla JavaScript (ES2020), klassiske scripts uden moduler, ingen frameworks og ingen npm-afhængigheder. Udviklingsversionen kører direkte fra `index.html` uden build.

```
speedometer/
  index.html            app-skal (udviklingsversion)
  src/styles.css        al UI-CSS (designtokens på :root, lyst og mørkt tema)
  src/gauge.js          window.Gauge – ren renderer (state → SVG-streng) og animation
  src/exporters.js      window.Exporters – PNG, udklipsholder, download, GIF
  src/pptx-export.js    window.PptxExport – PPTX med native former via PptxGenJS
  src/app.js            UI, state, localStorage, afspilning
  vendor/gifenc.js      GIF-koder (MIT)
  build.mjs             samler alt i dist/speedometer.html
  dist/speedometer.html den distribuerbare fil
  tests/verify.mjs      Playwright-verifikation af dist-filen
  tests/verify_assets.py GIF/PPTX-kontrol (Pillow, python-pptx, LibreOffice)
  tests/out/            testoutput (ignoreres af git)
```

Kommandoer:

```
npm run build   # node build.mjs → dist/speedometer.html
npm test        # build + tests/verify.mjs
```

`npm test` kræver Node 22, Playwright med Chromium (globalt installeret eller `npm i -D playwright@1.56.1`), Python 3 med Pillow og python-pptx. LibreOffice (`soffice`) bruges til at rendere PPTX-slide 1 til PNG, hvis det er installeret; ellers tegnes sliden med Pillow. Testen skriver skærmbilleder, PNG'er, GIF'er og PPTX til `tests/out/` og fejler, hvis en kontrol ikke består. PPTX-testen springes over med en advarsel, hvis PptxGenJS ikke kunne hentes.

Afhængigheder på kørselstidspunktet: `gifenc` (MIT, ligger i `vendor/`) og PptxGenJS 4.0.1 (MIT), som hentes fra jsDelivr ved behov. Appen virker fuldt ud uden PptxGenJS – kun PPTX-knappen bliver deaktiveret.
