"""Sports calendar feature.

The dossier is emphatic: the sports calendar is a *variable*, not noise. A
betting model without tournaments/seasons will have a residual structure you
would wrongly read as behaviour. This module turns a monthly tick index into a
``sports_intensity`` multiplier centred on 1.0.

Two distinct sources of variation (a critic finding — a repeating 12-month
pattern produces exactly 0 % year-on-year variation by construction):

- ``monthly_pattern`` × ``amplitude`` is the *within-year* shape (league
  rhythm, summer lull). At amplitude 1.0 the raw pattern is used (−15 %..+20 %
  around the mean); amplitude scales that deviation.
- ``tournament_ticks`` are the *between-year* driver: EM/VM summers add
  ``tournament_boost`` on top. This is what produces the observed −46 %..+14 %
  year-on-year swings — a tournament July vs. the following year's empty July.

Online casino has no calendar — that is why it is the commercially stable leg,
and the model must be able to show it.
"""
from __future__ import annotations

from simcore.gambling.config import CalendarConfig


def sports_intensity(tick: int, cal: CalendarConfig) -> float:
    """Deterministic monthly betting-intensity multiplier (off-year mean ≈ 1.0).

    ``amplitude`` scales the within-year deviation around 1.0 (0 = flat,
    1.0 = the raw monthly pattern). Tournament ticks add a further
    multiplicative ``tournament_boost`` (EM/VM summers) — tournament years
    genuinely carry more volume than off years.
    """
    if not cal.enabled:
        return 1.0
    month = (cal.start_month - 1 + tick) % 12
    mean = sum(cal.monthly_pattern) / 12.0
    rel = cal.monthly_pattern[month] / mean       # normalized around 1.0
    intensity = 1.0 + cal.amplitude * (rel - 1.0)
    boosted = tick in set(cal.tournament_ticks)
    if not boosted and cal.tournament_every and tick >= cal.tournament_offset:
        boosted = (tick - cal.tournament_offset) % cal.tournament_every < 2
    if boosted:
        intensity *= 1.0 + cal.tournament_boost
    return max(0.05, intensity)
