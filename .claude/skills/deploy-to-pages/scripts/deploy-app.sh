#!/usr/bin/env bash
# deploy-app.sh — publish ONE app to the multi-app GitHub Pages site
# (frederiknordentoft-prog/Test) without touching any other app.
#
# The site is served from the "overview branch" below: its root index.html is
# the "Mine projekter" front page, and every app lives in its own subfolder,
# reachable at https://frederiknordentoft-prog.github.io/Test/<app>/ and from a
# card on the front page. This script deploys into ONE subfolder and hard-refuses
# to change anything else — that guard is the whole point.
#
# Usage:
#   deploy-app.sh <app> <dist-dir> [--dry-run]   # UPDATE an existing app
#   deploy-app.sh <app> <dist-dir> --new         # stage a NEW app, then add a card
#   deploy-app.sh --push <worktree> <app>         # finish a staged NEW app
#   deploy-app.sh --verify                        # check every app is live (200) + front page intact
#
# Run it from inside a clone of the repo. It never force-pushes and never touches
# the Pages source, the root sw.js, or any other app's folder/card.
set -euo pipefail

REMOTE="origin"
OVERVIEW_BRANCH="claude/wc2026-tournament-app-k42mv8"
LIVE_BASE="https://frederiknordentoft-prog.github.io/Test"
# Top-level names that are NOT app folders — refuse them as a deploy target.
RESERVED="index.html sw.js favicon.svg .github .nojekyll manifest.webmanifest CLAUDE.md README.md notes assets icons .git .gitignore"

die()  { echo "ERROR: $*" >&2; exit 1; }
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "run this from inside a clone of the repo"

discover_live_apps() { # read app slugs from the front-page cards
  curl -fsS "$LIVE_BASE/" 2>/dev/null \
    | grep -oE 'href="\./[A-Za-z0-9_-]+/"' \
    | sed -E 's#href="\./([A-Za-z0-9_-]+)/"#\1#' | sort -u
}

verify_site() {
  echo "Verifying $LIVE_BASE  (Pages can take 1–2 min after a push):"
  local ok=1 code title a
  code=$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_BASE/"); printf '  %-22s %s\n' "<root>" "$code"; [ "$code" = 200 ] || ok=0
  for a in $(discover_live_apps); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_BASE/$a/"); printf '  %-22s %s\n' "$a/" "$code"; [ "$code" = 200 ] || ok=0
  done
  title=$(curl -s "$LIVE_BASE/" | grep -o '<title>[^<]*</title>' | head -1)
  echo "  root title: ${title:-<none>}"
  echo "$title" | grep -q 'Mine projekter' || { echo "  WARNING: front-page title is not 'Mine projekter'"; ok=0; }
  if [ "$ok" = 1 ]; then echo "  ✓ all paths 200, front page intact"; else
    echo "  ✗ some checks failed — if you just pushed, wait ~1–2 min and re-run:  deploy-app.sh --verify"; return 1; fi
}

# Abort unless every changed top-level entry is in the allowed set. This is the
# protection against clobbering another app.
guard() { # $1=worktree  $2..=allowed top-level names
  local wt="$1"; shift
  local allowed=" $* " changed p offenders=""
  changed=$(git -C "$wt" status --porcelain | awk '{print $NF}' | cut -d/ -f1 | sort -u)
  for p in $changed; do case "$allowed" in *" $p "*) ;; *) offenders="$offenders $p";; esac; done
  [ -z "$offenders" ] || { echo "REFUSING TO DEPLOY — changes outside allowed paths:$offenders" >&2
    echo "  allowed only:$allowed" >&2; return 1; }
}

commit_push_verify() { # $1=worktree  $2=message
  local wt="$1" msg="$2" i
  if git -C "$wt" diff --cached --quiet; then
    echo "No changes to deploy — '$APP' is already up to date."; verify_site || true; return 0
  fi
  git -C "$wt" commit -q -m "$msg"
  for i in 1 2 3 4; do
    git -C "$wt" push "$REMOTE" "HEAD:$OVERVIEW_BRANCH" && break
    [ "$i" = 4 ] && die "push failed after 4 attempts"
    sleep $((2 ** i))
  done
  echo "Pushed to $OVERVIEW_BRANCH."
  verify_site || true
}

