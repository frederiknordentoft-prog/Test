# CLAUDE.md — Territorieduel

Guidance for any future Claude session working on this repo. Read this first.

## What this is
**Territorieduel** is a finished, polished, single-file browser game (Paper.io-style
territory capture) for **2–8 players**, human and/or AI, playable locally on one
device or online across devices. All UI text is in **Danish**. The entire game lives
in **`index.html`** — there is no build step, no npm, no framework, and (except the
background-music `<audio>` and the PeerJS `<script>` for online play) no external
assets. It runs by opening `index.html` in a browser.

## Hard constraints (do not break these)
- **One file:** everything (HTML + CSS + JS) stays inline in `index.html`.
- **Vanilla** JS, no framework, no build. Draw the game on a single `<canvas>` via
  `requestAnimationFrame`, target 60 FPS.
- **Works on desktop (mouse/keyboard) and mobile (touch).**
- Only two external references are allowed and already present:
  - `<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/...">` — WebRTC for online.
  - `<audio ... src="https://cdn1.suno.ai/....mp3">` — background music (Suno track).
  Everything else (sound effects, particles, icons) is synthesized/inline.
- Keep it stable. After any change, run the Node test harness (see **Testing**) and
  only ship if a full match completes for 4 **and** 8 players.

## Deploying / sharing a playable link
The repo is public on GitHub. To give the user a runnable link, the file is served
through githack (which sends the correct `text/html` so JS runs):
```
https://rawcdn.githack.com/frederiknordentoft-prog/Test/<COMMIT_SHA>/index.html
```
Use a **commit SHA** (not the branch name — the branch has slashes and 404s), and
`curl` it once to prime the CDN before sending it to the user.
Development branch: `claude/territorieduel-game-kfLqN`.

## Game rules (current)
- Grid **58 × 36** cells. `owner[]` = who owns each cell (0 empty, 1..8), `trail[]`
  = whose open "streg" (line) is on each cell.
- Your head moves continuously (never stops). Outside your own territory it leaves a
  **trail**. Return to your own territory to **close the loop**: the enclosed area
  (empty **and** enemy cells) becomes yours via flood-fill from the borders.
- **One life.** Death = elimination (no respawn); your captured land freezes and still
  counts, and you spectate the rest of the round.
- You die from: driving onto an **opponent's territory**, an opponent **crossing your
  open trail**, hitting a **wall/obstacle** outside your land, or head-on collisions.
  Your **own** colour and own trail are safe. Crossing an opponent's open trail kills
  **them**, not you.
- **Round ends** when: someone reaches **50 %** (instant win), the **90 s** timer runs
  out (most % wins — even a dead leader), everyone is dead, or only one player remains
  **and** already has the most %. A lone survivor who is behind keeps playing to catch up.
- A **match = N rounds** for N players. Before each round players pick start positions
  **in turn**, and the pick order rotates so each player is first-picker exactly once.
  Match champion = most round wins.

## Architecture / where things are (all in `index.html` `<script>`)
- **State:** typed arrays `owner`, `trail`, `fillAge`, `reach`, `obstacle` (all
  `TOTAL = W*H`). `counts[]` (index by id, length 9). `G` = the match/settings object
  (mode, phase, players, roundIndex, speed, difficulty, toggles, stormM, etc.).
  `particles`, `floatTexts`, `powerups`, `flashA` for juice.
- **Phases** (`G.phase`): `lobby | select | play | roundwin | roundend | matchend`.
  (`G.demo` = the living-menu AI match that plays behind the lobby.)
- **Players:** `G.players` array of objects (id, kind `'local'|'ai'|'remote'`, color,
  base, cx/cy/prevX/prevY/dir, trailCells[], alive/eliminated, roundWins, effect
  timers `shield/ghostT/frozenT/invulnT`, AI `persona`/`path`/`frontier`).
