# Territorieduel

Paper.io-agtig territoriekamp for **2–8 spillere** (mennesker og/eller AI) — lokalt på én
enhed eller online via rum-koder. Hele spillet bor i **én fil**: `index.html` (vanilla JS,
ét canvas, ingen build). Åbn filen i en browser, eller brug githack-linket fra seneste
commit-SHA:

```
https://rawcdn.githack.com/frederiknordentoft-prog/Test/<COMMIT_SHA>/index.html
```

## "Markant løft" — hvad blev løftet

Dette build løfter spillet på tre akser (se `DECISIONS.md` for alle valg undervejs):

**1. Game feel i erobrings- og drabsøjeblikket**
- Erobringer skalerer med areal: shockwave-ring langs den erobrede kant, kant-gnister,
  `+N`-tekst, Web-Audio-arpeggio hvis trin/pitch stiger med arealet, screenshake og
  **hit-stop** (kort verdensfrys, 30–90 ms) ved store erobringer.
- Drab føles som et snit: den døde streg **splintres cellevis**, slash-lyd ved
  streg-kryds, og en **kill-feed** øverst til højre fortæller hvem der slog hvem ud
  ("Orange slog Grøn ud!") — med attribution for væg/storm/kollision/land også.
- **Nær-død telegraferes før du dør**: rød retningspil mod truslen, din streg pulserer
  hvidt, vignetten intensiveres og en audio-riser varsler. (Scanningen bruger nu
  trail-griddet og virker derfor også for online-klienter — det gjorde den gamle ikke.)
- Al juice udledes af **state-diff** (`fxWatch`, samme mønster som lydvagten), så host,
  lokal, menu-demo og online-klienter ser de samme effekter — inkl. erobrings-sweepet,
  som klienter aldrig fik før.

**2. Neon-on-dark identitet med ægte-ish bloom**
- Committet look: meget mørk, rolig baggrund (prærendret vignet + grid-prikker),
  territorier som **dæmpede indre flader med lysende neon-kanter**, lyse streger og heads.
- **Bloom**: de lyse lag tegnes til et nedskaleret offscreen-canvas (1/3), blurres i lav
  opløsning og komposittes tilbage med `lighter`. Feature-detekteres via
  `ctx.filter`-readback; fallback er den gamle shadowBlur-glød. Per-celle shadowBlur
  (tidligere den dyreste renderpost) er fjernet når bloom kører.
- Tilgængelighed bevaret: farveblind-temaet (Okabe-Ito) kører **uden** bloom for at
  bevare kontrast, mønstre tegnes nu lyse så de ses på de dæmpede flader, og
  `setTheme` kopierer nu **alle 8** spillerfarver (før kun 4 — spiller 5–8 fik forkerte
  farver i alle temaer).
- Nyt **✨ Effekter**-valg (Fuld/Reduceret/Fra) der respekterer `prefers-reduced-motion`
  og skalerer shake/partikler/bloom/hit-stop.

**3. Ny dybde-mekanik: kombo-erobring**
- Luk flere løkker inden for **3,5 sekunder** og din *kreditering* ganges op:
  x1 → x1.25 → x1.5 → x1.75 (loft ved 4 i kæden). Multiplieren påvirker KUN den
  krediterede optælling (50 %-checket, ranglister, HUD-%) — **aldrig** hvilke celler
  der faktisk ejes (byte-identisk grid med/uden combo, testet).
- Kæden vises som en bue om dit head (resterende vindue) + `×`-multiplier, "KOMBO x2!"-pops
  med eskalerende pitch, og multiplier i HUD'en. Kæden dør når vinduet udløber eller du dør
  (banket bonus består, ligesom frosset land).
- Deterministisk: vinduet måles i **sim-ticks** (`G.simTick`), broadcastes til klienter,
  og pauser under hit-stop.
- Valgfrit (⚙︎, default FRA): **🎯 Dusør på lederen** — lederens åbne streg lyser guld;
  skærer du den, krediteres du stregens længde. Anti-snowball uden skjult state.

## Sådan testes

```bash
node --test 'test/*.test.mjs'
```

31 tests: fuld kamp til `matchend` for **4 og 8 spillere × Åben/Søjler/Kryds ×
normal/Svær** med board-invarianter, load-test (hele scriptet evaluerer uden at kaste i
Node med stubbet DOM/audio), kombo-assertions (vindue/reset/loft/byte-paritet af
ejerskabs-griddet) og dusør on/off. Harnessen (`test/harness.mjs`) kører spillet i friske
`vm`-realms med seeded RNG — se `CLAUDE.md` → Testing.

### Manuel browser-verifikation (udført med Playwright/Chromium på dette build)
- 8-spiller lokal kamp mod AI: **60 FPS** med bloom aktiv; ved 4× CPU-throttle i
  software-rendering (container uden GPU — hårdere end en reel mid-range mobil) holder
  bloom 36 FPS og Reduceret 56 FPS. `devicePixelRatio` er cappet til 2.
- Stor erobring giver synligt kraftigere feedback end små (+102-shockwave verificeret),
  drab viser splintret streg + feed-post, nær-død varsles med pil/puls/riser før døden,
  kombo-tæller bygger op ved hurtige gen-erobringer og nulstilles ved udløb/død.
- Farveblind + mønstre, Reduceret effekter, mobil-viewport (390×844, touch) og
  offline-guarden for online-mode er alle verificeret uden konsolfejl.
- Online host+klient kunne ikke køres i test-containeren (PeerJS-CDN blokeret af
  sandbox-netværket); snapshot-stien er i stedet dækket af kode-review + de nye felter
  (`tk/bt` + `cb/cu/bo/kb/kk` pr. spiller) og af at al klient-juice udledes af replikeret
  state. Verificér gerne online med to enheder på det primede githack-link.

## Antagelser og beslutninger

Alle enkeltbeslutninger (tuning-tal, semantik, fixes af eksisterende bugs) er logget i
**`DECISIONS.md`**. De vigtigste: krediteret areal (raw + bonus) bruges i AL
rundestilling; kombo-vinduet er tick-baseret af hensyn til determinisme; bonus består
efter død; dusør er default FRA.
