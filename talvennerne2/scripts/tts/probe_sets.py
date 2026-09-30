"""Probe-sæt for S1 (stemmevalg, RTF, svære enkeltord, sammensat vs. hel).

Hvert klip har et stabilt id (seed = sha1(id) + take), en tekst der sendes til
modellen (med mid-/end-form-tegn) og en forventet tekst til ASR.
"""
from __future__ import annotations

from da_text import number_words

# 12 probesætninger fra spillets verden (stemmevalg + RTF).
PROBE12 = [
    ("p01", "Hvad er syv plus fem?"),
    ("p02", "Hvor mange kroner er det i alt?"),
    ("p03", "Klokken er kvart over tre."),
    ("p04", "Tryk på den figur, der har fire lige lange sider."),
    ("p05", "Hvad er to hundrede og syvogfyrre plus otteogtyve?"),
    ("p06", "Godt klaret! Du fandt tiervennerne."),
    ("p07", "Hvilket tal mangler: fem plus hvad giver tolv?"),
    ("p08", "Del tolv æbler ligeligt mellem tre venner."),
    ("p09", "Hvad er seks gange syv?"),
    ("p10", "Hvor mange centimeter er stregen?"),
    ("p11", "En fjerdedel af figuren er farvet."),
    ("p12", "Du har fået et nyt æg!"),
]

# 8 ekstra klip af varierende længde, så 12 + 8 = 20 probeklip til RTF og
# overhead pr. kald (lineær model: tid = overhead + marginal-RTF × varighed).
RTF_EXTRA8 = [
    ("r01", "syv."),
    ("r02", "Hvad er,"),
    ("r03", "tre hundrede og,"),
    ("r04", "otteogtyve."),
    ("r05", "Prøv igen."),
    ("r06", "Tolv kroner og halvtreds øre."),
    ("r07", "Flot! Du har samlet alle stjernerne på øen."),
    ("r08", "Klokken er fem minutter i halv ni om aftenen."),
]

# 20 svære enkeltord (end-form: tekst + ".").
WORDS20 = [
    "en", "et", "to", "tre", "elleve", "tolv", "tyve", "halvtreds", "halvfems",
    "syvogtyve", "nioghalvfems", "hundrede", "tusind", "kvart", "halv", "plus",
    "minus", "gange", "nul", "øre",
]

# 10 regnestykker: (id, a, operator, b)
EXPR10 = [
    ("e01", 347, "plus", 28),
    ("e02", 7, "plus", 5),
    ("e03", 15, "minus", 8),
    ("e04", 6, "gange", 7),
    ("e05", 56, "plus", 39),
    ("e06", 100, "minus", 45),
    ("e07", 250, "plus", 125),
    ("e08", 83, "minus", 19),
    ("e09", 9, "gange", 8),
    ("e10", 604, "minus", 71),
]

# Mellemrum (SPEC §10.2): 20 ms ved hundrede-sømmen, 120 ms efter mid-form,
# 0–60 ms inden for en frase (her 40 ms efter fragment/operator).
GAP_HUNDRED_MS = 20
GAP_AFTER_MID_MS = 120
GAP_IN_PHRASE_MS = 40


def words_set():
    return [(f"w.{w}", f"{w}.", w) for w in WORDS20]


def probe_set():
    return [(i, t, t) for i, t in PROBE12]


def rtf_extra_set():
    return [(i, t, t) for i, t in RTF_EXTRA8]


def expr_text(a: int, op: str, b: int) -> str:
    return f"Hvad er {number_words(a)} {op} {number_words(b)}?"


def number_clips(n: int, form: str) -> list[tuple[str, str, str]]:
    """Klip for et tal i given form (SPEC §10.2): (clip_id, modeltekst, kind)."""
    mark = "," if form == "mid" else "."
    if n <= 100 or n % 100 == 0:
        if n % 100 == 0 and n >= 100:
            cid = f"h.{form}.{n // 100}"
        else:
            cid = f"n.{form}.{n}"
        return [(cid, number_words(n) + mark, form)]
    h, rest = divmod(n, 100)
    head = ("et" if h == 1 else number_words(h)) + " hundrede og"
    return [(f"hog.{h}", head + ",", "hog"), (f"n.{form}.{rest}", number_words(rest) + mark, form)]


