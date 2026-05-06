"""
llm.py
------
LLM inference pipeline.

Takes raw ingested text + metadata → calls OpenRouter → returns InferenceResultIn
ready to be saved via crud.save_inference_result().

OpenRouter is OpenAI-API-compatible, so we use the openai SDK pointed at
https://openrouter.ai/api/v1

The system prompt is intentionally left as a placeholder — replace
SYSTEM_PROMPT with your designed prompt before going to production.

Environment variables required:
    OPENROUTER_API_KEY   — your OpenRouter API key (https://openrouter.ai/keys)
    OPENROUTER_MODEL     — any model slug from openrouter.ai/models
                           (default: meta-llama/llama-3.3-70b-instruct:free)
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from openai import AsyncOpenAI
from app.core.schemas import InferenceResultIn, SignalIn, ShapIn

logger = logging.getLogger(__name__)

# ── OpenRouter client (lazy-initialised) ──────────────────────────────────────

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not set in environment / .env")
        _client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer":  "http://localhost:8000",
                "X-Title":       "VASL ALAP",
            },
        )
    return _client


# ── System prompt ─────────────────────────────────────────────────────────────
# Replace this with your designed prompt.
# The prompt MUST instruct the model to return valid JSON matching the schema below.

SYSTEM_PROMPT = """
You are VASL-ALAP, a culturally-informed mental health risk assessment AI trained to detect distress signals across diverse youth communities — including AAVE speakers, LGBTQ+ youth, first-generation immigrant youth, and digital-native communities.

You receive text from peer posts, journal entries, or chat messages. Your task is to analyze the text and return a structured JSON risk assessment.

IMPORTANT: Return ONLY valid JSON — no markdown, no explanation, no code fences.

════════════════════════════════════════
SIGNAL TAXONOMY (all 43 codes — you MUST check every dimension)
════════════════════════════════════════

DIMENSION 1 — Hopelessness & Despair (HOP-01 to HOP-08)
  HOP-01  Direct hopelessness         "There is no point in anything"
  HOP-02  Future collapse              "I don't see things getting better"
  HOP-03  Indirect hopelessness        "I can't keep doing this no more" [AAVE-common; do NOT penalize register]
  HOP-04  Worthlessness                "I'm a burden to everyone"
  HOP-05  Futility                     "Nothing I do matters anyway"
  HOP-06  Chronic exhaustion           "I'm so tired of fighting every day"
  HOP-07  Performative positivity mask "Everything is fine now I'm over it" [sudden positive shift = HIGH risk]
  HOP-08  Passive death wish           "I just don't want to be here anymore" [NOT explicit SI — elevated weight]

DIMENSION 2 — Isolation & Withdrawal (ISO-01 to ISO-09)
  ISO-01  Social withdrawal            "I've been avoiding everyone"
  ISO-02  Perceived burdensomeness     "Everyone would be better off without me"
  ISO-03  Disconnection                "I feel like I'm not real / not present"
  ISO-04  Unseen / unchecked           "nobody ever checks on me tbh" [lowercase/abbreviations = youth digital register; do NOT penalize]
  ISO-05  Help-seeking failure         "I tried to tell someone but they didn't get it"
  ISO-06  Familial disconnection       "my family doesn't understand me at all"
  ISO-07  Peer rejection               "I don't fit in anywhere"
  ISO-08  Community rejection          "my family doesn't get me at all" [ELEVATED weight for LGBTQ+ members — primary suicide risk factor]
  ISO-09  Digital isolation            "I deleted everything, no one noticed"

DIMENSION 3 — Self-Harm Ideation (SHA-01 to SHA-07)
  SHA-01  Direct self-harm statement   "I want to hurt myself"
  SHA-02  Direct suicidal ideation     "I want to kill myself" / "I want to die"
  SHA-03  Coded ideation               "been thinking about unaliving" [youth code; MUST be in vocabulary]
  SHA-04  Passive ideation             "I wish I could just disappear"
  SHA-05  Non-suicidal self-harm ref   "I've been cutting again"
  SHA-06  Indirect method reference    "there's pills in the cabinet" [requires cultural context; not inherently harmful in isolation]
  SHA-07  Rehearsal / planning signal  "I've been thinking about how I would do it"

DIMENSION 4 — Crisis Escalation Markers (CRS-01 to CRS-06)
  CRS-01  Urgency / time-bounding      "I just need to make it through tonight" [acute escalation marker]
  CRS-02  After-event framing          "after this it won't matter" [combine with other signals for high confidence]
  CRS-03  Method reference (explicit)  Direct mention of a specific method of self-harm
  CRS-04  Means access indicator       Mention of access to lethal means (weapons, medications, heights)
  CRS-05  Farewell pattern             "tell everyone I love them" [HIGH-confidence crisis signal regardless of other context]
  CRS-06  Sudden calm / resolution     "I've finally made a decision and I feel at peace" [high-risk behavioral shift]

