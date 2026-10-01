"""Dansk tekst til udtaletjek: talord, normalisering, talparser, stavelser og CER.

Ren Python uden afhængigheder, så modulet kan bruges fra både /opt/tv2-tts og
/opt/tv2-asr. Talordene følger SPEC §10.1 (0–1000). Parseren er en spike-hjælper;
den uafhængige orakel-parser `da_numbers.py` skrives senere af en anden agent.
"""
from __future__ import annotations

import re
import unicodedata

UNITS = [
    "nul", "en", "to", "tre", "fire", "fem", "seks", "syv", "otte", "ni", "ti",
    "elleve", "tolv", "tretten", "fjorten", "femten", "seksten", "sytten", "atten",
    "nitten", "tyve",
]
TENS = {
    2: "tyve", 3: "tredive", 4: "fyrre", 5: "halvtreds", 6: "tres",
    7: "halvfjerds", 8: "firs", 9: "halvfems",
}


def number_words(n: int, gender: str = "c") -> str:
    """Talord for 0 ≤ n ≤ 1000 (SPEC §10.1). gender='n' giver "et" for 1."""
    if not 0 <= n <= 1000:
        raise ValueError(n)
    if n == 1000:
        return "tusind"
    if n >= 100:
        h, rest = divmod(n, 100)
        head = ("et" if h == 1 else UNITS[h]) + " hundrede"
        return head if rest == 0 else f"{head} og {number_words(rest, gender)}"
    if n == 1 and gender == "n":
        return "et"
    if n <= 20:
        return UNITS[n]
    t, u = divmod(n, 10)
    return TENS[t] if u == 0 else f"{UNITS[u]}og{TENS[t]}"


# --- normalisering -----------------------------------------------------------

_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


def digits_to_words(text: str) -> str:
    return re.sub(r"\d+", lambda m: f" {_digits(m.group())} ", text)


def _digits(s: str) -> str:
    n = int(s)
    if n <= 1000:
        return number_words(n)
    return " ".join(number_words(int(c)) for c in s)  # cifre enkeltvis


_SYMBOLS = [
    (re.compile(r"(\d)\s*[x×*·]\s*(\d)"), r"\1 gange \2"),
    (re.compile(r"(\d)\s*[-−–]\s*(\d)"), r"\1 minus \2"),
    (re.compile(r"(\d)\s*÷\s*(\d)"), r"\1 divideret med \2"),
    (re.compile(r"\+"), " plus "),
    (re.compile(r"="), " er lig med "),
    (re.compile(r"½"), " en halv "),
    (re.compile(r"¼"), " en fjerdedel "),
    (re.compile(r"%"), " procent "),
]


def normalize(text: str, fold: bool = True) -> str:
    """Små bogstaver, tal som danske ord, ingen tegnsætning, enkelte mellemrum.

    Regnetegn og symboler, som ASR (især whisper) skriver, bliver til ord
    ("6 x 7" → "seks gange syv", "5 + 7" → "fem plus syv").
    """
    t = unicodedata.normalize("NFKC", text).lower()
    t = t.replace("é", "e").replace("è", "e").replace("ü", "u")
    for rx, rep in _SYMBOLS:
        t = rx.sub(rep, t)
    t = digits_to_words(t)
    t = t.replace("-", " ").replace("_", " ")
    t = _PUNCT.sub(" ", t)
    t = " ".join(t.split())
    if not fold:  # fx til forced alignment, hvor teksten skal svare til det sagte
        return t
    # ASR skriver tal som cifre og kan derfor ikke skelne "en"/"et" eller høre, om
    # "et" blev sagt foran "hundrede". Begge sider foldes ens, så det ikke tæller som fejl.
    t = re.sub(r"\bet hundrede\b", "hundrede", t)
    t = re.sub(r"\bet\b", "en", t)
    return t


def squash(text: str) -> str:
    """Normaliseret tekst uden mellemrum (CER-grundlag, kunst-lyd-teknik §5.9)."""
    return normalize(text).replace(" ", "")


# --- CER ---------------------------------------------------------------------

def levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer_counts(ref: str, hyp: str) -> tuple[int, int]:
    """(redigeringsafstand, referencelængde) på squash-form."""
    r, h = squash(ref), squash(hyp)
    return levenshtein(r, h), max(len(r), 1)


def cer(ref: str, hyp: str) -> float:
    e, n = cer_counts(ref, hyp)
    return e / n


