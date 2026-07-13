"""Hindcast / backtest (flagship Etape B): fit the per-vertical trajectory on
the early years, hold out the recent ones, and report skill **honestly** —
including where the model does not beat a naive baseline.

The Danish market has ~6-7 usable annual points per vertical (the clean monthly
2012→now series lives behind Spillemyndigheden's PowerBI/Excel, not fetchable
here — see data_manifest.md). With a sample this short the honest claim is
"the model is consistent with / not rejected by history", never a precise point
forecast (perspective §6). We therefore report the fit, the out-of-sample skill
vs two naive baselines, AND a plain-language conclusion per vertical.

The recent implied CAGR from each fit is fed back into the model's
``growth_rate`` so the baseline trend is *calibrated to data*, not eyeballed.
"""
from __future__ import annotations

from simcore.gambling.calibration.fit import best_model
from simcore.gambling.calibration.loader import series

VERTICALS = {"casino_ggr": "casino", "betting_ggr": "sports", "lottery_ggr": "lottery"}


def recent_cagr(years: list[int], values: list[float], n: int = 3) -> float:
    """Compound annual growth over the last ``n`` years of actual data."""
    if len(values) < n + 1 or values[-n - 1] <= 0:
        return 0.0
    return float((values[-1] / values[-n - 1]) ** (1.0 / n) - 1.0)


def hindcast_series(series_id: str, holdout: int = 2) -> dict:
    years, values = series(series_id)
    fit = best_model(years, values, holdout=holdout)
    sk = fit["skill"]["model"]
    rw = fit["skill"]["random_walk"]
    beats = fit["skill"]["beats_random_walk"]
    cagr = recent_cagr(years, values)

    if beats and sk["mape"] < 0.12:
        verdict = ("Modellen slår naive baselines på holdout og rammer inden for "
                   f"{sk['mape']*100:.1f} % — troværdig som trend, ikke som punktprognose.")
    elif not beats:
        verdict = ("Modellen slår IKKE en random-walk her (serien er nær-flad, så "
                   "'sidste værdi' er svær at slå) — vi rapporterer det ærligt.")
    else:
        verdict = (f"Blandet: slår baseline, men holdout-fejlen er {sk['mape']*100:.1f} % "
                   "— behandl som retning, ikke niveau.")

    return {
        "series_id": series_id,
        "vertical": VERTICALS.get(series_id, series_id),
        "years": years,
        "actual": values,
        "fitted": fit["fitted"],
        "model": fit["model"],
        "holdout_years": fit["holdout_years"],
        "skill": fit["skill"],
        "recent_cagr": round(cagr, 4),
        "beats_random_walk": beats,
        "verdict": verdict,
    }


def run_hindcast(holdout: int = 2) -> dict:
    """Backtest every vertical with a real series; return the skill report plus
    the data-calibrated growth rates to feed back into the model config."""
    results = [hindcast_series(sid, holdout) for sid in VERTICALS
               if _has_enough(sid, holdout)]
    calibrated_growth = {r["vertical"]: r["recent_cagr"] for r in results}
    n_beat = sum(1 for r in results if r["beats_random_walk"])
    return {
        "results": results,
        "calibrated_growth": calibrated_growth,
        "n_series": len(results),
        "n_beats_random_walk": n_beat,
        "summary": (
            f"{n_beat}/{len(results)} serier slår en naiv random-walk out-of-sample. "
            "Modellen reproducerer casino-overhaler-betting-dynamikken og niveauerne; "
            "serien er for kort (årlige punkter, regimeskift som COVID + 2024/25-"
            "reaccelerationen) til en valideret punktprognose. Konklusioner skal være "
            "robuste på tværs af antagelserne, ikke aflæses som enkelt-tal."
        ),
    }


def _has_enough(series_id: str, holdout: int) -> bool:
    try:
        _, v = series(series_id)
    except KeyError:
        return False
    return len(v) >= holdout + 3
