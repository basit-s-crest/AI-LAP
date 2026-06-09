"""
decay.py
--------
Time-decay utilities.

Formula (exponential half-life decay):
    weight = 2 ^ (- age_days / half_life_days)

Examples:
  age=0 days,  half_life=3  → weight=1.000  (brand new)
  age=3 days,  half_life=3  → weight=0.500  (half weight)
  age=6 days,  half_life=3  → weight=0.250  (quarter weight)
  age=30 days, half_life=3  → weight≈0.001  (essentially zero)
"""

import math
from datetime import datetime, timezone


def decay_weight(event_time: datetime, half_life_days: float) -> float:
    """
    Return a 0–1 decay multiplier for an event at `event_time`.
    More recent → closer to 1.0.  Older → closer to 0.0.
    """
    now = datetime.now(timezone.utc)

    # Make event_time tz-aware if it isn't already
    if event_time.tzinfo is None:
        event_time = event_time.replace(tzinfo=timezone.utc)

    age_days = max((now - event_time).total_seconds() / 86_400, 0.0)
    return math.pow(2.0, -age_days / half_life_days)


def apply_decay(score: float, event_time: datetime, half_life_days: float) -> float:
    """
    Return score multiplied by the decay weight.
    Result is in [0, score].
    """
    return score * decay_weight(event_time, half_life_days)
