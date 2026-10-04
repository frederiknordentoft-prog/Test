# Piktogrammer runde 2: review (REVP)

Reviewer: REVP (uafhængig, har ikke tegnet noget af kunsten)
Dato: 2026-10-04
Emne: PIKTO's rettelser efter `pikto-r1.md` på `tv2/pikto` (HEAD b08b44d). Runde 2 er sidste iteration.

Rettelserne ligger i tre commits:
- b313d90 holder fluebenet på skærmen på liggende telefon,
- e88250d retter det overstregede svar i fejlflowet,
- b08b44d retter tegningerne.

## Resultat: bestået

- **Rettet:** Fem af de seks punkter fra runde 1 er rettet, også det blokerende overlap i fejlflowet.
- **Delvist rettet:** Overstregningen holder sig nu i sin boks, men dækker stadig et ord.
- **De nytegnede ting:** Skoen, bussen og kammen er tydeligt bedre og genkendes sikkert ved 46 og 78 px. Det er ikke testet blindt, for jeg kender nøglen.
- **Stil:** Alle 12 ting ligger nu på 4 eller derover, middel 4,25.
- **Fluebens-rettelsen:** Fluebenet bliver på skærmen, og telefon på højkant og iPad er uændrede. Den har én lille bivirkning: på se-l går de rumlige figurer lidt ud over de smallere kort.
- **Nye fund:** Ingen er blokerende. De står sidst med konkrete rettelser.

## Grundlag

- **Kode:** `git diff c1e49b4..b08b44d` i `/home/user/wt/pikto/talvennerne2`, dvs. `task.css`, `objects.tsx` og `examples.ts`.
- **Billeder i `artifacts/pikto/r2/`:**
  - `things12-{24,30,46,78,104}.png`, `thing-*.png` og `sheet.png`,
  - 18 skærmbilleder: ask, teach og teach6 i 6 viewports,
  - `audit.json` og `teach/teachcheck.json`.
- **Billeder i `artifacts/pikto/sel/`:**
  - before/after-billeder med `after.json` og `after-part.json`,
  - `sel/real/` med `before.json`, `after-part.json` og billederne.
- **Pixel-sammenligninger:** r1- mod r2-skærmbillederne og `sel/before-*` mod `sel/after-*`.

## Status pr. punkt fra runde 1

| # | Punkt | Status | Belæg |
|---|---|---|---|
| 1 | Blokerende: seks overstregede kort over strategiteksten på liggende telefon | Rettet | I `r2/teach6-se-l.png` og `r2/teach6-x-l.png` står boksen til højre for teksten, og kortene brydes 4 + 2. Intet dækker teksten. `audit.json` har nu et overlap-tjek og melder `overlaps: []` i alle 18. `teach/teachcheck.json` finder hverken overlap, klipning eller knap uden for skærmen i 17 andre harness-eksempler (14 opgavetyper) i se-l, x-l og se-p. |
| 2 | Overstregningen | Delvist rettet | Stregen er klippet til sin boks og når ikke længere strategiteksten eller knapperne (`teach6-ipad-l`, `teach6-se-l`). Til gengæld går den flade streg nu gennem midten af kortene og dækker et ord i hvert overstreget svar. Det gælder "et skib" i `teach-se-l` og `teach-x-l`, og "blyant" i teach6 på højkant og iPad (mest i `teach6-ipad-l`). |
| 3 | Skoens sål | Rettet | Sålen følger overdelen, buer op i tåkappen og har skoens mørkerøde kontur. Den læses ikke længere som en skøjte (`things12-46/78`). |
| 4 | Bussens front | Rettet | Kassen er længere og lavere og har skrå front med forrude, dør med to høje ruder, forlygte og hjul nær enderne. Den ligner ikke længere en togvogn. |
| 5 | Kammen | Rettet | Kammen er lilla (MAT.counterA), har kontur 2,4 og 6 tænder på 3,6 med lige så brede mellemrum. Tænderne holder sig adskilt ned til 24 px (`things12-24`). |
| 6 | Små størrelser og vandet | Rettet | Gaffel og ske har nu kontur 2,4. Broens bue-ring, hver anden stolpe, husets sprosser og dørgrebet er markeret som `.tv-fine` og skjules i `is-sm` (`things12-24/30`). Vandet under skib og bro holder sig inden for x 2–46, har afrundede ender og mørkeblå kontur. |

## Skoen, bussen og kammen ved 46 og 78 px

Vurderingen er ikke blind. Procenterne er mit skøn over, hvor sikkert tingen genkendes.

