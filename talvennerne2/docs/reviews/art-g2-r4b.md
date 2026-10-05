# Kunst-review G2-r4b: ARTFIX-F's rettelser af T16, T17 og stjernestaven

- **Reviewer:** REV8, samme reviewer som i G2-r4. Jeg er ikke forfatteren af kunsten.
- **Opgave:** et målrettet tjek af to WIP-commits oven på 16bc9e4:
  - 9d9a930: T16 (pandaen holder skjoldet foran armen) og T17 (vædderens skjold står under øret),
  - 1e464fd: stjernestaven står foran forbenet på de høje kroppe.
- **Grundlag:**
  - Alle ark er genereret i `/home/user/wt/rev8/talvennerne2/artifacts/sheets/` 5. okt. 2026 kl. 09:24–09:38 UTC fra 1e464fd. Arkene er lavet med `npx vite build --mode sheets` og `SHEETS_PORT=4363 node scripts/sheets.mjs`, med Chromium bag `flock`.
  - Alle 87 sider gav "ok", og `lint.json` har 0 fejl.
  - `silhouettes.png` er pixelidentisk med blindarket `sheet-r8.png` (SHA-256 `5e6d035e…781779e7` for begge). Silhuetterne bærer intet tøj, så der er ingen ny blindtest.
  - **Før og efter:** Jeg har gemt mine G2-r4-ark (fra f0f0cc4) og sammenlignet dem pixel for pixel med de nye. Kunsten i f0f0cc4 er den samme som i 16bc9e4: mellem dem er kun `src/dev/design/MaterialsPage.tsx` og `src/dev/tasks/examples.ts` ændret, og ingen af dem indgår i arkene.
  - **Ekstra optagelse:** Vædderen i stadie 1–3 med skjoldet i alle 7 humør. Den findes ikke på arkene, så jeg har tegnet den med `Rig` på dev-serveren (port 4363). Optagelsen ligger lokalt i REV8's scratchpad og er ikke committet.
- **Uafhængighed:**
  - Kunstens kode har jeg ikke læst, med én undtagelse: diff'en af `ridder-hand.tsx` i 9d9a930. Den har jeg læst for at se, hvilke humør T17 gælder for.
  - Ud over det har jeg kun åbnet kode for at betjene værktøjerne. Til den ekstra optagelse har jeg set, hvordan `SheetApp.tsx` giver tøj til `Rig`, og hvad modulerne eksporterer som standard.
  - Forfatterens udsnit i `artfixf/…/4c/` har jeg ikke åbnet.
  - Tallene for synlig andel er mine egne målinger. Metoden er den samme som i G2-r4, men nu tæller skjoldets lyse felter med (de hvide felter i farvesæt 1). Derfor er G2-r4-tallene nedenfor målt igen med samme metode.
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x0–x1, y0–y1). Systemet står i bilag A.

## Resultat

**Gate G2-r4b: bestået.**

| Krav | Resultat |
|---|---|
| T16 og T17 opfylder kravet om mindst 3/4 synligt | Ja. Pandaen: 86–94 % i alle 9 celler. Vædder · stadie 2: 78 %. |
| Staven har ingen nye fejl | Ja. Én iagttagelse om grebet (O1), som ikke er en fejl. |
| Ridder og Talmagiker har pasform og butikskort ≥ 4 | Ja. Ridder 4 og 4, Talmagiker 4 og **5**. |
| Ingen art falder under 4 på noget kriterium | Ja. |

| Sæt | Pasform | Butikskort | Begrundelse |
|---|---|---|---|
| Ridder | 4 (uændret) | 4 (uændret) | T16 og T17 er rettet, så skjoldet sidder rigtigt på alle 12 arter. Til 5 mangler to ting. På pasformen er det T5 (de lige ærmer på hest og enhjørning gælder også våbenkjortlen, `fit-horse.png` (1792–2028, 8332–8608)). På kortene er det B17 (rævens skjoldkort). |
| Talmagiker | 4 (uændret) | **5** (r4: 4) | Skaftet ses nu på kortene for de høje kroppe. I G2-r4 (§2.3 og §5) var det det eneste, der skilte kortene fra 5. Pasformen holdes på 4 af T5. |

| Art | Berørte kriterier | Score | Middel |
|---|---|---|---|
| Panda | Pasform (7) og butikskort (9) | 4 og 4 (uændret) | 4,4 |
| Kanin | Pasform (7) og butikskort (9) | 4 og 4 (uændret) | 4,5 |