- **Simulation** is fixed-step and **host/local-authoritative**: `simulate()` runs one
  lockstep tick for all alive players (decide dir → move → resolve deaths → lay
  trail/capture → pickups → `checkRoundEnd`). `frame(t)` is the rAF loop: advances
  `acc += dt*G.speed`, calls `simulate()` per whole step, interpolates rendering with
  `frac`, runs the countdown, storm, power-up spawns, timers, sound, particles.
- **Capture:** `capture(p)` sets trail cells to owner, BFS floods from the border
  through non-owner, non-obstacle cells, and fills everything unreached (animated
  "sweep" via `fillAge = now + dist*9`).
- **AI:** `aiDecide(p)` — frontier-based expansion (`aiNearestFrontier`/`aiBuildLoop`
  build 3-waypoint rectangles into open space), retreat when threatened, hunt exposed
  enemy trails, anti-stuck guard. Behaviour comes from `dp(p)` = the player's
  **persona** (`PERSONAS`: hunter/expander/cautious) sharpened by `G.difficulty`.
- **Rendering:** `render(frac)` draws bg/grid, obstacles, owned cells (with fill
  animation + optional accessibility **patterns**), trails (pulse **red** when long =
  danger telegraph), storm, heads (+ effect auras), power-ups, particles, float texts,
  onboarding arrow, wall frame, screen flash, near-death vignette, joystick.
- **Networking (online):** PeerJS, host-authoritative. Host runs the sim and
  broadcasts full state (`owner`/`trail` slices + per-player + powerups + storm +
  mapVariant + winner + ping-able); clients render snapshots (interpolated), send
  `input`/`pick`/`setname`/`emoji`/`ping`. Room code = 4 chars → peer id `tduel-<code>`.

## Feature list (all implemented)
Core loop, flood-fill capture, one-life elimination, N-round matches with rotating
start-pick, 50%/timer/last-standing win logic. Up to **8 players**, optional AI with
**personalities**. Local (keyboard schemes arrows/WASD/IJKL/TFGH + touch) and **online**
(room codes). Settings: **tempo** (5/6.5/8), **Svær AI**, **power-ups** (🛡️ shield /
❄️ freeze / 👻 ghost, toggle), **storm** (shrinking lethal border, last 20 s), **map
variants** (Åben/Søjler/Kryds obstacles), **themes/skins** (standard, colour-blind,
unlockable gold/sunset), **patterns** (accessibility), **control** (follow-finger /
joystick), **music volume** slider, sound on/off. Juice: particles, screen shake/flash,
fireworks + freeze-frame win celebration, countdown box, combo pop-ups, dynamic music,
haptics. Meta: on-device **leaderboard** + **stats**, **daily challenge**, **onboarding**
card, **share result** (PNG via native share), **emoji** reactions + **ping** display.
Living-menu AI demo behind the (translucent) lobby. Apple-Games-style menu (big mode
rows + tucked-away Settings panel with segmented controls).

## Testing (do this before shipping any change)
The whole game logic is deterministic and testable headless in **Node** by extracting
the `<script>`, stubbing `document`/`window`/`canvas`/`localStorage`/`navigator`/
`performance`/`requestAnimationFrame`, and driving `globalThis.__t` (exposed at the
bottom of the script: `simulate`, `startMatch`, `doPick`, `endRound`, `finishWin`,
`nextRound`, `validPick`, `counts()`, `owner`, `fillAge`, `powerups`, `setLocalPlayers`,
etc.). A standard smoke test: for each map variant × difficulty, `setLocalPlayers(0,8)`,
`startMatch()`, then loop — pick valid spots via `validPick`, run `simulate()` in the
`play` phase, `endRound(null,'tid')`, `finishWin()`, `nextRound()` — and assert it
reaches `matchend` with zero exceptions. Rendering/audio/network can't run in Node
(rAF is a no-op there) so load-test those for "no throw"; real online needs two devices.

## Style
Match the surrounding code: compact, terse, Danish comments, single-file. Keep the
`__t` test export in sync when adding testable functions.
