# Test

Baseline branch for this repository. Individual projects live on their own
feature branches and are proposed via pull requests against `main`.

## GitHub Pages — VIGTIGT

Hele sitet (https://frederiknordentoft-prog.github.io/Test/) serveres fra
branchen **`claude/wc2026-tournament-app-k42mv8`**: roden er oversigtssiden
"Mine projekter", og hver app ligger i sin egen undermappe (`vm/`, `elpriser/`,
`kuglebanen/`, `vaegtskaalen/`, `vindtunnel/`, …).

**Før du deployer noget som helst: læs [`CLAUDE.md`](./CLAUDE.md).**
Kort version: peg aldrig Pages på en anden branch, deploy aldrig til roden,
læg din app i en undermappe på oversigts-branchen og tilføj et kort på
forsiden.

Hele processen er også pakket som en **skill**:
[`.claude/skills/deploy-to-pages/`](./.claude/skills/deploy-to-pages/SKILL.md).
Den indeholder proceduren + et sikkerheds-script (`scripts/deploy-app.sh`), der deployer én
app til sin egen undermappe og **nægter at røre andre apps**. Samme mappe kan uploades som
personlig skill i Cowork og claude.ai-chat, så den er tilgængelig alle steder.

## Branches / projekter

- **Kabale Combo** — spilbar prototype af et 7-kabale kombinationsspil
  (Vite + React + TS + Tailwind + Zustand). Se den tilhørende pull request.
