# Kunst-rubrik (Talvennerne 2)

Rubrikken bruges af review-agenten, som **kun** ser kontaktarkenes PNG'er og dette dokument
(SPEC §11 pipeline pkt. 7). Reviewer er aldrig forfatteren. Arkene laves med `npm run sheets` og
ligger i `artifacts/sheets/<rute>.png` (taget i 2×). Alle mål er i CSS-px.

| Ark | Viser |
|---|---|
| `species.png` | Art × race × stadie × farve (idle) og humør × stadie. Stjerneform i nederste række af første gitter. |
| `moods.png` | De 7 humør (idle, happy, cheer, think, oops, sleep, wave) i 3 stadier, store. |
| `closeup.png` | Store renders (420 px) til kontur, cel-skygge, øjne og finish. |
| `sizes.png` | 48, 96 og 256 px samt butikskort ved 64 px (genstanden alene og på dyret). |
| `silhouettes.png` | Sort fyld uden navne, nummereret i fast blandet rækkefølge. |
| `fit.png` | Genstande på dyret i 3 stadier × genstandens 3 farvesæt. |
| `filmstrip.png` | 8 frames pr. humør (frosset animation) + blink/ørevip tæt samplet. |
| `lineup.png` | Racer side om side og de tre kropsskabeloner som mannequiner. |

## Stilen, der bedømmes imod