| Ting | 46 px | 78 px | Stil r1 → r2 | Note |
|---|---|---|---|---|
| sko | sikker (ca. 95 %) | sikker (ca. 98 %) | 3 → 4 | Én sammenhængende høj gummisko, hvor sål og tåkappe har samme kontur. Skøjte-læsningen er væk. Hælen er lidt kantet, ellers er den i stil med nabomaterialerne. |
| bus | sikker (ca. 94 %) | sikker (ca. 97 %) | 4 → 4 | Den skrå forrude, lygten og døren gør den til en bus med tydelig front. Den kan ikke forveksles med lastbilen (gul kasse mod orange lad og blåt førerhus). Dørens to ruder er smalle streger ved 46 px, men læses som en dør. |
| kam | sikker (ca. 92 %) | sikker (ca. 96 %) | 4 → 4 | En klar kam med seks brede tænder, og den har ikke længere regnormens farve. Den lilla farve med næsten sort kontur (#37008C) gør den til sættets tungeste ting, og farven ligger tæt på appens primærfarve. Det skader ikke læsningen. |

Stil for alle 12 i runde 2: fly 4, sko 4, skib 4, hval 5, tog 4, ske 4, lastbil 5, kam 4, bro 4, hus 5, gaffel 4, bus 4. Middel er 4,25.
- Det nye vand er konsekvent med resten.
- Under skibet ligner den afrundede vandstrimmel dog en lille sokkel. Det skader ikke genkendelsen.

## Fluebens-rettelsen på liggende telefon (b313d90)

**Afgrænsning:**
- Alle regler ligger i `@media (orientation: landscape) and (max-height: 500px)`.
- Delen for multiSelect gælder kun op til 800 px bredde, altså se-l og ikke x-l.
- **Telefon på højkant og iPad er uændrede.** Jeg har sammenlignet r1- og r2-ask-skærmbillederne i se-p, x-p, ipad-p og ipad-l pixel for pixel. Forskellene er kun de nye eller ændrede tegninger (ske, skibets vand, bus og kam) og fremskridtsstenene. Kort og knapper står samme sted.

**De 13 opgaver, hvor fluebenet lå uden for skærmen:** Alle har nu fluebenet på skærmen.
- coinNames, shapes3D og unitChoice: `sel/real/after-part.json`.
- placeValue1000 i se-l og x-l samt numberLine100 og numberLine1000: billederne i `sel/real/`.

**Harness-billederne i `sel/`:**
- Layoutet har kun ændret sig i fillSlots (fill-fraction, fill-pattern, fill-skip), i numberline (line-37, line-600, line-after7) og i multi-unit på se-l. De andre forskelle er kun fremskridtsstenens animation.
- I de ændrede billeder er kort, brikker og knapper læsbare, intet er beskåret, og fluebenet er på skærmen.
- `r2/ask-se-l` har seks kort på 80 px og flueben på 60 px. Det er præcis SPEC'ens minimum (svarkort ≥ 80, trykmål ≥ 60), men opfyldt.

**Bivirkninger og huller:**
- **shapes3D på se-l (lille bivirkning).** Kortene er nu 80 px brede mod 82 før. Derfor går kassen og skyggerne under pyramiden og kassen nogle px ud over kortkanten (`sel/real/after-real-shapes3D-multiSelect-0-se-l.png`). Før var det kun kassens skygge, og kun en smule.
- **Forældede efter-billeder.**
  - `sel/real/after-real-{halfShape,shapes2D,sortShapes,symmetry}-*.png` er taget kl. 10:46–10:47. Det er før den endelige afgrænsning med `:not(.is-owned)`, og de viser derfor en mellemtilstand. I `after-real-sortShapes-multiSelect-0-se-l.png` er tredje række fx skåret af nederst, og fluebenet mangler.
  - `after-part.json` (11:01) viser fluebenet samme sted som før for alle fire. CSS'en rammer dem ikke, fordi de ejer deres prompt. Den endelige tilstand er altså uændret, men der findes ingen billeder af den.
  - `sel/after.json` (10:46) melder stadig multi-triangles på se-l som DELVIST. `after-part.json` afløser den.

## Nye fund og rettelser (ingen er blokerende)

1. **Overstregningen dækker et ord** (resten af punkt 2).
   - *Ret sådan:* Gør stregen over kortrækker tyndere og delvis gennemsigtig, fx 3 px og `opacity: .7`. Alternativt kan den lægges i højde med billederne i stedet for ordene, så ordet under kan læses.
2. **shapes3D på se-l.**
   - *Ret sådan:* Lad figuren skalere med kortet i samme media query, fx `max-width: calc(100% - 8px); height: auto` på figurens svg. Alternativt kan de rumlige figurer gøres ca. 10 % mindre ved 80 px.
3. **Dokumentationen af fluebens-rettelsen.**
   - *Ret sådan:* Tag de fire efter-billeder af halfShape, shapes2D, sortShapes og symmetry om på b313d90, og lad `after.json` afspejle den endelige tilstand.
4. **Eksisterende problem, til integratoren og uden for denne runde.**
   - *Problem:* unitChoice' vægtvariant (gram/kilogram) har kun ordkort, fordi vægt-tingene ikke har billeder. På se-l er kortene 80 px brede. "en kuffert" klippes til "en kuffer", og "et jordbær" løber ud over kortet. Det ses ens før og efter i `sel/real/{before,after}-real-unitChoice-multiSelect-1-se-l.png`. Det er samme problem som QA2 P3-8 for børn, der ikke kan læse.
   - *Ret sådan:* Tegn piktogrammer til vægt-tingene på samme måde. Indtil da skal ordet kunne krympe i de smalle kort, fx med en mindre skriftstørrelse for ordkort i `@media (orientation: landscape) and (max-height: 500px)` eller med container-enheder på kortet.
5. **Restrisiko.**
   - *Problem:* CSS'en for det overstregede svar (e88250d) gælder alle opgavetyper og alle skærme, men `teachcheck.mjs` dækker kun se-l, x-l og se-p.
   - *Ret sådan:* Tilføj x-p, ipad-p og ipad-l til `teachcheck.mjs`.
