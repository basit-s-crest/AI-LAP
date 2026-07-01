"""
constants.py
------------
All magic numbers in one place.

Source weightings
-----------------
Document says: Chat & posts 30%, Clinical notes 35%, Mood 15%, Assessments 20%.
Clinical notes (doctor/coach session notes) are NOT yet available as a live input,
so we redistribute that 35% proportionally across the three active sources:

  Active sources total (without clinical): 30 + 15 + 20 = 65
  Scale factor: 100 / 65 ≈ 1.5385

  chat_posts   : 30 / 65 = 0.4615  → rounded to 0.46
  mood         : 15 / 65 = 0.2308  → rounded to 0.23
  assessments  : 20 / 65 = 0.3077  → rounded to 0.31
  ──────────────────────────────────────────────────
  Total                              = 1.00  ✓

When clinical notes become available, restore:
  WEIGHT_CHAT_POSTS   = 0.30
  WEIGHT_CLINICAL     = 0.35
  WEIGHT_MOOD         = 0.15
  WEIGHT_ASSESSMENTS  = 0.20
"""

# ── Source weights (must sum to 1.0) ─────────────────────────────────────────
WEIGHT_CHAT_POSTS      = 0.30   # peer-post + chat (sentiment analysis)
WEIGHT_MOOD            = 0.15   # journal mood_score (1-5 scale → 0-1)
WEIGHT_ASSESSMENTS     = 0.20   # PHQ8 / GAD7 / ACES assessment scores
WEIGHT_CHANGE_INSIGHTS = 0.35   # session change detection summaries
WEIGHT_CLINICAL        = 0.00   # doctor/coach notes — not available yet

# ── Time decay half-lives (days) ─────────────────────────────────────────────
HALF_LIFE_CHAT_DAYS           = 3    # chat & peer-posts decay quickly
HALF_LIFE_ASSESSMENT_DAYS     = 30   # assessments are stable longer
HALF_LIFE_CHANGE_INSIGHT_DAYS = 14   # session change insights are stable but updated weekly
# Mood uses a fixed 5-day window, no exponential decay

MOOD_WINDOW_DAYS = 5   # only look at mood entries within this window

# ── Risk tier thresholds ──────────────────────────────────────────────────────
TIER_CRISIS   = 0.85
TIER_HIGH     = 0.65
TIER_MODERATE = 0.35
# below TIER_MODERATE → low

# ── Special rules ─────────────────────────────────────────────────────────────
CRISIS_OVERRIDE_HOURS   = 24    # any single event ≥ 0.85 in last 24h → score = 1.0
FLOOR_PHQ_GAD_THRESHOLD = 15    # PHQ-8 or GAD-7 total ≥ 15 → score never below moderate
FLOOR_MODERATE_MIN      = TIER_MODERATE   # = 0.35

# ── Mood score normalisation (1–5 → 0.0–1.0) ─────────────────────────────────
# mood_score=1 is worst (inverted) → risk = 1.0
# mood_score=5 is best             → risk = 0.0
MOOD_SCORE_MIN = 1
MOOD_SCORE_MAX = 5