- Pandaen og kaninen hæves ikke til 5. T16 og T17 var forbehold inden for 4, og pasformen holdes også af de kendte begrænsninger for andre genstande.
- Kat, hvalp, hest, enhjørning og ræv er kun berørt gennem Talmagikerens stav. Deres butikskort-score dækker alle sæt og forbliver 4. Ingen arts scores ændres.

**Status pr. punkt:**

| Punkt | Status |
|---|---|
| T16, pandaens skjold | **Rettet.** |
| T17, vædderens skjold i stadie 2 | **Rettet**, kun lige over kravet. |
| Stjernestaven på de høje kroppe | **Rettet.** |
| B17, rævens skjoldkort | **Kendt, ikke lavet.** |
| Regression | **Ingen.** Kun de 72 nævnte hashes og de forventede celler er ændret (§5). |

## 1. T16: pandaens skjold

**Grundlag:**
- `fit-panda.png`:
  - rækken "ridder-hand" (y0 = 8894), alle 9 celler,
  - rækken "ridder · hele sættet" (y0 = 17226),
  - Ridder baby og stor i alle humør (y0 = 22076 og 22374).
- `fitmatrix-ridder.png`, panda 1–3: kolonnen "hånd" (1482–1694, 8056–8868) og kolonnen "hele sættet" (1726–1938, samme rækker).
- `sizes-panda.png`, Ridder "på dyret", kort 16–18 (2404–2844, 3696–3824).

**Synlig andel af skjoldet** (mine målinger):

| | Farvesæt 0 | Farvesæt 1 | Farvesæt 2 | G2-r4 (samme metode) |
|---|---|---|---|---|
| Stadie 1 | 91 % | 94 % | 94 % | 82 % |
| Stadie 2 | 94 % | 92 % | 92 % | 71–72 % |
| Stadie 3 | 87 % | 86 % | 86 % | 54–55 % |

Forfatterens tal (93,9 / 90,7 / 87,2 %) passer med mine. Den laveste celle er 86 % (stadie 3, farvesæt 1 og 2).

**Det ser jeg:**
- **Grebet:** Skjoldet ligger nu over den hvilende arm, og poten ligger over skjoldets nederste venstre hjørne. Det læses som et skjold, pandaen holder foran sig. Det ligner hverken et kram bagfra eller en mørk klat.
  - Det gælder også den sorte (c1) og den lilla panda. Her er poten mørk, men den har sin lyse kontur og læses som en pote.
  - Tydeligst i stadie 3 (1792–2540, 8894–9170).
- **Med kjortel** (Ridder · hele sættet og humørrækkerne): Skjoldet ligger også over ærmet, og poten griber om hjørnet. Sammenlign G2-r4 og nu i (2048–2284, 17226–17502).
- **I jubel, tænker, ups og vinker** følger skjoldet den løftede pote som før. Kun hvile, glad og sover er ændret.
- **Øjnene er fri** i alle celler og humør.
- **Kortet:** Ca. 90 % af skjoldet ses (G2-r4: ca. 2/3), og skjoldet fylder 60 % af kortet.

**Rettet.**

## 2. T17: vædderens skjold i stadie 2

**Grundlag:**
- `fit-rabbit.png`, "ridder-hand", stadie 2 · farvesæt 1 · vædder (1280–1516, 8926–9202). Til sammenligning stadie 1 (512–748, 8926–9202) og stadie 3 (2048–2284, 8926–9202).
- `fitmatrix-ridder.png`, kanin · 2 (1482–1694, 568–804).
- `sizes-rabbit.png`, kort 17 (2560–2688, 3696–3824).
- Min ekstra optagelse af vædderen i alle humør.

**Det ser jeg:**
- **Synlig andel:** 78 % (G2-r4: 65 % med samme metode, forfatteren: 77,2 %). Kravet er opfyldt, men kun lige.
  - Hængeøret ender lige over skjoldets øverste højre hjørne, og poten ligger på skjoldets øverste venstre kant som greb.
  - Stadie 1 er på 78 % og stadie 3 på 88 %. Ingen af dem er ændret.
- **Ved siden af stadie 1 og 3:** Skjoldet sidder lidt lavere, ved hoften med spidsen ved foden. Det ser naturligt ud og som samme stilling. Forskellen i højde ses kun, når cellerne står side om side.
- **Kortet:** Skjoldet fylder 56 % og kan straks genkendes.
- **Andre humør (min ekstra optagelse):** I hvile, glad og sover sidder skjoldet lavt som i fit-rækken. I jubel, tænker og vinker følger det poten som i stadie 1 og 3. "Ups" står i O2.

