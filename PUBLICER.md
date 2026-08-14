# Sådan kommer en ny side op på sitet

Live-site: **https://frederiknordentoft-prog.github.io/Test/**

## Kort svar: kan Cowork selv lægge det op?

**Ikke af sig selv.** Cowork kan sagtens *bygge* HTML-filen, men GitHub-
connectoren i Claude er **læse-only** — den henter filnavne og filindhold ind
som kontekst, den kan ikke committe eller pushe. Så Cowork kan ikke selv skubbe
siden ud på GitHub Pages med standardopsætningen.

Cowork kan til gengæld skrive filer i de **lokale mapper du har forbundet**. Så
findes der tre veje ud, og de virker alle tre:

| Rute | Hvem trykker på knappen | Hvornår |
|------|------------------------|---------|
| **A** | Cowork laver filen → Claude Code lægger den op | Standard. Hurtigst når du alligevel har en Claude Code-session |
| **B** | Du selv, i browseren | Virker altid, kræver ingen opsætning, tager et minut |
| **C** | Cowork pusher selv | Kræver at du først giver Cowork skriveadgang (se nederst) |

Uanset ruten er selve arbejdet det samme, og det er allerede gjort klar i dette
repo: læg filerne i en undermappe, tilføj et kort på forsiden, verificér.

---

## Sitets opbygning — læs det her først

- GitHub Pages serverer hele sitet fra branchen
  **`claude/wc2026-tournament-app-k42mv8`** (kaldet *oversigts-branchen*).
  Et push til den branch trigger `.github/workflows/deploy-pages.yml`, som
  lægger sitet ud. Det tager 1–2 minutter.
- **Roden er forsiden** "Mine projekter" (`index.html`) med ét kort pr. app.
- **Hver app bor i sin egen undermappe:** `vm/`, `elpriser/`, `kuglebanen/`,
  `vaegtskaalen/`, `vindtunnel/`, `surdej/`, `element-sandbox/` …
  En ny side skal have sin egen mappe. Den må aldrig lægges i roden.
- Repoet er **offentligt**. Alt hvad der lægges op, kan læses af alle der kender
  adressen. Det gælder også kildekoden til siden.

---

## Rute A — Cowork bygger, Claude Code lægger op *(anbefalet)*

**1. Bed Cowork om filen.** Kopiér denne blok ind i Cowork sammen med din idé:

```
Byg siden som ÉN selvstændig index.html — al CSS og JS inline i filen.
Den skal ligge i en undermappe på et GitHub Pages-site, så:
- brug kun relative stier (./ og ../), aldrig stier der starter med /
- ingen build-værktøjer, ingen npm, ingen imports fra en bundler
- eksterne biblioteker kun fra CDN med fuld https-URL
- den skal virke på mobil (viewport-meta, touch-venlige knapper)
- understøt både lyst og mørkt tema via prefers-color-scheme
- læg et "‹ Alle apps"-link øverst der peger på ../
Gem filen og fortæl mig hvor den ligger.
```

**2. Giv filen til Claude Code** — enten ved at lægge den i dette repo, eller
ved at sige til Claude Code: *"Læg den her fil op som `<slug>` på sitet."*

**3. Claude Code kører én kommando:**

```bash
scripts/deploy-page.sh \
  --slug minapp \
  --from ~/sti/til/mappen-med-index.html \
  --title "Min App" \
  --emoji "🚀" \
  --sub "Kort beskrivelse til forsidens kort"
```

Scriptet henter oversigts-branchen i et midlertidigt worktree, lægger filerne i
`minapp/`, opretter kortet på forsiden, **nægter at committe hvis noget uden for
`minapp/` og `index.html` er blevet rørt**, pusher med retry, og venter til
sitet svarer 200 på alle adresser. Kør med `--dry-run` først, hvis du vil se
hvad der sker uden at røre noget.

Siden er live på `https://frederiknordentoft-prog.github.io/Test/minapp/`.

---

## Rute B — du gør det selv i browseren

Virker altid, også uden Claude Code. Tager cirka et minut.

