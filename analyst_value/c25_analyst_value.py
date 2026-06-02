"""
C25 Analyst Value — tilfører analytikere værdi, eller er det lige så godt at gætte?
==================================================================================

Dette modul er motoren bag analysen. Det:

  1.  Henter daterede analytiker-/finanshus-anbefalinger ("aktiespådomme")
      for danske C25-aktier automatisk fra Yahoo Finance
      (modulet `upgradeDowngradeHistory`, eksponeret via `yfinance`).
  2.  Henter historiske aktiekurser for de samme selskaber.
  3.  Oversætter hver anbefaling til en RETNINGS-spådom (op / ned).
  4.  Måler om aktien faktisk bevægede sig den vej over de følgende 12 mdr.
  5.  Sammenligner træfsikkerheden med relevante "dumme" benchmarks:
        - møntkast (50/50)
        - "sig altid køb" (markedets base rate)
        - tilfældigt valg (Monte Carlo-fordeling)
  6.  Kan også indlæse MANUELT indtastede kald (Børsen, TV2, Danske Bank,
      Jyske Bank m.fl.) fra en CSV og køre den samme analyse på dem.

VIGTIGT OM DATADÆKNING (ærlig disclaimer)
-----------------------------------------
Frit tilgængelig, *dateret* analytiker-historik for danske aktier er stærkt
begrænset. Yahoo fører kun rig historik for de C25-selskaber, der også er
US-noterede (ADR). I praksis betyder det, at den automatiske del primært
dækker **Novo Nordisk (NVO)** og **Genmab (GMAB)** — tilsammen et par hundrede
rigtige finanshus-kald (Goldman, JP Morgan, Morgan Stanley, men også nordiske
huse som Jyske Bank, Handelsbanken, Kepler Cheuvreux, Swedbank).

Kald fra Børsen.dk, TV2 Finans, Danske Bank's og Jyske Banks egne
aktieanalyser ligger bag betalingsmur / kundelogin uden åbent, maskinlæsbart
arkiv og kan IKKE hentes automatisk. Brug `load_manual_predictions()` til at
fodre den slags kald ind manuelt — motoren behandler dem ens.
"""
from __future__ import annotations

import datetime as dt
import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

try:
    import yfinance as yf
except ImportError:  # pragma: no cover
    yf = None


# --------------------------------------------------------------------------- #
#  C25-univers: selskab -> (kurs-ticker (lokal), ratings-ticker (US/ADR))
#  Kurser måles på den lokale notering (sandheden for en dansk aktie);
#  ratings hentes fra den ticker, hvor Yahoo har dateret historik.
# --------------------------------------------------------------------------- #
C25: dict[str, tuple[str, str]] = {
    # selskab            (pris-ticker,    ratings-ticker)
    "Novo Nordisk":      ("NOVO-B.CO",    "NVO"),
    "Genmab":            ("GMAB.CO",      "GMAB"),
    "Zealand Pharma":    ("ZEAL.CO",      "ZEAL"),
    "DSV":               ("DSV.CO",       "DSDVY"),
    "Maersk":            ("MAERSK-B.CO",  "AMKBY"),
    "Vestas":            ("VWS.CO",       "VWDRY"),
    "Coloplast":         ("COLO-B.CO",    "CLPBY"),
    "Novonesis":         ("NSIS-B.CO",    "NVZMY"),
    "Carlsberg":         ("CARL-B.CO",    "CABGY"),
    "Orsted":            ("ORSTED.CO",    "DNNGY"),
    "Tryg":              ("TRYG.CO",      "TGVSF"),
    "Demant":            ("DEMANT.CO",    "WILLF"),
    "Pandora":           ("PNDORA.CO",    "PANDY"),
    "Danske Bank":       ("DANSKE.CO",    "DNKEY"),
    "GN Store Nord":     ("GN.CO",        "GGNDF"),
    "Rockwool":          ("ROCK-B.CO",    "RKWBF"),
    "Ambu":              ("AMBU-B.CO",    "AMBBY"),
    "Netcompany":        ("NETC.CO",      "NETC.CO"),
    "Nordea":            ("NDA-DK.CO",    "NRDBY"),
    "ISS":               ("ISS.CO",       "ISFFF"),
    "FLSmidth":          ("FLS.CO",       "FLIDY"),
    "Jyske Bank":        ("JYSK.CO",      "JYSKF"),
    "Sydbank":           ("SYDB.CO",      "SBABF"),
    "Bavarian Nordic":   ("BAVA.CO",      "BVNKF"),
    "Topdanmark":        ("TOP.CO",       "TPDKY"),
}

