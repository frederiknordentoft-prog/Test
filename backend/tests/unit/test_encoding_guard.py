"""Encoding regression guard (user-reported: "smÃ¥" instead of "små").

Python's default text encoding is platform-dependent (cp1252 on Windows), so a
single ``read_text()``/``open()``/``to_csv()`` without an explicit ``encoding=``
silently corrupts æ/ø/å for Windows users while working fine on Linux/CI. This
test scans the backend source and fails on any unencoded text-file I/O, so the
bug class cannot re-enter the codebase.
"""
from __future__ import annotations

import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
SCAN_DIRS = [BACKEND / "simcore", BACKEND / "api", BACKEND / "scripts"]

# A call plus its argument tail (the rest of the physical line and the next
# line, to catch wrapped keyword arguments).
CALLS = [
    re.compile(r"\.read_text\("),
    re.compile(r"\.write_text\("),
    re.compile(r"(?<![\w.])open\("),          # builtin open, not os.open/.open(
    re.compile(r"\.to_csv\("),
]
BINARY_MODES = re.compile(r"""['"][rwax]\+?b['"]|['"]b[rwax]['"]""")


def _violations() -> list[str]:
    out: list[str] = []
    for root in SCAN_DIRS:
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            lines = path.read_text(encoding="utf-8").splitlines()
            for i, line in enumerate(lines):
                code = line.split("#", 1)[0]
                for pat in CALLS:
                    if not pat.search(code):
                        continue
                    # Look at the call line plus the next two lines (wrapped kwargs).
                    window = " ".join(lines[i:i + 3])
                    if "encoding=" in window:
                        continue
                    if pat.pattern.startswith("(?<!") and BINARY_MODES.search(window):
                        continue  # binary open() needs no encoding
                    out.append(f"{path.relative_to(BACKEND)}:{i + 1}: {line.strip()}")
    return out


def test_no_unencoded_text_file_io():
    bad = _violations()
    assert not bad, (
        "Text-file I/O without explicit encoding= (breaks æøå on Windows):\n"
        + "\n".join(bad)
    )
