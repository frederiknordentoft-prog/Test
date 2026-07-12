"""Market-size computation.

Etape 0 is deliberately minimal: per track, monthly BSI = annual anchor / 12,
with an optional growth trend, the sports calendar applied to seasonal tracks,
and optional lognormal noise. This produces a *stable baseline series that
matches the 2024/25 anchors* (the Etape-0 Definition of Done).

Later etaper replace this flat baseline with an attraction/market-share model:
players choose between operators (incl. offshore + prediction markets) via a
multinomial logit, and market size becomes base participation × an engagement
multiplier. The function signature (``track_monthly_bsi``) stays the unit the
rest of the code reads, so the upgrade is localized here.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import GamblingConfig, TrackConfig

BN_TO_MIO = 1000.0  # 1 bn DKK = 1000 mio DKK


def track_monthly_bsi(
    track: TrackConfig,
    tick: int,
    gcfg: GamblingConfig,
    rng: np.random.Generator | None = None,
) -> float:
    """Monthly BSI for one track at ``tick`` (month index), in **mio DKK**."""
    monthly = track.annual_bsi / 12.0                      # bn DKK / month
    if track.growth_rate:
        monthly *= (1.0 + track.growth_rate) ** (tick / 12.0)
    if track.seasonal:
        monthly *= sports_intensity(tick, gcfg.calendar)
    if gcfg.baseline_noise > 0 and rng is not None:
        monthly *= float(np.exp(rng.normal(0.0, gcfg.baseline_noise)))
    return monthly * BN_TO_MIO


def market_snapshot(gcfg: GamblingConfig, tick: int,
                    rng: np.random.Generator | None = None) -> dict[str, float]:
    """Per-track monthly BSI (mio DKK) for one tick, keyed by track_id."""
    return {t.track_id: track_monthly_bsi(t, tick, gcfg, rng) for t in gcfg.tracks}
