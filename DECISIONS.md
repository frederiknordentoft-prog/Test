# DECISIONS.md — Territorieduel "Markant løft"

Én linje pr. beslutning truffet autonomt undervejs (beslutning + hvorfor).

- **Branch re-point:** Sessionens branch `claude/territorieduel-feel-neon-xirilk` pegede på et urelateret elpris-dashboard; den er nulstillet til spil-basen `origin/claude/territorieduel-game-kfLqN` (1fc3cf4), da opgaven er et løft af Territorieduel.
- **Harness committes:** CLAUDE.md beskriver Node-harnessen som en procedure, ikke en fil; den er nu committet som `test/*.mjs` (kompilér-én-gang + frisk vm-realm pr. kørsel) så matrixen er reproducérbar og combo-assertions har et blivende hjem. Spillet selv er stadig én fil.
- **Testkommando:** `node --test 'test/*.test.mjs'` (Node 22 kræver glob; bare `test/` fejler som modul-load).
- **Juice via state-diff (fxWatch):** al erobrings-/døds-feedback udledes af owner/trail/alive-diff i stedet for direkte kald i capture/killPlayer — én kodesti der virker identisk for host, lokal, demo og online-klient (samme mønster som eksisterende soundWatch); sim-funktionerne blev samtidig rene (state-only).
- **Hit-stop fryser også timeLeft:** konsistent verdensfrys; timeren er autoritativ og broadcastes, så klienter kan ikke desynce — runder bliver marginalt længere.
- **Nær-død-scanning flyttet til trail-griddet:** den gamle trailCells-scanning var i praksis død kode hos online-klienter (holey array efter tlen-sync gav NaN-afstande); grid-scanning omkring fjende-heads er billigere og virker ens begge steder.
- **Klient-fillAge genskabes i fxWatch:** fillAge broadcastes ikke, så klienter fik aldrig erobrings-sweepet; nu genskabes det fra owner-diffen (gratis visuel paritet).
- **Vibration gated på !G.demo:** før kunne menu-demoen vibrere enheden når 'AI 1' døde (samme id som G.myId).
- **Feel-tuning:** hit-stop 30-90 ms ved erobringer ≥8 celler; shake ~2.5+0.2/celle (loft 13, halveret for andres erobringer); arpeggio 3-8 trin; kill-feed max 4 rækker à 4,5 s.
- **Neon = opgraderet 'standard'-tema (label "Neon"):** paletten var allerede neon-hues; identiteten ligger i rendering-behandlingen (mørkere baggrund, dæmpet indre + lysende territorie-kanter, bloom). Ingen ny unlock-række; cb/guld/solnedgang røres ikke.
- **setTheme kopierede kun 4 af 8 farver (live bug):** spiller 5-8 beholdt standard-farver i alle temaer — nu kopieres hele paletten (fixer bl.a. farveblind-dækning i 5-8-spillerkampe).
- **Bloom erstatter per-celle shadowBlur:** shadowBlur på hver trail/head-celle var den dyreste renderpost; bloom = nedskaleret offscreen (1/3) + filter:blur + 'lighter'. Fallback ved manglende ctx.filter (readback-detektion, Safari<18): den gamle shadowBlur-sti. Ved 'Reduceret/Fra' effekter droppes glød helt (roligere OG billigere).
- **Bloom slås fra i farveblind-tema:** additiv blanding udvander Okabe-Ito-kontrasterne; cb beholder shadowBlur-glød ved fuld effekt.
- **Mønstre tegnes nu lyse (hvid 0.30):** de gamle mørke glyffer ville forsvinde på de nye dæmpede territorie-flader.
- **Territorie-læsbarhed:** indre flade alpha 0.34 + kant 0.95 i egen hue — kanten ER identiteten; hvid fill-flash og sweep-animation uændret.
- **Kombo-vinduet måles i sim-ticks (G.simTick), ikke ms:** effekt-timere lever i frame() (dt-sekunder) og kører ikke i Node; rAF-tid drifter med FPS, og et ms-vindue ville dræne under hit-stop (straf for vores egen freeze-frame). Ticks pauser med sim'en, er 100% deterministiske i harnessen og broadcastes til klienter (tk). comboWindowMs forbliver den menneskelige konstant og omregnes lazily via G.speed (cache aldrig — speed kan skifte i demoen).
- **Kombo=1 giver x1 (ingen bonus):** credited ≡ counts indtil en ægte kæde findes — mekanikken er usynlig før den er fortjent, og paritets-testen (e) er meningsfuld.
- **Krediteret areal (counts+bonus) bruges i AL rundestilling** (50%-checket, lone-survivor, ranglister, HUD, share, banner, stats) — det er hele pointen med risk/reward; celle-ejerskab/flood-fill er urørt (byte-identisk grid med/uden combo, testet).
- **Bonus består efter død** (kæden nulstilles) — samme semantik som frosset land der stadig tæller.
- **Kombo-tuning:** vindue 3500 ms (~23 ticks v. normal), maxStack 4 ⇒ x1/x1.25/x1.5/x1.75, COMBO_STEP=0.25 ét sted i toppen af scriptet.
