#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# gate-hash.sh — lav den <script>-linje der sætter en adgangskode på en side.
#
#   scripts/gate-hash.sh minapp "mit kodeord"
#
# Udskriver de to linjer du indsætter i <head> på appens index.html.
# Selve kodeordet havner ALDRIG i koden — kun en SHA-256 af slug+kodeord.
#
# LÆS FØRST: dette er en dørmåtte, ikke en lås. Se LOGIN-afsnittet i PUBLICER.md.
# ---------------------------------------------------------------------------
set -euo pipefail

SLUG="${1:-}"
PASS="${2:-}"

if [ -z "$SLUG" ] || [ -z "$PASS" ]; then
  printf 'brug: %s <slug> "<kodeord>"\n' "$0" >&2
  exit 1
fi

HASH="$(printf '%s:%s' "$SLUG" "$PASS" | python3 -c \
  'import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())')"

cat <<EOF

Indsæt disse to linjer i <head> på ${SLUG}/index.html — før alt andet indhold:

<link rel="stylesheet" href="../_shared/gate.css" />
<script src="../_shared/gate.js" data-gate="${SLUG}" data-hash="${HASH}"></script>

Valgfrit: data-title="Min App"  data-hint="Spørg Frederik"

EOF
