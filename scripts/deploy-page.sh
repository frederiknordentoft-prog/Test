#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-page.sh — læg en side/app op på Pages-sitet, sikkert og i én kommando.
#
#   scripts/deploy-page.sh --slug minapp --from dist \
#       --title "Min App" --emoji "🚀" --sub "Kort beskrivelse"
#
# Scriptet gør præcis det CLAUDE.md beskriver, men uden håndarbejde:
#   1. henter oversigts-branchen ned i et midlertidigt worktree
#   2. lægger dine filer i <slug>/ — og kun der
#   3. opretter/opdaterer appens kort på forsiden
#   4. nægter at committe hvis noget uden for <slug>/ og index.html er rørt
#   5. committer, pusher (med retry) og verificerer at HELE sitet svarer 200
#
# Kør --help for alle flag.
# ---------------------------------------------------------------------------
set -euo pipefail

SITE_BRANCH="${SITE_BRANCH:-claude/wc2026-tournament-app-k42mv8}"
REMOTE="${REMOTE:-origin}"
SLUG="" FROM="" TITLE="" EMOJI="" SUB=""
DRY_RUN=0 NO_CARD=0 NO_VERIFY=0

RESERVED="notes scripts templates docs assets icons _shared .github .git"

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m→\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Flag:
  --slug <navn>     Undermappen på sitet, fx "minapp"  → /Test/minapp/  (påkrævet)
  --from <mappe>    Mappen med de færdige filer (skal indeholde index.html)
  --title <tekst>   Titel på forsidens kort   (påkrævet for en NY app)
  --emoji <tegn>    Emoji på forsidens kort   (påkrævet for en NY app)
  --sub <tekst>     Undertekst på kortet      (påkrævet for en NY app)
  --branch <navn>   Oversigts-branch (default: claude/wc2026-tournament-app-k42mv8)
  --no-card         Deploy filerne uden at røre forsiden
  --no-verify       Spring live-tjekket over (frarådes)
  --dry-run         Vis hvad der ville ske — commit/push udelades
  -h, --help        Denne hjælp
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --slug)    SLUG="${2:-}"; shift 2 ;;
    --from)    FROM="${2:-}"; shift 2 ;;
    --title)   TITLE="${2:-}"; shift 2 ;;
    --emoji)   EMOJI="${2:-}"; shift 2 ;;
    --sub)     SUB="${2:-}"; shift 2 ;;
    --branch)  SITE_BRANCH="${2:-}"; shift 2 ;;
    --remote)  REMOTE="${2:-}"; shift 2 ;;
    --no-card)   NO_CARD=1; shift ;;
    --no-verify) NO_VERIFY=1; shift ;;
    --dry-run)   DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "ukendt flag: $1 (prøv --help)" ;;
  esac
done

# --- validering ------------------------------------------------------------
[ -n "$SLUG" ] || { usage; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{0,39}$ ]] \
  || die "ugyldigt slug '$SLUG' — brug kun små bogstaver, tal og bindestreg"
for r in $RESERVED; do
  [ "$SLUG" = "$r" ] && die "'$SLUG' er reserveret til sitets egne filer"
done

[ -n "$FROM" ] || die "--from mangler"
[ -d "$FROM" ] || die "--from '$FROM' er ikke en mappe"
[ -f "$FROM/index.html" ] || die "'$FROM' indeholder ingen index.html — er appen bygget?"

FROM_ABS="$(cd "$FROM" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
[ "$FROM_ABS" = "$REPO_ROOT" ] && die "--from må ikke være repo-roden"
[ -d "$FROM_ABS/.git" ] && die "--from ligner et helt repo-checkout, ikke en build-mappe"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARD_PY="$SCRIPT_DIR/_card.py"
[ -f "$CARD_PY" ] || die "mangler $CARD_PY"

# --- worktree --------------------------------------------------------------
WT="$(mktemp -d -t sitewt-XXXXXX)"
cleanup() {
  cd "$REPO_ROOT" 2>/dev/null || true
  git worktree remove --force "$WT" >/dev/null 2>&1 || true
  rm -rf "$WT" 2>/dev/null || true
}
trap cleanup EXIT

