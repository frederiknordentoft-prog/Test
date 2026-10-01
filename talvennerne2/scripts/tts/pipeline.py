"""Fælles for lydpipelinen (generate.py, qa_asr.py): stier, konfiguration, inventar, master-indeks,
filnavne og hvordan hvert klip genereres (strategi D, docs/voice.md §11).

Ren Python (standardbiblioteket + da_text), så modulet kan importeres fra begge venvs.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from da_text import normalize, syllables  # noqa: E402

ROOT = HERE.parents[1]                                   # talvennerne2/
VOICE = ROOT / "voice"
CONFIG = VOICE / "config.json"
INVENTORY = VOICE / "inventory.json"
MASTERS = Path(os.environ.get("TV2_VOICE_MASTERS", VOICE / "masters"))
INDEX = MASTERS / "index.json"
LOGS = Path(os.environ.get("TV2_VOICE_LOGS", VOICE / "logs"))
# Rå takes, kandidater og tilstand ligger uden for git. voice/probe/takes/ er allerede ignoreret.
WORK = Path(os.environ.get("TV2_VOICE_WORK", VOICE / "probe" / "takes" / "pipeline"))

SR = 24000
MAX_TAKE = 4             # take 0 + højst 4 nye takes (SPEC §10.3)
SENTENCE_K = 4           # hele sætninger pr. kald (strategi D)
SENTENCE_MAX_SYLL = 56   # … men højst så mange stavelser i ét kald (K=6 blev rodet i S1)
CARRIER_K = 10           # talord i bæresætning pr. kald
MIN_SYLL_ALONE = 3       # kortere klip tjekkes kun i bæresætning eller sammensætning (SPEC §10.4)
CER_MAX = 0.05

_NUMBER_ID = re.compile(r"^(?:n\.(mid|end)\.\d+(?:\.et)?|h\.(mid|end)\.\d+)$")
_HEAD_ID = re.compile(r"^hog\.(\d+)$")
# Halerne i hundrede-hovedernes bæresætning ("Tallet er tre hundrede og syvogfyrre."): et
# sammensat tal pr. hoved, så kaldet ikke gentager den samme sætning ni gange.
HEAD_TAILS = [47, 25, 38, 62, 19, 84, 56, 73, 91]


def load_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def write_json_atomic(path: Path, data, indent: int | None = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=indent, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def config() -> dict:
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def config_sha1() -> str:
    return hashlib.sha1(CONFIG.read_bytes()).hexdigest()


def inventory() -> dict:
    inv = load_json(INVENTORY)
    if inv is None:
        raise SystemExit("voice/inventory.json mangler: kør node scripts/voice/run-vite.mjs scripts/voice/inventory.ts")
    if inv.get("configSha1") != config_sha1():
        raise SystemExit("voice/config.json er ændret efter inventaret: kør inventory.ts igen")
    return inv


def load_index() -> dict:
    return load_json(INDEX, {"version": 1, "clips": {}})


def save_index(index: dict) -> None:
    write_json_atomic(INDEX, index)


def safe_name(clip_id: str) -> str:
    """Reversible, collision-free file name: unsafe characters become ~XX (q.add:3+4 → q.add~3A3~2B4)."""
    return re.sub(r"[^A-Za-z0-9._-]", lambda m: "~%02X" % ord(m.group(0)) if ord(m.group(0)) < 256
                  else "~u%04X" % ord(m.group(0)), clip_id)


def master_rel(clip: dict) -> str:
    return f"{clip['pack']}/{safe_name(clip['id'])}.flac"


def seed_for(key: str, take: int) -> int:
    """Same rule as the S1 spike: int(sha1(id)[:8], 16) + take."""
    return int(hashlib.sha1(key.encode("utf-8")).hexdigest()[:8], 16) + take


def words_of(text: str) -> list[str]:
    return normalize(text, fold=False).split()


def bare(text: str) -> str:
    """Text without the form's final punctuation."""
    return text.rstrip(" .,?!")


def method_of(clip: dict) -> str:
    """How take 0 of a clip is generated (strategy D).

    carrier   talord og runde hundreder i bæresætningen "Tallet er X," / "Tallet er X." (ca. 10 pr. kald)
    head      hundrede-hoveder i "Tallet er tre hundrede og syvogfyrre." (ca. 10 pr. kald)
    sentence  hele sætninger (≥ 4 stavelser, slutter med . ? !), 4 pr. kald
    single    alt andet, ét kald pr. klip
    """
    cid = clip["id"]
    if _NUMBER_ID.match(cid):
        return "carrier"
    if _HEAD_ID.match(cid):
        return "head"
    g = clip["genText"]
    if g[-1:] in ".?!" and syllables(g) >= 4 and len(words_of(g)) >= 2:
        return "sentence"
    return "single"


def form_of(clip: dict) -> str:
    return clip["form"] or ("end" if clip["genText"][-1:] in ".?!" else "mid")


def model_text(clip: dict) -> str:
    """The text a single call sends to the model.

    genText as the catalogue gives it, except that a sentence piece without punctuation ("Hvad er",
    "plus", "i kurven") gets a comma: chatterbox otherwise appends a full stop (punc_norm), and the
    falling end-of-sentence intonation breaks the composed sentence. The comma is the form the S1
    spike measured for fragments. Names and button labels are spoken alone and keep the full stop.
    """
    g = clip["genText"]
    if g[-1:] in ".?!,":
        return g
    if clip["id"].startswith(("name.", "s.ui.")):
        return g
    return g + ","


def head_parts(clip: dict, take: int = 0) -> tuple[str, int]:
    """(head words, tail number) for a hundred head's carrier sentence."""
    h = int(_HEAD_ID.match(clip["id"]).group(1)) // 100
    return bare(clip["genText"]), HEAD_TAILS[(h - 1 + take) % len(HEAD_TAILS)]


def needs_composition(clip: dict) -> bool:
    """Short clips, number clips and the shared fragments are checked in compositions too."""
    cid = clip["id"]
    if cid.startswith(("frag.", "op.")) or method_of(clip) in ("carrier", "head"):
        return True
    return syllables(clip["text"]) < MIN_SYLL_ALONE


def setup_logging(name: str, to_file: bool = True) -> Path | None:
    fmt = logging.Formatter("%(asctime)s %(message)s", "%H:%M:%S")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for h in list(root.handlers):
        root.removeHandler(h)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    root.addHandler(sh)
    if not to_file:
        return None
    LOGS.mkdir(parents=True, exist_ok=True)
    path = LOGS / f"{name}-{time.strftime('%Y%m%d-%H%M%S')}.log"
    fh = logging.FileHandler(path, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)
    return path
