#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# verify-site.sh — tjek at HELE sitet stadig virker efter et deploy.
#
#   scripts/verify-site.sh                     # tjek alt én gang
#   scripts/verify-site.sh --wait-for minapp   # vent til minapp/ er live
#
# Alle app-mapper skal svare 200, og forsiden skal stadig hedde "Mine projekter".
# Exit-kode 1 hvis noget er galt — så kan det ikke overses.
# ---------------------------------------------------------------------------
set -euo pipefail

SITE_BRANCH="${SITE_BRANCH:-claude/wc2026-tournament-app-k42mv8}"
REMOTE="${REMOTE:-origin}"
WAIT_FOR=""
TIMEOUT=180

while [ $# -gt 0 ]; do
  case "$1" in
    --branch)   SITE_BRANCH="${2:-}"; shift 2 ;;
    --wait-for) WAIT_FOR="${2:-}"; shift 2 ;;
    --timeout)  TIMEOUT="${2:-}"; shift 2 ;;
    -h|--help)  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'ukendt flag: %s\n' "$1" >&2; exit 1 ;;
  esac
done

# Site-URL udledes af remote, så scriptet også virker i en fork.
ORIGIN_URL="$(git remote get-url "$REMOTE")"
OWNER_REPO="$(printf '%s' "$ORIGIN_URL" \
  | sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\.git$##')"
OWNER="${OWNER_REPO%%/*}"
REPO="${OWNER_REPO##*/}"
BASE="https://${OWNER}.github.io/${REPO}"

code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$1" || echo 000; }

# Hvilke mapper findes på oversigts-branchen? Kilde: branchen selv, ikke en liste
# der bliver forældet.
git fetch "$REMOTE" "$SITE_BRANCH" --quiet 2>/dev/null || true
APPS="$(git ls-tree -d --name-only "$REMOTE/$SITE_BRANCH" 2>/dev/null \
        | grep -v -E '^\.' \
        | grep -v -E '^(notes|scripts|templates|docs|_shared)$' || true)"

# Vent på Pages-bygningen, hvis vi lige har pushet.
if [ -n "$WAIT_FOR" ]; then
  printf 'venter på %s/ ' "$WAIT_FOR"
  ELAPSED=0
  until [ "$(code "$BASE/$WAIT_FOR/")" = "200" ]; do
    [ "$ELAPSED" -ge "$TIMEOUT" ] && {
      printf '\n\033[31m✗\033[0m %s/ svarer stadig ikke 200 efter %ss\n' "$WAIT_FOR" "$TIMEOUT" >&2
      printf '  Tjek build-loggen: %s/actions\n' "https://github.com/$OWNER_REPO" >&2
      exit 1
    }
    printf '.'; sleep 10; ELAPSED=$((ELAPSED + 10))
  done
  printf ' klar\n\n'
fi

FAIL=0
ROOT_CODE="$(code "$BASE/")"
[ "$ROOT_CODE" = "200" ] || FAIL=1
printf '%-22s %s\n' "/" "$ROOT_CODE"
for a in $APPS; do
  C="$(code "$BASE/$a/")"
  [ "$C" = "200" ] || FAIL=1
  printf '%-22s %s\n' "/$a/" "$C"
done

TITLE="$(curl -sS --max-time 20 "$BASE/" | grep -o '<title>[^<]*' | sed 's/<title>//' || true)"
printf '\nforsidens titel: %s\n' "${TITLE:-(tom)}"
[ "$TITLE" = "Mine projekter" ] || { printf '\033[31m✗ forsiden er overskrevet!\033[0m\n' >&2; FAIL=1; }

if [ "$FAIL" = 0 ]; then
  printf '\033[32m✓ hele sitet svarer 200\033[0m  %s/\n' "$BASE"
else
  printf '\033[31m✗ noget er galt — ret det før du melder færdig\033[0m\n' >&2
  exit 1
fi