**Rettet.**

## 3. Stjernestaven på de høje kroppe

**Grundlag:**
- `fit-<art>.png` for kat, hvalp, hest, enhjørning og ræv:
  - "talmagiker-hand" (y0 = 10712 for kat, hest og enhjørning og 10680 for hvalp og ræv), alle 9 celler,
  - "talmagiker · hele sættet" (y0 = 17556 og 17524),
  - Talmagiker baby og stor i alle 7 humør (y0 = 22704/22672 og 23002/22970).
- `sizes-<art>.png`, Talmagiker "på dyret", kort 16–18 (2404–2844, 3848–3976).

**Det ser jeg:**
- **Skaftet foran benet:** Ja, i alle 45 hånd-celler og i hvile, glad og sover i humørrækkerne. Hos ræven er det kun hvile og sover, fordi den løfter poten i glad.
  - Skaftet går skråt fra stjernen i brysthøjde ned over forbenet til poten eller hoven, og den lyse endedup ses.
  - Eksempler: `fit-horse.png` (1792–2028, 10712–10988) og `fit-fox.png` (2304–2540, 10680–10956).
- **Enden ved poten:** Endedutten står på poten eller hoven ved jorden. Det læses, som at dyret holder staven nede ved foden og lader den hvile mod benet. Ingen del af poten ligger over skaftet (A17's "hånddel"), men ved 1x og 64 px ser det ikke forkert ud. Se O1.
- **Øjnene er fri:** Ja. Stjernen sidder under hovedet i alle stadier, også hos babyen, og overlapper hverken hoved eller mule (fx `fit-horse.png` (256–492, 10712–10988)).
- **Ingen nye fejl:**
  - Skaftet stikker ikke forkert ud. Endedutten slutter ved jordlinjen, i højde med poternes og hovenes underkant, og hull-lint'en er grøn.
  - De løftede stillinger (jubel, tænker, ups og vinker) er uændrede.
- **Kortene:** Staven kan nu genkendes som en stav på alle fem arter, med stjerne, skaft og endedup. Genstanden fylder ca. 57 % af kortets højde (G2-r4: 36–45 %, kun stjernen). De tre farvesæt er klart forskellige.

**Rettet.**

## 4. B17: rævens skjoldkort (kendt, ikke lavet)

- `sizes-fox.png`, Ridder "på dyret", kort 16–18 (2404–2844, 3696–3824): Skjoldet fylder stadig ca. 45 %. Det er som i G2-r4.
- Forfatterens grund: `HAND_CARD` er fælles for alle håndkort, og `'wide'`-beskæringen bruges kun i kontaktarkene.
- Det holder Ridderens butikskort på 4. Det blokerer ikke gaten.
- **Ret sådan (senere):** Giv ræven en artsspecifik beskæring af håndkortet, der går tættere om skjold og pote, så skjoldet fylder mindst 55 %. Tilføj også en lint for kortene "på dyret" (genstandens største udstrækning mindst 50 %), så tilfældet fanges automatisk.

## 5. Regression

**Snapshots:** `git diff 16bc9e4..1e464fd -- '*.snap'` rører kun to filer: 72 nøgler er ændret, og ingen er tilføjet eller fjernet.

| Fil | Nøgler | Fordeling |
|---|---|---|
| `items/ridder/…/items.test.tsx.snap` | 13 | Panda 12 (`idle`, `happy`, `sleep` og `std/1–3/0–2`) og kanin 1 (`lop/2/1`). |
| `items/talmagiker/…/items.test.tsx.snap` | 59 | Kat, hvalp, hest og enhjørning 12 hver, og ræv 11 (ikke `happy`). |

Artssnapshottet (`regression.test.tsx.snap`) og alle andre genstandes snapshots er uændrede.

**Pixel for pixel mod G2-r4** (alle fit-, sizes- og fitmatrix-ark med en grænse på 24 pr. kanal):

| Ark | Ændret |
|---|---|
| `fit-panda.png` | Ridder-hand (9 celler), Ridder · hele sættet (9) og Ridder baby og stor i hvile, glad og sover. |
| `fit-rabbit.png` | Ridder-hand og Ridder · hele sættet, kun vædder · stadie 2. |
| `fit-cat`, `fit-puppy`, `fit-horse`, `fit-unicorn` og `fit-fox` | Talmagiker-hand (9), Talmagiker · hele sættet (9) og Talmagiker baby og stor i hvile, glad og sover (ræven kun hvile og sover). |
| `sizes-*.png` | Kun håndkortene "på dyret": Ridder hos pandaen (16–18) og kaninen (17), og Talmagiker hos de fem høje kroppe (16–18). |
| `fitmatrix-ridder.png` | Kanin · 2 og panda 1–3, kolonnerne "hånd" og "hele sættet". |
| `fitmatrix-talmagiker.png` | Kat, hvalp, hest, ræv og enhjørning 1–3, kolonnerne "hånd" og "hele sættet". |

**Pixelidentiske:**
- fit- og sizes-arkene for pindsvin, lam, hamster, egern og ugle,
- fitmatrix-arkene for de 7 andre sæt,
- Ridder-hand-rækkerne på de høje kroppe,
- alle andre sæts håndgenstande.

Uglen, skjoldet på de høje kroppe og de andre sæts håndgenstande er altså nøjagtig som i G2-r4.

## 6. Iagttagelser (ingen scoreændring, uden for gaten)

**O1. Stavens greb på de høje kroppe har ingen hånddel.**
- Endedutten står ved poten, men ingen del af poten eller hoven ligger over skaftet. A17 beskriver, at "en rem eller hånddel viser grebet".
- Det læses fint som at holde staven, så det er ikke en fejl.
- **Valgfrit:** Lad tæerne eller kanten af hoven ligge over endedutten, eller giv staven en lille kvast eller rem om poten.

**O2. I de løftede humør står håndgenstanden delvist bag hovedet.**
- Håndgenstande tegnes før hovedet. Når poten er oppe ved hovedet (ups, delvist jubel og vinker), dækker hoved, øre eller manke derfor en del af skjoldet.
- Tydeligst hos vædderen i ups. Her er ca. halvdelen af skjoldet skjult bag hængeøret i alle tre stadier (min ekstra optagelse, ikke på arkene). Det ses også hos løvehovedbabyen i ups (`fit-rabbit.png` (1280–1516, 22108–22384)).
- Det er ikke ændret i denne runde, og det er korte animationsstillinger.
- **Ret sådan (senere):** Hold håndgenstanden under hagen i ups, som i tænker, eller drej den ud forbi øret hos arter med hængeører og manke.

## 7. Rettelser i prioriteret rækkefølge

Gaten er bestået. Tilbage står:

1. **B17:** artsspecifik beskæring af rævens håndkort og lint for kortene "på dyret" (§4).
2. **O2:** håndgenstanden i ups (§6).
3. **O1:** en hånddel på stavens greb (valgfrit, §6).

## Bilag A: koordinatsystem

- **`fit-<art>.png`:**
  - Kolonnerne har x0 = 256 + 256 · (k − 1), og felterne er 236 × 276.
  - I genstandsrækkerne er k = 1–3, 4–6 og 7–9 stadie 1, 2 og 3, i farvesæt 0, 1 og 2. Racerne skifter med farvesættet: farvesæt 1 er race 2 (kaninens vædder).
  - I humørrækkerne er k = 1–7 hvile, glad, jubel, tænker, ups, sover og vinker.
  - Rækkernes y0 for kanin, kat, hest og enhjørning er givet først. For de andre arter er de 32 px mindre (givet efter skråstregen):
    - Ridder-hand: 8926 / 8894,
    - Talmagiker-hand: 10712 / 10680,
    - Ridder · hele sættet: 17258 / 17226,
    - Talmagiker · hele sættet: 17556 / 17524,
    - Ridder baby og stor: 22108 og 22406 / 22076 og 22374,
    - Talmagiker baby og stor: 22704 og 23002 / 22672 og 22970.
- **`fitmatrix-<sæt>.png`:**
  - Kolonnerne har x0 = 262 + 244 · (c − 1), hvor c = 6 er hånd og c = 7 er hele sættet.
  - Rækkerne har y0 = 280 + 288 · r. Kanin er r = 0–2, kat 3–5, hvalp 6–8, hest 12–14, ræv 18–20, enhjørning 24–26 og panda 27–29.
- **`sizes-<art>.png`:**
  - Kort k har x0 = 64 + 156 · (k − 1) og er 128 × 128. Kort 16–18 er håndkortene i farvesæt 0, 1 og 2.
  - "På dyret" har y0 = 3696 (Ridder) og 3848 (Talmagiker). "Alene" har y0 = 2244 og 2396.
