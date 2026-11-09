# STELLA NOVA — Game Design Document

UI-demo af en casinoautomat. Ingen backend, ingen rigtige penge. Alt – grafik, animation, lyd og matematik – er lavet i kode uden eksterne assets.

## 1. Pitch

> 11. november 1572 ser Tycho Brahe en ny stjerne tænde i Cassiopeia. Han kalder den *stella nova*. Automaten er hans himmelmaskine: et messing-astrolabium, hvor ædelsten og himmellegemer sidder i fire ringe om en glødende stjerne.

**Ét udsagnsord: at bringe på linje.** Spinnet bringer tilfældigt på linje. Spilleren bringer bevidst på linje med ét træk.

### Søjler

1. **Ringe, ikke hjul.** Brættet er 4 koncentriske ringe × 8 eger i ægte 3D. Topologien er ny, men reglen er til at forstå på ti sekunder.
2. **Dit træk.** Efter hvert spin må spilleren dreje én ring ét hak. Fuld information, ét valg, direkte manipulation med klik og haptik. Det er automatens signatur.
3. **Urværket lever.** Hver gevinst får hele mekanismen til at tikke ét hak. Kædereaktioner er synlig mekanik, ikke magi.
4. **Ærlig spænding.** Alt, hvad man ser, er den rigtige position. Ingen fabrikerede næsten-gevinster, og små gevinster under indsatsen fejres ikke som sejre.
5. **AAA uden assets.** Shadere, procedurel geometri, partikler, bloom og syntetiseret lyd.

## 2. Brættet

- `RINGS = 4`, `SPOKES = 8`. Ring 0 er inderst. Eger 0 peger mod nord (væk fra kameraet), og egerne tælles med uret set oppefra.
- 32 celler: `grid[ring][spoke]`.
- I midten sidder stjernen. Den er kilden til alle gevinster og er samtidig Nova-måleren.
- Hver ring kan dreje om centrum. +1 hak flytter alle ringens symboler én eger med uret.

### Symboler

| Id | Nøgle | Navn | Type | Silhuet | Farve |
|---|---|---|---|---|---|
| 0 | sapphire | Safir | lav | rund brillant | blå |
| 1 | emerald | Smaragd | lav | smaragdslib (lang ottekant) | grøn |
| 2 | amethyst | Ametyst | lav | trillion (trekant) | violet |
| 3 | ruby | Rubin | lav | rombe | rød |
| 4 | moon | Måne | høj | sølvkugle med kratere | sølv |
| 5 | jupiter | Jupiter | høj | båndet kugle | orange/creme |
| 6 | saturn | Saturn | høj | kugle med bred ring | sand/lilla ring |
| 7 | sun | Sol | høj | flammende kugle med korona | guld |
| 8 | wild | Stella Nova | wild | ottetakket stjerne | hvidguld |
| 9 | scatter | Komet | scatter | iskerne med hale | iscyan |

Hvert symbol kan kendes på silhuetten alene, ikke kun på farven.

## 3. Regler

### 3.1 Spin

1. Spilleren trykker SPIN. Indsatsen trækkes.
2. Ringene hvirvler (ring 0 og 2 med uret, ring 1 og 3 mod uret) og stopper indefra og ud.
3. Hver celle får et symbol fra ringens vægtede fordeling. Højst én komet pr. ring.

### 3.2 Gevinst

- En **linje** er en eger læst fra ring 0 og udad.
- Linjen betaler, når de første **3** (ring 0–2) eller alle **4** celler viser samme symbol. Wild erstatter alle symboler undtagen komet.
- Linjens symbol er det første ikke-wild symbol. Rene wild-linjer betaler som Sol.
- Alle 8 eger er altid aktive. Gevinster angives som multipla af den samlede indsats.
- En komet bryder linjen.

### 3.3 Kædereaktion

Efter hver evaluering med gevinst:

1. Gevinsten udbetales med den aktuelle multiplikator.
2. Cellerne i gevinstlinjerne splintres. Støvet flyver ind i stjernen: +1 Nova-ladning pr. celle.
3. Nye symboler falder ned i de tomme celler (ingen kometer i genopfyldning).
4. **Urværket tikker:** hver ring drejer ét hak i sin egen retning (`RING_DIR = [+1, −1, +1, −1]`).
5. Multiplikatoren stiger ét trin på stigen, og brættet evalueres igen.

Multiplikatorstigen nulstilles ved hvert nyt spin. Kometer splintres aldrig.

### 3.4 Dit træk (nudge)

- Når kæden er død, og trækket ikke er brugt i dette spin, beregner motoren alle 8 træk (4 ringe × 2 retninger).
- Giver mindst ét træk gevinst, venter spillet på spilleren: træk en ring ét hak, eller spring over.
- Giver intet træk gevinst, springes fasen over uden ventetid.
- En gevinst skabt af trækket fortsætter på samme multiplikatortrin, og kæden kører videre.
- Ét træk pr. spin (også pr. gratisspin).
- **Auto-juster** vælger det træk, der giver størst øjeblikkelig gevinst (lighed: laveste ring, derefter med uret). RTP angives for denne strategi.

