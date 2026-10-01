#!/usr/bin/env python3
"""Uafhængig parser for danske grundtal i tekst (SPEC §10.4). Ren Python uden afhængigheder.

Bruges af udtaletjekket: talfølgen i forventet tekst og i ASR-teksten skal være ens, og hvert af de
899 sammensatte tal 101–999 skal give n tilbage. Parseren er skrevet ud fra dansk grammatik, ikke ud
fra appens `numberWords.ts`, så den kan fange fejl i begge retninger.

Grammatik (moderne rigsdansk, plus de varianter ASR skriver):

  enere      nul, en/et/én/ét, to, tre, fire, fem, seks, syv, otte, ni
  ti–nitten  ti, elleve, tolv, tretten, fjorten, femten, seksten, sytten, atten, nitten
  tiere      tyve, tredive/tredve, fyrre/fyrretyve, halvtreds/halvtredsindstyve,
             tres/tresindstyve, halvfjerds/halvfjerdsindstyve, firs/firsindstyve,
             halvfems/halvfemsindstyve
  21–99      ener + "og" + tier, skrevet i ét ord (syvogfyrre) eller adskilt (syv og fyrre)
  100–999    [ener] hundrede [og <1–99>]   ("hundrede" alene er 100; "og" kan mangle i ASR)
  1000–      [<1–999>] tusind(e) [og] [<1–999>]
  cifre      "47", "300 og 47", "3 hundrede", "1.000"; decimalkomma læses som to tal ("2,5" = 2 5,
             ligesom "to komma fem")

Ord, der hænger sammen uden mellemrum ("trehundredeogsyvogfyrre", "ethundrede"), deles i talled,
hvis hele ordet kan deles; ellers er ordet ikke et tal ("tirammen", "tiere", "ettallet").

  python3 da_numbers.py "Hvad er tre hundrede og syvogfyrre plus 28?"   → [347, 28]
  python3 da_numbers.py --check < linjer      # "n<TAB>tekst" pr. linje: tekst skal give [n]
  python3 da_numbers.py --selftest
"""
from __future__ import annotations

import re
import sys
import unicodedata

UNITS = {
    "nul": 0, "en": 1, "et": 1, "to": 2, "tre": 3, "fire": 4, "fem": 5,
    "seks": 6, "syv": 7, "otte": 8, "ni": 9,
}
TEENS = {
    "ti": 10, "elleve": 11, "tolv": 12, "tretten": 13, "fjorten": 14, "femten": 15,
    "seksten": 16, "sytten": 17, "atten": 18, "nitten": 19,
}
TENS = {
    "tyve": 20, "tredive": 30, "tredve": 30, "fyrre": 40, "fyrretyve": 40,
    "halvtreds": 50, "halvtredsindstyve": 50, "tres": 60, "tresindstyve": 60,
    "halvfjerds": 70, "halvfjerdsindstyve": 70, "firs": 80, "firsindstyve": 80,
    "halvfems": 90, "halvfemsindstyve": 90,
}
HUNDRED = {"hundrede", "hundred"}
THOUSAND = {"tusind", "tusinde"}
AND = "og"

# Morphemes a glued word may be split into, longest first so "tretten" wins over "tre".
_MORPHEMES = sorted(list(UNITS) + list(TEENS) + list(TENS) + ["hundrede", "tusinde", "tusind", AND],
                    key=len, reverse=True)


def _split_glued(word: str) -> list[str] | None:
    """All-or-nothing split of a glued word into number morphemes ("syvogfyrre" → syv og fyrre)."""
    out: list[str] = []
    i = 0
    while i < len(word):
        for m in _MORPHEMES:
            if word.startswith(m, i):
                out.append(m)
                i += len(m)
                break
        else:
            return None
    return out


def tokenize(text: str) -> list[str]:
    """Lower case, accents folded, punctuation dropped; digits split from letters."""
    t = unicodedata.normalize("NFKC", text).lower()
    t = t.replace("é", "e").replace("è", "e")
    t = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", t)          # 1.000 → 1000
    t = re.sub(r"(?<=\d),(?=\d)", " komma ", t)          # 2,5 → 2 komma 5
    t = re.sub(r"(\d)([^\d\s])", r"\1 \2", t)            # 7plus → 7 plus
    t = re.sub(r"([^\d\s])(\d)", r"\1 \2", t)
    t = re.sub(r"[^\w\s-]", " ", t)
    out: list[str] = []
    for raw in t.split():
        parts = [p for p in raw.split("-") if p]
        # A hyphenated word is a number only when every part is ("syv-og-fyrre"), never "ti-rammen".
        pieces: list[str] = []
        for p in parts:
            split = [p] if (p.isdigit() or p in UNITS or p in TEENS or p in TENS or p in HUNDRED
                            or p in THOUSAND or p == AND) else _split_glued(p)
            if split is None:
                pieces = []
                break
            pieces.extend(split)
        if pieces and not (len(pieces) == 1 and pieces[0] == AND and len(parts) > 1):
            out.extend(pieces)
        else:
            out.append(raw)
    return out


class _Stream:
    def __init__(self, toks: list[str]):
        self.toks = toks
        self.i = 0

    def peek(self, k: int = 0) -> str | None:
        j = self.i + k
        return self.toks[j] if j < len(self.toks) else None