Siddende, forfra, chibi (hovedet ca. halvdelen af figurens højde og lidt bredere end kroppen).
Flad cel-skygge: grundfarve, en halvmåne i `shade` nederst til højre og 1–2 hvide højlys med 40 %
alfa. Farvet kontur på 3,2 enheder (i viewBox 200 × 240), afledt af pelsfarven. Store, lodrette,
blanke øjne med to højlys, lyserøde kinder, lille næse. Ingen filtre, masker, gradienter på kroppen
(kun jordskyggen og regnbuens manke/hale). Varm, rolig palet på papirbaggrund (#FFF8EC).

## De 10 kriterier (1–5)

Scor hvert kriterium 1–5. 2 og 4 ligger mellem beskrivelserne.

### 1. Genkendelighed ved 48 px (`sizes.png`, række "48 px")
- **1:** Arten kan ikke bestemmes; ører, hoved og krop flyder sammen, eller ansigtet er støj.
- **3:** Arten kan gættes, men kun ud fra farve eller efter at have set den større version.
- **5:** Arten er øjeblikkeligt tydelig i alle farver og stadier; ører, øjne og silhuet står skarpt,
  og humør som glad og sover kan skelnes.

### 2. Silhuet (`silhouettes.png`)
- **1:** Silhuetten er en neutral klat; arten kan ikke læses uden farver og ansigt.
- **3:** Arten kan læses, men silhuetten er generisk, eller racerne ligner hinanden for meget.
- **5:** Hver silhuet er entydig og karakteristisk (fx kaninens ører, halekvast og store fødder);
  racerne skelnes også i sort. En frisk agent ville ramme arten i første forsøg.

### 3. Proportioner (`species.png`, `lineup.png`)
- **1:** Proportionerne er tilfældige; hovedet er for lille, eller kroppen dominerer.
- **3:** Chibi-proportioner overordnet, men stadierne skiller sig for lidt ud, eller dele (arme,
  fødder, ører) har forkert størrelse i forhold til hinanden.
- **5:** Tydelig, charmerende chibi: stort hoved, lille rund krop, lave store øjne. Baby → ung → stor
  er en klar og troværdig udvikling (babyen har størst hoved og øjne), og alle dele hænger sammen.

### 4. Kontur (`closeup.png`, `species.png`)
- **1:** Konturen er ujævn i tykkelse, har huller, dobbeltstreger eller sømme mellem dele.
- **3:** Konturen er konsistent, men der er synlige sømme (fx hvor øret møder hovedet) eller
  enkelte for tynde/tykke streger.
- **5:** Én ensartet, farvet kontur på alle dele og stadier; sømløse overgange (ører vokser ud af
  hovedet), runde samlinger, og konturfarven harmonerer med pelsen i hver farve.

### 5. Palet (`species.png`)
- **1:** Farverne er grelle, mudrede eller skærer sig; skygger er grå og døde.
- **3:** Farverne er pæne hver for sig, men nogle colorways ligner hinanden, eller skygger og
  kontur er for svage/stærke.
- **5:** Harmonisk, varm palet; hver colorway er smuk og tydeligt forskellig; skygge og kontur er
  afledt ensartet; guld og regnbue føles særlige uden at skrige; god kontrast mod papirbaggrunden.

### 6. Ansigtets appel (`closeup.png`, `moods.png`)
- **1:** Ansigtet er tomt, uhyggeligt eller skævt; udtryk kan ikke aflæses.
- **3:** Sødt i hvile, men enkelte humør er svære at læse eller virker forkerte (fx surt i stedet for
  genert).
- **5:** Uimodståeligt sødt: store, levende øjne med højlys, velplacerede kinder og næse. Alle 7
  humør læses straks, og ingen virker triste, vrede eller skyldfremkaldende (der findes ingen sad).

### 7. Pasform (`fit.png`)
- **1:** Tøjet flyder, dækker øjnene, stikker ud af kroppen eller passer kun på ét stadie.
- **3:** Tøjet sidder, men med synlige fejl: hatte for høje/lave, ørerne ser forkert ud i forhold til
  hatten, eller kropstøj går uden for kroppen.
- **5:** Alt sidder naturligt på alle 3 stadier og i alle farvesæt: `through`-hatte har ørerne op
  gennem huller, `under`-hatte sidder mellem ørerne, trøjen følger kroppens kontur og ribkanten
  sidder på hoften; øjnene er altid fri.

### 8. Animation (`filmstrip.png`)
- **1:** Frames er ens, eller dele hopper fra hinanden (forkerte pivoter).
- **3:** Bevægelsen er synlig, men stiv; pivoter sidder lidt forkert, eller humørene ligner hinanden.
- **5:** Levende og troværdig: squash og stretch i hop, dele drejer om rigtige led (ører om basen,
  poter om skulderen, hovedet om halsen), blink og ørevip sker, og hvert humør har sin egen rytme.

### 9. Læsbarhed i butikskort ved 64 px (`sizes.png`, "butikskort")
- **1:** Genstanden kan ikke genkendes, eller den forsvinder i kortet.
- **3:** Genstanden kan genkendes, men er for lille, beskåret uheldigt eller uklar i farvesættene.
- **5:** Både genstanden alene og dyret med genstanden er tydelige og tiltalende ved 64 px, fylder
  kortet godt, og de tre farvesæt er klart forskellige.

### 10. AAA-finish (alle ark, især `closeup.png`)
- **1:** Ser ud som en prototype: artefakter, uens stil, tilfældige detaljer.
- **3:** Pæn og konsistent, men mangler den sidste polering (dybde, detaljer, charme) for at kunne stå
  i en betalt top-børneapp.
- **5:** Kan stå side om side med de bedste betalte børneapps: gennemført, konsistent og
  kærligt detaljeret (fx skygge under hagen, tåliner, fnugget hale), uden en eneste fejl.

## Accept

- **Alle kriterier ≥ 4 og middel ≥ 4,3.**
- Højst 4 review-iterationer; derefter eskaleres til integratoren.
- Blind silhuettest (når flere arter findes): en frisk agent identificerer ≥ 15/16 arter.

## Svarformat (JSON)

```json
{
  "scores": {
    "recognizability48": 4, "silhouette": 5, "proportions": 5, "outline": 4, "palette": 5,
    "faceAppeal": 5, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.4,
  "pass": true,
  "issues": [
    { "criterion": "fit", "sheet": "fit.png", "at": [812, 344], "note": "Festhattens flæse overlapper venstre øre i stadie 1." }
  ]
}
```

`at` er pixelkoordinater i PNG'en (2×). Hver fejl skal være konkret nok til at kunne rettes.
