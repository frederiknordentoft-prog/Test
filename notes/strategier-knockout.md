# Strategi — Knockoutfasen (VM Manager / holdet.dk)

> Kildebemærkning: Det uploadede strategi-billede ("VM Manager: Strategier til knockoutfasen", Bold.dk) var en meget lav-opløst (225 px bred) lang screenshot og kunne ikke OCR'es pålideligt. Strategi-URL'en gav 404. Indholdet herunder er rekonstrueret fra: holdet.dk's "Den ultimative guide til VM Manager", Bold-artiklernes intro/noter, BetXpert's VM-2026-manager-guide, samt min egen lodtrængnings- og odds-research. Behandl det som mit arbejdsnotat, ikke et ordret citat.

## Spilmekanik (huskeseddel)
- 11 startere + anfører (dobbelt point). Begrænset antal transfers pr. runde; spillerværdi ændrer sig → "vækst" giver budget.
- Point: mål, assist, clean sheets, spilletid, kort/straf m.m. (forsvarere/MV scorer på clean sheets; angribere på mål/assist).
- **Runder = matchdays.** R1–R3 = gruppespil. **R4 = 1/16-finaler (Round of 32)**, R5 = 1/8 (R16), R6 = kvart, R7 = semi/finale.

## Kerne-model for knockout
**Maksimér: (forventede kampe tilbage) × (pointloft pr. kamp) — og fang vækst.**
1. **Kampe tilbage dominerer.** Hver runde ryger halvdelen hjem. En spiller fra et hold der når finalen spiller op til ~5 kampe mere; et hold der ryger i R32 giver 0. → Bak hold der er **favoritter + har let vej**.
2. **Ram favoritterne hver runde** (gennemgående råd fra alle managerekspert­erne): tjek lodtrækningen og sæt holdet efter hvem der møder svagest modstand.
3. **Vækst:** spillere på vindende favoritter stiger; udslåede hold falder. Sælg spillere FØR deres hold ryger (typisk før runden hvor de er underdog).
4. **Clean sheets er guld i knockout** (tætte kampe, forlænget spilletid) → billige forsvarere/MV fra favoritter er value.
5. **Startsikkerhed:** brug Bolds forventede startopstillinger (grøn/gul/rød) — undgå "på vippen"-spillere og roterede stjerner.

## Anfører
- Dobbelt point → højeste loft × letteste kamp. Roter over runderne (holdet-vinderen brugte ~8 forskellige anførere over turneringen).
- Differential-anfører = stærkeste varians-løftestang, hvis man jagter føring.

## Varians (når man fører sin miniliga)
- Klassisk: fører man, sænker man variansen (matcher feltet). Men kan man "tåle mere varians" (komfortabel føring / jagter global placering):
  - Tag **differentialer med højt loft på favoritter med let vej** (smart varians) — IKKE tilfældig gambling.
  - Reducér "dum varians": flere lav-lofts spillere (forsvarere) på ét coin-flip-hold = dårlig EV.

## Lodtrækning + odds (R32-kontekst, pr. 28/6)
- **Favoritter:** Frankrig (+360), Argentina (+390), Spanien (+500/600), England, Portugal; så Brasilien (+1200), Holland; outsidere: Marokko (+4000), Norge m.fl.
- **Letteste R32 + bløde veje:** **Argentina** (vs Kap Verde → Colombia/Ghana), **Spanien** (vs Østrig), **Frankrig** (vs Sverige), **Colombia** (vs Ghana → Schweiz/Algeriet).
- **Sværeste blandt mine hold:** **Marokko vs Holland** (coin-flip).

## Mit hold (R3) og R4-plan
**Hold:** Simón(ESP, MV) · Riad(MAR) · de Fougerolles(CAN) · D. Santos(BRA) · Ounahi(MAR) · Saibari(MAR) · Tchouaméni(FRA) · Arias(COL) · Oyarzabal(ESP) · **Mbappé(FRA, C)** · Haaland(NOR).

**Diagnose:**
- For tungt på **Marokko (3 spillere)** mod Holland — to af dem lav-lofts (Riad-forsvar; Ounahi startede ikke i MD3). Dum varians.
- **Ingen på turneringens letteste dybe vej: Argentina.**

**R4-plan (prioriteret, kør oppefra ift. transfers/vækst):**
1. **SÆLG Chadi Riad → KØB Argentina-angriber** (Messi/J. Álvarez/Lautaro). Lav-lofts forsvarer på sværeste kamp → højt loft på favorit med letteste vej.
2. **SÆLG Ounahi → en favorit-aktiv mere** (fransk/spansk angriber, eller opgrader forsvarer til ESP/FRA for clean sheet + vækst). Trimmer Marokko til **kun Saibari** (min smarte upside).
3. **BEHOLD Saibari** (i form, scorede vs Brasilien) som ene Marokko-chance.
4. **Anfører: Mbappé** (vs Sverige). Gem differential-anfører til senere runde.
5. **Hold øje:** Haaland hvilet i MD3 → starter R32, men kort runway (R16 vs Brasilien) → sælg-kandidat efter R32. D. Santos/Brasilien: brutal QF-vej.