### 3.5 Stella Nova

- Ladningen går på tværs af spins. Når den når tærsklen, og kæden er død, udløses novaen før et eventuelt træk.
- Alle celler på ring 0 og 1 bliver wild (kometer undtaget). Dermed betaler alle egere uden komet mindst 3 ens af symbolet på ring 2.
- Ladningen nulstilles. Højst én nova pr. spin.

### 3.6 Kometnat (gratisspil)

- 3 kometer på det første stop i grundspillet giver 8 gratisspil, 4 giver 12. Udløses efter spinnets gevinster.
- Under Kometnat er **ring 0 en evig krans af wilds**. De splintres ikke.
- Kometer kan lande på ring 1–3. 2 kometer giver +2 spins, 3 giver +5.
- Træk, kædereaktion og Nova virker som i grundspillet. Indsatsen er den, runden blev udløst på.

### 3.7 Loft

Maksimal gevinst pr. spin er 5.000× indsatsen. Nås loftet, slutter spinnet.

## 4. Matematik

Ejet af `src/math`. Udfaldet kommer kun fra motorens seedede RNG (`sfc32`). Præsentationen bruger en separat kosmetisk strøm.

### Mål for kalibreringen

| Størrelse | Mål |
|---|---|
| RTP med auto-juster | 96,0 % ± 0,15 (≥ 50 mio. spins) |
| RTP uden træk | rapporteres |
| Træfprocent (alle gevinster) | 38–52 % |
| Andel spins med gevinst ≥ indsats | rapporteres, gerne ≥ 18 % |
| Kometnat | 1 ud af 120–200 spins |
| Stella Nova | 1 ud af 50–90 spins |
| Andel af RTP fra Kometnat | 20–30 % |
| Standardafvigelse | 5–10 indsatser |
| Stige | starter ×1, stiger monotont, f.eks. 1·2·3·5·8·12·20 |

Udbetalinger er multipla af 0,1 × indsats, så alle indsatsniveauer giver hele øre. Paytablen er monoton: højere symbol betaler mere, 4 ens betaler mere end 3 ens.

### Drum-roll (anticipation)

Må kun afspejle reel mulighed på de ringe, der allerede står stille:

- Ring 2 får drum-roll, hvis ring 0–1 danner et par af Saturn, Sol eller wild på mindst én eger, eller hvis der allerede ligger 2 kometer.
- Ring 3 får drum-roll, hvis ring 0–2 danner 3 ens af et højt symbol på mindst én eger, eller hvis der ligger 2 kometer.

### Demo-rigs

Demo-menuen kan tvinge næste spin: `nova`, `freeSpins`, `bigWin`, `megaWin`, `supernovaWin`, `chain`, `nudgeWin`, `dead`. Rigs findes kun i demoen og er tydeligt mærket.

## 5. Art bible

**Identitet: renæssanceinstrument i dybt kosmos.** Varmt messing og hvidguld mod koldt nattehimmelblåt. Ædelsten lyser indefra. Alt andet er roligt, så brættet kan læses.

### Palet (`PALETTE` i `core/config.ts`)

- Nat: `#03050d`, `#070b1c`, `#0d1433`. Tåger: teal `#17606e`, violet `#4a2a78`, rosa `#8a3a6a` (Kometnat).
- Messing: `#b8923f`, lys `#f2d488`, mørk `#5a3f17`. Guld: `#ffcf5a`.
- Emalje: `#0a1230`, lys `#16245a`.
- Stjerne: kerne `#fff8e6`, varm `#ffc46b`, hed `#ff8a3c`. Komet: `#6fe7ff`.
- UI: tekst `#f4ecd8`, dæmpet `#9aa3c0`, guld `#e8c66a`.

### Instrumentet

- Ringene er **mørkeblå emalje i messingfatning**: emaljen giver kontrast til symbolerne, messingkanterne fanger lyset. Aldrig blankt messing bag et guldsymbol.
- Indgraveringer: gradskala, stjernekort, alkymistiske tegn. Fatninger ved hver celle.
- Ringene ligger i svagt forskellige højder, så parallaksen kan ses, når kameraet bevæger sig.
- Yderst en fast messingkrans med 8 egermarkører og dyrekredsens tegn.
- Under ringene en bundplade med stjernekort og langsomt drejende tandhjul.

### Stjernen

En lille sol: turbulent overflade, korona, lysstråler. Vokser og bliver hvidere med ladningen. Ved fuld ladning ryster den.

### Kamera

Perspektiv, let vippet (ca. 15–30° fra lodret). Rolig drift i tomgang. Bevægelse bruges som tegnsætning: skub ind ved gevinst, ryst ved stop, træk ud ved nova.

### Post