def expr_plan(a: int, op: str, b: int):
    """Klip-sekvens og mellemrum for "Hvad er a op b?" sat sammen af klip."""
    seq = [("frag.hvad_er", "Hvad er,", "frag")]
    seq += number_clips(a, "mid")
    seq += [(f"op.{op}", f"{op},", "op")]
    seq += number_clips(b, "end")
    gaps = []
    for cur, _nxt in zip(seq, seq[1:]):
        kind = cur[2]
        if kind == "hog":
            gaps.append(GAP_HUNDRED_MS)
        elif kind == "mid":
            gaps.append(GAP_AFTER_MID_MS)
        else:
            gaps.append(GAP_IN_PHRASE_MS)
    return seq, gaps


def expr_whole_set():
    return [(f"q.{eid}", expr_text(a, op, b), expr_text(a, op, b)) for eid, a, op, b in EXPR10]


def expr_fragment_set():
    seen: dict[str, tuple[str, str, str]] = {}
    for _eid, a, op, b in EXPR10:
        seq, _ = expr_plan(a, op, b)
        for cid, text, _kind in seq:
            seen.setdefault(cid, (cid, text, text.rstrip(",.?")))
    return list(seen.values())


def carrier_set():
    """Bæresætninger for talklippene i EXPR10: "Tallet er X," (mid) / "Tallet er X." (end).

    Hundrede-hovederne (hog.H, "tre hundrede og") har ≥ 3 stavelser og genereres
    direkte; kun n.* og h.* går gennem bæresætningen.
    """
    out = {}
    for _eid, a, _op, b in EXPR10:
        for n, f in ((a, "mid"), (b, "end")):
            for cid, text, kind in number_clips(n, f):
                if kind == "hog":
                    continue
                word = text.rstrip(",.")
                mark = "," if kind == "mid" else "."
                out.setdefault(cid, (f"c.{cid}", f"Tallet er {word}{mark}", f"Tallet er {word}"))
    return list(out.values())


SETS = {
    "probe12": probe_set,
    "rtf8": rtf_extra_set,
    "words20": words_set,
    "whole10": expr_whole_set,
    "frags": expr_fragment_set,
    "carrier": carrier_set,
}


# --- batch-generering (flere klip pr. kald, klippes ud med forced alignment) ---
#
# End-form-klip står som hver sin sætning ("Syv. Otte."), så hvert får faldende
# slutintonation. Mid-form-klip står i en kommaliste ("syv, otte,"), som giver
# fortsættelsesintonation. Hele sætninger sættes efter hinanden med deres egne tegn.

def _chunks(xs, k):
    return [xs[i:i + k] for i in range(0, len(xs), k)]


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def _batch(bid: str, form: str, items: list[tuple[str, str]]):
    """items: [(clip_id, ren tekst)] → (batch_id, modeltekst, [(clip_id, tekst, form)])."""
    if form == "end":
        text = " ".join(_cap(t) + "." for _c, t in items)
    elif form == "mid":
        text = ", ".join(t for _c, t in items) + ","
    else:  # hele sætninger med egne tegn
        text = " ".join(t for _c, t in items)
    return (bid, text, [(c, t, form) for c, t in items])


def batch_sets():
    b = []
    words = [(f"w.{w}", w) for w in WORDS20]
    for i, ch in enumerate(_chunks(words, 10)):
        b.append(_batch(f"b.w10.{i}", "end", ch))
    for i, ch in enumerate(_chunks(words, 5)):
        b.append(_batch(f"b.w5.{i}", "end", ch))
    # talklippene fra EXPR10 (mid og end) og fragmenterne, så regnestykkerne kan
    # sættes sammen af batch-klip og sammenlignes med enkeltkald og hele sætninger
    mids, ends, frags = {}, {}, {}
    for _eid, a, op, bb in EXPR10:
        seq, _ = expr_plan(a, op, bb)
        for cid, text, kind in seq:
            word = text.rstrip(",.?")
            if kind == "mid":
                mids.setdefault(cid, word)
            elif kind == "end":
                ends.setdefault(cid, word)
            else:
                frags.setdefault(cid, word)
    b.append(_batch("b.nmid", "mid", list(mids.items())))
    b.append(_batch("b.nend", "end", list(ends.items())))
    b.append(_batch("b.frag", "mid", list(frags.items())))
    sents = [(i, t) for i, t in PROBE12]
    for i, ch in enumerate(_chunks(sents, 4)):
        b.append(_batch(f"b.s4.{i}", "sent", ch))
    for i, ch in enumerate(_chunks(sents, 6)):
        b.append(_batch(f"b.s6.{i}", "sent", ch))
    return b
