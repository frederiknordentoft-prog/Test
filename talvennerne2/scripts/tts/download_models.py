#!/usr/bin/env python3
"""Henter de modelfiler, som oplæsnings-pipelinen bruger, til HF-cachen.

Kaldes af setup.sh (med venv'ets python). Revisionerne er låst, så en
genopbygning efter container-genstart giver præcis de samme vægte.

  python download_models.py tts      # CoRal Chatterbox (kun de filer from_local indlæser)
  python download_models.py asr      # CoRal wav2vec2 (uden sprogmodel)
  python download_models.py whisper  # valgfri second opinion (ca. 3,1 GB)
  python download_models.py piper    # A2-reserve: Piper da_DK-talesyntese-medium
  python download_models.py paths    # skriv lokale stier (kræver at filerne findes)
"""
from __future__ import annotations

import json
import sys

from huggingface_hub import snapshot_download

# Låste revisioner (commit-hash på HuggingFace, læst 30/9-2026).
MODELS = {
    "tts": {
        "repo_id": "CoRal-project/roest-v3-chatterbox-500m",
        "revision": "7ce205cea6b3b36d9f60f18abb88ff21fa04ea0d",
        # Præcis de filer ChatterboxMultilingualTTS.from_local i chatterbox-tts 0.1.7
        # indlæser (se chatterbox/mtl_tts.py): ve.pt, t3_mtl23ls_v2.safetensors,
        # s3gen.pt, grapheme_mtl_merged_expanded_v1.json og (valgfri) conds.pt.
        # Dertil stemmeprompts for Mic og Nic samt licens og modelkort.
        # t3_23lang.safetensors, ve.safetensors, tokenizer.json, mtl_tokenizer.json og
        # Cangjie5_TC.json indlæses ikke for dansk og hentes derfor ikke.
        "allow_patterns": [
            "t3_mtl23ls_v2.safetensors",
            "s3gen.pt",
            "ve.pt",
            "grapheme_mtl_merged_expanded_v1.json",
            "conds.pt",
            "audio_samples/00_*",
            "LICENSE",
            "README.md",
        ],
    },
    "asr": {
        "repo_id": "CoRal-project/roest-v3-wav2vec2-315m",
        "revision": "beb3e790246d6b9dec1df596b0b21d5c42f4d99c",
        # Grådig CTC-afkodning uden KenLM (language_model/ springes over med vilje:
        # en sprogmodel ville "rette" udtalefejl, som udtaletjekket skal fange).
        "allow_patterns": [
            "config.json",
            "preprocessor_config.json",
            "vocab.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "added_tokens.json",
            "model.safetensors",
            "README.md",
        ],
    },
    "whisper": {
        "repo_id": "CoRal-project/roest-v3-whisper-1.5b",
        "revision": "7182cced29631ef7d7776eb8c01f24624b9b9b04",
        "allow_patterns": [
            "*.json",
            "merges.txt",
            "model-*.safetensors",
            "README.md",
        ],
    },
    "piper": {
        "repo_id": "rhasspy/piper-voices",
        "revision": "c10ece1aade47bb51c153c893d14e5bf8e5b7117",  # bruges kun ved A2-reserven
        "allow_patterns": [
            "da/da_DK/talesyntese/medium/*",
        ],
    },
}


def fetch(key: str, local_only: bool = False) -> str:
    m = MODELS[key]
    return snapshot_download(
        repo_id=m["repo_id"],
        revision=m["revision"],
        allow_patterns=m["allow_patterns"],
        token=None,
        local_files_only=local_only,
    )


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    if argv[0] == "paths":
        out = {}
        for key in ("tts", "asr", "whisper", "piper"):
            try:
                out[key] = fetch(key, local_only=True)
            except Exception:  # noqa: BLE001 – ikke hentet
                out[key] = None
        print(json.dumps(out, indent=2))
        return 0
    for key in argv:
        path = fetch(key)
        print(f"{key}: {MODELS[key]['repo_id']}@{MODELS[key]['revision']} -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
