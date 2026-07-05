#!/usr/bin/env bash
# Samler de øvrige app-brancher ind i dist/apps/<navn>/ så alle apps i repoet
# fortsat er tilgængelige fra ét GitHub Pages-site:
#   /Test/                  → vindtunnelen (denne branch)
#   /Test/apps/             → oversigtsside
#   /Test/apps/<navn>/      → hver statisk app fra sin branch
# Vite-KILDE-brancher (script src="/src/…") kan ikke serveres ubygget og springes
# over — Vægtskålen findes færdigbygget på gh-pages og medtages derfra.
set -uo pipefail

OUT=dist/apps
SELF_BRANCH="claude/wind-tunnel-vision-j5cevp"
mkdir -p "$OUT"

slug() { echo "$1" | sed 's|^origin/||; s|^claude/||; s|[^a-zA-Z0-9-]|-|g'; }

# Forudbygget Vægtskålen fra gh-pages (den tidligere Pages-rod)
if git show origin/gh-pages:index.html >/dev/null 2>&1; then
  mkdir -p "$OUT/vaegtskaalen"
  git archive origin/gh-pages | tar -x -C "$OUT/vaegtskaalen" && echo "app: gh-pages -> apps/vaegtskaalen/"
fi

for BR in $(git branch -r --format='%(refname:short)' | grep '^origin/claude/'); do
  NAME="${BR#origin/}"
  [ "$NAME" = "$SELF_BRANCH" ] && continue
  git show "$BR:index.html" >/dev/null 2>&1 || continue
  if git show "$BR:index.html" | grep -q 'src="/src/'; then
    echo "skip (vite-kilde, kræver build): $NAME"
    continue
  fi
  S=$(slug "$BR")
  mkdir -p "$OUT/$S"
  if git archive "$BR" | tar -x -C "$OUT/$S"; then
    echo "app: $NAME -> apps/$S/"
  else
    echo "FEJL ved udpakning: $NAME (springes over)"
    rm -rf "$OUT/$S"
  fi
done

# Oversigtsside
{
  cat <<'HTML'
<!doctype html><html lang="da"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apps</title>
<style>
body{font-family:system-ui;background:#0b0e14;color:#e5eaf3;padding:36px 20px;max-width:640px;margin:auto}
h1{font-size:1.25rem;letter-spacing:.05em;color:#7dd3fc;text-transform:uppercase}
a{color:#e5eaf3;display:block;padding:12px 14px;margin:8px 0;background:#131826;border:1px solid #222b42;border-radius:10px;text-decoration:none}
a:hover{border-color:#38bdf8}
</style></head><body>
<h1>Apps i dette repo</h1>
<a href="../">🌬️ Vindtunnel</a>
HTML
  for D in "$OUT"/*/; do
    S=$(basename "$D")
    echo "<a href=\"./$S/\">$S</a>"
  done
  echo '</body></html>'
} > "$OUT/index.html"

echo "færdig: $(find "$OUT" -mindepth 1 -maxdepth 1 -type d | wc -l) apps samlet"
