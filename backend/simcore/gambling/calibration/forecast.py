"""From trajectory to a bid on the future (flagship Etape D).

The model's output is not a number — it is a *distribution* plus an honest
account of how much to trust it. This module assembles the "forecast &
validation" payload that turns the raw Monte Carlo fan into a decision-grade
answer:

- **Reality anchors**: the latest real observations per headline metric, so the
  UI can overlay actuals on the forecast fan (nowcasting) and show whether the
  present sits where the model expects.
- **Backtest skill** (Etape B) and **natural-experiment validation** (Etape C),
  summarised — the evidence for *why* the bands are (or are not) trustworthy.
- **An honesty statement**: what the model can and cannot predict.

The probabilistic bands themselves come from the existing Monte Carlo endpoint
(``series_percentiles`` p5/p50/p95 over time); this module supplies the context
that makes them a forecast rather than a pretty chart.
"""
from __future__ import annotations

from simcore.gambling.calibration.hindcast import run_hindcast
from simcore.gambling.calibration.loader import historical
from simcore.gambling.calibration.natural_experiments import run_natural_experiments

# tick 0 of a forecast run = this calendar year (the latest full-year anchor).
ANCHOR_YEAR = 2025


def reality_anchors() -> dict:
    """Latest real observations, mapped to the model's headline metric keys, in
    the model's units (mio DKK/month for BSI, fraction for shares) — for the
    nowcasting overlay."""
    df = historical()

    def latest(series_id):
        rows = df[df["series_id"] == series_id].sort_values("year")
        if rows.empty:
            return None
        r = rows.iloc[-1]
        return {"year": int(r["year"]), "value": float(r["value"]),
                "confidence": r["confidence"]}

    casino = latest("casino_ggr")
    betting = latest("betting_ggr")
    total = latest("total_ggr")
    chan = latest("channelization_official")
    anchors = {}
    if casino:
        anchors["bsi_casino"] = {**casino, "value": round(casino["value"] / 12, 1), "unit": "mio_kr_md"}
    if betting:
        anchors["bsi_sports"] = {**betting, "value": round(betting["value"] / 12, 1), "unit": "mio_kr_md"}
    if total:
        # model's market_size_total is the 4 tracks incl. offshore, mio/month;
        # the real total incl. land-based/machines is a loose upper reference.
        anchors["market_reference_total"] = {**total, "value": round(total["value"] / 12, 1),
                                             "unit": "mio_kr_md",
                                             "note": "hele markedet inkl. landbaseret — løs øvre reference"}
    if chan:
        anchors["channelization_official"] = {**chan, "unit": "fraction"}
    return anchors


def forecast_validation() -> dict:
    """The full 'can this predict the future?' bundle."""
    hc = run_hindcast()
    ne = run_natural_experiments()
    return {
        "anchor_year": ANCHOR_YEAR,
        "reality_anchors": reality_anchors(),
        "hindcast": {
            "summary": hc["summary"],
            "n_series": hc["n_series"],
            "n_beats_random_walk": hc["n_beats_random_walk"],
            "per_series": [
                {"vertical": r["vertical"], "beats_random_walk": r["beats_random_walk"],
                 "mape": r["skill"]["model"]["mape"], "verdict": r["verdict"]}
                for r in hc["results"]
            ],
        },
        "natural_experiments": {
            "summary": ne["summary"],
            "n_reproduced": ne["n_reproduced"], "n_total": ne["n_total"],
            "checks": [{"experiment": c["experiment"], "reproduced": c["reproduced"],
                        "verdict": c["verdict"]} for c in ne["checks"]],
        },
        "honesty": (
            "Modellen giver et BUD på fremtiden som en fordeling, ikke et tal. "
            "Den er forankret i virkelige data (UK Patterns of Play for koncentration, "
            "Spillemyndighedens serie for vækst) og reproducerer to naturlige eksperimenter "
            "(Sverige-bonusforbud, Betano-entry) den ikke blev fittet på. Backtesten viser: "
            "casino-væksten kan forudsiges bedre end en naiv baseline; betting kan den IKKE "
            "(nær-flad serie). Læs derfor båndet, ikke midterlinjen — og kun konklusioner, der "
            "er robuste på tværs af antagelserne, tæller."
        ),
    }