def _below100(s: _Stream) -> int | None:
    """0–99: unit, teen, ten, unit og ten, or a digit token below 100."""
    t = s.peek()
    if t is None:
        return None
    if t.isdigit() and int(t) < 100:
        s.i += 1
        return int(t)
    if t in UNITS:
        v = UNITS[t]
        if 1 <= v <= 9 and s.peek(1) == AND and s.peek(2) in TENS:
            s.i += 3
            return v + TENS[s.toks[s.i - 1]]
        s.i += 1
        return v
    if t in TEENS:
        s.i += 1
        return TEENS[t]
    if t in TENS:
        s.i += 1
        return TENS[t]
    return None


def _rest_after(s: _Stream, limit: int) -> int:
    """Optional "[og] <1..limit-1>" after hundrede/tusind; 0 when there is none."""
    save = s.i
    if s.peek() == AND:
        s.i += 1
    v = _below1000(s, allow_zero=False)
    if v is not None and 1 <= v < limit:
        return v
    s.i = save
    return 0


def _below1000(s: _Stream, allow_zero: bool = True) -> int | None:
    """0–999: [unit] hundrede [og] <1–99> | <0–99> | digits."""
    save = s.i
    t = s.peek()
    if t is not None and t.isdigit():
        v = int(t)
        if 100 <= v < 1000:
            s.i += 1
            if v % 100 == 0:
                v += _rest_after(s, 100)
            return v
    head: int | None = None
    if t in HUNDRED:
        head = 1
        s.i += 1
    else:
        v = _below100(s)
        if v is None:
            s.i = save
            return None
        if s.peek() in HUNDRED and 1 <= v <= 9:
            head = v
            s.i += 1
        elif v == 0 and not allow_zero:
            s.i = save
            return None
        else:
            return v
    return head * 100 + _rest_after(s, 100)


def _number(s: _Stream) -> int | None:
    save = s.i
    t = s.peek()
    if t is not None and t.isdigit() and int(t) >= 1000:
        s.i += 1
        return int(t)
    if t in THOUSAND:
        s.i += 1
        return 1000 + _rest_after(s, 1000)
    v = _below1000(s)
    if v is None:
        s.i = save
        return None
    if s.peek() in THOUSAND and v >= 1:
        s.i += 1
        return v * 1000 + _rest_after(s, 1000)
    return v


def parse_numbers(text: str) -> list[int]:
    """Every cardinal number in a Danish text, in order of appearance."""
    s = _Stream(tokenize(text))
    out: list[int] = []
    while s.peek() is not None:
        v = _number(s)
        if v is None:
            s.i += 1
        else:
            out.append(v)
    return out


# --- self-test (grammar cases written independently of the app's number words) ------------------

_CASES = {
    "nul": [0], "en": [1], "et": [1], "én": [1], "ti": [10], "elleve": [11], "nitten": [19],
    "tyve": [20], "enogtyve": [21], "en og tyve": [21], "syvogfyrre": [47], "syv og fyrre": [47],
    "halvtreds": [50], "halvtredsindstyve": [50], "toogtres": [62], "nioghalvfems": [99],
    "hundrede": [100], "et hundrede": [100], "ethundrede": [100], "et hundrede og en": [101],
    "et hundrede og fem": [105], "to hundrede og tyve": [220], "tre hundrede og syvogfyrre": [347],
    "trehundredeogsyvogfyrre": [347], "tre hundrede syvogfyrre": [347], "ni hundrede og nioghalvfems": [999],
    "tusind": [1000], "tusinde": [1000], "et tusind": [1000], "tusind og en": [1001],
    "to tusind tre hundrede og fire": [2304],
    "347": [347], "300 og 47": [347], "3 hundrede og 47": [347], "1.000": [1000], "7plus 5": [7, 5],
    "Hvad er tre hundrede og syvogfyrre plus 28?": [347, 28],
    "Hvad er syv plus fem?": [7, 5], "Fire plus hvad giver ti?": [4, 10],
    "Hvilket tal ligger mellem tre og fem?": [3, 5], "Tallet er seksoghalvtreds.": [56],
    "Tæl de tomme felter i ti-rammen.": [], "tirammen": [], "tiere": [], "ettallet": [],
    "to komma fem": [2, 5], "2,5": [2, 5], "Hop en gang frem.": [1], "fire hundrede": [400],
    "tre hundrede plus fem": [300, 5], "hundrede og ti": [110], "fem hundrede og nul": [500, 0],
    "tolv kroner og halvtreds øre": [12, 50], "to og to": [2, 2], "tre og tyve": [23],
}


def selftest() -> int:
    bad = [(t, want, parse_numbers(t)) for t, want in _CASES.items() if parse_numbers(t) != want]
    for t, want, got in bad:
        print(f"FEJL: {t!r}: forventede {want}, fik {got}")
    print(f"da_numbers: {len(_CASES) - len(bad)}/{len(_CASES)} grammatiktilfælde")
    return 1 if bad else 0


def main(argv: list[str]) -> int:
    if argv[:1] == ["--selftest"]:
        return selftest()
    if argv[:1] == ["--check"]:
        bad = 0
        n = 0
        for line in sys.stdin:
            if not line.strip():
                continue
            want, text = line.rstrip("\n").split("\t", 1)
            n += 1
            got = parse_numbers(text)
            if got != [int(want)]:
                bad += 1
                print(f"FEJL {want}: {text!r} → {got}")
        print(f"da_numbers --check: {n - bad}/{n} rigtige")
        return 1 if bad else 0
    if not argv:
        print(__doc__)
        return 2
    print(parse_numbers(" ".join(argv)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