# Rating-ord -> retning. +1 = forvent stigning, -1 = forvent fald, 0 = neutral.
BUY_WORDS = [
    "buy", "outperform", "overweight", "accumulate", "add", "strong buy",
    "positive", "market outperform", "sector outperform", "conviction buy",
    "speculative buy", "long-term buy", "top pick",
]
SELL_WORDS = [
    "sell", "underperform", "underweight", "reduce", "negative",
    "strong sell", "sector underperform",
]


def grade_to_signal(grade: str) -> int:
    """Oversæt et rating-ord til retning (+1 køb / -1 sælg / 0 neutral)."""
    g = str(grade).strip().lower()
    if any(w in g for w in BUY_WORDS):
        return 1
    if any(w in g for w in SELL_WORDS):
        return -1
    return 0  # hold / neutral / equal-weight / market perform / sector perform


# --------------------------------------------------------------------------- #
#  Datahentning
# --------------------------------------------------------------------------- #
def fetch_ratings(universe: dict | None = None) -> pd.DataFrame:
    """Hent daterede analytiker-anbefalinger for hele universet via Yahoo.

    Returnerer en DataFrame med kolonnerne:
        company, source, date, to_grade, from_grade, action, signal,
        price_target, prior_target, price_ticker, origin
    """
    if yf is None:
        raise RuntimeError("yfinance er ikke installeret (pip install yfinance)")
    universe = universe or C25
    frames = []
    for company, (px_ticker, rate_ticker) in universe.items():
        try:
            ud = yf.Ticker(rate_ticker).upgrades_downgrades
        except Exception:
            ud = None
        if ud is None or len(ud) == 0:
            continue
        ud = ud.reset_index()
        ud.columns = [c.lower() for c in ud.columns]
        df = pd.DataFrame({
            "company":      company,
            "source":       ud["firm"],
            "date":         pd.to_datetime(ud["gradedate"]).dt.tz_localize(None),
            "to_grade":     ud["tograde"],
            "from_grade":   ud.get("fromgrade", ""),
            "action":       ud.get("action", ""),
            "price_target": ud.get("currentpricetarget", np.nan),
            "prior_target": ud.get("priorpricetarget", np.nan),
            "price_ticker": px_ticker,
            "origin":       "yahoo",
        })
        frames.append(df)
    out = pd.concat(frames, ignore_index=True) if frames else _empty_ratings()
    out["signal"] = out["to_grade"].map(grade_to_signal)
    return out.sort_values("date").reset_index(drop=True)


