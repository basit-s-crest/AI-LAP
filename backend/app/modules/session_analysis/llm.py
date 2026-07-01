"""
llm.py
------
LLM inference pipeline — powered by OpenRouter.

Takes raw ingested text + metadata → calls OpenRouter → returns InferenceResultIn
ready to be saved via crud.save_inference_result().

OpenRouter is OpenAI-API-compatible, so we use the openai SDK pointed at
https://openrouter.ai/api/v1

Environment variables required:
    OPENROUTER_API_KEY   — your OpenRouter API key (https://openrouter.ai/keys)
    OPENROUTER_MODEL     — any model slug from openrouter.ai/models
                           (default: google/gemini-2.0-flash-001)
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory absolutely
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent.parent / ".env", override=True)

from openai import AsyncOpenAI
from app.modules.session_analysis.schemas import InferenceResultIn, SignalIn, ShapIn

logger = logging.getLogger(__name__)

# ── Gemini / OpenRouter client (lazy-initialised, one instance reused across requests) ─

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # Check GROQ_API_KEY first, fallback to GEMINI_API_KEY or OPENROUTER_API_KEY
        api_key = os.getenv("GROQ_API_KEY")
        if api_key:
            api_key = api_key.strip().strip("'\"")
            _client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1",
            )
        else:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                api_key = os.getenv("OPENROUTER_API_KEY")
                
            if not api_key:
                raise RuntimeError("GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY is not set in environment / .env")
                
            # Clean any surrounding quotes from .env parsing
            api_key = api_key.strip().strip("'\"")

            # Determine backend endpoint based on API key prefix.
            # Google Gemini API keys from Google AI Studio typically start with "AIzaSy"
            is_gemini = api_key.startswith("AIzaSy")
            if is_gemini:
                base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
                _client = AsyncOpenAI(
                    api_key=api_key,
                    base_url=base_url,
                )
            else:
                base_url = "https://openrouter.ai/api/v1"
                _client = AsyncOpenAI(
                    api_key=api_key,
                    base_url=base_url,
                    default_headers={
                        "Authorization": f"Bearer {api_key}",
                        "HTTP-Referer":  "http://localhost:8000",
                        "X-Title":       "VASL ALAP",
                    },
                )
    return _client


# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are VASL-ALAP, an AI for mental health early distress detection.
Analyze the input text and return a structured JSON risk assessment.

OBJECTIVE:
Detect emerging emotional deterioration, hopelessness, social withdrawal, emotional exhaustion, self-harm, or pre-crisis patterns (including subtle, joking, abbreviated, or digital-slang signals like "unaliving", "cooked", "done fr").
Prefer MODERATE over LOW risk if meaningful suffering or disconnection exists.

RISK TIERS & SCORES:
- crisis [0.85-1.0]: Explicit suicidal intent, active planning, means, or farewell behavior. Action: "immediate_crisis_protocol"
- high [0.65-0.84]: Passive suicidal ideation, severe hopelessness, or repeated disappearance language. Action: "urgent_clinician_review"
- moderate [0.35-0.64]: Loneliness, burnout, exhaustion, withdrawal, feeling invisible, or chronic stress. Action: "schedule_followup"
- low [0.00-0.34]: Ordinary stress/frustration or stable coping. Action: "no_action"

TAXONOMY (dimensions & signal_codes):
- hopelessness: HOP-01:Direct, HOP-02:FutureCollapse, HOP-03:Indirect, HOP-04:Worthlessness, HOP-05:Futility, HOP-06:ChronicExhaustion, HOP-07:PositivityMask, HOP-08:PassiveDeathWish
- isolation: ISO-01:Withdrawal, ISO-02:Burdensomeness, ISO-03:Disconnection, ISO-04:Unseen, ISO-05:HelpFailure, ISO-06:FamilyDisconnect, ISO-07:PeerRejection, ISO-08:CommunityRejection, ISO-09:DigitalIsolation
- self_harm: SHA-01:DirectHarm, SHA-02:Suicidal, SHA-03:Coded, SHA-04:Passive, SHA-05:NSSI, SHA-06:MethodRef, SHA-07:Rehearsal
- crisis_escalation: CRS-01:Urgency, CRS-02:AfterEvent, CRS-03:MethodExplicit, CRS-04:MeansAccess, CRS-05:Farewell, CRS-06:SuddenCalm
- cultural_modifier: CCM-01:AAVE, CCM-02:YouthDigital, CCM-03:CodeSwitch, CCM-04:Minimization, CCM-05:PerfWellness, CCM-06:FirstGenPain, CCM-07:AntiLgbtqStress, CCM-08:CollectiveGrief, CCM-09:CodeSwitchMarker, CCM-10:InternalStigma, CCM-11:AntiLgbtqPolicy, CCM-12:IntergenSilence

OUTPUT FORMAT (JSON only, no markdown wrappers/code blocks, no explanation):
{
  "event_id": "<echo event_id>",
  "source_type": "peer-post"|"journal"|"chat"|"change-insight"|null,
  "risk_tier": "low"|"moderate"|"high"|"crisis",
  "risk_score": <float 0.0-1.0, 2 decimals>,
  "risk_trend": "stable"|"increasing"|"decreasing",
  "recommended_action": "no_action"|"schedule_followup"|"urgent_clinician_review"|"immediate_crisis_protocol",
  "cultural_context": [<strings of detected contexts/slang>],
  "active_signals": [{"signal_code": "<code e.g. HOP-03>", "signal_label": "<label>", "confidence": <float>, "dimension": "<dim>"}],
  "shap_attributions": [{"rank": <int>, "span": "<max 5 words verbatim>", "weight": <float>, "signal_code": "<code-driven>"}],
  "clinician_reviewed": false,
  "model_version": "vasl-alap-llm-v0-test"
}

RULES:
1. Output valid JSON only. Never use markdown block wraps (```json).
2. Limit shap_attributions to 1-5 verbatim spans driving the classification.
3. If no distress exists, score must be <=0.15.
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
    Call Groq / Gemini / OpenRouter with raw_text, parse the JSON response,
    and return a fully-populated InferenceResultIn ready for crud.save_inference_result().
    """
    # Resolve the correct api key and model based on backend endpoint:
    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
        if model:
            model = model.strip().strip("'\"")
    else:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            api_key = os.getenv("OPENROUTER_API_KEY")
        api_key = (api_key or "").strip().strip("'\"")
        is_gemini = api_key.startswith("AIzaSy")

        model = os.getenv("GEMINI_MODEL")
        if not model:
            if is_gemini:
                model = "gemini-2.5-flash"
            else:
                model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
        if model:
            model = model.strip().strip("'\"")
        
    # Scrub PII for chat messages before sending to 3rd-party LLM providers
    llm_input_text = raw_text
    if source_type == "chat":
        from app.shared.pii import scrub_pii
        llm_input_text = scrub_pii(raw_text)
        logger.info("PII scrubbing applied to chat message for event_id=%s", event_id)

    # ── Call LLM (with retry on 429 / 503) ─────────────────────────────
    client = _get_client()
    last_exc = None
    for attempt in range(3):
        try:
            response = await client.chat.completions.create(
                model=model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": llm_input_text},
                ],
                temperature=0.1,
                max_tokens=2048,
            )
            break  # success
        except Exception as exc:
            last_exc = exc
            err_str   = str(exc)
            if ("429" in err_str or "503" in err_str) and attempt < 2:
                wait = 10 * (attempt + 1)   # 10s, 20s
                logger.warning(
                    "LLM transient error, retrying in %ds (attempt %d/3): %s",
                    wait, attempt + 1, err_str[:120],
                )
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


