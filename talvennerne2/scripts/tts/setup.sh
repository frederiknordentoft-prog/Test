#!/usr/bin/env bash
# Talvennerne 2 — opsætning af oplæsningsværktøjer (spike S1). Idempotent: kan
# genkøres efter en container-genstart og gør kun det, der mangler.
#
#   bash talvennerne2/scripts/tts/setup.sh            # venvs + modeller (TTS + ASR)
#   bash talvennerne2/scripts/tts/setup.sh --smoke    # + én prøvegenerering med ASR-tjek
#   bash talvennerne2/scripts/tts/setup.sh --whisper  # + roest-v3-whisper-1.5b (valgfri, ca. 3,1 GB)
#   bash talvennerne2/scripts/tts/setup.sh --piper    # + A2-reserve: Piper da_DK-talesyntese-medium
#
# Resultat:
#   /opt/tv2-tts   torch 2.6.0+cpu, chatterbox-tts 0.1.7 m.m. (requirements-tts.txt)
#   /opt/tv2-asr   torch/torchaudio 2.6.0+cpu, transformers 5.2.0 (requirements-asr.txt)
#   HF-cache       CoRal-project/roest-v3-chatterbox-500m og roest-v3-wav2vec2-315m
#                  på låste revisioner (download_models.py)
#   ~/.pkuseg      spacy-pkuseg-model, som chatterbox' tokenizer henter ved indlæsning
#
# Netværk går gennem agent-proxyen (HTTPS_PROXY + CA-bundle /root/.ccr/ca-bundle.crt).
# TLS-verifikation slås aldrig fra.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-python3.11}"
TTS_VENV="${TV2_TTS_VENV:-/opt/tv2-tts}"
ASR_VENV="${TV2_ASR_VENV:-/opt/tv2-asr}"
PIPER_VENV="${TV2_PIPER_VENV:-/opt/tv2-piper}"
TORCH_INDEX="https://download.pytorch.org/whl/cpu"
PIPER_VERSION="1.8.0"

SMOKE=0 WHISPER=0 PIPER=0
for arg in "$@"; do
  case "$arg" in
    --smoke) SMOKE=1 ;;
    --whisper) WHISPER=1 ;;
    --piper) PIPER=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "ukendt flag: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n== %s\n' "$*"; }

make_venv() {  # $1 = venv-sti, $2 = requirements-fil
  local venv="$1" req="$2"
  if [ ! -x "$venv/bin/python" ]; then
    log "opretter $venv"
    "$PY" -m venv "$venv"
  fi
  log "pakker i $venv"
  "$venv/bin/python" -m pip install -q --upgrade pip
  # torch først og kun fra CPU-indekset, så PyPI's CUDA-hjul aldrig bliver valgt.
  "$venv/bin/pip" install -q --index-url "$TORCH_INDEX" "torch==2.6.0+cpu" "torchaudio==2.6.0+cpu"
  "$venv/bin/pip" install -q -r "$req"
  "$venv/bin/pip" check
}

command -v "$PY" >/dev/null || { echo "mangler $PY" >&2; exit 1; }

make_venv "$TTS_VENV" "$HERE/requirements-tts.txt"
make_venv "$ASR_VENV" "$HERE/requirements-asr.txt"

log "modeller (låste revisioner, kun de filer der indlæses)"
"$TTS_VENV/bin/python" "$HERE/download_models.py" tts asr
if [ "$WHISPER" = 1 ]; then
  "$ASR_VENV/bin/python" "$HERE/download_models.py" whisper
fi

log "spacy-pkuseg-model (chatterbox' MTLTokenizer indlæser den altid, også for dansk)"
"$TTS_VENV/bin/python" - <<'PYEOF'
from spacy_pkuseg import pkuseg
pkuseg()  # henter ~/.pkuseg/spacy_ontonotes.zip fra GitHub-release første gang
print("pkuseg ok")
PYEOF

log "tjek af installationen"
"$TTS_VENV/bin/python" - <<'PYEOF'
import importlib.metadata as md
import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: F401
print("tv2-tts: torch", torch.__version__, "| chatterbox-tts", md.version("chatterbox-tts"),
      "| transformers", md.version("transformers"))
PYEOF
"$ASR_VENV/bin/python" - <<'PYEOF'
import torch, torchaudio, transformers
from torchaudio.functional import forced_align  # noqa: F401
print("tv2-asr: torch", torch.__version__, "| torchaudio", torchaudio.__version__,
      "| transformers", transformers.__version__)
PYEOF
"$TTS_VENV/bin/python" "$HERE/download_models.py" paths

if [ "$PIPER" = 1 ]; then
  log "A2-reserve: Piper $PIPER_VERSION + da_DK-talesyntese-medium"
  [ -x "$PIPER_VENV/bin/python" ] || "$PY" -m venv "$PIPER_VENV"
  "$PIPER_VENV/bin/python" -m pip install -q --upgrade pip
  "$PIPER_VENV/bin/pip" install -q "piper-tts==$PIPER_VERSION" soundfile "numpy<2" scipy pyloudnorm huggingface_hub
  "$PIPER_VENV/bin/python" "$HERE/download_models.py" piper
fi

if [ "$SMOKE" = 1 ]; then
  log "røgtest: én probesætning (Nic) + ASR"
  nice -n 19 "$TTS_VENV/bin/python" "$HERE/probe.py" gen --set probe12 --voices nic --only p01 --tag smoke
  nice -n 19 "$ASR_VENV/bin/python" "$HERE/asr_check.py" "$HERE/../../voice/probe/takes/smoke/meta.jsonl"
fi

log "færdig"
