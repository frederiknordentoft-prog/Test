# Konventioner for alle agenter (Talvennerne 2)

Kort og bindende. `docs/SPEC.md` er den fulde spec (afsnittet "Ændringer" øverst vinder). Kontrakterne
ligger i `src/engine/types.ts`, `src/content/{skills,curriculum,catalog}.ts` og `src/content/ids.lock.json`
og ejes af integratoren — foreslå ændringer i din rapport i stedet for at rette dem.

## Arbejdsgang
- Du arbejder i dit eget git-worktree (`/home/user/wt/<agent>`, branch `tv2/<agent>`), commit'er dér og pusher aldrig. Integratoren merger.
- Containeren kan genstarte uden varsel. Lav WIP-commits i dit worktree ca. hvert 20. minut (også når noget er rødt) og altid før lange kørsler. Lange jobs skal kunne genoptages, hvor de slap.
- `talvennerne2/node_modules` er symlinket fra hovedtræet. Installér aldrig pakker; mangler du en, så skriv det i rapporten.
- Før hver commit: `cd talvennerne2 && npm run scope -- '<dine globs>'`, `npx tsc --noEmit`, `npx vitest run` (grønt for dine filer) og `npm run build`.
- Commit som `git -c user.email=fnordentoft@icloud.com -c user.name="Frederik Nordentoft" commit -m "<dansk besked>"` og afslut beskeden med
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NkKeG1vom4pEx42VmVeg8D
  ```
  Nævn aldrig modelnavne andre steder.
- Chromium: brug `scripts/browser.mjs` (`launch()`), altid bag `flock /tmp/tv2-chromium.lock …`. Kør aldrig `playwright install`.
- Din dev/preview-port er den, du har fået tildelt (4300+n). Bash i forgrunden højst 10 min; `sleep` i forgrunden er blokeret.
- Deaktivér aldrig TLS-verifikation og unset aldrig HTTPS_PROXY.

## Kode
- TypeScript strict, React 19 funktionskomponenter, Zustand til tilstand. Kommentarer på engelsk i samme stil som den omkringliggende kode; al tekst til brugeren er dansk.
- Ingen `Math.random()` i spillogik — brug `makeRng(seed)`/`hashSeed()` fra `src/engine/rng.ts`.
- Notation: gange `·`, division `:`, minus `−`. Tegnene `×` og `÷` må ikke forekomme nogen steder.
- Ingen emoji i `src/**`. Egne SVG-ikoner i stedet.
- Ingen rå hex-farver uden for palette-/token-filer (`src/art/rig/palette.ts`, colorway-definitioner, `src/ui/design/tokens.css`, `src/content/{skills,catalog}.ts`).
- Moodet `sad` findes ikke. Ingen skyldtekster ("savner", "ked af det", "venter på dig", "glem ikke", "kom tilbage", "din ven bliver") og ingen "kun N til …".
- `Date` må ikke bruges i `src/content/economy.ts`, `goals.ts` eller `wardrobe.ts`.
- Lager: kun IndexedDB `talvennerne2` og localStorage/sessionStorage-nøgler med præfikset `talvennerne2.`. Aldrig `localStorage.clear()`, `sessionStorage.clear()`, `caches.`, `serviceWorker.register`, `Notification`, `PushManager`. V1's nøgle `talvennerne.save` må aldrig læses eller skrives.
- Børneskærme (`src/ui/screens/child/**`, `src/ui/task/**`) har ingen rå JSX-tekst: al tekst går gennem `SpokenText`, så den kan læses op.
- Trykmål ≥ 60 px, svarkort ≥ 80×80 px. Kun `transform` og `opacity` animeres.

## Fact-id'er
Recall-facts er deres egen mestringsnøgle og skal være globalt unikke og stabile (de bruges også i klip-id'et `q.<factId>`):

| Skill | Id |
|---|---|
| addTo10, addTo20 | `add:<a>+<b>` |
| subTo10, subTo20 | `sub:<a>-<b>` |
| tenFriends | `ten:<a>` (a + ? = 10) |
| doubles | `dbl:<a>` |
| halves | `hlf:<n>` (n er det hele) |
| missingPart10 | `mp:<a>+?=<c>` |
| mul2510, mul34, mul6to9 | `mul:<a>x<b>`, mindste faktor først |
| div2510, divAll | `div:<c>/<d>` |

Andre skills vælger et kort præfiks pr. skill (fx `cnt:`, `shp:`, `clk:`) og dokumenterer det i modulet; en test sikrer unikhed på tværs. Procedure-nøgler er `<skill>/<familie>`, og instans-id'er følger samme mønster som facts.

## Oplæsning
- `SpeechPart` i `types.ts` er formatet. `compile()` i `src/speech/compile.ts` gør dele til klip-id'er og tekst uden cifre.
- Faste klip defineres i kataloger under `src/speech/clips/**/*.ts` (id → tekst). Hvert område har sin egen fil, så agenter aldrig deler en fil: fx `clips/numbers.ts`, `clips/ui/<skærm>.ts`, `clips/skills/<domæne>.ts`, `clips/names.ts`.
- `speak()` fra `src/audio/voice.ts` er den eneste vej til lyd for UI'et.

## Kontaktark
- Kunst (rig, arter, genstande) renderes af `src/dev/SheetApp.tsx` via `npm run sheets` → `artifacts/sheets/*.png`.
- Designsystemet (ikoner, materialer, skærme) renderes af `design.html` → `src/dev/design/**` på dev-serveren.
- Review laves af en agent, der ikke er forfatteren, efter `docs/art-rubric.md`.
