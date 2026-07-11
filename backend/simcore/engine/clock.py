"""Tick resolution semantics.

Dynamics parameters are expressed *per tick*; the resolution mainly affects
annualization of indicators and default parameter scaling suggestions.
"""
from __future__ import annotations

from enum import Enum


class TickResolution(str, Enum):
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    QUARTER = "quarter"


TICKS_PER_YEAR: dict[TickResolution, float] = {
    TickResolution.MINUTE: 252 * 390,
    TickResolution.HOUR: 252 * 6.5,
    TickResolution.DAY: 252,
    TickResolution.WEEK: 52,
    TickResolution.QUARTER: 4,
}


def annualization_factor(resolution: TickResolution | str) -> float:
    return float(TICKS_PER_YEAR[TickResolution(resolution)]) ** 0.5
