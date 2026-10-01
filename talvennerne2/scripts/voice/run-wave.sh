#!/usr/bin/env bash
# Hele lydkæden for én bølge (SPEC §10.2–10.4): inventar → generering i bidder → sammensætningstest
# → pakning, med commits undervejs. Genoptagelig: kør samme kommando igen efter en genstart, så
# fortsætter den, hvor den slap (generate.py er idempotent på klippenes hash).
#
#   bash talvennerne2/scripts/voice/run-wave.sh 1
#
# Miljøvariabler:
#   TV2_THREADS=2|4        tråde til generering (4 når containeren er ledig; standard 2)
#   TV2_MAX_MINUTES=100    længden af én genereringsbid (minutter)
#   TV2_COMMIT=0           ingen commits (standard: mastere i bidder ≤ 10 MB, derefter sprites)
#   TV2_QA_ROUNDS=2        runder med nye takes for klip, som sammensætningstesten peger på
set -uo pipefail

WAVE="${1:?brug: run-wave.sh <bølge 1|2|3>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
cd "$APP"
THREADS="${TV2_THREADS:-2}"
MAX_MIN="${TV2_MAX_MINUTES:-100}"
COMMIT="${TV2_COMMIT:-1}"
QA_ROUNDS="${TV2_QA_ROUNDS:-2}"
TTS_PY="${TV2_TTS_PYTHON:-/opt/tv2-tts/bin/python}"
CHUNK_BYTES=$((10 * 1024 * 1024))
TRAILER="${TV2_COMMIT_TRAILER:-Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NkKeG1vom4pEx42VmVeg8D}"
START=$(date +%s)

say() { printf '\n== %s  %s\n' "$(date +%H:%M:%S)" "$*"; }

git_commit() {  # $1 = besked; resten = stier
  local msg="$1"; shift
  [ "$COMMIT" = 1 ] || return 0
  git add -- "$@" || return 1
  git diff --cached --quiet && return 0
  git -c user.email=fnordentoft@icloud.com -c user.name="Frederik Nordentoft" \
    commit -q -m "$msg" -m "$TRAILER" && git log --oneline -1
}

commit_masters() {  # nye og ændrede mastere i bidder på højst 10 MB, så indeks og logs
  [ "$COMMIT" = 1 ] || return 0
  local files=() batch=() size=0 part=1 f s
  mapfile -d '' files < <(git ls-files -z --others --modified --exclude-standard -- voice/masters)
  for f in "${files[@]}"; do
    [ "$f" = voice/masters/index.json ] && continue
    s=$(stat -c %s "$f" 2>/dev/null || echo 0)
    if [ "${#batch[@]}" -gt 0 ] && [ $((size + s)) -gt "$CHUNK_BYTES" ]; then
      git_commit "Stemme bølge $WAVE: mastere, bid $part" "${batch[@]}" || return 1
      batch=(); size=0; part=$((part + 1))
    fi
    batch+=("$f"); size=$((size + s))
  done
  [ -f voice/masters/index.json ] && batch+=(voice/masters/index.json)
  [ -d voice/logs ] && batch+=(voice/logs)
  [ "${#batch[@]}" -gt 0 ] && git_commit "Stemme bølge $WAVE: mastere, bid $part" "${batch[@]}"
  return 0
}

status() {
  "$TTS_PY" scripts/tts/generate.py --status --wave "$WAVE"
  [ -f voice/qa.json ] && python3 - <<'EOF'
import json
q = json.load(open("voice/qa.json"))
n, t = q["numbers"], q["templates"]
print(f"sammensætning: tal {n['correct']}/{n['rendered']} rigtige ({n['rendered']}/899 kunne bygges), "
      f"skabeloner {t['verbatim']}/{t['rendered']} ordret ({t['rate']} %)")
EOF
  echo "væguret for run-wave.sh: $(( ($(date +%s) - START) / 60 )) min"
}

# 0. Værktøjer (genopbygges efter en genstart af containeren, hvis de mangler)
if [ ! -x "$TTS_PY" ] || [ ! -x /opt/tv2-asr/bin/python ]; then
  say "venvs mangler: kører scripts/tts/setup.sh"
  bash scripts/tts/setup.sh || exit 1
fi

# 1. Inventar fra koden
say "inventar"
node scripts/voice/run-vite.mjs scripts/voice/inventory.ts || exit 1

# 2. Generering i bidder (exit 0 = færdig, 3 = tidsbudget brugt, 4 = ingen fremdrift)
gen_until_done() {  # ekstra argumenter går til generate.py
  local rc
  while :; do
    say "generering, bølge $WAVE ($THREADS tråde, bidder à $MAX_MIN min)"
    nice -n 19 "$TTS_PY" scripts/tts/generate.py --wave "$WAVE" --threads "$THREADS" --max-minutes "$MAX_MIN" "$@"
    rc=$?
    set --  # retakes only in the first chunk
    commit_masters
    status
    case $rc in
      0) return 0 ;;
      3) continue ;;
      4) echo "generate.py: ingen fremdrift; se voice/logs/"; return 0 ;;
      *) echo "generate.py fejlede (exit $rc)"; return "$rc" ;;
    esac
  done
}
gen_until_done || exit 1

# 3. Sammensætningstest (899 tal + skabeloner) og nye takes til de klip, den peger på
round=0
while :; do
  say "sammensætningstest"
  node scripts/voice/run-vite.mjs scripts/voice/render.ts
  rc=$?
  [ $rc -eq 1 ] && exit 1
  retake=$(python3 -c 'import json; print(len(json.load(open("voice/qa.json"))["retake"]))')
  if [ $rc -eq 0 ] || [ "$retake" = 0 ] || [ "$round" -ge "$QA_ROUNDS" ]; then break; fi
  round=$((round + 1))
  say "nye takes til $retake klip (runde $round af $QA_ROUNDS)"
  gen_until_done --retake-from voice/qa.json || exit 1
done

# 4. Sprites og manifest
say "pakning"
node scripts/voice/pack.mjs || exit 1
git_commit "Stemme bølge $WAVE: sprites, manifest og QA" src/assets/voice voice/qa.json voice/inventory.json voice/masters/index.json

say "status"
status