**Tænk fremad (R5/R16):** læg vægt på Argentina/Frankrig/Spanien/Colombia (venligste 2-runders-udsigt). Behold én mellempris-flex pr. kæde. Pas på Argentina-køb + Arias kan mødes i R16.

## Kilder
- holdet.dk: [Den ultimative guide til VM Manager](https://blog.holdet.dk/den-ultimative-guide-til-vm-manager/)
- Bold.dk: [Startopstillinger til 1/16-finalerne](https://bold.dk/fodbold/stillinger/fifa-vm/nyheder/vm-manager-startopstillinger-til-116-finalerne)
- BetXpert: [VM 2026 Manager: Tips og strategi](https://www.betxpert.com/artikel/vm-2026-manager)
- Lodtrækning: [Wikipedia – 2026 WC knockout stage](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage)

---

## DATA-KVALIFICERET (holdet spillerstatistik-CSV, 1250 spillere) + startopstillings-tjek

**"Index" = akkumulerede holdet-point i turneringen** (historisk form). Krydstjekket mod alle 32 startopstillinger.

### Mit hold — tal (Index | pris | ejer%)
| Spiller | Idx | Pris | Ejer% | Startopstilling | Dom |
|---|---|---|---|---|---|
| Mbappé (FRA,A) | 84 | 10.9M | 21% | ✅ starter (vs Sverige) | Behold, anfører-kandidat |
| Saibari (MAR,M) | **149** | 4.1M | 22% | ✅ starter (vs Holland) | **Behold** — mit bedste point-hold |
| Haaland (NOR,A) | 84 | 9.3M | 13% | hvilet R3 → starter R32 (vs CIV) | **Sælg-kandidat** (kort runway) |
| Oyarzabal (ESP,A) | 60 | 8.0M | 14% | ✅ starter (vs Østrig) | Behold (let kamp) |
| Riad (MAR,F) | 100 | 2.2M | 9% | ✅ starter (vs Holland) | OK værdi, men svær kamp |
| D. Santos (BRA,F) | 80 | 2.7M | 6% | ✅ starter (vs Japan) | Behold |
| de Fougerolles (CAN,F) | 56 | 2.1M | 1% | ✅ starter (vs Sydafrika) | Behold (billig) |
| Tchouaméni (FRA,M) | 42 | 3.7M | 11% | ✅ starter | Behold |
| Jhon Arias (COL,M) | 41 | 3.1M | 3% | ✅ starter (vs Ghana) | Behold (blød vej) |
| Ounahi (MAR,M) | **35** | 3.1M | 2% | ❌ **bænket R3** | **Sælg** |
| Simón (ESP,MV) | – | 5.4M | – | ✅ starter | Behold (clean sheet) |

### Prioriterede R4-transfers (data-drevet)
1. **Haaland (9.3M, 84) → Messi (9.2M, 126, 6 mål, straffe, vs Kap Verde).** Næsten gratis bytte; +42 idx, letteste R32, længst runway. **Den vigtigste handel.**
2. **Ounahi (3.1M, 35, bænket) → Manzambi (SUI, 3.7M, 195 idx, kun 2,4% ejet, starter, vs Algeriet).** Elite-differential = den smarte varians. (Alt.: Quiñones, MEX, 143 idx, 1% ejet, 3.5M, Azteca vs Ecuador.)
3. **(valgfri) Riad (2.2M) → Medina (ARG, 2.7M, 87 idx, vs Kap Verde).** Clean-sheet på favorit + trimmer Marokko til kun Saibari.

→ Efter dette: Marokko-eksponering = kun Saibari (mit topnavn). Tilføjet Messi + Manzambi (+ Medina) = favoritter/differentialer med lette R32-kampe.

### Anfører R4
**Messi (vs Kap Verde)** hvis købt — højeste idx (126) + letteste modstander. Ellers **Mbappé (vs Sverige)**.

### FÆLDER (krydstjek afslørede)
- **Undav (TYS, 163 idx) = BÆNKET** (Tysklands front-3: Havertz/Wirtz/Musiala). Køb IKKE.
- **Yamal (31), Pedri (19), J. Álvarez (27), Lautaro (36)** = lavt index (underpræsteret) — ingen køb trods navn/pris.

### Bedste differentialer (Index≥120, <6% ejet, BEKRÆFTEDE startere)
Manzambi (SUI 195) · Quiñones (MEX 143) · Pepe (CIV 131) · Romo (MEX 130) · Vargas (SUI 125) · Jonathan David (CAN 122) · Rahimi (MAR 122) · Wissa (COD 122) · Muñoz (COL 127).
*Note: Brobbey (NED 196) er bedst af alle, men Holland = Marokkos modstander (hedge mod egne spillere).*

### Billige clean-sheet-forsvarere (favoritter)
Medina (ARG 87, 2.7M, vs Kap Verde) · Laporte (ESP 71, 4.8M, vs Østrig) · Cubarsí (ESP 65) · Kounde (FRA 59).