info "henter $SITE_BRANCH fra $REMOTE"
git fetch "$REMOTE" "$SITE_BRANCH" --quiet \
  || die "kunne ikke hente $SITE_BRANCH fra $REMOTE"
git worktree add --detach "$WT" "$REMOTE/$SITE_BRANCH" >/dev/null 2>&1 \
  || die "kunne ikke oprette worktree"

IS_NEW=0
[ -d "$WT/$SLUG" ] || IS_NEW=1
if [ "$IS_NEW" = 1 ] && [ "$NO_CARD" = 0 ]; then
  [ -n "$TITLE" ] && [ -n "$EMOJI" ] && [ -n "$SUB" ] \
    || die "'$SLUG' er ny — --title, --emoji og --sub er påkrævet (eller brug --no-card)"
fi

# --- kopiér filer ind i KUN <slug>/ ---------------------------------------
info "kopierer $(find "$FROM_ABS" -type f | wc -l | tr -d ' ') filer → $SLUG/"
rm -rf "${WT:?}/${SLUG:?}"
mkdir -p "$WT/$SLUG"
(cd "$FROM_ABS" && tar cf - .) | (cd "$WT/$SLUG" && tar xf -)
# build-artefakter der aldrig skal på sitet
find "$WT/$SLUG" -name '.DS_Store' -delete 2>/dev/null || true
rm -rf "$WT/$SLUG/.git" "$WT/$SLUG/node_modules" 2>/dev/null || true

# --- forsidens kort --------------------------------------------------------
if [ "$NO_CARD" = 0 ] && [ -n "$TITLE$EMOJI$SUB" ]; then
  info "opdaterer forsidens kort"
  python3 "$CARD_PY" "$WT/index.html" \
    --slug "$SLUG" --title "$TITLE" --emoji "$EMOJI" --sub "$SUB" \
    || die "kunne ikke opdatere index.html"
fi

# --- sikkerhedstjek: intet uden for <slug>/ og index.html må være rørt -----
cd "$WT"
git add -A
STRAY="$(git diff --cached --name-only \
        | grep -v -E "^${SLUG}/" | grep -v -E '^index\.html$' || true)"
if [ -n "$STRAY" ]; then
  printf '\033[31mSTOP:\033[0m deployet ville ændre filer uden for %s/:\n' "$SLUG" >&2
  printf '  %s\n' $STRAY >&2
  die "afbrudt — sitet er urørt"
fi

if git diff --cached --quiet; then
  ok "ingen ændringer — $SLUG/ er allerede up to date"
  exit 0
fi

printf '\n'
git diff --cached --stat
printf '\n'

if [ "$DRY_RUN" = 1 ]; then
  ok "dry-run: intet blev committet eller pushet"
  exit 0
fi

# --- commit + push med backoff --------------------------------------------
VERB=$([ "$IS_NEW" = 1 ] && echo "Add" || echo "Update")
git -c user.name="${GIT_AUTHOR_NAME:-Claude}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-noreply@anthropic.com}" \
    commit --quiet -m "$VERB $SLUG on the Pages site"

DELAY=2
for attempt in 1 2 3 4 5; do
  if git push "$REMOTE" "HEAD:$SITE_BRANCH" --quiet 2>/dev/null; then
    ok "pushet til $SITE_BRANCH"
    break
  fi
  [ "$attempt" = 5 ] && die "push fejlede 5 gange — er $SITE_BRANCH flyttet under os? Kør igen."
  info "push fejlede, prøver igen om ${DELAY}s"
  sleep "$DELAY"; DELAY=$((DELAY * 2))
  git fetch "$REMOTE" "$SITE_BRANCH" --quiet || true
done

cd "$REPO_ROOT"

# --- verificér -------------------------------------------------------------
if [ "$NO_VERIFY" = 0 ]; then
  info "venter på at Pages bygger (op til 3 min)"
  "$SCRIPT_DIR/verify-site.sh" --branch "$SITE_BRANCH" --wait-for "$SLUG"
fi

ok "$SLUG er live"
