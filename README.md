# Talvennerne

Regnespil til indskolingen — plus og minus i et univers med små væsener.
Bygget til iPhone og iPad: åbn i Safari → Del → **Føj til hjemmeskærm**.

**Live:** https://frederiknordentoft-prog.github.io/Test/talvennerne/

## Hvad det er

Barnet spiller korte ture på 10 opgaver (60–90 sekunder), samler **talvenner**
der klækkes af æg, og fylder et album. Sværhedsgraden følger barnet: hver
opgave har en mestringstilstand, og en tur blandes af 2 sikre, 5 vaklende og
3 nye regnestykker. En fejl straffes ikke — opgaven kommer bare igen senere
i samme tur.

Syv øer, kun plus og minus:

| Ø | Fagligt |
|---|---|
| Tælleskoven | Tælle 1–10, én mere / én mindre |
| Plusengen | Plus inden for 10 |
| Minusmosen | Minus inden for 10 |
| Tiervennernes hule | Par der giver 10 |
| Dobbeltbjerget | Dobbelt og halvdelen |
| Tyvebroen | Plus og minus over tieren |
| Hundredehavet | Tiere og enere, plus og minus inden for 100 |

Fem inputformer: vælg svar, taltastatur, tæl og tap, træk-og-slip par, talrække.

## Til forældre

Ingen konto, ingen reklamer, ingen køb, ingen måling, ingen netværkskald.
Al fremgang ligger lokalt i browseren. Forældrepanelet ligger bag en
voksen-gate og viser fremgang pr. færdighed, kan slå lyd, oplæsning og
effekter fra, og kan tage en kopi af fremgangen.

Alt grafik og lyd genereres i kode — ingen billedfiler, ingen lydfiler.
Væsenerne bygges af SVG-primitiver ud fra deres id, lyden syntetiseres med
Web Audio, og oplæsningen bruger enhedens danske stemme (og tier hvis der
ikke er en).

## Udvikling

```bash
npm install
npm run dev          # udviklingsserver
npm test             # unit-tests på motoren
npm run build        # typecheck + produktionsbuild til dist/
npm run icons        # gengenerér app-ikoner
npm run playthrough  # spil en hel tur igennem i browseren + screenshots
```

`npm run playthrough` kræver at `npm run build && npx vite preview --port 4173`
kører. Den spiller en rigtig tur, svarer bevidst forkert én gang, klækker ægget
og tjekker at samlingen overlever en genindlæsning.

## Struktur

```
src/engine/    ren spillogik — facts, distraktorer, mestringsmodel, tursammensætning
src/content/   øer, ture og navne
src/state/     zustand-stores og versioneret persistens
src/art/       procedurale SVG-væsener
src/fx/        partikelmotor på eget canvas
src/audio/     syntetiseret lyd og dansk oplæsning
src/ui/        skærme og de fem opgavetyper
```

Motoren kender ikke til React og kalder aldrig `Math.random()` — alt tilfældigt
kommer fra en seedet PRNG, så en tur kan gentages nøjagtigt i en test.

## Deploy

Følger repoets regler i `CLAUDE.md` på `main`: appen bor i sin egen undermappe
på oversigts-branchen og deployes med `deploy-app.sh`, som nægter at røre
andre apps.
