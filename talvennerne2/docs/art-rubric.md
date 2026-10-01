# Kunst-rubrik (Talvennerne 2)

Rubrikken bruges af review-agenten, som **kun** ser kontaktarkenes PNG'er og dette dokument
(SPEC §11 pipeline pkt. 7). Reviewer er aldrig forfatteren. Arkene laves med `npm run sheets` og
ligger i `artifacts/sheets/` (taget i 2x). Ark pr. art hedder `<ark>-<art>.png` (art = `rabbit`,
`cat`, `horse`, `unicorn`); fælles ark har intet suffiks. Alle mål er i CSS-px.

| Ark | Viser |
|---|---|
| `species-<art>.png` | Pr. race: stadie · farve (idle) med stjerneformen nederst, og humør · stadie for første race. |
| `moods-<art>.png` | De 7 humør (idle, happy, cheer, think, oops, sleep, wave) store, én race pr. række, og øjne der følger et punkt. |
| `closeup-<art>.png` | Store renders (420/300 px) af alle racer: kontur, cel-skygge, øjne, finish, guld/stjernehvid, regnbue og tøj. |
| `sizes-<art>.png` | 48, 96 og 256 px (≤ 64 px tegnes med tykkere, mørkere kontur, uden hårfine streger og tæt beskåret) samt butikskort ved 64 px (genstanden alene og på dyret, beskåret efter slot). |
| `silhouettes.png` | Alle arter og racer i 3 stadier, sort fyld uden navne, nummereret i fast blandet rækkefølge. |
| `fit-<art>.png` | Genstandene på arten i 3 stadier · genstandens 3 farvesæt (racerne på skift). |
| `fitmatrix.png` | Art · stadie · genstand for alle arter (racerne skifter pr. stadie). |
| `filmstrip-<art>.png` | 8 frames pr. humør (frosset animation), blink/ørevip tæt samplet og artens signatur. |
| `lineup.png` | Alle arter og racer side om side i stadie 2 på samme jordlinje, stadierne pr. art og kropsskabelonerne. |

Arternes signaturer (SPEC §6.1): kaninen vipper med næsen, katten krøller halespidsen, hesten kaster
med manken, og enhjørningens horn glimter (kun opacity).

## Stilen, der bedømmes imod

