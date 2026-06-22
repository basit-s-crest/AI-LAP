import os
import logging
from strands import Agent
from strands.models.litellm import LiteLLMModel
from app.modules.rag.retriever import get_patient_profile, get_relevant_memory_events, get_recent_episodes
from app.modules.rag.embedder import get_embedding, get_embedding_async

logger = logging.getLogger(__name__)

def get_litellm_model() -> LiteLLMModel:
    """Configures and returns the LiteLLMModel based on environmental key definitions."""
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip().strip("'\"")
    if groq_api_key:
        groq_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip().strip("'\"")
        model_id = f"groq/{groq_model}"
        client_args = {"api_key": groq_api_key}
    else:
        gemini_key = os.getenv("GEMINI_API_KEY", "").strip().strip("'\"")
        openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip().strip("'\"")
        if gemini_key or openrouter_key:
            api_key = gemini_key or openrouter_key
            if api_key.startswith("AIzaSy"):
                gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip().strip("'\"")
                model_id = f"gemini/{gemini_model}"
                client_args = {"api_key": api_key}
            else:
                or_model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001").strip().strip("'\"")
                model_id = f"openrouter/{or_model}"
                client_args = {
                    "api_key": api_key,
                    "base_url": "https://openrouter.ai/api/v1"
                }
        else:
            model_id = "openrouter/google/gemini-2.0-flash-001"
            client_args = {}

    logger.info(f"[RAG Agent] Initializing LiteLLMModel using model_id: {model_id}")
    return LiteLLMModel(
        model_id=model_id,
        client_args=client_args,
        params={
            "temperature": 0.2,
            "max_tokens": 350
        }
    )