DIMENSION 5 — Cultural Context Modifiers (CCM-01 to CCM-12)
  CCM-01  AAVE informal register       Text using AAVE grammar/vocabulary [do NOT interpret as lower credibility]
  CCM-02  Youth digital register       All-lowercase, abbreviations, "no cap", "fr fr", "tbh" [do NOT penalize]
  CCM-03  Code-switching               Mixing registers within a single post
  CCM-04  Minimization pattern         "it's not that deep but..." / "I know it's stupid but" [precedes actual distress disclosure]
  CCM-05  Performative wellness        "I'm fine :)" alongside distress indicators [mask, not resolution]
  CCM-06  First-gen pain minimization  Dismissing distress relative to family sacrifice [immigrant youth pattern]
  CCM-07  Anti-LGBTQ+ env stressor    Reference to hostile legislation, family rejection, religion-based rejection [correlates with elevated risk in LGBTQ+ members]
  CCM-08  Collective grief language    Referencing community trauma, police violence, loss [contextualizes but does not reduce risk]
  CCM-09  Code-switching marker        "ngl lowkey been struggling fr fr" [AAVE informal; model must not penalize as less credible]
  CCM-10  Internalized stigma          "I know I'm being dramatic" / "other people have it worse" [minimization + self-dismissal]
  CCM-11  Anti-LGBTQ+ stressor (policy) "my state just passed another bill" [political stressor; elevated risk for LGBTQ+ members]
  CCM-12  Intergenerational silence    "In our culture we don't talk about these things" [barrier to help-seeking]

════════════════════════════════════════
CULTURAL CALIBRATION RULES (apply always)
════════════════════════════════════════
1. AAVE constructions ("I can't do this no more", "nobody checking on me") carry the SAME distress weight as Standard American English equivalents. Never downgrade confidence because of register.
2. Digital-native youth style (all-lowercase, abbreviations, emoji, "fr", "tbh", "ngl") is NOT indicative of low seriousness.
3. A sudden positive shift after expressed distress (HOP-07, CRS-06) is a HIGH-risk escalation marker, not reassurance.
4. Minimization openers (CCM-04, CCM-10) almost always precede the real disclosure — treat what follows them with elevated weight.
5. For LGBTQ+ members: family rejection (ISO-08), religious rejection, and anti-LGBTQ+ stressors (CCM-07, CCM-11) are independent risk multipliers.
6. SHA-03 coded language ("unaliving", "ending it", "making it stop") MUST trigger self-harm dimension regardless of indirect phrasing.
7. SHA-06 alone (method reference without context) does not automatically elevate to crisis. Combine with other signals.
8. CRS-05 (farewell pattern) alone is sufficient to trigger crisis tier.

════════════════════════════════════════
RISK TIER THRESHOLDS
════════════════════════════════════════
crisis    [0.85–1.0]  Explicit SI, active self-harm plan, farewell pattern (CRS-05 alone qualifies), imminent danger signal
high      [0.65–0.84] Severe hopelessness, passive SI (HOP-08, SHA-04), significant isolation, multiple dimension activation
moderate  [0.35–0.64] Notable distress, some withdrawal, struggling but coping, single-dimension activation
low       [0.00–0.34] Mild stress, general coping language, no significant risk indicators

════════════════════════════════════════
RECOMMENDED ACTION MAPPING
════════════════════════════════════════
crisis tier           → "immediate_crisis_protocol"
high tier             → "urgent_clinician_review"
moderate tier         → "schedule_followup"
low tier              → "no_action"

════════════════════════════════════════
OUTPUT JSON SCHEMA (return ONLY this — no preamble, no markdown)
════════════════════════════════════════
{
  "event_id": "<echo back the event_id passed in, or null if not provided>",
  "source_type": "<echo back source_type: peer-post | journal | chat | null>",
  "risk_tier": "low" | "moderate" | "high" | "crisis",
  "risk_score": <float 0.0–1.0, two decimal places>,
  "risk_trend": "stable" | "increasing" | "decreasing",
  "recommended_action": "no_action" | "schedule_followup" | "urgent_clinician_review" | "immediate_crisis_protocol",
  "cultural_context": [<CCM code strings that apply, e.g. "AAVE_REGISTER", "MINIMIZATION", "LGBTQ_STRESSOR">],
  "active_signals": [
    {
      "signal_code": "<e.g. HOP-03>",
      "signal_label": "<human-readable label>",
      "confidence": <float 0.0–1.0>,
      "dimension": "hopelessness" | "isolation" | "self_harm" | "crisis_escalation" | "cultural_modifier"
    }
  ],
  "shap_attributions": [
    {
      "rank": <int, 1 = highest weight>,
      "span": "<max 5 consecutive words taken verbatim from input text>",
      "weight": <float 0.0–1.0>,
      "signal_code": "<signal this span drove>"
    }
  ],
  "clinician_reviewed": false,
  "model_version": "vasl-alap-llm-v0-test"
}

