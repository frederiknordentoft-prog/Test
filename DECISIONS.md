# DECISIONS — Vægtskålen

Beslutninger truffet autonomt under bygningen, med begrundelse.

## Repo & placering
- **Spillet erstatter el-pris-dashboardet i repo-roden på denne branch.**
  Dashboardet lever uændret på `claude/electricity-price-dashboard-3J4IT`
  (samme commit som denne branch udgik fra), så intet er tabt. Rod-placering
  giver en ren Vite/PWA-opsætning. Vite kører med `base: './'`, så builded kan
  hostes fra en undermappe (fx GitHub Pages) uden ændringer.

## Data
- **Uran er kategoriseret som `overgangsmetal`.** Spec'ens kategoriliste nævner
  ikke U. Actinider kaldes ofte "indre overgangsmetaller", og alternativet
  (`andet-metal`) ville blande U med Al/Pb, som kemisk ligger fjernere.
- **Al masse-matematik kører i mikro-u-heltal** (1 u = 100 000 µu). Alle
  spec-værdier har ≤ 5 decimaler, så repræsentationen er eksakt; molekyle-
  identiteterne (H₂O === O + 2·H osv.) holder uden float-epsilon.

## Fysik & game feel
- **Model: underdampet vinkelfjeder mod `θ_target = θ_max·tanh(Δm/S)`** med
  `S = s0 + sK·(mL+mR)`, semi-implicit Euler ved fast dt = 1/120 s.
  tanh giver garanteret monotoni (testkrav) og blød mætning; den masse-
  afhængige skala gør at både 4 u- og 238 u-scener føles levende. ζ = 0,22
  giver synligt wobble; reduced motion hæver ζ til 0,9 (nær kritisk dæmpning).
- **Drop-impuls:** hver landet brik sparker vinkelhastigheden proportionalt
  med sin andel af totalmassen (klampet), så bjælken "mærker" slaget. Brikker
  tæller først med i massen når de LANDER — bjælken reagerer på nedslaget,
  ikke på datastrukturen.
- **BeamState pushes kun ved ændringer** i settled/balanced/masser — aldrig
  pr. frame — så React aldrig re-render på 60 Hz.

## Gameplay
- **Challenges genereres by construction:** løsnings-multisettet trækkes
  først, og udfordringen afledes deraf. Solvability er dermed garanteret pr.
  design; testene med 500 seeds pr. mode verificerer invarianten.
- **Molekyle-mode kræver de RIGTIGE atomer (eksakt multiset), ikke bare
  rigtig masse.** Med tolerance alene kan man "snyde": 11×He = 44,029 u ≈ CO₂
  (44,009 u). Vægten står lige (og det er i sig selv en sjov opdagelse — appen
  siger det højt i et hint), men sejren gives kun for den kemisk korrekte
  opbygning. Tolerancen i molekyle-mode er sat til 0,3 u (kun visuel
  generøsitet); de andre modes bruger spec'ens 0,6 u.
- **"Ram vægten" viser målet som et graveret messinglod i venstre skål** med
  virtuel masse = målmassen. Så opfører bjælken sig fysisk korrekt mod målet,
  og flowet "byg højre op til målmassen" fungerer bogstaveligt.
- **Hold-inde hælder brikker i** (auto-gentag, accelererende 110→40 ms).
  Nødvendigt for at "238 brint mod 1 uran" er sjovt i stedet for RSI. Tap
  lægger 1; træk vælger skål præcist.
- **Streak nulstilles kun ved eksplicit "Ny udfordring" med en påbegyndt,
  uløst udfordring.** Mode-skift og urørte udfordringer straffes ikke —
  udforskning skal være gratis.
- **bestFewest** gemmes som det laveste brik-antal i en løst "færrest
  brikker"-udfordring (på tværs af targets). Sejrs-overlayet sammenligner
  desuden med det beregnede optimum for netop dén udfordring (IDDFS-solver).

## Teknik
- **PWA-ikoner genereres proceduralt** af `scripts/gen-icons.mjs` (ren Node,
  zlib-PNG-encoder, ingen dependencies) under `npm run build` — spec'en
  forbyder eksterne assets, og binære filer i git undgås (`public/icons` er
  gitignoret og bygges deterministisk).
- **Zustand-storen er source of truth for skål-indhold**; engine spejler via
  `syncPans` (diff på tile-id → nye brikker får fly-in + squash + klink).
  Engine-instansen er ét delt modul-singleton — React-komponenten monterer
  bare canvas og callbacks.
- **Testen for monotont settle-udslag konvergerer helt i bund** (40 000 skridt
  uden settle-early-break), fordi tanh-forskellene ved store udslag er mindre
  end settle-tærsklens ±0,008 rad.
- **`window.__vaegt`** eksponerer storen som læse-hook til røgtests
  (Playwright-gennemspilning af alle 6 DoD-flows mod produktions-builded).

## Verifikation udført
- `typecheck`, `lint`, `build`, `test` (27 tests) — alle grønne.
- Playwright-røgtest mod `vite preview`: 16/16 checks — drag af Guld, 195×H-
  balance i fri leg, sejr i balancér/ram/molekyle (inkl. glukose med 24 atomer),
  ren nulstilling, mode-skift, Dexie-persistens over reload, offline-reload
  via service worker, reduced-motion-kontekst.

## v1.1 — faglig korrekthed + polish (to-rollers review)

- **Oxygen/Ilt-kollisionen fjernet:** grundstof 8 hedder nu Oxygen (fagsprog);
  "Ilt" er forbeholdt molekylet O₂, med noten "dioxygen" i udfordringsteksten.
- **NaCl mærkes som formelenhed** (iongitter) i udfordringstekst og fakta —
  salt er ikke et molekyle.
- **"Vidste du"-fakta** pr. grundstof og molekyle (isotop-forklaringen på
  decimalerne, u ↔ g/mol-koblingen m.m.): vises ved sejr og i indstillinger.
- **Fortryd-toast ved streak-tab:** "Ny udfordring" med påbegyndt uløst
  udfordring nulstiller ikke længere streaken stille; 6 s fortryd-vindue.
  Straffen udløses desuden kun når streaken faktisk er > 0.
- **Førstegangs-hint** viser træk-gestussen (forsvinder ved første brik;
  statisk ved reduced motion). Tray-hjælpeteksten ejer nu kun hold-tippet.
- **"Færrest brikker" er en variant-chip** (aria-pressed) i stedet for checkbox.
- **Header-glyffer som SVG** med ens stregvægt i stedet for emoji; indstillinger
  bruger "sliders"-ikon. App-ikonerne genereres nu med 4× supersampling.
- **Engine-bugfix (fundet af regressionstest):** celebrate/sejr talte visuelle
  brikker (også flyvende) men målte kun landede masser — i vinduet hvor begge
  skåle kun havde flyvende brikker var 0 ≈ 0 "i balance" og kunne give
  fantomsejr. Nu kræver celebrate landede brikker og ingen i luften.