async def run_rag_analysis(
    session_id: str,
    member_id: str,
    recent_lines: list[str],
    working_buffer_text: str,
    tone_context: str = ""
) -> str:
    """
    RAG-based clinical status analysis orchestrated within Strands Agent.
    Each retriever call uses its own isolated DB session so that a dropped
    Supabase connection on one call cannot poison the transaction state for
    the others (prevents the 'invalid transaction is rolled back' cascade).
    """
    from app.core.database import AsyncSessionLocal

    # 1. Fetch RAG Context (L2 summaries, L3a memory events, L3b profile)
    profile_str = ""
    history_str = ""
    episodes_str = ""

    # 1a. Profile (L3b) — isolated session
    profile: dict = {}
    try:
        async with AsyncSessionLocal() as profile_db:
            profile = await get_patient_profile(profile_db, member_id)
    except Exception as e:
        logger.error(f"[RAG Agent] Failed to open session for profile fetch: {e}")

    if profile:
        profile_str = (
            f"- Presenting Conditions: {', '.join(profile.get('presenting_conditions', []))}\n"
            f"- Core Wounds: {', '.join(profile.get('core_wounds', []))}\n"
            f"- Recurring Themes: {', '.join(profile.get('recurring_themes', []))}\n"
            f"- Progress Markers: {', '.join(profile.get('progress_markers', []))}\n"
            f"- Active Risk Flags: {', '.join(profile.get('risk_flags', []))}\n"
            f"- Unresolved Threads: {', '.join(profile.get('unresolved_threads', []))}\n"
            f"- Overall Progress Score: {profile.get('overall_progress_score', 50.0)}/100\n"
            f"- Current Risk Tier: {profile.get('current_risk_tier', 'low')}\n"
        )
    else:
        profile_str = "- No historical longitudinal profile found for this member.\n"

    # 1b. Vector search for relevant memory events (L3a) — isolated session
    if working_buffer_text.strip():
        model = get_litellm_model()
        topic_agent = Agent(
            model=model,
            system_prompt=(
                "You are an AI psychiatric assistant. Analyze the transcript snippet of the current mental health coaching session "
                "and extract the main psychological concern, feeling, or struggle mentioned by the patient. "
                "Output exactly a single sentence or keyword phrase describing this topic to be used for semantic search (RAG)."
            )
        )
        search_result = await topic_agent.invoke_async(f"TRANSCRIPT SNIPPET:\n{working_buffer_text}")
        search_query = str(search_result).strip()

        logger.info(f"[RAG Agent] Generated search query: {search_query}")

        if search_query:
            query_vector = await get_embedding_async(search_query)
            matched_events: list[dict] = []
            try:
                async with AsyncSessionLocal() as events_db:
                    matched_events = await get_relevant_memory_events(events_db, member_id, query_vector)
            except Exception as e:
                logger.error(f"[RAG Agent] Failed to open session for memory events fetch: {e}")

            if matched_events:
                for idx, ev in enumerate(matched_events):
                    history_str += f"- [{ev['category']}] (Similarity: {ev['similarity']:.2f}): {ev['narrative']}\n"
                    if ev['raw_quote']:
                        history_str += f"  Quote: \"{ev['raw_quote']}\"\n"
            else:
                history_str += "- No relevant historical events matched.\n"

    if not history_str:
        history_str = "- No relevant historical events matched.\n"

    # 1c. Live session episodes (L2) — isolated session
    episodes: list[dict] = []
    try:
        async with AsyncSessionLocal() as episodes_db:
            episodes = await get_recent_episodes(episodes_db, session_id)
    except Exception as e:
        logger.error(f"[RAG Agent] Failed to open session for episodes fetch: {e}")

    if episodes:
        for ep in reversed(episodes):
            episodes_str += f"- Summary: {ep['summary']} (Sentiment: {ep['sentiment']})\n"
    else:
        episodes_str += "- No previous episodes in this session.\n"
        
    # 2. Setup standard clinical prompt context
    transcript_context = "\n".join(recent_lines)
    
    # Build vocal tone section if available
    tone_section = ""
    if tone_context:
        tone_section = (
            "VOCAL TONE ANALYSIS (L1 — Acoustic Features):\n"
            + tone_context + "\n\n"
            "IMPORTANT: The vocal tone analysis above reveals HOW the patient is speaking, not just WHAT they said. "
            "Pay special attention to affect incongruence — when the patient's words and vocal delivery do not align. "
            "Examples:\n"
            "- Laughing while expressing suicidal ideation → possible deflection or masking\n"
            "- Flat monotone on hopeful words → possible anhedonia\n"
            "- Voice tremor/breaks on specific topics → emotional sensitivity\n"
            "- Calm words + elevated energy/pitch → hidden agitation\n\n"
        )
    
    prompt = (
        "You are an AI psychiatric clinical assistant observing a live mental health coaching session. "
        "You are provided with clinical context from the patient's history (L3), the profile, recent session summaries (L2), "
        "and the raw transcript snippet of the last 60 seconds (L1).\n\n"
        "PATIENT LONGITUDINAL PROFILE (L3b):\n" + profile_str + "\n"
        "RELEVANT PATIENT HISTORY (L3a):\n" + history_str + "\n"
        "RECENT SESSION EPISODES (L2):\n" + episodes_str + "\n"
        + tone_section +
        "CURRENT SESSION TRANSCRIPT (L1):\n" + transcript_context + "\n\n"
        "Based on the current conversation, historical context, and vocal tone analysis (if available), "
        "provide the following:\n"
        "1. A brief sentiment/tone assessment of the patient's current state, considering BOTH what they said AND how they said it. "
        "If affect incongruence is detected, explicitly note the mismatch and what it might indicate clinically.\n"
        "2. Suggest 2-3 highly relevant, clinically sound questions or responses for the coach/therapist.\n\n"
        "Format the output strictly as follows:\n"
        "- The very first line of your response MUST be exactly one of the following tags: `[LOW]`, `[MODERATE]`, `[HIGH]`, or `[CRISIS]`. Do not include any prefix like 'Risk Tier:' or 'RISK TIER:' before the tag.\n"
        "- Follow it with a one-line sentiment/tone summary (e.g., 'Patient presents flat affect despite verbalizing hope — possible anhedonia').\n"
        "- Then 2-3 suggested coach questions/statements in bullet points.\n"
        "- Keep suggestions concise, direct, and tailored to the current context, historical core wounds/themes, and vocal delivery."
    )
    
    # 3. Execute main analysis Agent
    model = get_litellm_model()
    analysis_agent = Agent(
        model=model,
        system_prompt="You are a clinical psychiatric assistant."
    )
    
    response = await analysis_agent.invoke_async(prompt)
    return str(response).strip()
