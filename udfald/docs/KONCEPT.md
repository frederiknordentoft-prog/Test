# ØRE · samlet konceptspec v1 (klar til build)

> Arbejdstitlen ØRE er siden ændret til **UDFALD**, og prisenheden til **kurs** (2. nov. 2026). Teksten nedenfor er bevaret, som den blev besluttet.

*Syntese af fem koncepter og tre dommere. Rygraden er ØRE (exchange, 22,5 point). Elementer er podet ind fra de andre koncepter, men kun hvor de styrker markedsmetaforen:*
- *Fra FRONT: Målvejret, Udsigten og sproget "X af 100 fremtider".*
- *Fra TAKT: salgsfaderen og sidechain-pumpen.*
- *Fra Kridt: Kampstriben, Midtercirklen, chippen "Afregnes på" og oscilloskopets trigger.*
- *Fra TRÆK: genvindelig skade og træk-karakterer.*

*Alle must-cuts er respekteret. To dommere var uenige med en must-cut i præcis ét tilfælde: oscilloskopet i håndbold. Det bliver derfor, og candlesticks ryger.*

---

## 1. Navn, pitch og den ene sætning

**ØRE.** Ordmærket er et Ø, hvor skråstregen er en kurslinje, der stiger gennem en mønt. Enheden er selve produktet: 56 øre = 56 % chance = 1,79 i odds.

**Pitch:** ØRE gør returderbyet i Parken til et levende marked. Hvert udfald er en andel mellem 0 og 100 øre, som ånder med kampen. Du køber, holder og sælger din overbevisning, mens bolden ruller. Markedet læser du med instrumenter lånt fra vejrtjenesten, lydstudiet, tv-grafikken og skakbrættet.

**Hvorfor det ikke er en sportsbook:** Hos Oddset køber du et tal på en kupon og venter. I ØRE ejer du andele i et udfald, hvis pris har en fortid, en synlig årsag og en fremtid, og du kan sælge dem i hvert eneste sekund af kampen.

## 2. Central metafor og 6 designprincipper

**Kampen er et noteret marked, og ØRE er dit handelsgulv.**
- Markedet åbner med en auktion ved startfløjtet og handler i 90 minutter.
- Ved store begivenheder stopper det, som en børs gør ved voldsomme udsving.
- Det lukker med en lukkeauktion, hvor hver andel afregnes til 100 eller 0 øre.
- Publikum er ordrestrømmen, og dine spil er positioner.

På et rigtigt handelsgulv står der instrumenter fra andre fag: råvarehandleren har vejrudsigten åben, produceren sin fader og tv-grafikeren sin rekordlinje. ØRE låner præcis de instrumenter, der hjælper dig med at læse og handle én kurs, og intet andet. Udtrykket er broadcast-premium, ikke terminal: én linje, store tal og stadionnat.

1. **Op betyder mere sandsynligt.** Prisen er øre pr. 1 kr udbetaling. Den står altid sammen med en frekvens ("54 af 100 fremtider"), og odds står som sekundær tekst ("1,82").
2. **Ingen bevægelse uden synlig årsag.** Hvert udsving på 1 øre eller mere kan spores til tid, pres, ordreflow eller en begivenhed. Årsagen står på skærmen som chip, båndlinje eller nål. Støj er højst ±0,5 øre og ses kun som åndedræt.
3. **Én helt pr. skærm.** På Kampen er helten Den Åndende Linje, og alt andet opdaterer i T0/T1. Fremtidszonen viser årsager; den er ikke en kontrolflade.
4. **Et spil er en position.** "Værdi nu", "Ved sejr" og en salgsfader er altid synlige, også midt i et mål.
5. **Stille ramme, levende data.** Rammer, labels og navigation flytter sig aldrig. Ingen skærmrystelser, ingen konfetti, intet casinoguld.
6. **Penge under tommelen, klart dansk overalt.** Alt, der koster penge, bekræftes under y = 470. Udsigten skrives som DMI skriver. Fagkoder som TAF, Richter og Brier findes ikke i UI'et.

## 3. Lånte brancher

| # | Branche (kilde) | Mekanik | Hvor på skærmen | Hvorfor det forbedrer betting |
|---|---|---|---|---|
| S1 | **Finans og børs** (Polymarket, Kalshi, Robinhood; NYSE/Nasdaq LULD-stop, åbnings- og lukkeauktion) | Øre-linjen med handelsstop og Schrödinger-gab | Kampen y 139–469 | Prisen får fortid og årsag. VAR bliver et handelsøjeblik i stedet for død tid. Fælder i gabet belønner forberedelse. |
| S2 | **Meteorologi** (DMI-udsigten, Dark Sky/Apple Weather "næste time") | Målvejret og Udsigten | y 115–139 og y 595–671 | Tidspunkt for mål, næste mål og "intet mål" bliver ét greb, og sandsynlighed står på dansk, så alle kan læse den. |
| S3 | **Musikproduktion** (mixerpultens fader, sidechain-kompression) | Salgsfaderen med hak og sidechain-pumpen ved mål | y 679–763 plus dataområdet ved mål | Delsalg, "Indsats hjem" og exit i ét træk. Målet får tyngde, uden at chromen rokker sig. |
| S4 | **Sports-tv-grafik** (Orads virtuelle rekordlinje, OL-svømning) | Spøgelseslinjen | På linjen, efter tap på positionskortet. Status står altid på kortet | Hver position får en baseline, så du kan se i mål, om kampen løber i dit tempo. |
| S5 | **Online-skak** (chess.com Game Review) med closing line value (CLV) fra professionel trading | Træk-karakterer | Afregningen | Dømmekraft skilles fra held. Det giver en grund til at komme tilbage, som ikke handler om penge. |
| S6 | **Elektronik og måleinstrumenter** (Tektronix-oscilloskopets trigger) | Triggerniveauet | Hallen, som helt | Håndbold får sin egen grammatik: et niveau, du selv trækker, prissat i lukket form. |

**Støttelån** (ikke signaturmekanikker og ingen egne flader):
- Beskedapps: hold-for-indsats fungerer som en talebesked i WhatsApp/iMessage.
- Fightingspil: et hit-stop på 80 ms og "genvindelig skade" på andelsbarerne.

På helteskærmen er S1, S2, S3 og S4 synlige samtidig, så snart du har en position. S5 lever i Afregningen og S6 i Hallen.

## 4. Informationsarkitektur og navigation

**Fem flader:**

| # | Flade | Rute | Indhold |
|---|---|---|---|
| 1 | Lobbyen | `#lobby` | To stille kort (Derbyet og Hallen), hver med ét åndende tal og en mini-linje. Første tap viser kick-off-gaten "Tryk for at åbne handlen". |
| 2 | Kampen | `#kamp` | Helteskærmen (§5). Ordresedlen er en bakke i Kampen, ikke en selvstændig flade. |
| 3 | Porteføljen | `#portefolje` | Bundark med stop ved 60 % og 100 %: positioner, fælder, kurve og afregnede spil. |
| 4 | Afregningen | `#afregning` | Fuldskærm efter lukkeauktionen (§9). |
| 5 | Hallen | `#hallen` | Aalborg–GOG (§12): samme komponenter, egen helt. |

Overlays er Ordresedlen, infoarkene ("Husets andel", "Afregnes på") og instruktørpanelet.

**Gestus-grammatik.** Kurslinjen har kun to gestus, så de ikke kolliderer: scrub og fælde.

