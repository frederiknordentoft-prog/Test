# Stilguide for UDFALD-rapporten

Rapporten er et mørkt A4-dokument på dansk i to dele.
- **Del I · Spillet** henvender sig til alle. Den bruger "du"-stemme, korte afsnit og screenshots.
- **Del II · Maskinrummet** henvender sig til teknikere. Den har neutral stemme, formler, regler og målinger.
- **Bilag** indeholder ordliste, kontraktnøgler, konstanter og metode.

## Sprog

- **Klart, præcist dansk.** Ingen salgssprog og ingen superlativer ("revolutionerende", "banebrydende"). Sig hvad tingen gør, og hvorfor.
- **Ærlighed:** begrænsninger og afvigelser fra planen skrives lige ud, med tal.
- **Aktiv form** og korte sætninger. Et afsnit er 2–5 sætninger.
- **Engelske fagord** kun hvor de er etablerede (stop-loss, Monte Carlo). Første gang forklares de på dansk.

## Ordforråd (låst)

- **Ord, der aldrig bruges:**
  - Skriv aldrig "øre" som prisenhed. Navnet ØRE må kun nævnes i en historisk sætning: appen hed ØRE, før den blev omdøbt.
  - Skriv aldrig "odds" som appens hovedenhed. Odds må kun nævnes som sekundær visning ("odds 2,22").
- **Prisenheder:**
  - Prisen hedder **kurs** og går fra 0 til 100. "kurs 45" betyder, at én andel koster 45 øre i rigtige penge. Skriv det som "0,45 kr", ikke "45 øre".
  - Bevægelser hedder **point** ("+29 point").
  - Sandsynlighed hedder **%** eller **chance** ("44 % chance").
- **Handel:**
  - En **andel** udbetaler 1 kr, hvis udfaldet sker, ellers 0.
  - Prisen, du køber til, er **kursen** eller **købskursen**. Prisen, du sælger til, er **salgskursen** (i koden ask og bid).
- **Funktionernes navne:** **Sikring** dækker **stop-loss** og **Sikr gevinst** (take-profit). **Parken-puljen** kan forkortes "puljen". Skærmen hedder **Mål og slutresultat** (fanen "Mål"). **Over 2,5** er kampens anden kurs.
- **Lag og mekanikker:**
  - **Handelsstop** er en pause i handlen, og **genåbning** er, når den slutter.
  - **Gab** er det spring, kursen tager ved genåbning.
  - **Substep** er det mindste tidsskridt i simulationen, 1,5 kampsekunder.
  - **Fremtidsviften:** de 100 simulerede fremtider, "stierne".
  - **Tally:** optællingen af stier ved slutfløjt.
- **Holdnavne:** FCK og BIF. Brøndby kun i fuld form første gang.

## Talformat (dansk)

- **Decimaler og tusinder:** decimalkomma og tusindtalspunktum, fx "0,946", "180.000 kr", "1.487,50 kr".
- **Procent:** mellemrum før %: "54 %".
- **Minutter:** skrives med ′: "28′". Et klokkeslæt i kampen skrives "28:46".
- **Stillinger:** tankestreg, "1–0". Spænd også: "0,5–4,5".
- **Minus:** brug det typografiske minustegn "−" i tal ("−13 point").

## Tal kommer fra faktaarket

- **Kilden:** alle tal om kampen, handlerne, kalibreringen og målingerne står i `data/fakta.json`. Indsæt dem som `{{nøgle}}`, fx `{{stop.bif.kr}}` → "61,52 kr". `build.mjs` erstatter nøglerne og fejler på ukendte nøgler.
- **Tal i koden:** marginer, konstanter og regler må skrives direkte, men kun når du har læst dem i kildefilen. Sæt `<!-- kilde: sti:linje -->` lige efter afsnittet.
- **Opfind aldrig et tal.** Findes tallet hverken i faktaarket eller i koden, skal det ikke med.
- **Data til egen beregning:** tabeller (kalibrering, MC mod DP, puljegrænsen) ligger i `data/stats.json`, og hele historien ligger i `data/story.json`. Nævner du et tal derfra, som ikke er i faktaarket, så skriv det direkte og angiv kilden i en kommentar: `<!-- data: stats.json calO25[3] -->`.

## HTML-ordforråd (fragmenter, ingen `<html>`/`<head>`)

Hver fil i `kapitler/` er et HTML-fragment. Kun disse elementer og klasser bruges:

