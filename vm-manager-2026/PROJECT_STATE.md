# VM MANAGER 2026 — PROJECT STATE (varig hukommelse)

> Komprimeret tilstand så samtalen kan fortsætte uden hele historikken.
> Sidst opdateret: efter R3 (gruppespil slut), bygger R4 (1/16-finaler / R32).
> Bruger: Frederik · holdnavn "Middelmådige Arkæologer" · GULDHOLD (frie transfers).

═══════════════════════════════════════════════════════════════════
## 1. SPILLETS REGLER (eksakt — kilde: data/Regler.txt)
═══════════════════════════════════════════════════════════════════
Budget start: 50,0 mio. Holdværdi vokser via spillervækst; bank = uforbrugt.

POINTSYSTEM (vækst i kr.), implementeret i src/scoring.py:
- Mål: GK 250k · DEF 175k · MID 150k · ATT 125k   | Selvmål -50k
- Assist 60k (ikke v. straffe/selvmål/riposter) · Skud på mål 10k (kun hvis IKKE mål)
- Afgørende scoring: sejr 40k / uafgjort 20k (1 pr. kamp, til målscorer)
- Kampens spiller 33k · Gult -20k · 2.gult -20k · Rødt -50k
- Holdpræstation (alle på banen): Vundet 25k / Uafgjort 5k / Tabt -8k
- Pr. holdmål +10k · pr. indkasseret -8k (KUN mens spilleren er på banen)
- På banen 7k · ikke på banen -5k
- Rent mål (kræver 60+ min): GK 75k · DEF 50k (MID/ATT 0)
- GK-redning 5k · reddet straffe 100k · brændt straffe -30k · hattrick 100k
- Straffesparkskonkurrence vundet 25k (knockout)
- KAPTAJN: bonus = spillerens vækst i runden (kun hvis POSITIV) → reelt x2 på opadgående. Skift af kaptajn er gratis.
- Bankrente 1 %/runde af uforbrugt bank.

FORMATIONER (lovlige): 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1.
→ GK=1, DEF 3-5, MID 3-5, ATT 1-3. (5-2-3 er IKKE lovlig — MID min. 3.)

TRANSFERS/KONTRAKTER:
- Køb koster 1 % transfergebyr af spillerens aktuelle pris.
- R1-opbygning gratis. Hver udskiftning koster 1 "kontrakt".
- Basishold = 3 kontrakter i alt. GULDHOLD = frie transfers (brugeren har guld).
- Maks. 4 spillere fra samme nation FREM TIL kvartfinalerne. Grænsen
  BORTFALDER fra kvartfinalerne (R6) → kan stable 5-6 fra én nation til semi/finale.
- Hold slået ud deaktiveres ved rundens afslutning (kan sælges, ikke købes, ændrer ikke værdi).
- Handel åbner kl. 9 dagen efter sidste kamp i runden; lukker ved første kamp i ny runde.

RUNDESTRUKTUR: R1-R3 gruppespil · R4=1/16 (R32) · R5=1/8 · R6=KF · R7=semi+bronze+finale.

═══════════════════════════════════════════════════════════════════
## 2. MODELLEN (repo vm-manager-2026/)
═══════════════════════════════════════════════════════════════════
Markedsdrevet: outright-odds + Golden Boot-odds + kampodds → ratings (fittet til
titelmarkedet + kamp-ankre) → 24k korrelerede turneringssimulationer → eksakt
pointsystem → flerrunde-ILP. Kode engelsk, output dansk.
- src/scoring.py  pointsystem (+ tests/test_scoring.py)
- src/ingest.py   priser, outright-odds, GB-odds, fixtures
- src/model.py    ratings-fit + turneringssim + MATCH_ANCHORS (R1+R2-kampodds)
- src/players.py  p_start (P_START_OVERRIDE = bekræftede opstillinger), målandele
- src/simulate.py korreleret vækst-sim (kaptajnbonus asymmetrisk = E[max(vækst,0)])
- src/optimize.py flerrunde-ILP (EV-max, miniliga)
- run.py / optimize_r2.py  entrypoints
- gen_team_pdf.py / gen_team_graphic.py / gen_r3_final.py  visualiseringer
- data/: prices.csv, odds_outright.csv, odds_scorer.csv, fixtures.csv,
  actual_team_r1.csv, stats_after_r3.csv (R3-resultater m. Index/Trend/Aktiv)
VIGTIGT: Gruppespils-Monte Carloen er nu FORÆLDET — knockout er et FAST bracket.
Næste modeltrin (hvis ønsket): knockout-bracket-simulator (propagér hold gennem
R32→finale med kampodds → P(når finale) + forventet vækst R4-R7 pr. spiller).