| Gestus | Hvor | Betyder |
|---|---|---|
| Tap | Flise, bue, søjle | Åbner Ordresedlen med seneste indsats |
| Hold ≥ 250 ms | Flise, bue, søjle | Hold-for-indsats (§9) |
| Træk på tværs | To fliser eller flere søjler | Dobbeltchance eller et bredere vindue |
| Træk vandret | Linjen | Scrub: score, minut og kurs spoles med |
| Langt tryk 450 ms uden bevægelse over 6 px | Linjen | Kladde til en fælde ved den kurs; bekræftes i bakken |
| Træk | Faderen | Sælg en del eller alt |
| Tap | Positionskortet | Vis eller skjul Spøgelseslinjen |
| Swipe op | Positionskortet | Åbner Porteføljen |
| Swipe vandret | Kampbåndet | Skifter mellem Kampen og Hallen |
| Swipe ned | Kampbåndet eller et ark | Tilbage eller luk |
| Langt tryk 600 ms | Ø-logoet | Åbner instruktørpanelet |

**Overgange:**
- **Lobby → Kampen:** `<ViewTransition>`-morf på højst 350 ms, hvor kortets tal flyver op i instrumenthovedet. Canvas starter først, når overgangen er færdig, fordi snapshottet er statisk.
- **Kampen ↔ Hallen:** gestusstyret fjeder (visualDuration 0,45, bounce 0,15) med hastighedsoverdragelse og ingen ViewTransition.
- **Ark:** fjeder 0,45/0,15. Svar på UI-handlinger: 0,25/0.
- **Afregningen:** overtager efter lukkeauktionen med en krydsfade på 400 ms, og linjen bliver flodens øverste kant.

## 5. Helteskærmen (FCK–Brøndby live)

Øjebliksbillede: 27', 0–0, FCK presser. Brugeren ejer 510 FCK-andele købt til 49 øre (249,90 kr). Skærmen er 390 × 844.