def load_manual_predictions(path: str) -> pd.DataFrame:
    """Indlæs manuelt indtastede kald (Børsen, TV2, Danske Bank, Jyske Bank ...).

    Forventet CSV med kolonner:
        company, source, date, to_grade, price_target (valgfri), price_ticker (valgfri)
    'source' er mediet/finanshuset. 'to_grade' kan være dansk (Køb/Hold/Sælg)
    eller engelsk — begge mappes til retning.
    """
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
    # dansk -> engelsk synonymer så grade_to_signal forstår dem
    da = {"køb": "buy", "koeb": "buy", "akkumulér": "accumulate", "akkumuler": "accumulate",
          "hold": "hold", "neutral": "hold", "reducer": "reduce",
          "sælg": "sell", "saelg": "sell", "undervægt": "underweight",
          "overvægt": "overweight"}
    df["to_grade_en"] = df["to_grade"].astype(str).str.lower().map(lambda x: da.get(x.strip(), x))
    df["signal"] = df["to_grade_en"].map(grade_to_signal)
    if "price_ticker" not in df.columns:
        name2px = {k: v[0] for k, v in C25.items()}
        df["price_ticker"] = df["company"].map(name2px)
    for col in ("action", "from_grade", "prior_target"):
        if col not in df.columns:
            df[col] = ""
    if "price_target" not in df.columns:
        df["price_target"] = np.nan
    df["origin"] = "manual"
    keep = ["company", "source", "date", "to_grade", "from_grade", "action",
            "signal", "price_target", "prior_target", "price_ticker", "origin"]
    return df[keep].sort_values("date").reset_index(drop=True)


def _empty_ratings() -> pd.DataFrame:
    cols = ["company", "source", "date", "to_grade", "from_grade", "action",
            "price_target", "prior_target", "price_ticker", "origin"]
    return pd.DataFrame({c: [] for c in cols})


def fetch_prices(tickers) -> dict[str, pd.Series]:
    """Hent fuld, udbytte-/split-justeret lukkekurshistorik for hver ticker."""
    if yf is None:
        raise RuntimeError("yfinance er ikke installeret")
    px = {}
    for tk in sorted(set(tickers)):
        try:
            h = yf.Ticker(tk).history(period="max", auto_adjust=True)["Close"]
            if len(h):
                h.index = pd.to_datetime(h.index).tz_localize(None)
                px[tk] = h.sort_index()
        except Exception:
            pass
    return px


# --------------------------------------------------------------------------- #
#  Evaluering
# --------------------------------------------------------------------------- #
def forward_return(prices: pd.Series, date, horizon_days: int = 365) -> float:
    """Aktiens afkast fra `date` og `horizon_days` frem (NaN hvis ikke realiseret)."""
    if prices is None or not len(prices):
        return np.nan
    end = date + pd.Timedelta(days=horizon_days)
    if prices.index.max() < end:        # udfald endnu ikke kendt
        return np.nan
    p0 = prices.asof(date)
    p1 = prices.asof(end)
    if pd.isna(p0) or pd.isna(p1) or p0 == 0:
        return np.nan
    return float(p1 / p0 - 1.0)


def evaluate(ratings: pd.DataFrame, prices: dict[str, pd.Series],
             horizon_days: int = 365) -> pd.DataFrame:
    """Tilføj fremtidigt afkast + om retningsspådommen ramte rigtigt."""
    r = ratings.copy()
    r["fwd_return"] = [
        forward_return(prices.get(row.price_ticker), row.date, horizon_days)
        for row in r.itertuples()
    ]
    r["actual_up"] = r["fwd_return"] > 0
    # kun retnings-kald (køb/sælg) kan ramme/ikke ramme en retning
    r["is_directional"] = r["signal"] != 0
    r["correct"] = np.where(
        r["is_directional"] & r["fwd_return"].notna(),
        ((r["signal"] > 0) & (r["fwd_return"] > 0)) |
        ((r["signal"] < 0) & (r["fwd_return"] < 0)),
        np.nan,
    )
    return r


def age_cohort(r: pd.DataFrame, min_years: float = 1.0, max_years: float = 2.0,
               today=None) -> pd.DataFrame:
    """Filtrér til spådomme der er mellem `min_years` og `max_years` gamle."""
    today = pd.Timestamp(today or dt.date.today())
    lo = today - pd.Timedelta(days=int(max_years * 365))
    hi = today - pd.Timedelta(days=int(min_years * 365))
    return r[(r["date"] >= lo) & (r["date"] <= hi)].copy()


