# Deploy-regler for dette repo — LÆS FØR DU DEPLOYER

Dette repo hoster flere web-apps på ét GitHub Pages-site. Reglerne herunder
sikrer at ingen session ødelægger de andres apps. De er ikke valgfrie.

Skal du bare have en ny side op — og især hvis siden kommer fra Cowork — så
læs **[PUBLICER.md](PUBLICER.md)**. Den har hele opskriften, inklusive de ruter
der ikke kræver en shell, og afsnittet om login.

## Arkitekturen

- GitHub Pages serverer **hele sitet fra branchen `claude/wc2026-tournament-app-k42mv8`**
  ("oversigts-branchen"). Live-URL: https://frederiknordentoft-prog.github.io/Test/
- Deploy sker via `.github/workflows/deploy-pages.yml`, der kører på hvert push
  til den branch. Pages-kilden er **GitHub Actions**, ikke "deploy from a branch".
- Roden af den branch er oversigtssiden **"Mine projekter"** (`index.html`) med et
  kort pr. app.
- Hver app bor i sin egen undermappe på oversigts-branchen:
  `vm/`, `elpriser/`, `kuglebanen/`, `vaegtskaalen/`, `vindtunnel/`, …
- Udviklingsarbejde sker på hver sessions egen branch som normalt. Deploy =
  kopiér de færdige, byggede filer ind i appens undermappe på oversigts-branchen.
- Repoet er **offentligt**. Alt der deployes, kan læses af alle.

## Forbud (disse har allerede ødelagt sitet én gang)

1. **Bed ALDRIG brugeren om at ændre Pages-kilden** til en anden branch.
   Pages skal blive på oversigts-branchen.
2. **Deploy ALDRIG en app til site-roden.** Roden tilhører oversigtssiden.
3. **Force-push ALDRIG** oversigts-branchen eller `gh-pages`.
4. **Slet eller ændr ALDRIG andre apps' undermapper** eller deres kort på forsiden.
5. **Rør ikke rodens `sw.js`** — det er et kill-switch der rydder gamle
   service-worker-caches hos besøgende. Registrér kun service workers med
   scope i din egen undermappe.

## Deploy — én kommando

`scripts/deploy-page.sh` gør hele dansen: worktree, kopiering, kort på forsiden,
commit, push med retry, og live-verifikation. Det **afbryder af sig selv**, hvis
deployet ville ændre noget uden for din egen mappe — det er regel 4 håndhævet i
kode i stedet for i hukommelsen.

```bash
# Ny app (--title, --emoji og --sub er påkrævet første gang)
scripts/deploy-page.sh --slug minapp --from dist \
  --title "Min App" --emoji "🚀" --sub "Kort beskrivelse"

# Opdatering af en app der allerede ligger der
scripts/deploy-page.sh --slug minapp --from dist

# Se hvad der ville ske, uden at røre noget
scripts/deploy-page.sh --slug minapp --from dist --dry-run
```

Byg med relativ base (`./`) — i Vite: `base: './'`. Manifest: `"start_url"` og
`"scope"` skal pege på undermappen, ikke roden. Se hele checklisten i
PUBLICER.md.

Skal du starte en side fra bunden, så kopiér `templates/page/index.html` — den
har relative stier, mørkt tema og tilbage-link sat rigtigt op.

## Hvis du gør det i hånden alligevel

```bash
git fetch origin claude/wc2026-tournament-app-k42mv8
git worktree add /tmp/overview -B overview-wt origin/claude/wc2026-tournament-app-k42mv8
cp <dine byggede filer> /tmp/overview/<din-app>/
cd /tmp/overview
git add -A && git commit -m "Deploy <din-app>"
git push origin HEAD:claude/wc2026-tournament-app-k42mv8
cd - && git worktree remove /tmp/overview
```

Tilføj derefter et kort til din app i forsidens `index.html` — følg de
eksisterende korts markup (`.card` med emoji, titel, undertitel) og rør ikke de
andres.

## Verifikation — obligatorisk før du melder færdig

```bash
scripts/verify-site.sh
```

Den finder selv app-mapperne på oversigts-branchen, tjekker at alle svarer
**200**, og at roden stadig har titlen "Mine projekter". Exit-kode 1 hvis noget
er galt.

Hvis noget andet end din egen mappe har ændret sig, har du gjort noget galt —
ret det før du afslutter.

## Login

Statisk hosting på et offentligt repo kan ikke lave rigtig adgangskontrol.
`_shared/gate.js` giver en simpel adgangskode-dør (`scripts/gate-hash.sh` laver
linjerne), men den holder kun tilfældige ude — filerne kan stadig hentes direkte.
Skal det være reelt privat, står mulighederne i LOGIN-afsnittet i PUBLICER.md.
