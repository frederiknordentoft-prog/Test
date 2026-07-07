# Deploy-regler for dette repo — LÆS FØR DU DEPLOYER

Dette repo hoster flere web-apps på ét GitHub Pages-site. Reglerne herunder
sikrer at ingen session ødelægger de andres apps. De er ikke valgfrie.

## Arkitekturen

- GitHub Pages serverer **hele sitet fra branchen `claude/wc2026-tournament-app-k42mv8`**
  ("oversigts-branchen"). Live-URL: https://frederiknordentoft-prog.github.io/Test/
- Roden af den branch er oversigtssiden **"Mine projekter"** (`index.html`) med et
  kort pr. app.
- Hver app bor i sin egen undermappe på oversigts-branchen:
  `vm/`, `elpriser/`, `kuglebanen/`, `vaegtskaalen/`, `vindtunnel/`, …
- Udviklingsarbejde sker på hver sessions egen branch som normalt. Deploy =
  kopiér de færdige, byggede filer ind i appens undermappe på oversigts-branchen.

## Forbud (disse har allerede ødelagt sitet én gang)

1. **Bed ALDRIG brugeren om at ændre Pages-kilden** til en anden branch.
   Pages skal blive på oversigts-branchen.
2. **Deploy ALDRIG en app til site-roden.** Roden tilhører oversigtssiden.
3. **Force-push ALDRIG** oversigts-branchen eller `gh-pages`.
4. **Slet eller ændr ALDRIG andre apps' undermapper** eller deres kort på forsiden.
5. **Rør ikke rodens `sw.js`** — det er et kill-switch der rydder gamle
   service-worker-caches hos besøgende. Registrér kun service workers med
   scope i din egen undermappe.

## Sådan deployer du en NY app

1. Byg med relativ base (`./`) — i Vite: `base: './'` — eller hårdkodet
   `/Test/<dit-mappenavn>/`. Manifest: `"start_url"` og `"scope"` skal pege på
   undermappen, ikke roden.
2. Tjek oversigts-branchen ud i et worktree (se opskrift nederst).
3. Læg de byggede filer i en ny undermappe: `<dit-mappenavn>/`.
4. Tilføj et kort til din app i forsidens `index.html` (følg de eksisterende
   korts markup: `.card` med emoji, titel, undertitel).
5. Commit + push oversigts-branchen. Verificér (se nederst).

## Sådan OPDATERER du en eksisterende app

1. Udvikl og test på din egen branch som normalt.
2. Kopiér de færdige filer ind i appens undermappe på oversigts-branchen
   via worktree. Overskriv kun din egen mappe.
3. Commit + push. Verificér.

## Worktree-opskrift

```bash
git fetch origin claude/wc2026-tournament-app-k42mv8
git worktree add /tmp/overview -B overview-wt origin/claude/wc2026-tournament-app-k42mv8
cp <dine byggede filer> /tmp/overview/<din-app>/
cd /tmp/overview
git add -A && git commit -m "Deploy <din-app>"
git push origin HEAD:claude/wc2026-tournament-app-k42mv8
cd - && git worktree remove /tmp/overview
```

## Verifikation — obligatorisk før du melder færdig

Kør efter push (Pages bygger 1-2 min):

```bash
for p in "" vm/ elpriser/ kuglebanen/ vaegtskaalen/ vindtunnel/ <din-app>/; do
  echo "$p → $(curl -s -o /dev/null -w '%{http_code}' https://frederiknordentoft-prog.github.io/Test/$p)"
done
```

Alle skal svare **200**, og roden skal stadig have titlen "Mine projekter":

```bash
curl -s https://frederiknordentoft-prog.github.io/Test/ | grep -o '<title>[^<]*'
```

Hvis noget andet end din egen mappe har ændret sig, har du gjort noget galt —
ret det før du afslutter.