Siddende, forfra, chibi (hovedet ca. halvdelen af figurens højde og lidt bredere end kroppen).
Flad cel-skygge: grundfarve, en halvmåne i `shade` nederst til højre og 1–2 hvide højlys med 40 %
alfa. Farvet kontur på 3,2 enheder (i viewBox 200 x 240), afledt af pelsfarven. Store, lodrette,
blanke øjne med to højlys, lyserøde kinder, lille næse. Ingen filtre, masker, gradienter på kroppen
(kun jordskyggen og regnbuens manke/hale). Varm, rolig palet på papirbaggrund (#FFF8EC).

## De 10 kriterier (1–5)

Scor hvert kriterium 1–5. 2 og 4 ligger mellem beskrivelserne.

### 1. Genkendelighed ved 48 px (`sizes-<art>.png`, række "48 px")
- **1:** Arten kan ikke bestemmes; ører, hoved og krop flyder sammen, eller ansigtet er støj.
- **3:** Arten kan gættes, men kun ud fra farve eller efter at have set den større version.
- **5:** Arten er øjeblikkeligt tydelig i alle farver og stadier; ører, øjne og silhuet står skarpt,
  og humør som glad og sover kan skelnes.

### 2. Silhuet (`silhouettes.png`)
- **1:** Silhuetten er en neutral klat; arten kan ikke læses uden farver og ansigt.
- **3:** Arten kan læses, men silhuetten er generisk, eller racerne ligner hinanden for meget.
- **5:** Hver silhuet er entydig og karakteristisk (fx kaninens ører, halekvast og store fødder);
  racerne skelnes også i sort. En frisk agent ville ramme arten i første forsøg.

### 3. Proportioner (`species-<art>.png`, `lineup.png`)
- **1:** Proportionerne er tilfældige; hovedet er for lille, eller kroppen dominerer.
- **3:** Chibi-proportioner overordnet, men stadierne skiller sig for lidt ud, eller dele (arme,
  fødder, ører) har forkert størrelse i forhold til hinanden.
- **5:** Tydelig, charmerende chibi: stort hoved, lille rund krop, lave store øjne. Baby → ung → stor
  er en klar og troværdig udvikling (babyen har størst hoved og øjne), og alle dele hænger sammen.

### 4. Kontur (`closeup-<art>.png`, `species-<art>.png`)
- **1:** Konturen er ujævn i tykkelse, har huller, dobbeltstreger eller sømme mellem dele.
- **3:** Konturen er konsistent, men der er synlige sømme (fx hvor øret møder hovedet) eller
  enkelte for tynde/tykke streger.
- **5:** Én ensartet, farvet kontur på alle dele og stadier; sømløse overgange (ører vokser ud af
  hovedet), runde samlinger, og konturfarven harmonerer med pelsen i hver farve.

### 5. Palet (`species-<art>.png`)
- **1:** Farverne er grelle, mudrede eller skærer sig; skygger er grå og døde.
- **3:** Farverne er pæne hver for sig, men nogle colorways ligner hinanden, eller skygger og
  kontur er for svage/stærke.
- **5:** Harmonisk, varm palet; hver colorway er smuk og tydeligt forskellig; skygge og kontur er
  afledt ensartet; guld og regnbue føles særlige uden at skrige; god kontrast mod papirbaggrunden.

### 6. Ansigtets appel (`closeup-<art>.png`, `moods-<art>.png`)
- **1:** Ansigtet er tomt, uhyggeligt eller skævt; udtryk kan ikke aflæses.
- **3:** Sødt i hvile, men enkelte humør er svære at læse eller virker forkerte (fx surt i stedet for
  genert).
- **5:** Uimodståeligt sødt: store, levende øjne med højlys, velplacerede kinder og næse. Alle 7
  humør læses straks, og ingen virker triste, vrede eller skyldfremkaldende (der findes ingen sad).

### 7. Pasform (`fit-<art>.png`, `fitmatrix.png`)
- **1:** Tøjet flyder, dækker øjnene, stikker ud af kroppen eller passer kun på ét stadie.
- **3:** Tøjet sidder, men med synlige fejl: hatte for høje/lave, ørerne ser forkert ud i forhold til
  hatten, eller kropstøj går uden for kroppen.
- **5:** Alt sidder naturligt på alle 3 stadier og i alle farvesæt: `through`-hatte har ørerne op
  gennem huller, `under`-hatte sidder mellem ørerne, trøjen følger kroppens kontur og ribkanten
  sidder på hoften; øjnene er altid fri.

### 8. Animation (`filmstrip-<art>.png`)
- **1:** Frames er ens, eller dele hopper fra hinanden (forkerte pivoter).
- **3:** Bevægelsen er synlig, men stiv; pivoter sidder lidt forkert, eller humørene ligner hinanden.
- **5:** Levende og troværdig: squash og stretch i hop, dele drejer om rigtige led (ører om basen,
  poter om skulderen, hovedet om halsen), blink og ørevip sker, og hvert humør har sin egen rytme.

### 9. Læsbarhed i butikskort ved 64 px (`sizes-<art>.png`, "butikskort")
- **1:** Genstanden kan ikke genkendes, eller den forsvinder i kortet.
- **3:** Genstanden kan genkendes, men er for lille, beskåret uheldigt eller uklar i farvesættene.
- **5:** Både genstanden alene og dyret med genstanden er tydelige og tiltalende ved 64 px, fylder
  kortet godt, og de tre farvesæt er klart forskellige.

### 10. AAA-finish (alle ark, især `closeup-<art>.png`)
- **1:** Ser ud som en prototype: artefakter, uens stil, tilfældige detaljer.
- **3:** Pæn og konsistent, men mangler den sidste polering (dybde, detaljer, charme) for at kunne stå
  i en betalt top-børneapp.
- **5:** Kan stå side om side med de bedste betalte børneapps: gennemført, konsistent og
  kærligt detaljeret (fx skygge under hagen, tåliner, fnugget hale), uden en eneste fejl.

## Accept

- **Alle kriterier ≥ 4 og middel ≥ 4,3.**
- Højst 4 review-iterationer; derefter eskaleres til integratoren.
- Blind silhuettest: en frisk agent identificerer arten for hver silhuet (≥ 15/16 når alle 16 arter
  findes; med de 4 helte-arter skal alle racer og stadier rammes).
- Hver art bedømmes for sig (scores pr. art), og alle arter skal bestå.

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
    { "criterion": "fit", "sheet": "fit-cat.png", "at": [812, 344], "note": "Festhattens flæse overlapper venstre øre i stadie 1." }
  ]
}
```

`at` er pixelkoordinater i PNG'en (2x). Hver fejl skal være konkret nok til at kunne rettes.