1. Gå til [repoet på oversigts-branchen](https://github.com/frederiknordentoft-prog/Test/tree/claude/wc2026-tournament-app-k42mv8).
2. **Add file → Create new file**.
3. Skriv filnavnet som `minapp/index.html` — skråstregen laver mappen
   automatisk.
4. Indsæt HTML'en fra Cowork. **Commit changes** (direkte på branchen).
5. Åbn `index.html` i roden, klik blyanten, og kopiér et af de eksisterende
   `<a class="card …>`-blokke. Ret `href` til `./minapp/`, samt emoji, titel og
   undertekst. Commit.

Efter 1–2 minutter er siden live. Har appen flere filer end én, så upload dem
samme sted via **Add file → Upload files**.

---

## Rute C — lad Cowork pushe selv

Kræver at du giver Cowork et værktøj med *skrive*adgang til GitHub, siden den
indbyggede connector ikke har det. To muligheder:

- **En GitHub-MCP-server med skriveadgang**, tilføjet under
  *Customize → Connectors → Add custom connector*. Den giver Cowork handlinger
  som "create or update file" og "push files".
- **En forbundet lokal mappe der er et git-klon** af dette repo, hvor `git push`
  allerede er autentificeret på din maskine. Så kan Cowork køre
  `scripts/deploy-page.sh` direkte i den mappe.

Når Cowork har skriveadgang, er opskriften den samme som Rute B, bare formuleret
til Cowork:

```
Læg denne side op på GitHub Pages-sitet i repoet
frederiknordentoft-prog/Test, på branchen claude/wc2026-tournament-app-k42mv8.

1. Opret filen minapp/index.html med indholdet nedenfor.
2. Hent index.html i roden, tilføj ét nyt <a class="card"> i <div class="cards">
   med href="./minapp/", en emoji, en titel og en undertekst — kopiér formen fra
   de kort der allerede er der. Rør ikke de øvrige kort.
3. Commit begge filer direkte på branchen.
4. Vent to minutter og bekræft at både
   https://frederiknordentoft-prog.github.io/Test/ og .../minapp/ svarer 200,
   og at forsiden stadig har titlen "Mine projekter".
```

**Vigtigt uanset rute:** deploy aldrig til sitets rod, force-push aldrig
oversigts-branchen, og slet aldrig andre apps' mapper eller kort.

---

## Krav til HTML-filen

Det der oftest går galt, når en side flyttes ned i en undermappe:

- ✅ `<script src="./app.js">` og `<img src="./logo.png">`
  ❌ `<script src="/app.js">` — den absolutte sti peger på sitets rod, ikke din mappe
- ✅ `<a href="../">` tilbage til forsiden
- ✅ Bygger du med Vite: `base: './'` i `vite.config.ts`
- ✅ Har du et manifest: `"start_url"` og `"scope"` skal pege på `./`, ikke `/`
- ✅ Registrerer du en service worker: kun med scope i din egen mappe.
  Rodens `sw.js` er et kill-switch der rydder gamle caches — rør den ikke.
- ✅ Alt over `https://` — Pages serverer ikke `http://`-ressourcer

Der ligger en klar-til-brug skabelon i `templates/page/index.html` med det hele
sat rigtigt op.

---

## Login på en side

Sitet er statisk hosting på et **offentligt** repo. Der er ingen server, ingen
sessioner og ingen brugerdatabase. Det sætter en hård grænse:

> Alt hvad der lægges på sitet, kan hentes af enhver der kender adressen —
> uanset hvad der står foran det i browseren.

### Hvis det bare skal holde tilfældige ude

Der ligger en simpel adgangskode-dør i `_shared/`. Generér linjerne:

```bash
scripts/gate-hash.sh minapp "mit kodeord"
```

og indsæt de to linjer den udskriver i `<head>` på `minapp/index.html`.
Kodeordet står aldrig i koden — kun en SHA-256 af slug + kodeord — og
oplåsningen huskes i browseren.

**Vær ærlig om hvad det er:** en dørmåtte, ikke en lås. Filerne kan hentes
direkte udenom dialogen, og hashen står i kildekoden og kan brute-forces. Brug
den til "det her rager ikke tilfældige forbipasserende" — aldrig til noget der
gør ondt at få offentliggjort.

### Hvis der skal være rigtig adgangskontrol

| Løsning | Hvad du får | Pris/krav |
|---------|-------------|-----------|
| **Cloudflare Pages + Cloudflare Access** | Rigtigt login (Google, e-mail-kode) foran hele sitet. Uautoriserede når aldrig filerne | Gratis op til 50 brugere, kræver domæne på Cloudflare |
| **Netlify eller Vercel** | Password-beskyttelse på hele sitet, sat i deres UI | Betalt plan |
| **Privat repo + GitHub Pages** | Kun folk med repo-adgang kan se sitet | Kræver GitHub Enterprise Cloud |
| **Krypteret side (fx StatiCrypt)** | Indholdet er AES-krypteret i filen og dekrypteres først med kodeordet. Reel beskyttelse på statisk hosting | Gratis, men ét fælles kodeord og ingen brugerstyring |

### Hvis appen har brug for *brugere* og gemte data

Fx en OKR-app eller noget med personlige lister — der er en adgangskode ikke
svaret. Vælg:

- **Kun dig, kun din browser:** gem i `localStorage`. Ingen login, ingen server,
  data følger enheden. Dækker overraskende mange af den slags apps.
- **Flere brugere eller flere enheder:** brug en backend med rigtig auth —
  Supabase, Firebase eller Auth0. Siden kan stadig ligge på GitHub Pages og bare
  tale med backenden. Nøgler i frontend skal være *publishable* nøgler, og
  adgangen skal håndhæves i backenden — aldrig i JavaScript på siden.

---

## Verifikation — kør altid til sidst

```bash
scripts/verify-site.sh
```

Alle mapper skal svare `200`, og forsiden skal stadig hedde "Mine projekter".
Er noget andet end din egen mappe ændret, er der gået noget galt — ret det, før
du melder færdig.