═══════════════════════════════════════════════════════════════════
## 3. STRATEGI-PRINCIPPER & LÆRDOMME (hele sæsonen)
═══════════════════════════════════════════════════════════════════
- EV er målet (lille vennegruppe-liga). Kaptajnvalget er den største enkeltedge.
- Billigt bagude / dyrt fremme. team_goal +10k til alle gør billige forsvarere på
  målstærke favoritter mod svage hold meget effektive.
- ALTID kun bekræftede startere (Bold/Frederik Ingemann-opstillinger). Heuristik
  alene fejler: Bremer-fejlen (reserve sat som starter, p_start 0,86) → verificér.
- Dødt opgør / allerede-kvalificeret = ROTATION → undgå (Medina/Argentina R3,
  Brown/Tyskland R3, Messi ville sidde over R3). Knockout = fuld styrke (modsat).
- Longshot-bias: små holds enere overvurderes af GB-odds → deflater halen.
- Verificér ALTID modstander-styrke + om favoritten faktisk har noget at spille for.
- Kaptajn-hierarki: straffeskytte/stjerne på storfavorit mod svagt hold, høj p_start.

═══════════════════════════════════════════════════════════════════
## 4. RESULTATER & HISTORIK
═══════════════════════════════════════════════════════════════════
- R1 (kaptajn Haaland v Irak): +1,70m total (Haaland +407k, Mbappe +324k, Brown +309k). Top ~P85.
- R2 (kaptajn Mbappe v Irak): bl.a. Oyarzabal +415k, Mbappe +395k, Haaland +379k (solgt før R3? nej, beholdt R2).
- R3 (kaptajn Mbappe v Norge): Saibari +186k, Messi +167k (købt), Mbappe +194k, Simon +132k.
- Gruppe-resultater: Frankrig vandt gr. I (3-1 Senegal, 3-0 Irak, 4-1 Norge).
  Argentina 9 point (slog Algeriet 3-0, Østrig 1-0 m. Messi-mål, ...). Spanien 1.
  Marokko 2'er i gr. C bag Brasilien. Norge 2'er i gr. I.

═══════════════════════════════════════════════════════════════════
## 5. NUVÆRENDE HOLD (R4 / R32-build) — bank ~0,66m... (BEKRÆFT)
═══════════════════════════════════════════════════════════════════
Formation 3-4-3. Kaptajn pt. Mbappe (skift til MESSI anbefalet, se §6).
- GK : Unai Simon (Spanien)        ~5,38m
- DEF: Chadi Riad (Marokko ~2,22m) · Douglas Santos (Brasilien ~2,72m) · Luc De Fougerolles (Canada ~2,12m)
- MID: A. Tchouameni (Frankrig ~3,65m) · I. Saibari (Marokko ~4,12m) · Jhon Arias (Colombia ~3,13m) · A. Ounahi (Marokko)
- ATT: M. Oyarzabal (Spanien ~7,98m) · K. Mbappe (Frankrig ~10,9m) · Lionel Messi (Argentina ~9,15m)
NB: 3 Marokkanere (Riad, Saibari, Ounahi) — alle mod Holland i R32 (svær). Klyngerisiko.
"Aldrig-sælg"-kerne mod finalen: Mbappe, Messi, Oyarzabal, Simon, Tchouameni (top-3 favoritter).

═══════════════════════════════════════════════════════════════════
## 6. R32-BRACKET & R4-PLAN
═══════════════════════════════════════════════════════════════════
Titelodds efter grupper: Frankrig #1 (~+360/460) · Argentina #2 (~+390) · Spanien #3 (~+500) · Brasilien/England/Tyskland/Portugal efter.
R32-kampe for dine hold:
- Argentina–KAP VERDE  🟢 letteste kamp (Messi: Index 126, Trend +3278, 6 mål) → KAPTAJN R4
- Frankrig–Sverige     🟢 (Mbappe, Tchouameni)
- Spanien–Østrig       🟢 (Oyarzabal, Simon)
- Brasilien–Japan      🟡 (Santos)
- Canada–Sydafrika     🟡 (De Fougerolles)
- Colombia–?           🟡 (Arias — bekræft modstander)
- Marokko–HOLLAND      🔴 svær (Riad, Saibari, Ounahi) → sælg-kandidater

R4-ANBEFALING:
1. KAPTAJN → MESSI (Kap Verde, hottest form + svageste modstander).
2. Sælg Saibari (Holland-kamp, Trend -1547) → køb Bradley Barcola (Frankrig MID
   4,4m, Index 90, Trend +961, v Sverige, holdbar). Klar opgradering.