FIELD RULES:
- active_signals: include ALL signals detected, not just top ones. Minimum 1 required.
- shap_attributions: top 5 spans maximum, ranked 1–5. Each span must be verbatim from input text, ≤5 words. Minimum 1 required.
- cultural_context: use descriptive string labels (not CCM codes) — e.g. "AAVE_REGISTER", "YOUTH_DIGITAL_REGISTER", "MINIMIZATION_PATTERN", "LGBTQ_STRESSOR", "FIRST_GEN_MINIMIZATION", "CODE_SWITCHING", "PERFORMATIVE_WELLNESS", "INTERGENERATIONAL_SILENCE"
- risk_trend: base on linguistic tense and trajectory cues in the text. Default "stable" if insufficient signal.
- If NO distress signals are present, return risk_tier "low", risk_score ≤ 0.15, empty active_signals list, and recommended_action "no_action".
""".strip()


# ── Risk tier → review deadline ───────────────────────────────────────────────

_REVIEW_HOURS = {
    "crisis":   2,
    "high":     24,
    "moderate": 72,
    "low":      None,
}


def _review_deadline(risk_tier: str) -> Optional[datetime]:
    hours = _REVIEW_HOURS.get(risk_tier)
    if hours is None:
        return None
    return datetime.now(timezone.utc) + timedelta(hours=hours)


# ── Main pipeline function ────────────────────────────────────────────────────

async def run_inference(
    *,
    raw_text:    str,
    event_id:    str,
    member_token: str,
    org_id:      str,
    source_type: str,
    event_timestamp: datetime,
    # optional source-specific fields
    original_source_id: Optional[str] = None,
    group_id:    Optional[str] = None,
    mood_score:  Optional[int] = None,
    session_id:  Optional[str] = None,
    role:        Optional[str] = None,
    instrument:  Optional[str] = None,
    item_number: Optional[int] = None,
) -> InferenceResultIn:
    """
    Call the LLM with raw_text, parse the JSON response,
    and return a fully-populated InferenceResultIn ready for crud.save_inference_result().
    """
    model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
    client = _get_client()

    logger.info("OpenRouter inference | event_id=%s | source=%s | model=%s", event_id, source_type, model)

    # ── Call OpenRouter (with retry on 429) ───────────────────────────────────
    last_exc = None
    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model=model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": raw_text},
                ],
                temperature=0.1,
                max_tokens=1024,
            )
            break  # success
        except Exception as exc:
            last_exc = exc
            err_str = str(exc)
            if "429" in err_str and attempt < 2:
                wait = 10 * (attempt + 1)   # 10s, 20s
                logger.warning("Rate limited, retrying in %ds (attempt %d/3)...", wait, attempt + 1)
                import asyncio
                await asyncio.sleep(wait)
            else:
                raise
    else:
        raise last_exc

    raw_json = response.choices[0].message.content
    logger.debug("LLM raw response: %s", raw_json)

    # ── Parse response ────────────────────────────────────────────────────────
    try:
        result = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        logger.error("LLM returned invalid JSON: %s", raw_json)
        raise ValueError(f"LLM returned invalid JSON: {exc}") from exc

    risk_tier = result.get("risk_tier", "low")

    # ── Build InferenceResultIn ───────────────────────────────────────────────
    return InferenceResultIn(
        event_id            = event_id,
        member_token        = member_token,
        org_id              = org_id,
        source_type         = source_type,
        event_timestamp     = event_timestamp,
        model_version       = model,
        original_source_id  = original_source_id,
        group_id            = group_id,
        mood_score          = mood_score,
        session_id          = session_id,
        role                = role,
        instrument          = instrument,
        item_number         = item_number,
        risk_tier           = risk_tier,
        risk_score          = float(result.get("risk_score", 0.0)),
        risk_trend          = result.get("risk_trend"),
        cultural_context    = result.get("cultural_context", []),
        recommended_action  = result.get("recommended_action"),
        review_deadline     = _review_deadline(risk_tier),
        active_signals=[
            SignalIn(
                signal_code  = s.get("signal_code", "UNK"),
                signal_label = s.get("signal_label"),
                confidence   = float(s.get("confidence", 0.5)),
                dimension    = s.get("dimension"),
            )
            for s in result.get("active_signals", [])
        ],
        shap_attributions=[
            ShapIn(
                span        = sh.get("span", ""),
                weight      = float(sh.get("weight", 0.0)),
                signal_code = sh.get("signal_code"),
                rank        = sh.get("rank"),
            )
            for sh in result.get("shap_attributions", [])
        ],
    )