HDR, ACES, tærskelbaseret bloom, let kromatisk aberration, vignet, filmkorn. Shockwave-refraktion ved nova.

### Typografi (HUD)

- Display: **Cinzel** (indgraverede versaler) til titler, etiketter og store gevinster.
- UI og tal: **Manrope** med tabeltal.

## 6. Lyd

Alt syntetiseres i WebAudio. Ingen filer.

- **Toneart:** D-dorisk/D-mol. Novaen lander på D-dur.
- **Grundmusik:** langsomme pads (Dm9 → B♭maj7 → Fmaj7 → Csus), sub-drone, sparsom celesta, blødt urværk (tik-tak) ved ca. 72 BPM.
- **Spin:** basostinat og hurtigere arpeggio, filteret åbner.
- **Spænding:** stigende støj og toneklynge, accelererende dunk.
- **Kometnat:** lysere, bredere, glitrende sekstendedele, blød stortromme.
- **Nova:** musikken trækkes ned til stilhed lige før glimtet. Derefter sub-drop, støjbrag, D-dur og lang hale.
- **Stor gevinst:** fanfareloop med klokker, optælling med stigende tone.
- **Effekter:** ringstop er stemte klokker (D–F–A–D), stråler er en luftig "laserharpe", splintring er glas, genopfyldning er plink med stigende tone, tikket er et tungt mekanisk klonk, hak under fingeren er en skraldeklik.
- Masterkæde med kompressor, rumklang fra genereret impulsrespons og ducking af musik under store effekter.

## 7. HUD og tekster

Mobil først, portræt. Dansk.

- **Top:** ordmærke, lyd, menu.
- **Omkring brættet:** multiplikatorstige, Nova-måler, gratisspil-tæller.
- **Under brættet:** statuslinje ("Dit træk: drej en ring ét hak").
- **Bund:** SALDO · GEVINST · INDSATS (−/+), og AUTO · TURBO · SPIN · AUTO-JUSTER.
- **Menu:** Regler og gevinsttabel, Matematik (nøgletal + simulation), Indstillinger (lyd, kvalitet, mindre bevægelse), Demo (udløs features).
- **Splash:** ordmærke, "Tycho Brahes himmelmaskine", knappen SPIL, "Demo · ingen rigtige penge · 18+".

Store gevinster: fra 10× STOR GEVINST, fra 25× MEGA GEVINST, fra 60× SUPERNOVA.

Tastatur: mellemrum = spin/spring over, piletaster = vælg ring og drej, M = lyd.

## 8. Følelse og timing

Normal hastighed (turbo ×0,55):

| Fase | Varighed |
|---|---|
| Opspænding (ringene trækker lidt baglæns) | 0,15 s |
| Hvirvel før første stop | ≥ 0,9 s |
| Mellem ringstop | 0,34 s |
| Drum-roll pr. ring | +1,25 s |
| Gevinstvisning | 0,95 s |
| Splintring + støv | 0,5 s |
| Genopfyldning | 0,45 s |
| Tik | 0,34 s |
| Snap ved træk | 0,22 s |
| Hint efter inaktivitet | 4 s |

Hvert input kvitteres i samme frame. Ringstop: overskydning og fjedring, gnister ved markøren, lille kamerarystelse, klokke. Træk: ringen følger fingeren 1:1, har gummibånd ud over ét hak og et tydeligt hak ved 45°. Under træk vises spøgelsesstråler for det, trækket ville give.

`prefers-reduced-motion`: ingen rystelser, ingen shockwave, færre partikler, kortere kamerabevægelser.

## 9. Ansvarligt design

- Ingen fabrikerede næsten-gevinster. Drum-roll afspejler kun reelle muligheder.
- Gevinster under indsatsen vises nøgternt: beløb og en blød lyd, ingen fanfare.
- Udfald og præsentation er adskilt. Kosmetisk tilfældighed rører aldrig udfaldet.
- Demoen siger tydeligt, at den er en demo, og at rigs er rigs.
- Trækket har ingen tidsfrist. Der er ingen nedtælling, der presser.

## 10. Teknik

- Vite + TypeScript + Three.js (WebGL2). Én selvstændig HTML-fil ved build.
- `anim`-uret driver al timing, så showet kan pauses, springes over og steppes frame for frame.
- Moduler bag kontrakter i `src/core/types.ts`: `IEngine`, `IGameView`, `IAudio`, `IHud`. `Director` ejer saldo og forløb.
- Se `docs/ARCHITECTURE.md`.

## 11. Hvor et rigtigt asset ville løfte mest

1. **Indspillet musik.** Den syntetiserede musik bærer stemningen, men et komponeret tema med rigtige strygere og kor ville løfte brandet.
2. **Illustreret baggrund.** Et håndmalet observatorium på Hven ville give stedet en fortælling, som tåger og stjerner ikke kan.

Begge er valg, ikke forudsætninger. Spillet er komplet uden.