# --- talparser ---------------------------------------------------------------

_UNIT_VAL = {w: i for i, w in enumerate(UNITS)}
_UNIT_VAL.update({"et": 1, "én": 1, "ét": 1})
_TENS_VAL = {w: t * 10 for t, w in TENS.items()}
_SMALL = sorted(UNITS[1:10], key=len, reverse=True)
_COMPOUND = re.compile(
    r"^(" + "|".join(_SMALL) + r")og(" + "|".join(sorted(_TENS_VAL, key=len, reverse=True)) + r")$"
)


def _small_value(tok: str):
    if tok in _UNIT_VAL:
        return _UNIT_VAL[tok]
    if tok in _TENS_VAL:
        return _TENS_VAL[tok]
    m = _COMPOUND.match(tok)
    if m:
        return _UNIT_VAL[m.group(1)] + _TENS_VAL[m.group(2)]
    return None


def parse_numbers(text: str) -> list[int]:
    """Alle tal (0–1000) i en dansk tekst, i rækkefølge.

    Tåler ASR-varianter som "syv og fyrre", "trehundrede" og cifre. "en"/"et"
    tælles som 1 på begge sider (også som artikel), så sammenligningen er fair.
    """
    toks = normalize(text).split()
    # "syv og fyrre" -> "syvogfyrre"
    merged: list[str] = []
    i = 0
    while i < len(toks):
        if (i + 2 < len(toks) and toks[i] in _SMALL and toks[i + 1] == "og"
                and toks[i + 2] in _TENS_VAL):
            merged.append(f"{toks[i]}og{toks[i + 2]}")
            i += 3
            continue
        # "trehundrede" -> "tre hundrede"
        m = re.match(r"^(" + "|".join(_UNIT_VAL) + r")(hundrede)$", toks[i])
        if m:
            merged.extend([m.group(1), "hundrede"])
        else:
            merged.append(toks[i])
        i += 1
    out: list[int] = []
    i = 0
    while i < len(merged):
        tok = merged[i]
        if tok == "tusind":
            out.append(1000)
            i += 1
            continue
        if tok == "hundrede":  # "hundrede" uden forled
            val = 100
            i += 1
        else:
            v = _small_value(tok)
            if v is None:
                i += 1
                continue
            if i + 1 < len(merged) and merged[i + 1] == "hundrede" and 1 <= v <= 9:
                val = v * 100
                i += 2
            else:
                out.append(v)
                i += 1
                continue
        # efter "hundrede": valgfrit "og" + rest
        if i + 1 < len(merged) and merged[i] == "og":
            rest = _small_value(merged[i + 1])
            if rest is not None and 1 <= rest <= 99:
                val += rest
                i += 2
        out.append(val)
    return out


# --- stavelser og forventet varighed -----------------------------------------

_VOWELS = set("aeiouyæøå")


def syllables(text: str) -> int:
    """Groft antal stavelser: vokalbogstaver (au/eu/ou tæller som én)."""
    t = normalize(text).replace(" ", "|")
    n = 0
    prev = ""
    for ch in t:
        if ch in _VOWELS and not (prev + ch in ("au", "eu", "ou")):
            n += 1
        prev = ch
    return max(n, 1)


def expected_duration(text: str, rate: float = 3.2) -> float:
    """Forventet varighed i sekunder: stavelser ÷ 3,2/s (SPEC §10.3)."""
    return syllables(text) / rate


if __name__ == "__main__":  # små selvtjek
    assert number_words(347) == "tre hundrede og syvogfyrre"
    assert number_words(100) == "et hundrede"
    assert number_words(105) == "et hundrede og fem"
    assert number_words(220) == "to hundrede og tyve"
    assert number_words(99) == "nioghalvfems"
    assert number_words(1, "n") == "et"
    for n in range(0, 1001):
        assert parse_numbers(number_words(n)) == [n], (n, number_words(n))
        assert parse_numbers(str(n)) == [n], n
    assert parse_numbers("hvad er tre hundrede og syv og fyrre plus 28") == [347, 28]
    assert parse_numbers("Tallet er seksoghalvtreds.") == [56]
    assert squash("Hvad er 7 plus 5?") == "hvadersyvplusfem"
    assert syllables("nioghalvfems") == 4 and syllables("elleve") == 3
    assert syllables("Tryk på den figur, der har fire lige lange sider.") == 15
    print("da_text ok")
