---
name: deploy-to-pages
description: >-
  Publish or update a web app on the multi-app GitHub Pages site in repo
  frederiknordentoft-prog/Test (live at https://frederiknordentoft-prog.github.io/Test/)
  WITHOUT overwriting the other apps. Use this whenever you are about to deploy, publish,
  ship, "lægge op/online", or push a built app to that site; add a new app to the
  "Mine projekter" front page; update an already-deployed app; or wire up an app's subfolder
  and direct link. Every app lives in its own subfolder and is reachable BOTH from the
  front-page cards AND directly at its own /Test subfolder URL. It enforces a safe worktree
  deploy so apps never clobber each other. Trigger even when the user only says "deploy the app", "add it to
  my projects page", "put it online like the others", or "opdater appen på Pages".
---

# Deploy an app to the "Mine projekter" Pages site

This site hosts **many small web-apps on one GitHub Pages site**, one shared front page
linking to them all. The single hardest requirement is that **deploying one app must never
touch or overwrite another**. Follow this skill and that stays true.

## Architecture — read this first

- **Repo:** `frederiknordentoft-prog/Test`. **Live site:** `https://frederiknordentoft-prog.github.io/Test/`.
- **Everything is served from ONE branch — the "overview branch": `claude/wc2026-tournament-app-k42mv8`.**
  A GitHub Action (`.github/workflows/deploy-pages.yml`) publishes the **whole branch**
  (`path: .`) on every push, so **a push auto-publishes** — no manual Pages step; it goes
  live in ~1–2 min.
- The **root `index.html` is the front page "Mine projekter"** (its `<title>` is literally
  `Mine projekter`) with one `.card` per app.
- **Each app lives in its own subfolder** (`vm/`, `elpriser/`, `kuglebanen/`,
  `vaegtskaalen/`, `vindtunnel/`, `surdej/`, …). So every app has **two access paths**:
  its card on the front page, and the direct link `/Test/<app>/`. Both must work.
- Development happens on each app's own branch. **Deploy = copy the app's *built* files into
  its subfolder on the overview branch** (and, for a new app, add a card to the front page).

## Rules that keep apps from clobbering each other — do not break these

1. **Never change the Pages source** to another branch. It must stay on the overview branch.
2. **Never deploy to the site root.** The root belongs to the front page.
3. **Never force-push** the overview branch (or `gh-pages`).
4. **Never touch another app's subfolder or its card.** Only ever write your own subfolder,
   and (for a new app) add exactly one card.
5. **Never touch the root `sw.js`** — it is a kill-switch that clears stale service-worker
   caches for visitors. If your app needs a service worker, scope it to your own subfolder.

## Build your app so it works in a subfolder

Assets must load from `/Test/<app>/`, not the root, so use **relative paths**:

- **Vite:** set `base: './'` in `vite.config.ts`. (Or hardcode `/Test/<app>/`.)
- **PWA manifest:** `start_url` and `scope` = `"./"` (point at the subfolder, not the root).
- Verify the built `index.html` references `./assets/...` (relative), then deploy the build
  output (e.g. `dist/`), not the source.

## The fast, safe path: `scripts/deploy-app.sh`

This script does the whole deploy through a throwaway worktree and **refuses to commit if any
change lands outside your subfolder** — that guard is the real protection. Run it from inside
a clone of the repo.

**Update an existing app** (one command — build first):
```bash
bash scripts/deploy-app.sh <app> <dist-dir>
# e.g. bash scripts/deploy-app.sh surdej dist
```
It confines changes to `<app>/`, commits (no force-push), pushes the overview branch, and
verifies the live site. Add `--dry-run` to preview without pushing.

**Add a NEW app** (two steps, because the front-page card is a judgement call):
```bash
bash scripts/deploy-app.sh <app> <dist-dir> --new     # stages the folder, then stops
# → add a card for <app> to the printed worktree's index.html (see reference/card-template.html)
bash scripts/deploy-app.sh --push <worktree> <app>    # guards, commits, pushes, verifies
```

**Verify anytime** (all apps 200 + front page intact):
```bash
bash scripts/deploy-app.sh --verify
```

## Add the front-page card (new apps)

In the overview branch's root `index.html`, inside `<div class="cards">`, add one `.card`
linking to `./<app>/`, add a matching `.<xx> .emoji` gradient rule in the `<style>`, and bump
the "N web-apps" lead count. Copy the exact pattern from **`reference/card-template.html`**.
Keep every other card untouched.

## Manual worktree recipe (if you can't run the script)

```bash
git fetch origin claude/wc2026-tournament-app-k42mv8
git worktree add /tmp/overview -B overview-wt origin/claude/wc2026-tournament-app-k42mv8
rm -rf /tmp/overview/<app> && mkdir -p /tmp/overview/<app>
cp -R <dist-dir>/. /tmp/overview/<app>/
# NEW app only: edit /tmp/overview/index.html to add the card (see reference/card-template.html)
cd /tmp/overview && git add -A

# GUARD — must print nothing but your own folder (and index.html for a new card):
git status --porcelain | awk '{print $NF}' | cut -d/ -f1 | sort -u
# If anything else appears, STOP and undo — you are about to clobber another app.

git commit -m "Deploy <app>"
git push origin HEAD:claude/wc2026-tournament-app-k42mv8      # never --force
cd - && git worktree remove /tmp/overview
```

## Verify before you call it done — mandatory

Pages rebuilds ~1–2 min after the push. Then confirm **every** app still answers `200` and the
front page is intact:
```bash
for p in "" vm/ elpriser/ kuglebanen/ vaegtskaalen/ vindtunnel/ surdej/ <app>/; do
  echo "$p → $(curl -s -o /dev/null -w '%{http_code}' https://frederiknordentoft-prog.github.io/Test/$p)"
done
curl -s https://frederiknordentoft-prog.github.io/Test/ | grep -o '<title>[^<]*'   # must be "Mine projekter"
```
All must be `200`, the root title must still be `Mine projekter`, and **nothing but your own
subfolder (and your new card) may have changed**. If something else moved, you broke a rule —
fix it before finishing. (`scripts/deploy-app.sh --verify` does this check for you and
discovers the app list from the live front page automatically.)

## Using this skill across surfaces

The facts above are hardcoded, so this skill is portable: it works the same in Claude Code, and
when installed as a personal skill in Cowork and claude.ai chat. In Claude Code the
authoritative rules also live in the overview branch's `CLAUDE.md` (which every deploy fetches),
so a deploying agent always reaches them even on a disjoint app branch.