remove_worktree() { git -C "$REPO_ROOT" worktree remove --force "$1" 2>/dev/null || rm -rf "$1"; }

# ---------------- subcommands ----------------
if [ "${1:-}" = "--verify" ]; then verify_site; exit $?; fi

if [ "${1:-}" = "--push" ]; then
  WT="${2:?worktree dir}"; APP="${3:?app folder}"
  [ -e "$WT/.git" ] || die "not a worktree: $WT"
  git -C "$WT" add -A
  guard "$WT" "$APP" "index.html" || die "guard failed — fix the worktree and retry"
  grep -q "\./$APP/" "$WT/index.html" 2>/dev/null || die "front page has no card linking to ./$APP/ — add one first (see reference/card-template.html)"
  commit_push_verify "$WT" "Deploy $APP (new app + front-page card)"
  remove_worktree "$WT"
  exit 0
fi

# ---------------- normal deploy (update / stage-new) ----------------
APP="${1:?usage: deploy-app.sh <app> <dist-dir> [--new|--dry-run]}"
DIST="${2:?dist dir required}"
NEW=0; DRY=0
for f in "${@:3}"; do case "$f" in --new) NEW=1;; --dry-run) DRY=1;; *) die "unknown flag: $f";; esac; done

echo "$APP" | grep -qE '^[a-z0-9][a-z0-9-]*$' || die "app must be a lowercase slug (a-z 0-9 -): got '$APP'"
for r in $RESERVED; do [ "$APP" = "$r" ] && die "'$APP' is reserved — choose an app subfolder name, not a root file"; done
[ -d "$DIST" ] || die "dist dir not found: $DIST"
[ -f "$DIST/index.html" ] || die "no index.html in '$DIST' — build the app first (Vite: base './')"

git fetch "$REMOTE" "$OVERVIEW_BRANCH" >/dev/null 2>&1 || die "cannot fetch $OVERVIEW_BRANCH"
EXISTS=0; git ls-tree -r --name-only "$REMOTE/$OVERVIEW_BRANCH" | grep -qE "^$APP/" && EXISTS=1
[ "$EXISTS" = 1 ] && [ "$NEW" = 1 ] && die "'$APP' already exists — drop --new (this is an update)"
[ "$EXISTS" = 0 ] && [ "$NEW" = 0 ] && die "'$APP' does not exist yet — it's a NEW app: re-run with --new and you'll add a front-page card"

WT="$(mktemp -d)"; WTBRANCH="deploy-$APP-wt"
git worktree add -q "$WT" -B "$WTBRANCH" "$REMOTE/$OVERVIEW_BRANCH"
finish_fail() { remove_worktree "$WT"; git -C "$REPO_ROOT" branch -D "$WTBRANCH" 2>/dev/null || true; }

rm -rf "${WT:?}/$APP"; mkdir -p "$WT/$APP"; cp -R "$DIST/." "$WT/$APP/"
git -C "$WT" add -A

if [ "$NEW" = 1 ]; then
  guard "$WT" "$APP" "index.html" || { finish_fail; exit 1; }
  cat <<EOF

STAGED new app '$APP'. Built files are in the worktree, but no front-page card exists yet.
Worktree: $WT

Next:
  1) Add a card for '$APP' to  $WT/index.html
     (copy the pattern in the skill's reference/card-template.html — new .card, a .<xx> .emoji
      gradient rule, and bump the "N web-apps" count).
  2) Finish (guards, commits, pushes, verifies):
       bash "$0" --push "$WT" "$APP"
EOF
  exit 0
fi

# update
guard "$WT" "$APP" || { finish_fail; exit 1; }
echo "Changes are confined to  $APP/  ✓"
if [ "$DRY" = 1 ]; then
  echo "[--dry-run] would commit & push to $OVERVIEW_BRANCH:"
  git -C "$WT" --no-pager diff --cached --stat
  echo "[--dry-run] current live status (no changes pushed):"
  verify_site || true
  finish_fail
  exit 0
fi
commit_push_verify "$WT" "Deploy $APP (update)"
finish_fail