| y (px) | Element | Indhold (≈ værdier) | Datakilde | Tier |
|---|---|---|---|---|
| 0–47 | Safe area | – | – | – |
| 47–91 | **Kampbånd** | Ø-logo 20 px; FCK-monogram 28 × 28 (#EAF6FF); "0–0" i Roboto Flex 24, wght 650; BIF-monogram (#FFD200); "27'" med livepunkt; statuspille ÅBEN / STOPPET / LUKKET; lydpille | Ur, score, halt-tilstand (React højst 2 commits/s) | Stille. Cifrene ruller i T1 ved ændring |
| 91–115 | **Kampstriben** | Endimensionel bane på 358 × 24 med hårlinjer og feltmærker. Boldprik på 6 px med en hale på 24 px. Pres-tone fra angrebssiden. Chippen "Næste mål FCK 61" rider med bolden; den kan kun aflæses | Boldzone z ∈ 1..6, π_FCK − π_BIF, ask for Næste mål | T1: fjeder ≈ 120 px/s, chip højst 2 Hz |
| 115–139 | **Udsigten** | Inter Tight 14/20, #B9C2CE: "Tiltagende FCK-pres. 45 % risiko for mål inden pausen." | Skabelon over hazard(t → 45'), dπ/dt og score | Krydsfade 300 ms, højst hvert 6. sekund |
| 139–215 | **Instrumenthoved** | "FCK vinder ▾" (13 px) og "55" i Roboto Flex 56/56 med "øre". Til højre: "54 af 100 fremtider", "1,82 · sælg 53" og "▲ 6 øre · 5 min". Årsagschip på 24 px: "+6 øre: 3 hjørnespark på 4 min" | Ask og bid fra markedslaget, fair i lukket form, Δ over 5 min, årsagsdekomposition | Cifre højst 4 Hz med hysterese 0,6 øre; GRAD +40 ved volatilitet; chip højst hvert 3. sekund |
| 215–447 | **Den Åndende Linje** (canvas 390 × 232) | Historik fra x 16 til 286 (15 min, 18 px/min) og NU-hårlinje ved x 286. **Fremtidszonen** x 286–374 har tre grene: "Mål FCK → 69", "Mål BIF → 27" og "Intet mål 10' → 47". Linjen er 2 px med 6 px glød i 15 %, hovedet 10 px. Hertil nåle, dit købspunkt (49), fælde-linje (violet stiplet, greb 44 × 28), handelsglimt ved hovedet og tidspillerne "5m · 15m · Kamp" | Ringbuffer med mid og ask. Grenene er what-if i lukket form; handlerne kommer fra crowd-agenterne | **HELT.** Hovedet ånder over 1,2 s (T0) og følger en fjeder mellem 10 Hz-ticks (T1). T3 ved begivenheder |
| 447–469 | **Båndet** | Til venstre seneste handel, "▲ 250 kr FCK @ 55"; handler under 100 kr samles til "+12 små". Til højre "Oms. 4,2 mio. kr" | LMSR-crowd og Hawkes | Hver indgang glider 8 px på 180 ms, højst 2 Hz; ellers stille |
| 475–507 | **Familievælger** | "Udfald · Næste mål · Mål" (32 px, hitzone 44 px) | – | Stille |
| 511–587 | **Kursbåndet** | Tre fliser på 114 × 76: FCK 55 / X 27 / BIF 21 med "1,82 · sælg 53". En andelsbar på 4 px er fyldt op til prisen, og en lys sektion viser genvindelig skade. Positionsprik "510" | Ask/bid og den transiente markedsafvigelse (§8.6) | Ciffer-rul og fyld på fjeder (T1). Skaden dræner over 1,2 s |
| 595–671 | **Målvejret** | Overskrift: "Mål sandsynligt inden 42' (52 %)". Én søjle pr. resterende 5-minutters vindue (her 13, højst 36 px brede, 54 px høje). FCK-andelen ligger øverst i is, BIF nederst i gult. Det løbende vindue skrumper i savtak. Pausemarkør ved 45' | ∫λ pr. vindue i lukket form; λ_F/(λ_F+λ_B) | T0: søjlerne omskaleres langsomt; T1 ved presændringer |
| 679–763 | **Positionskortet** | "FCK vinder · 510 andele @ 49", "Værdi nu 270 kr ▲ +20", "Ved sejr 510 kr", "Tempo: foran · +4 øre". Faderspor på 28 px med knap 44 × 28 og hakkene "Indsats hjem", "Halvdelen" og "Alt" | Andele × bid; spøgelset fra MC | T2: ±2 px nudge ved ændringer på 2 øre eller mere |
| 766–810 | **Bundbjælke** | "Lobby" · "Portefølje +20 kr" · "Kurv (0)" | Porteføljen | Stille |

**Ordresedlen** rejser sig over y 579–810. Dens øverste række (28 px) viser altid "Portefølje: værdi 270 kr · ved sejr 510 kr", så den rigtige udbetaling aldrig skjules.

Under en **VAR-pause** erstattes Familievælger og Kursbånd af strimlen "Målet står? Ja 73 · Nej 35".

## 6. Signaturmekanikker

### S1 · Øre-linjen og handelsstoppet (finans og børs)

**UI og interaktion**
- Det valgte kontrakt-udfald (standard: FCK vinder) vises som én linje. Et tap på en flise retter linjen mod det udfald med en krydsfade på 300 ms.
- **Handelsglimt:**
  - Hver crowd-handel tegner et glimt ved hovedet med radius 2 + 1,2·log₁₀(S/100) px (2–7 px). Køb er mint ▲, salg er koral ▼, og glimtet toner ud over 400 ms.
  - En hval (10.000 kr eller mere) sender en ring fra hovedet med 1.200 px/s, klippet til canvas. Den overtager båndet i 2,4 s og sætter årsagschippen.
- **Fremtidszonen:**
  - Tre grene beregnet i lukket form. Opaciteten er 0,25 + 0,75·w, hvor w = P(grenen sker først inden for 10').
  - Zonen kan kun læses, og den klapper sammen under scrub.
- **Fælder:**
  - Et langt tryk på linjen laver en kladde ved hele øre. Den bekræftes i bakken: "Køb FCK ved 35 · 100 kr". Der kan højst være 3 aktive.
  - En fælde over den aktuelle ask afvises med "Kursen er allerede under – køb nu?".

**Pris**
- ask_i = 100·m_i^k efter power-metoden på markedets mid m_i, hvor k løses så Σ ask(1X2) = 103 ± 1.
- bid_i = ask_i − s_i. Spreadet s er 2 øre i ro og 4 øre, når bolden er i zone 6 eller presset er højt. I 10 kampsekunder efter en genåbning er det 6 øre.

**Afregning**
- Andelene afregnes til 100 eller 0 ved lukkeauktionen og kan sælges når som helst til bid. Værdien er andele × bid/100.
- En fælde fyldes, når ask ≤ L uden for et stop. Ligger niveauet i et gab, fyldes fælden til første ask efter genåbningen ("fyldt til 26 · 9 øre bedre"). Fyldningerne kommer i kaskade med 60 ms mellemrum.

**Handelsstop**

| Begivenhed | Varighed |
|---|---|
| Mål | 1.200 ms |
| Rødt kort | 1.600 ms |
| VAR | Til afgørelsen (demo: 6–9 s) |

- Under stoppet handles der ikke, og fælderne er frosne. Et skraveret bånd (45°, #8A8F98 i 30 %) bærer teksten "HANDEL STOPPET · VAR-tjek".
- Grenene erstattes af to spøgelseskurser fra what-if i lukket form: "Godkendt ≈ 32 / Annulleret ≈ 17". Under VAR er kun "Målet står?" åben.
- Ved afgørelsen størkner det ene spøgelse, og det andet fordamper over 400 ms. Genåbningen tegner et lodret, mærket gab ("+15 øre").

**Auktioner**
- Åbningsauktionen varer 2,5 s ved startfløjt: ordrer krydser, og der står "Åbner 49 øre".
- Lukkeauktionen varer 2 s: linjen løber til 100/0.

**Edge cases**
- Ask kappes ved 99 og bid ved 1. Over 97 viser kortet "Næsten afgjort".
- Y-skalaen er adaptiv med et spænd på mindst 30 øre. Den skalerer kun om mellem begivenheder (fjeder 600 ms), aldrig under T3.
- To begivenheder inden for samme stop sættes i kø, og gabet mærkes med den samlede ændring.

### S2 · Målvejret og Udsigten (meteorologi)

**UI og interaktion**
- **Overskriften** viser "Mål sandsynligt inden T' (P %)". T er det første vinduesslut, hvor den kumulerede sandsynlighed når 50 %. Når T kommer efter 90', står der i stedet "Mål usandsynligt resten af kampen (P %)".
- **Søjlerne** har højden P(mål i vinduet): 0–60 % svarer til 0–54 px.
- **Tap på en søjle:** bakken viser "Mål i 30–35' · Ja 23 | Tørvejr 80".
- **Træk hen over sammenhængende søjler:** du får ét samlet vindue. En lup på 120 × 36 px over tommelen viser "Mål 60–70' · 38 øre".
- **Tørvejr** er Nej-siden ("Intet mål 60–70' · 71 øre"). Positionen viser theta: "Tiden arbejder for dig: +1,80 kr/min".
- **Efter målet:** efter hvert mål får vinduet fra målminuttet og 5 minutter frem en markeret kant og teksten "Efter målet: nyt mål inden 36'? 26". Det er samme kontrakttype, men med excitation. Det erstatter Efterskælv uden en ny flade.

**Pris**
- p = 1 − exp(−∫ₐᵇ (λ_F+λ_B) du) i lukket form, inklusive excitation. Marginen er 9 % (power-metoden på Ja/Nej), og 10 % på "Efter målet".
- Ved 54' og stillingen 0–1 koster "Mål 60–70'" ≈ 38 øre og Tørvejr ≈ 71.

**Afregning**
- Ja betaler 100 ved første mål i vinduet, først når en eventuel VAR har godkendt målet. Annulleres målet, lever kontrakten videre.
- Nej betaler 100 ved vinduets slut uden mål.

**Udsigten** har fem skabeloner: pres stiger, pres falder, føring, udligning nær og tiden løber. Hver sætning skal citere et tal fra modellen, fx "BIF fører. FCK presser frem: 21 % risiko for nyt mål inden 36'."

**Bevægelse.** Ved mål fyldes søjlen til 100, får et "✓" og bliver til en afregnet prik. Den deltager i sidechain-pumpen.

**Edge cases**
- 40–45' omfatter tillægstiden i 1. halvleg og 85–90' tillægstiden i 2. halvleg.
- Under 1 kampminut før vinduets slut lukker vinduet for nye handler ("Lukket").
- Er en søjle smallere end 20 px, snapper et tap til nærmeste søjle, og luppen vises altid.

### S3 · Salgsfaderen og sidechain-pumpen (musikproduktion)

**UI.** Faderen følger kortets fulde bredde. Knappen står yderst til højre, når du ejer 100 %. Hakkene er magnetiske inden for ±12 px:
- **"Indsats hjem"** vises kun, når værdien er højere end indsatsen.
- **"Halvdelen".**
- **"Alt".**

Under træk viser en udlæsning over tommelen fx: "Sælg 365 andele → 350 kr nu · 529 kører gratis (ved sejr 529 kr)".

**Interaktion**
- Slipper du et andet sted end ved 100 %, vises chippen "Sælg 365 → 350 kr" med samme låsering på 3 s (§9).
- Et tap sælger til bid med en tolerance på ±1 øre. Er kursen flyttet mere, står der "Kursen flyttede sig – sælg til 95?".
- Tapper du ikke, fjedrer knappen tilbage.

**Formler**
- k_indsats = ⌈100·S/bid⌉ og k_halv = ⌈N/2⌉.
- Provenu = k·bid/100. Resterende udbetaling = N − k.

**Sidechain-pumpen** (erstatter skærmrystelse i alle koncepter):
- Ved mål og VAR-domme løber en usynlig bølge fra linjens hoved med 1.200 px/s.
- Hvert dataelement dykker til 30 % opacitet, når bølgen passerer (forsinkelse = afstand / 1.200 px/s), og kommer tilbage over 300 ms. Det gælder linjens glød, flisernes barer, Målvejrets søjler og Kampstribens tone.
- Rammer, tekst og udbetalingstal dykker aldrig.
- Lyden dukker samtidig −12 dB i 600 ms.

**Edge cases.** Under et stop er faderen deaktiveret med teksten "Salg åbner efter stoppet". En position med tab har intet "Indsats hjem"-hak.

### S4 · Spøgelseslinjen (sports-tv-grafik)

**Pris og afregning.** Spøgelset er ikke et marked. Ved købet fryser workeren den betingede mediansti: blandt MC-stier, hvor positionen vinder, tages medianen af kontraktens fair pris pr. kampminut fra købet til 90'. Det bygger på 512 stratificerede stier ud af 5.000. Ved et nyt køb i samme kontrakt fryses spøgelset igen for den samlede position ("Tempo for 894 andele @ 39,1").

**UI**
- Spøgelset tegnes stiplet i hvid 40 % (1,5 px).
- Feltet mod den rigtige linje er mint 12 %, når du er foran, og koral 12 %, når du er bagud. Farven skifter over 300 ms ved krydsning.
- Etiketten bruger mål, når stillingen kræver det ("Bag tempo · mangler 1 FCK-mål"), og ellers øre ("Foran tempo · +4 øre").

**Interaktion.** Statusteksten står altid på positionskortet. Selve linjen vises kun efter tap, og kun ét spøgelse ad gangen.

**Edge cases.** Spøgelser findes ikke for målvinduer og VAR-binærer, kun for Udfald, Næste mål, Mål i alt og Kurve.

### S5 · Træk-karakterer (online-skak)

**Formel.** For hver handel (lot) er
CLV = (R − e) − (P₀(t_R) − P₀(t_e)), hvor:
- e er købs- eller fyldningsprisen.
- R er mid lige før næste mål eller 10 kampminutter efter købet, alt efter hvad der kommer først.
- P₀ er fremskrivningen i lukket form uden begivenheder, altså det tiden alene ville gøre.

**Skala:**

| CLV | Karakter |
|---|---|
| ≥ +8 | Brillant !! |
| +3 til +8 | Godt køb ! |
| −3 til +3 | Præcist |
| −8 til −3 | Unøjagtigt ?! |
| < −8 | Fejlkøb ?? |

**UI.** Karakterer vises kun i Afregningen, sat med Instrument Serif kursiv og et stempel, der skalerer fra 1,2 til 1 over 200 ms uden partikler. Under dem står: "Karakteren måler købet, ikke udfaldet." Karaktererne flytter ingen penge.

**Edge cases.** Binærer, der afgøres inden for 30 kampsekunder (VAR), får "—".

### S6 · Triggerniveauet (elektronik)

Mekanikken hører til i Hallen og er beskrevet i §12.
- **Pris:** first-passage-sandsynlighed i lukket form.
- **Afregning:** 100 ved første ramning, 0 ved deadline.
- **Bevægelse:** freeze-flash på 120 ms.

## 7. Markedskatalog for prototypen

| Familie | Kontrakt | Pris (fair) | Margin | Afregning |
|---|---|---|---|---|
| Udfald | FCK / X / BIF | Skellam over restmål. Dixon–Coles (ρ −0,08) kun før kampen | 3 % (Σ ask 103) | 100/0 ved fuld tid; salg til bid |
| Udfald | Dobbeltchance 1X, X2 (træk over to fliser), 12 (link "Ikke uafgjort" i bakken) | Sum af fair | 4 % | Fuld tid |
| Næste mål | FCK / Ingen / BIF | P_F = Λ_F/Λ·(1 − e^(−Λ)), P_Ingen = e^(−Λ) | 5 % | Ved næste mål (efter VAR) eller ved fuld tid |
| Mål | "Mindst N mål" / "Højst N−1" (N = 1..5) via Midtercirklen: seks buer 0..5+ i halvcirkel; fyldte buer er scorede mål, opaciteten er P(≥ N) | 1 − Σ_{j<N−g} Pois(j; Λ_F+Λ_B) | 5 % | Fuld tid |
| Mål | Begge scorer: Ja / Nej (chip i Midtercirklens centrum) | (1 − 1[g_F=0]·e^(−Λ_F))·(1 − 1[g_B=0]·e^(−Λ_B)) | 6 % | Fuld tid |
| Målvejret | "Mål i a–b'": Ja / Tørvejr | 1 − e^(−∫λ) | 9 % | Ved første mål eller vinduets slut |
| Målvejret | "Efter målet" (opstår ved mål) | Som vindue, med excitation | 10 % | Efter 5 kampminutter |
| Begivenhed | "Målet står?" Ja / Nej (kun under VAR) | VAR-sandsynlighed (§8.6) | 8 % | Ved dommen |
| Kurv | 2–3 ben fra Udfald, Mål, Begge scorer og Målvindue | Fælles træfrate i MC | 12 % | Alle ben skal ramme; kan sælges til MC-bid |
| Værktøj | Fælde (kun køb) | – | – | Ask ≤ L, eller første ask efter et gab |
| Hallen | Aalborg / X / GOG | Stern: Φ((d − ½ + μτ)/(σ√τ)), krydstjekket med MC | 4 % | Fuld tid |
| Hallen | "Mål i dette angreb?" | Angrebskæde (§12) | 8 % | Ved mål eller boldtab |
| Hallen | Triggerniveau "Aalborg +N før M'". "Føringsskifte før M'" er en trigger på den anden side af nul | First passage med drift (§12) | 8 % | Ved første ramning eller deadline |

Hver kontrakt, der opstår under kampen ("Efter målet", "Målet står?", Kurv, Trigger), har chippen **"Afregnes på: …"**, fx "Afregnes på: første godkendte mål 31:00–35:59 · ØRE-feed (fiktiv)".

## 8. Oddsmotor

### 8.1 Seeds og determinisme

- Hele tilstanden er en ren funktion: tilstand = f(seed, instruktørens tidslinje, tick).
- Seedet er `hashSeed("FCK-BIF·Parken·2026·retur")`. Separate mulberry32-strømme bruges til `feed` (bold, skud, hjørner), `press`, `crowd`, `noise`, `var` og `director`. Instruktørens begivenheder trækker derfor aldrig tal fra støj- eller crowd-strømmene.
- MC bruger tællerbaseret hashing (se §8.5).
- Funktionerne mulberry32, hashSeed, Poisson-gitteret og priceFromProb genbruges fra `sportsbook-x/src/odds`.

### 8.2 Ur og tickrater

| Lag | Rate |
|---|---|
| Kampur | 1 kampminut = 4 s. Tick på 100 ms = 1,5 kampsekunder |
| Motor (fast skridt) | 10 Hz. Spol ×N kører N delskridt pr. tick, så linjen tegnes i stedet for at springe |
| Lukket form (1X2, vinduer, grene, mål) | Hvert tick |
| MC-forespørgsel | Hvert 3. tick, tick-låst |
| Rendering | 60 fps (30 fps i Low Power Mode) med interpolation alpha = (now − tickTime)/100 |
| React | Højst 2 commits/s (score, minutspand, halt, slip) |
| NumberFlow | Højst 4 Hz pr. tal |

### 8.3 Fundamental model

λ_i(t) = c_i · (λ_i^pre/90) · s(t) · m_score · m_red · e^(π_i) · (1 + α·xT_i(z)) · (1 + E_i(t))

| Parameter | Standard |
|---|---|
| λ_FCK^pre / λ_BIF^pre / ρ | 1,60 / 1,10 / −0,08, svarende til fair ≈ 48/27/25 og Over 2,5 ≈ 51 % |
| s(t) | (0,85 + 0,40·t/90)/1,05 |
| m_score | Bagud 1,18, foran 0,90 |
| m_red | Eget rødt kort 0,70, modstanderens 1,18 |
| π_i (OU i kamptid) | θ = 0,20/min, σ = 0,30/√min, klip ±0,9. Spark: hjørne +0,08, skud på mål +0,05, stor chance +0,12 |
| Boldzone (Markov pr. tick) | Frem: 0,22 + 0,10·tanh(2Δπ). Tilbage: 0,14. Boldtab: 0,06 + 0,02·z/6, hvorefter bolden spejles til zone 7 − z |
| xT(z) og α | {0; 0,05; 0,1; 0,2; 0,45; 1,0} og α = 0,5. I lukket form gælder boldzonens løft kun det næste ½ kampminut |
| Skud | Kun fra zone 5–6 med vægt 0,35 og 1. xG ~ Beta(1,1; 8,9) med middel 0,11. Mål hvis U < xG |
| Excitation E_i | κ = 0,6 og τ_E = 3 min efter hvert mål |
| Tillægstid | +2 / +4 kampminutter (styres af instruktøren) |
| c_i | Kalibreres offline til 2,7 mål pr. kamp i snit |

### 8.4 Lukket form

- Λ_i = ∫_t^slut λ_i du. Presset henfalder som e^(π) → 1 + (e^(π) − 1)·(1 − e^(−θT))/(θT).
- 1X2 er Skellam på d + N_F − N_B.
- Grenene er what-if-tilstande:
  - Mål nu: score +1, ny m_score og et E-spark.
  - Intet mål 10': t + 10, π henfalder, E = 0.
- Grenvægte: w_F = Λ10_F/Λ10·(1 − e^(−Λ10)), og tilsvarende for w_B og w_0.

### 8.5 Monte Carlo-worker (tick-låst)

**Forespørgsel.** Ved tick n sendes snapshot S_n (score, t, π, E, kort) sammen med forespørgslerne: kurve, spøgelser og konsistensprobe.

**Simulering**
- 5.000 stier i skridt på 15 kampsekunder.
- Uniform U(j, m, kanal) = hash32(seedMC, j, m_abs, kanal)/2³². Fremtidige minutter bruger derfor de samme tal fra forespørgsel til forespørgsel (CRN), så der ikke opstår flimmer.

**Output** (transferable Float32Array/Uint16Array):
- Slutmatrix 11 × 11.
- Måltider pr. sti (højst 8).
- Fælles træfrater for kurve.
- Spøgelsesmedianer (højst 60 punkter pr. position).
- Slutandele for 1X2.

**Anvendelse**
- Resultatet anvendes ved tick n + 3 med lerp over 300 ms.
- I QA-tilstand (`qa=1`) venter tick n + 3 på resultatet. I live-tilstand anvendes et sent resultat ved næste tick, og en tæller "forældet" vises i debug-HUD'en.

**Fallback.** Kaster `new Worker` en fejl, eller kommer der intet svar inden for 1 s, kører MC i hovedtråden i bidder på højst 3 ms pr. frame med 2.000 stier.

**Invariant.** |MC-andel for 1X2 − lukket form| ≤ 2,5 pp ved hvert resultat.

### 8.6 Markedslag

mid_i = softmax_i( ln p_i + (u_i^T + u_i^P)/b + o_i + ε_i )

| Komponent | Formel og standard |
|---|---|
| LMSR-likviditet | b = 400.000. En handel på S kr giver Δu = S/ask_i andele. En median-billet på 150 kr flytter ≈ 0,02 pp; en hval på 25.000 kr på BIF @ 26 flytter FCK ≈ −3 øre |
| Flowlager | Almindelig handel går 100 % til u^T. Hvaler går 50/50 til u^T og u^P. Halveringstid: u^T 4 s, u^P 60 s (realtid) |
| Ankomst (Hawkes) | λ_c = μ + Σα·e^(−β(t−t_k)), μ = 2,0/s, β = 1/1,2 s. α: mål 14, VAR-dom 10, hval 3, stor chance 4 |
| Størrelser | Lognormal med median 150 kr og σ_ln 1,2, kappet ved 9.999. Hvaler på 10.000–40.000 kr kommer 1–3 gange pr. halvleg |
| Side | 30 % informeret flow køber argmax(p_i − mid_i). 70 % støj: FCK 52 %, X 16 %, BIF 32 % |
| Overshoot o_i | Ved genåbning gives et spark på 0,10·\|Δp_fair\| i springets retning. Det henfalder med τ = 0,5 s og fordeles på burstens handler, som er årsagen |
| Mikrostøj ε | OU på logit, θ = 0,8/s, stationær sd 0,016 (≈ 0,4 pp ved 50 %), ×1,5 i farlige faser |
| Genvindelig skade | \|mid − anker\|, hvor anker = softmax(ln p + u^P/b). Tegnes som en lys sektion på flisebaren |
| VAR-sandsynlighed | Seedet Brownian bridge fra p₀ (0,70) mod dommen. I drift ville den komme fra VAR-feedet |
| Visning | Hele øre med hysterese: det viste tal skifter først, når afvigelsen er mindst 0,6 øre |
| Cash-out og theta | Værdi = Σ andele × bid/100. Theta = d(Værdi)/dt under fremskrivningen uden begivenheder, pr. kampminut |
| Margin | 1X2 3 %, dobbeltchance 4 %, Næste mål og Mål 5 %, Begge scorer 6 %, vinduer 9 %, Efter målet 10 %, VAR 8 %, kurve 12 %. Vises som "Husets andel" (Σ ask − 100 og mid − fair) i et infoark |

### 8.7 Årsagsdekomposition

Δmid over de seneste 10 s deles i fem led: **tid** (theta), **pres** (π, zone, hjørner), **flow** (u), **hændelse** og **støj**. Chippen viser det største led, der ikke er støj, når det er på mindst 1 øre. Skabelonerne er:
- "−2 øre: tiden løber (0–0)"
- "+6 øre: 3 hjørnespark på 4 min"
- "−3 øre: storordre BIF"
- "+15 øre: Mål FCK 64' (VAR godkendt)"

### 8.8 Hvilken visual læser hvilket output

| Visual | Output |
|---|---|
| Linjen, fliser, instrumenthoved | mid, ask og bid (markedslag) oven på lukket form |
| "54 af 100 fremtider" | Fair p i lukket form (≈ mid) |
| Fremtidszonen, VAR-spøgelser, "≈ genåbner ved" | What-if i lukket form |
| Målvejret, Udsigten, "Efter målet" | ∫λ pr. vindue og π-trend |
| Kampstriben | Boldzone z, Δπ og ask for Næste mål |
| Midtercirklen | Poisson(Λ_F+Λ_B) og score |
| Handelsglimt, Båndet, hvalring | Crowd-agenter (LMSR, Hawkes) |
| Genvindelig skade | u^T og o (transient del) |
| Spøgelseslinjen, Kurv-pris | MC-worker |
| Positionskort, Porteføljen | Andele × bid, theta |
| Afregningens flod | Ringbuffer med 1X2-mid for hele kampen |

## 9. Bet-komposition og portefølje

**Vælg.** Tap, hold eller træk på fliser, buer eller søjler. Fælder sættes med et langt tryk på linjen.

**Ordresedlen** (bakke, 231 px) indeholder:
- Porteføljelinjen øverst, altid synlig.
- Kontraktens navn med Ja/Nej-split for binærer.
- Indsatschips: 25 · 50 · 100 · 250 · 500 · seneste.
- **"Udbetaling ved sejr 178 kr"** i Roboto Flex 28.
- Knappen **"Køb 100 kr"** (64 px høj), "+ Kurv" og "i".

En gentagelse af seneste indsats koster to tap: udfaldet, så Køb.

**Hold-for-indsats** (beskedapps):
- Ringen vokser, og indsatsen trappes op: 10 → 25 → 50 → 100 → 250 → 500 → 1.000 kr med 280 ms pr. trin.
- Over tommelen svæver fx "510 andele · udbetaling 510 kr".
- Glid op mindst 40 px for at købe. Glid til venstre for at annullere.
- Slipper du uden at glide, åbner Ordresedlen med den indsats.

**Prisaccept: én låsering.**
- Efter et køb kører en ring i 1,5 s, ligesom de 1–3 sekunders forsinkelse på live-markeder.
- Ordren fyldes til den låste ask, hvis den aktuelle ask højst er 1 øre højere.
- Ellers vises "Kursen flyttede sig – acceptér 58?" med valgene Acceptér og Annullér.
- Under et stop afvises ordren med "Handlen er stoppet".

Der købes **hele andele**: k = ⌊100·S/ask⌋, og der trækkes k·ask/100 kr (250 kr @ 49 giver 510 andele for 249,90 kr).

**Kurv**
- "+ Kurv" lægger benet i kurven. Der kan højst være 3 ben, og ben, der udelukker hinanden, afvises ("FCK vinder og BIF vinder kan ikke begge ske").
- Prisen vises som **"Hver for sig 4,50 → Hænger sammen 3,20"** med én forklarende linje: "Når FCK vinder, kommer der oftere 3+ mål."
- Første beregning viser en shimmer i højst 500 ms.
- Når kurven er købt, får den sit eget ticker-navn ("FCK·3M") og sin egen linje i Porteføljen og kan sælges undervejs.

**Porteføljen.** Hver position viser:
- en mini-linje
- spøgelsets status
- theta ("Tiden arbejder imod dig: −1,40 kr/min")
- en fader

Desuden ligger aktive fælder (som kan annulleres), kurve og afregnede spil her.

**Afregning**
- Lukkeauktionen varer 2 s. Derefter stemples positionskortet "AFREGNET · 894 kr" (skala 1,08 → 1 over 240 ms, uden partikler).
- Så åbner Afregningen:
  - En 1X2-flod for hele kampen med stablede bånd, skraverede stop og målnåle.
  - Dine handler som prikker på floden.
  - Regnskabet: "Udbetalt 1.025 kr · indsat 399,52 kr · +625,48 kr".
  - Træk-karaktererne.
- Beløbene ruller én gang og bliver stående.

## 10. Bevægelses- og lyddesign

**Tempo-tiers.** Kun én T3 eller T4 kører ad gangen. T2 venter bag T3, højst 1,5 s.

| Tier | Elementer | Budget |
|---|---|---|
| T0 Ånde | Hovedets puls (1,2 s), Målvejrets omskalering | ≤ 1 Hz, ≤ 3 px |
| T1 Data | Linjens fremdrift, ciffer-rul (350 ms), barer, handelsglimt, Båndet, grene, årsagschip | Cifre ≤ 4 Hz, former 60 fps |
| T2 Dit | Positionskortets nudge og blink (600 ms), fælden lyser inden for 3 øre, spøgelsets farveskift | Ved ændring |
| T3 Kamp | Mål, VAR, rødt kort, hval (hval uden hit-stop) | Én ad gangen |
| T4 Dit udfald | Lukkeauktion, stempel, Afregningen | Én gang. Tap springer over |

**Mål: BIF 31', 0–1500 ms**
- **−4 s:** opbygningen kan ses. Bolden suser mod FCK's felt, chippen viser "BIF-kontra", og Udsigten skifter.
- **0 ms:** motoren udsender MÅL. Alt canvas fryser i et hit-stop på 80 ms, pillen viser STOPPET, og ordreindgangen lukker.
- **80 ms:** en gul ring på 2 px løber fra hovedet med 1.200 px/s, kun inde i canvas, og sidechain-bølgen fortsætter usynligt nedad.
- **120 ms:** "0–1" ruller ind over 350 ms, og BIF-monogrammet blinker gult med henfald over 600 ms.
- **160 ms:** det skraverede bånd lægger sig ved hovedet. Grenen "Mål BIF → 27" bliver solid, de andre toner ud over 300 ms, og der står "≈ genåbner ved 26".
- **220–520 ms:** pumpen rammer fliserne (≈ 220 ms) og Målvejret (≈ 290 ms) med et dyk til 30 % og tilbage over 300 ms.
- **300 ms:** lyd: tryk-sus, messingakkord og en duck på −12 dB.
- **400 ms:** vinduet 30–35' fyldes til 100 og får ✓.
- **600 ms:** Udsigten skrives om.
- **1.200 ms:** genåbning med gabet "−30 øre". Fælden fyldes til 26 med ring og pluk, og en Hawkes-burst går i gang.
- **1.200–1.500 ms:** overshoot til ≈ 23, som dræner tilbage som genvindelig skade. "Efter målet" toner ind.
- "Ved sejr 510 kr" flytter sig ikke på noget tidspunkt.

**VAR-stop**
- Linjen bremser og fryser under skraveringen.
- Fremtidszonens tre grene klapper sammen til to spøgelseskurser ("Godkendt ≈ 32 / Annulleret ≈ 17"), og VAR-sandsynligheden glider (70 → 81 %).
- Handelslydene tier, og et blødt tik lyder hvert sekund.
- Ved dommen størkner det ene spøgelse, det andet fordamper over 400 ms, og gabet tegnes. Pumpen går igennem.

**Hvalhandel.** Et glimt på 10 px ved hovedet og en ring (kun i canvas) med subbas. Båndet viser "HVAL · 25.000 kr på BIF @ 26" i 2,4 s, chippen viser "−3 øre: storordre BIF", og flisen får genvindelig skade.

**Afregning.** Lukkeklokken lyder, linjen løber til 100/0, stemplet kommer, og Afregningen krydsfader ind. Der lyder én ren tone.

**Reduceret bevægelse** (MotionConfig `reducedMotion="user"`):
- Intet hit-stop, ingen ring og ingen pumpe. Ringen bliver et øjeblikkeligt farveskift.
- Hovedet ånder ikke, og cifrene ruller ikke (NumberFlow `animated={false}`).
- Grenene krydsfader.
- Data, stop, gab og farveskift bevares.

**Lydpalet** (rå Web Audio uden samples):
- Lyd starter først efter gate-tappet og bruger `navigator.audioSession.type='playback'`.
- Afspilningen planlægges 100 ms frem, med en master-gain og en mute-pille.

| Lyd | Syntese |
|---|---|
| Åbningsklokke | Sinus 880 + 1.320 Hz, henfald 1,4 s, −14 dBFS. Lukkeklokken er 660 + 990 Hz |
| Handelstik | 8 ms båndpasstøj (3–5 kHz), FCK lyst og BIF mørkt, højst 8/s, −30 dBFS. Tætheden følger Hawkes |
| Hval | Sinus 48 Hz med henfald over 300 ms, −12 dBFS |
| Mål | Lavpas-sweep 4 kHz → 200 Hz over 400 ms plus akkord: FCK glas (E5/B5), BIF messing (savtak gennem lavpas, A3/E4). Duck −12 dB i 600 ms |
| Handelsstop | To toner 660 → 440 Hz à 120 ms |
| Fælde fyldt | Stigende 990/1.320 Hz-pluk |
| Afregning | Én tone på 528 Hz, 1,8 s |
| Hallens trigger | Blip på 2 kHz synkront med freeze-flash |

## 11. Visuel identitet

| Token | Hex | OKLCH | Brug |
|---|---|---|---|
| bg | #07090C | oklch(13,9 % 0,008 256) | Nat |
| surface-1 / 2 | #0E1217 / #151A21 | oklch(18,0 % 0,012 254) / oklch(21,6 % 0,016 257) | Kort og bakke |
| hairline | #232A35 | oklch(28,3 % 0,023 259) | 1 px-linjer |
| text / text-2 | #E8EDF2 / #8A94A3 | oklch(94,4 % 0,009 248) / oklch(66,3 % 0,025 258) | Tekst |
| udsigt | #B9C2CE | oklch(81,1 % 0,020 256) | Udsigten |
| fck / fck-accent | #EAF6FF / #5CE1FF | oklch(96,7 % 0,018 240) / oklch(84,8 % 0,122 215) | Kun FCK |
| bif / bif-dim | #FFD200 / #8A7400 | oklch(87,7 % 0,180 93) / oklch(56,3 % 0,116 96) | Kun BIF |
| draw | #8A93A3 | oklch(66,1 % 0,026 262) | Uafgjort |
| up ▲ / down ▼ | #3DDC97 / #FF6B5E | oklch(79,7 % 0,164 160) / oklch(70,9 % 0,183 28) | Kun pris og P&L, altid med pil |
| trap | #A58BFF | oklch(71,0 % 0,166 292) | Fælder |
| halt | #8A8F98 | oklch(64,9 % 0,015 262) | Skravering |
| aah / gog | #F4EDE4 / #9AA8FF | oklch(94,9 % 0,014 74) / oklch(75,5 % 0,126 276) | Hallen. Prototypetoner; de rigtige klubfarver skal verificeres |

**Fremkaldelse**
- Sikkerhed = 1 − H(1X2)/ln 3, og kroma = sikkerhed^1,5 × maks, i fire trin (0 / 0,04 / 0,09 / 0,15).
- Derbyet starter gråt og fremkaldes mod favorittens holdfarve. En udligning dræner farven igen over 400 ms.

**Typografi** (Google Fonts, `display=swap`, `&text=` til tal og symboler; tabulære tal overalt):

| Rolle | Font | Størrelse |
|---|---|---|
| Heltetal | Roboto Flex, wght 600, opsz 72 | 56/56 |
| Fliser | Roboto Flex | 28/32 |
| Score | Roboto Flex | 24/28 |
| Kortværdier | Roboto Flex | 17/22 |
| Båndet | Roboto Flex, wdth 75 | 11/14 |
| Brødtekst | Inter Tight | 15/20 |
| Udsigten | Inter Tight | 14/20 |
| Meta | Inter Tight | 12/16 |
| Mikro | Inter Tight | 11/14 |
| Karakterer | Instrument Serif kursiv | Kun i Afregningen |

Kun GRAD-aksen animeres.

**Talformat.** `Intl.NumberFormat('da-DK')`: "1,82", "4.812 kr", "54 %" med hårdt mellemrum, "27'", "90+3'".

**Radier.** 4 (chips), 8 (fliser), 12 (kort), 20 (arkets top), 999 (piller).

**Materialer**
- Mat sort med hårlinjer på 1 px og 3 % korn. Kornet er en støjtekstur på 128 px, genereret i canvas ved opstart uden eksternt kald.
- En statisk projektørvignet på 4 % i toppen.
- Glød laves med dobbeltstreg. Ingen shadowBlur, ingen backdrop-filter over canvas og ingen skygger.

**Ikoner**
- Streger på 1,5 px. Nåle: ● mål, ◆ VAR, ▮ rødt kort.
- Typografiske monogrammer FCK, BIF, AaH og GOG i stedet for klubvåben.
- Ingen konfetti, mønter, ædelsten eller maskotter.

## 12. Håndbold (Aalborg–GOG)

**Hallen er et oscilloskop.** Fodbold er spring, håndbold er signal.

| y (px) | Element |
|---|---|
| 47–91 | Kampbånd: "AaH 21–20 GOG · 38'" og "OVERTAL GOG 1:22", når det gælder |
| 91–123 | **Angrebsbåndet:** holdet med bolden, antal afleveringer og "Mål i dette angreb? 58". Ved passivt spil vises 4 pips, der slukker én ad gangen (IHF: højst 4 afleveringer), og prisen falder ≈ 58 → 49 → 41 → 30 |
| 131–451 | **Skopet (helt):** målforskellen som et firkantsignal i fosfor med efterglød. Gitteret er banens egne linjer: midterlinjen er 0, de stiplede 9-m-linjer er ±5 og 6-m-linjerne ±8. AaH over nul (#F4EDE4), GOG under (#9AA8FF). Overtal vises som et skraveret bånd på 2:00 og er kun visuelt |
| 459–539 | **Triggerpanel:** træk den stiplede triggerlinje til et niveau. Deadline-chips: "før 45' · før 50' · før slut". Udlæsning: "Aalborg +4 før 45'? 42 øre · 38 af 100" |
| 547–623 | Fliser for Aalborg / X / GOG (samme komponent som i fodbold) |
| 631–715 | Positionskort med fader (samme komponent) |

**Pris for triggeren.** Diff X_t er Brownsk med drift μ (≈ +0,04 mål/min for Aalborg) og σ = 1,0/√min. Afstanden til niveauet er h = (a − x₀) − ½ (kontinuitetskorrektion):

P = Φ((μτ − h)/(σ√τ)) + e^(2μh/σ²)·Φ((−μτ − h)/(σ√τ))

Ved 38' og Aalborg +1 giver "+4 før 45'" (τ = 7) fair 38 %, og med 8 % margin bliver ask 42. MC krydstjekker hvert 3. tick, og afviger de mere end 3 pp, bruges MC. "Føringsskifte" er det samme instrument med niveauet på den anden side af nul.

**Afregning og bevægelse.** Når sporet krydser niveauet, fryser skopet i 120 ms og blinker. Triggersymbolet tænder, og kontrakten afregnes til 100. Ved deadline falder kontrakten til 0.

**Motor**
- Angrebs-Markovkæde med ≈ 30 kampsekunder pr. angreb (≈ 2 s realtid).
- P(mål | angreb): Aalborg 0,60 og GOG 0,55, +15 pp i overtal. 7 m-kast giver 0,75. Timeouts og tomt mål ved 7 mod 6.
- Målet er ≈ 61 mål pr. kamp.
- Uret er 1 kampminut = 4 s, som i fodbold. Seed: `hashSeed("AaH-GOG·2026")`.

Efterglød bruges som sweep-teknik: kun en smal stribe ryddes pr. frame. Der er ingen partikler og ingen candlesticks.

## 13. Demo-instruktør og 90-sekunders manuskript

**Instruktøren** åbnes med et langt tryk på Ø-logoet.
- Knapper: Mål FCK/BIF · VAR · Rødt kort · Hval · Spol til … · Demo 90.
- Tidslinjen er én JSON-fil, og den samme fil bruges til autoplay og Playwright-replay.
- URL-format: `#kamp?seed=…&tick=…&dir=demo90&qa=1&fx=0`.
- `window.__sim` har `getState()`, `setTick(n)`, `fire(ev)` og `hash()`.
- I demotilstand udfører en tydeligt markeret **spøgelsestommel** brugerens handlinger, efter at gaten er tappet.
- Med `naturalGoals:false` bliver uscriptede skud til redninger eller forbiskud, men prismodellen kender ikke manuskriptet.
- Scriptede mål har altid synlig opbygning, nemlig bolden i feltet og et π-bias før målet.

```json
{ "seed":"FCK-BIF·Parken·2026·retur", "naturalGoals":false,
  "events":[
   {"at":"0:00","type":"auction","open":49},
   {"at":"9:00","type":"whale","team":"BIF","kr":25000},
   {"at":"18:00-24:00","type":"pressure","team":"FCK","corners":3,"piBias":0.45},
   {"at":"30:00","type":"buildUp","team":"BIF","secs":60},
   {"at":"31:10","type":"goal","team":"BIF","xg":0.38},
   {"at":"63:00","type":"buildUp","team":"FCK","secs":60},
   {"at":"64:05","type":"goal","team":"FCK","xg":0.41,"var":{"secs":8,"p0":0.70,"verdict":"godkendt"}},
   {"at":"89:20","type":"goal","team":"FCK","xg":0.33},
   {"at":"90+3","type":"fulltime"}],
  "spol":[["1:00","8:00",16],["9:30","26:00",16],["26:00","30:00",4],["31:30","54:00",16],["54:30","63:00",16],["64:30","88:00",16],["89:40","90+3",16]],
  "gestures":[{"at":"0:30","do":"hold","target":"tile:FCK","kr":250},{"at":"9:40","do":"trap","price":35,"kr":100},
   {"at":"20:00","do":"tap","target":"position"},{"at":"54:10","do":"drag","target":"mv:60-70","kr":50},
   {"at":"89:30","do":"fader","notch":"indsats","commit":false}] }
```

Alle priser i manuskriptet er **≈ mål**. Testen `tune-demo` kører demo90 headless og kræver, at nøglepriserne ligger inden for ±2 øre. Fejler den, justeres instruktørens opbygningsparametre, aldrig prismodellen.

| Tid | Kamp | Hvad der sker |
|---|---|---|
| 0:00 | – | Lobbyen. Derby-kortet "49 øre" ånder; Hallen viser "16'" |
| 0:03 | – | Tap på kortet, så gaten "Tryk for at åbne handlen". Tappet låser lyd og rAF op, og ViewTransition kører |
| 0:04 | 0' | Åbningsauktion med klokke: "Åbner 49 øre". Startfløjt kl. 0:06 |
| 0:07 | 0:30 | Seeren holder på FCK til 250 kr og glider op. Låseringen kører, og købet fyldes: **510 andele @ 49 · ved sejr 510 kr**. Spøgelset fryses |
| 0:10 | → 8' | Spol ×16 |
| 0:16 | 9' | **Hval** 25.000 kr på BIF @ 26: ring, "HVAL" i Båndet og "−3 øre: storordre BIF". FCK går 49 → ≈ 46; skaden dræner, og informeret flow fører kursen til ≈ 48 |
| 0:21 | 9:40 | Langt tryk ved 35, og bakken viser "Sæt fælde · Køb FCK ved 35 · 100 kr". Tap |
| 0:24 | → 26' | Spol ×16. Tre FCK-hjørner giver "+6 øre: 3 hjørnespark på 4 min", og kursen stiger til ≈ 55. Tap på kortet viser spøgelset: "Foran tempo · +4 øre" |
| 0:28 | → 30' | Spol ×4. Udsigten: "Tiltagende FCK-pres. 45 % risiko for mål inden pausen." |
| 0:32 | 30–31' | Normal tid. Bolden suser mod FCK's felt med chippen "BIF-kontra" |
| 0:36 | 31' | **MÅL BIF** (§10). Gab 55 → ≈ 25. Fælden fyldes til ≈ 26: **384 andele**, "9 øre bedre". "Efter målet" ≈ 26 dukker op |
| 0:39 | → 54' | Spol ×16 med pausekort på 1 s |
| 0:46 | 54' | Udsigten: "FCK presser for udligning. 55 % risiko for mål inden 70'." Seeren trækker over 60–65 og 65–70, luppen viser "Mål 60–70' · 38 øre", indsatsen er 50 kr, og købet fyldes: **131 andele** |
| 0:51 | → 64' | Spol, derefter opbygning i normal tid |
| 0:57 | 64' | **MÅL FCK → VAR.** Schrödinger-spøgelserne "Godkendt ≈ 32 / Annulleret ≈ 17" og "Målet står? Ja 73 · Nej 35". VAR-sandsynligheden går 70 → 81 % |
| 1:05 | 64' | **Godkendt.** Gab +15, overshoot til ≈ 34 og tilbage til ≈ 32. Vinduet ✓ +131 kr |
| 1:08 | → 89' | Spol ×16 og opbygning |
| 1:18 | 89' | **MÅL FCK 2–1**, gab til ≈ 98 |
| 1:20 | 89' | Faderen trækkes til "Indsats hjem": "Sælg 365 andele → 350 kr nu · 529 kører gratis". Seeren slipper uden at bekræfte, og knappen fjedrer tilbage |
| 1:23 | 90+3' | Slutfløjt og lukkeauktion. Stemplet "AFREGNET · 894 kr" |
| 1:27 | – | **Afregningen**: floden, "Udbetalt 1.025 kr · indsat 399,52 kr · +625,48 kr" og karaktererne (mål): Mål 60–70' "Brillant !!", FCK-køb "Godt køb !", fælden "Præcist" |
| 1:30 | – | Swipe ned. Lobbyen viser "Hallen · Aalborg 21–20 GOG · 38'" |

Regnskabet: (510 + 384) × 1 kr + 131 × 1 kr = 1.025 kr. Indsats: 249,90 + 99,84 + 49,78 = 399,52 kr.

Valgfri forlængelse på 20 s i Hallen: en trigger trækkes til "+4 før 45' · 42", sporet rammer ved 43', freeze-flash, og kontrakten afregnes til 100.

## 14. Fase 2 (udskudt)

1. "Køb denne udsigt": slutresultat-termini ved 90' ("1–0 ×9 · 2–1 ×4") og korrekt resultat købt fra bakken.
2. Udfaldskort med snap-regioner: L-form for Begge scorer, diagonal for handicap, række for sejrsmargin.
3. TAKT's mønster-grammatik: betingede og kædede vinduer.
4. Stop-loss og take-profit på fælder. Peak-hold-mærker.
5. Målscorer-familie med fiktive navne.
6. Parken-puljen (parimutuel med synlig take på 10 %) og sæsonkontrakter (top-6, Mester 2027).
7. Trader-lag: stige og heat field.
8. Håndbold: overtal-marked, interval for mål i alt, kappet overlegenhed og rytmebane.
9. Vejrkort-lobby over Danmark og et delbart kort (PNG) med kampens flod.
10. Prognose-identitet med kalibrering bag en "Pro"-toggle. Paraply-afdækning.
11. Straffe-takeover med zone-tap. HOPs-flimmer på kurve.
12. Synk med TV, 1:1-ur som standard, og et Pixi-FX-lag, kun hvis governor-data tillader det.
13. Derby-VIX og andenordensmarkeder.

## 15. Acceptkriterier

1. **Determinisme:** samme seed, tidslinje og tick giver samme `__sim.hash()` i tre kørsler. Fem golden screenshots (åbning, hval, mål-frame ved 160 ms, VAR-split, Afregningen) afviger højst 0,1 % pixeldiff med `page.clock` og `animations:'disabled'`.
2. Σ ask for 1X2 = 103 ± 1 øre i hvert tick uden for stop (Vitest-egenskab over 10.000 ticks).
3. MC's slutandele for 1X2 ligger inden for ±2,5 pp af lukket form ved hvert resultat, også i main-thread-fallback.
4. Positionskortets værdi = Σ andele × bid/100 på øret, sammenlignet med motoren.
5. Køb giver ⌊100·S/ask⌋ hele andele, og der trækkes k·ask/100 kr.
6. En fælde fyldes aldrig under et stop. I et gab fyldes den til første ask efter genåbning, når ask ≤ L. Kun købsfælder findes, højst 3.
7. Under VAR afvises enhver ordre undtagen "Målet står?". Gabets etiket = ask efter − ask før.
8. Udbetalingstal ("Ved sejr", bakkens udbetaling) er synlige og udækkede i hver prøve hver 50. ms gennem mål-, VAR- og afregningssekvenserne (elementFromPoint).
9. **Stille chrome:** Kampbånd, fliserammer, kort og bundbjælke flytter sig 0 px under alle T3/T4-sekvenser. Ingen transform med translate uden for heltecanvas.
10. Højst én T3/T4 er aktiv ad gangen (lyttere på motorens animationskø).
11. Hver ændring i mid på 2 øre eller mere inden for 10 s har et årsags-id (chip, båndhandel eller nål) i motorens revisionslog.
12. Ingen UI-streng indeholder "." som decimaltegn. Tusinder bruger "."; "%" har hårdt mellemrum. Ingen TAF-, okta-, Richter- eller Brier-termer forekommer.
13. Alle handlingers bekræftelser ligger med centrum ved y ≥ 470. Alle hitzoner er mindst 44 × 44 px. axe giver 0 kritiske fund.
14. Mint og koral bruges aldrig på holdelementer (token-lint) og står altid med ▲/▼.
15. **Ydelse:** p95 frame ≤ 16,7 ms ved 1× og ≤ 33 ms ved 4× CPU-throttle. Under 5 % tabte frames over 20 s live-spil inklusive et mål. Ingen long tasks eller LoAF over 50 ms. React højst 3 commits/s. Heap-vækst under 5 MB pr. 60 s. CLS 0.
16. Initial JS ≤ 250 KB gzip uden WebGL. Første live-frame ≤ 1,5 s ved 4×. Højst 2 synlige canvas.
17. **CSP-paritet:** 0 `securitypolicyviolation`-hændelser og 0 requests til andre værter end self, fonts.googleapis.com og fonts.gstatic.com. Virker i en cross-origin iframe-harness.
18. Med Worker blokeret prissættes Kurv og spøgelse inden for 1 s, uden long tasks over 50 ms.
19. **Lyd:** ingen AudioContext før første tap. Mute virker inden for 50 ms. Højst 8 pluk pr. sekund.
20. Ved reduceret bevægelse er der intet hit-stop, ingen ring, pumpe eller åndedræt, men pristeksten ændrer sig stadig over 10 s.
21. Demo90 når fuld tid på 90 ± 2 s. Udbetalt = Σ andele i vundne kontrakter (1.025 kr), indsat = 399,52 kr, og `tune-demo` holder nøglepriserne inden for ±2 øre.
22. **Kalibrering:** over 1.000 seedede derbyer er snittet 2,7 ± 0,15 mål og FCK-sejr 48 ± 3 %. Over 200 seedede håndboldkampe er snittet 58–64 mål. Triggerprisen ligger inden for ±3 pp af MC.