3. Overvej at reducere Marokko-klyngen (Riad/Ounahi) — alle mod Holland.
   Erstat med billige startere på lette kampe (Argentina/Spanien/Frankrig).
4. Behold top-3-favorit-kernen hele vejen.

VEJ MOD FINALEN: hold Mbappe/Messi/Oyarzabal/Simon/Tchouameni. Cykl billige slots
efter kamp. Fra KF (R6) bortfalder nationsgrænsen → stak 5-6 fra finalist-nation(er).

═══════════════════════════════════════════════════════════════════
## 7. TJEKLISTE FØR HVER DEADLINE
═══════════════════════════════════════════════════════════════════
[ ] Bekræftede opstillinger (knockout=fuld styrke, men tjek skader/karantæne i CSV)
[ ] Friske kampodds for rundens kampe
[ ] Bank + aktuelle salgs-/købspriser (afgør budget)
[ ] Kaptajn = højeste single-kamp-EV (favorit mod svagest, straffeskytte, høj p_start)
[ ] Sælg spillere hvis hold er slået ud / har svær kamp

═══════════════════════════════════════════════════════════════════
## 8. KNOCKOUT-MODEL (knockout.py) — FREMADSKUENDE, bygget efter R3
═══════════════════════════════════════════════════════════════════
knockout.py simulerer det FASTE R32-bracket 20k gange (ratings fra
data/odds_title_r32.csv), og giver pr. spiller: forventet vækst R4-R7 +
P(når finalen), samt en ILP der finder max-værdi-holdet (nationsgrænse 4).
Bracket + flow er hardkodet i knockout.py.

P(NÅ FINALEN) — nøglehold: Argentina 58% (LETTESTE vej!) · Frankrig 39% ·
Spanien 31% · Brasilien 24% · England 22% · Portugal 6% · Holland 6% ·
Colombia 1% · Marokko 1% · Canada 0%.

DINE SPILLERES forventede R4-R7 vækst: Messi 1079k(58%) · Mbappe 744k(39%) ·
Oyarzabal 549k(31%) · Simon 310k · Santos 152k · Arias 154k(kun R4) ·
Tchouameni 132k · Saibari/Riad/Ounahi 21-65k (Marokko ~DØD, 1% finale) ·
De Fougerolles 26k (Canada ud).

STRATEGI HERFRA (data-drevet): "ARGENTINA-OVERVÆGT + premium-kerne".
Argentina trak det letteste bracket (58% finale) → stak 4 Argentina (cap-max
til KF). Behold premium-kerne (Messi, Mbappe, Oyarzabal). Sælg døde stier
(Marokko-trio, Canada; Colombia efter R4). Kaptajn = Messi (58% finale, højest EV).
Fra KF (R6) bortfalder nationsgrænsen → gå endnu tungere på overlevende favoritter.
Guld = frie transfers, men 1% gebyr → undgå unødig churn; målrettede skift.

═══════════════════════════════════════════════════════════════════
## 9. RETTELSE (efter R3, verificeret skærmbillede) — HOLDET HAR HAALAND, IKKE MESSI
═══════════════════════════════════════════════════════════════════
Tidligere §5 var FORKERT. Verificeret R4-build (3-4-3, kaptajn Mbappe):
GK Unai Simon(Spa 5,38m) | DEF Chadi Riad(Mar 2,22) Douglas Santos(Bra 2,72)
Luc De Fougerolles(Can 2,12) | MID Azzedine Ounahi(Mar 3,11) A.Tchouameni(Fra 3,65)
Jhon Arias(Col 3,13) Ismael Saibari(Mar 4,12) | ATT Mikel Oyarzabal(Spa 7,98)
Kylian Mbappe(Fra 10,91 ©) Erling Haaland(Nor 9,28).  Bank 0,32m. Aldrig haft Messi.
Haaland fik -5k i R3 (hvilet vs Frankrig). 3 Marokkanere mod Holland i R32 (1% finale).

R4-NØGLEBESLUTNING: SÆLG Haaland (Norge, 0% finale, møder Brasilien i R16) →
KØB Messi (Argentina, 47% finale, letteste vej). ~cash-neutralt (9,28m→9,15m).
Forward-EV: Haaland 271k vs Messi 820k. Haaland dog +27k bedre i SELVE R4
(mod Elfenbenskysten vs Messi mod Kap Verde-bus) → "vent 1 runde" giver kun +27k.
Anbefaling: skift nu (lås den lette vej). Kaptajn forbliver Mbappe (247k > Messi 191k).
Plus sælg Marokko-trioen → 2 Argentina-CB (Otamendi+L.Martinez, clean sheet v Kap Verde) + billig mid.
