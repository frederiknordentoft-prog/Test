"""Sports calendar feature.

The dossier is emphatic: the sports calendar is a *variable*, not noise. A
betting model without tournaments/seasons will have a residual structure you
would wrongly read as behaviour. This module turns a monthly tick index into a
``sports_intensity`` multiplier centred on 1.0, with amplitude scaling and
optional tournament spikes. Online casino has no calendar — that is why it is
the commercially stable leg, and the model must be able to show it.
"""
from __future__ import annotations

from simcore.gambling.config import CalendarConfig


def sports_intensity(tick: int, cal: CalendarConfig) -> float:
    """Deterministic monthly betting-intensity multiplier (mean ≈ 1.0).

    ``amplitude`` stretches the seasonal deviation around 1.0: at amplitude 0
    every month is 1.0; at 0.45 the strongest month sits ~+45 % over the mean.
    Tournament ticks add a further multiplicative boost (EM/VM/CL knockouts).
    """
    if not cal.enabled:
        return 1.0
    month = (cal.start_month - 1 + tick) % 12
    mean = sum(cal.monthly_pattern) / 12.0
    rel = cal.monthly_pattern[month] / mean       # normalized around 1.0
    intensity = 1.0 + cal.amplitude * (rel - 1.0)
    if tick in set(cal.tournament_ticks):
        intensity *= 1.0 + cal.tournament_boost
    return max(0.05, intensity)