@dataclass
class Verdict:
    n_directional: int
    hit_rate: float
    base_rate_up: float          # hvor ofte aktien faktisk steg (markedets drift)
    always_bull_score: float     # hvad "sig altid køb" ville have ramt
    p_vs_coinflip: float         # binomial p: er hit_rate signifikant > 50%?
    p_vs_baserate: float         # binomial p: slår analytikerne base raten?
    edge_vs_coin: float          # procentpoint over møntkast
    edge_vs_market: float        # procentpoint over "sig altid køb"

    def summary(self) -> str:
        skill_coin = "JA" if self.p_vs_coinflip < 0.05 else "NEJ"
        skill_mkt = "JA" if self.p_vs_baserate < 0.05 else "NEJ"
        return (
            f"Retnings-kald:            {self.n_directional}\n"
            f"Træfsikkerhed:            {self.hit_rate:6.1%}\n"
            f"Møntkast-benchmark:       {0.5:6.1%}   (edge {self.edge_vs_coin:+.1f} pp)\n"
            f"'Sig altid køb'-benchmark:{self.always_bull_score:6.1%}   (edge {self.edge_vs_market:+.1f} pp)\n"
            f"Aktien steg reelt:        {self.base_rate_up:6.1%}  af tiden (markedets drift)\n"
            f"Slår møntkast (p<0.05)?   {skill_coin}  (binomial p = {self.p_vs_coinflip:.3f})\n"
            f"Slår markedets drift?     {skill_mkt}  (binomial p = {self.p_vs_baserate:.3f})"
        )


def verdict(evaluated: pd.DataFrame) -> Verdict:
    """Saml dommen: tilfører kaldene værdi ud over tilfældighed/drift?"""
    from scipy.stats import binomtest

    d = evaluated[evaluated["is_directional"] & evaluated["fwd_return"].notna()].copy()
    n = len(d)
    if n == 0:
        return Verdict(0, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan)
    k = int(d["correct"].sum())
    hit = k / n
    base_up = float((d["fwd_return"] > 0).mean())
    # "sig altid køb" rammer rigtigt netop når aktien steg
    always_bull = base_up
    p_coin = binomtest(k, n, 0.5, alternative="greater").pvalue
    p_base = binomtest(k, n, max(base_up, 1e-9), alternative="greater").pvalue
    return Verdict(
        n_directional=n,
        hit_rate=hit,
        base_rate_up=base_up,
        always_bull_score=always_bull,
        p_vs_coinflip=float(p_coin),
        p_vs_baserate=float(p_base),
        edge_vs_coin=(hit - 0.5) * 100,
        edge_vs_market=(hit - always_bull) * 100,
    )


def random_baseline(evaluated: pd.DataFrame, n_sims: int = 10000,
                    seed: int = 42) -> np.ndarray:
    """Monte Carlo: træfsikkerhed hvis man gættede retning helt tilfældigt.

    Bevarer markedets faktiske op/ned-fordeling, så fordelingen viser hvad ren
    tilfældighed ville give på PRÆCIS de samme aktie-udfald.
    """
    d = evaluated[evaluated["is_directional"] & evaluated["fwd_return"].notna()]
    ups = (d["fwd_return"] > 0).values
    n = len(ups)
    if n == 0:
        return np.array([])
    rng = np.random.default_rng(seed)
    guesses = rng.integers(0, 2, size=(n_sims, n)).astype(bool)  # tilfældigt køb/sælg
    return (guesses == ups).mean(axis=1)


def by_group(evaluated: pd.DataFrame, col: str, min_n: int = 5) -> pd.DataFrame:
    """Træfsikkerhed pr. gruppe (fx finanshus, selskab eller action)."""
    d = evaluated[evaluated["is_directional"] & evaluated["fwd_return"].notna()]
    g = (d.groupby(col)
           .agg(n=("correct", "size"),
                hit_rate=("correct", "mean"),
                mean_fwd_return=("fwd_return", "mean"))
           .reset_index())
    return g[g["n"] >= min_n].sort_values("hit_rate", ascending=False).reset_index(drop=True)