- **Kapitelstart:** `<h1 class="kapitel" id="k6" data-nr="6">Nyt: Mål i alt og slutresultat</h1>`, hvor id og nummer følger dispositionen. Bilag bruger `data-nr="A"` osv. og `id="bA"`.
- **Indledning:** `<p class="ingress">` er 1–3 sætninger lige under h1.
- **Overskrifter:** `<h2>` og `<h3>` med egne id'er. De er korte, uden kolon-undertitler.
- **Tekst:** `<p>`. `<b>` bruges til begreber første gang. `<span class="ui">Sikring</span>` bruges til tekst, der står på skærmen, i stedet for anførselstegn. `<code>` bruges til kode-identifikatorer (kun i Del II og bilag).
- **Tekst og telefon side om side (Del I):**
  ```html
  <section class="duo">
    <div class="txt">…afsnit…</div>
    <figure class="phone" data-shot="05-sikring-linjer"><figcaption><b>Sikring i viften.</b> Koral stop ved kurs {{stop.bif.niveau}} …</figcaption></figure>
  </section>
  ```
  Hver `duo` holdes på én side, så teksten i den skal være kort: 120–220 ord.
- **2–3 telefoner på række:** `<div class="phones">` med `<figure class="phone sm" data-shot="…">`-elementer, hver med en kort `figcaption`.
- **Figurer (SVG, bygges af scripts):** `<figure class="fig" data-fig="sikring-spor"><figcaption><b>Figur:</b> …</figcaption></figure>`. Brug kun id'erne fra listen nedenfor.
- **Bokse:**
  - `<div class="callout">` er en note.
  - `<div class="callout ny">` bruges til "Nyt i denne version".
  - `<div class="callout advarsel">` bruges til begrænsninger og afvigelser.
  - Hver boks starter med `<b>Titel.</b>`.
- **Formler:** `<div class="formel">` med én formel pr. linje. Brug `<i>` til variable, `<sub>`/`<sup>`, Unicode (Σ ⌈ ⌉ ≤ ≥ ≈ · × − λ π κ τ) og `<span class="hvor">hvor …</span>` til forklaring.
- **Tabeller:** `<table class="t">` med `<thead>`. Tal står højrestillet med `<td class="n">`. Tabellerne skal holdes korte.
- **Lister:** `<ul>` og `<ol>`. Ordlisten bruger `<dl class="ord"><dt>…</dt><dd>…</dd></dl>`.
- **Anatomi (kun kapitel 3):** `<ol class="anat">` med præcis de 14 punkter i rækkefølgen herunder. Numrene tegnes på billedet automatisk.
- **Undgå:** ingen inline styles, ingen billeder ud over `data-shot`/`data-fig`, og ingen emojier.

## Anatomipunkter (kapitel 3, rækkefølge låst)

1. Kampbånd
2. Instrumenthoved (etiket og kurs)
3. Chance og odds
4. Årsagschip
5. Prislinjen og NU
6. Fremtidsviften
7. Grenmærker
8. Tally
9. Andelsbar
10. Målvejret
11. Over 2,5-chip
12. Positionskort med fader
13. Sikring-chip
14. Bundbjælke

## Figur-id'er (bygges af `figurer/*.mjs`)

| id | indhold | kapitel |
|---|---|---|
| `tidslinje` | Kampen vi følger: hvaler, mål, handelsstop, pause/puljelukning, vores køb, Sikring-udløsninger, slutfløjt | Læsevejledning |
| `kurs-chance` | Kurs mod chance: kurs = chance + husets andel; en andel betaler 1 kr | 1 |
| `skaermkort` | Kort over skærmene og navigationen | 2 |
| `system` | Arkitektur: seed → simulation → DP → markedslag → kurser → MC-stier → skærm | 12 |
| `tidsskala` | Tidsskala: substep 1,5 kampsekunder = 100 ms ved ×1; 1 kampminut = 4 s; kamp ≈ 6 min | 12 |
| `stier` | 5.000 Monte Carlo-stier stratificeres til 100, så tally = den viste chance | 14 |
| `over25-kamp` | Over 2,5 gennem kampen: fair, mid og kurs; spring ved mål; frosset i handelsstop | 6 og 16 |
| `kal-o25` | Over 2,5-kalibrering pr. decil (pris mod faktisk) med 3·SE-bånd | 16 og 20 |
| `kal-1x2` | 1X2-kalibrering (FCK) pr. decil | 20 |
| `sikring-spor` | Substep 1170–1215: BIF købs/salgskurs, Over salgskurs, niveauer, handelsstop, vagtvindue, udløsninger og kontrafaktisk salg uden vagt | 7 og 17 |
| `pulje-flow` | Puljens pengestrøm: publikum + dig → sider → 10 % hus → vinderside | 8 og 18 |
| `pulje-halvleg` | Puljen i første halvleg: odds pr. side og forventet udbytte pr. krone | 18 |
| `pulje-graense` | Grænsen 0,9·Σ(q·ℓ)/ℓᵢ som funktion af FCK's chance | 18 |
