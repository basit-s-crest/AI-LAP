import json
import logging
from strands import Agent
from app.modules.rag.agent import get_litellm_model

logger = logging.getLogger(__name__)

CRISIS_KEYWORDS = ["suicide", "kill", "harm", "die", "end my life", "end it all", "self-harm", "cutting", "overdose"]

def parse_llm_json(response_text: str) -> dict:
    """Parses LLM response, stripping markdown wrappers if present."""
    text = response_text.strip()
    if text.startswith("```"):
        # strip opening block
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    
    # Try to load JSON
    try:
        return json.loads(text)
    except Exception as e:
        logger.error(f"[ChangeDetection] JSON parsing failed: {e}. Raw response: {response_text}")
        # Return fallback structured dict
        return {
            "summary": "Unable to parse comparison results.",
            "improvements": [],
            "concerns": [{"area": "Parsing Error", "details": "The LLM response could not be parsed into JSON."}],
            "goals": [],
            "behavioralPatterns": [],
            "safetyFlags": []
        }

async def run_session_comparison(note_a: dict, note_b: dict) -> dict:
    """
    Orchestrates session comparison using strands Agent and LiteLLM model.
    Applies the custom risk and safety classifier logic to identify alerts.
    """
    model = get_litellm_model()
    
    prompt = (
        "You are an expert psychiatric AI assistant analyzing progress and changes between two mental health coaching sessions.\n"
        "Compare the following two session notes (Note A is the older session, Note B is the newer session).\n\n"
        "NOTE A (Older Session):\n"
        f"- Summary: {note_a.get('summary', '')}\n"
        f"- Key Themes: {', '.join(note_a.get('keyThemes', []))}\n"
        f"- Sentiment: {note_a.get('sentiment', 'Neutral')}\n"
        f"- Coach Observations: {note_a.get('coachObservations', '')}\n"
        f"- Recommended Follow-Up: {note_a.get('recommendedFollowUp', '')}\n\n"
        "NOTE B (Newer Session):\n"
        f"- Summary: {note_b.get('summary', '')}\n"
        f"- Key Themes: {', '.join(note_b.get('keyThemes', []))}\n"
        f"- Sentiment: {note_b.get('sentiment', 'Neutral')}\n"
        f"- Coach Observations: {note_b.get('coachObservations', '')}\n"
        f"- Recommended Follow-Up: {note_b.get('recommendedFollowUp', '')}\n\n"
        "Tasks:\n"
        "1. Extract narrative summary of changes (progress, mood changes, overall trajectory).\n"
        "2. Extract improvements: areas where the member has progressed or shown positive change (list of { \"area\": string, \"details\": string }).\n"
        "3. Extract concerns: areas where the member is experiencing worsening symptoms, new struggles, or setbacks (list of { \"area\": string, \"details\": string }).\n"
        "4. Track goals: changes or progress regarding recommended follow-up goals (list of { \"goal\": string, \"progress\": string }).\n"
        "5. Extract behavioral patterns: any recurring or shifting patterns of behavior/thought (list of strings).\n"
        "6. Extract safety flags: any indicators of self-harm, suicidal ideation, severe hopelessness, panic, or crisis language (list of { \"flag\": string, \"reason\": string }).\n\n"
        "You MUST respond with a VALID JSON object matching the following structure exactly, without any extra text or markdown formatting:\n"
        "{\n"
        "  \"summary\": \"overall narrative comparison...\",\n"
        "  \"improvements\": [{\"area\": \"...\", \"details\": \"...\"}],\n"
        "  \"concerns\": [{\"area\": \"...\", \"details\": \"...\"}],\n"
        "  \"goals\": [{\"goal\": \"...\", \"progress\": \"...\"}],\n"
        "  \"behavioralPatterns\": [\"...\", \"...\"],\n"
        "  \"safetyFlags\": [{\"flag\": \"...\", \"reason\": \"...\"}]\n"
        "}"
    )

    agent = Agent(
        model=model,
        system_prompt="You are a clinical change detection assistant. You always respond in raw JSON format."
    )

    logger.info("[ChangeDetection] Invoking LLM for session comparison...")
    response = await agent.invoke_async(prompt)
    result_text = str(response)
    
    parsed_result = parse_llm_json(result_text)
    
    # ─── Dedicated Risk & Safety Classifier ───
    safety_flags = parsed_result.get("safetyFlags", [])
    has_safety_alert = len(safety_flags) > 0
    
    # Keyword-based verification on Note B content (double-check safety triggers)
    note_b_full_text = (
        f"{note_b.get('summary', '')} {note_b.get('coachObservations', '')} "
        f"{note_b.get('recommendedFollowUp', '')}"
    ).lower()
    
    triggered_keywords = [kw for kw in CRISIS_KEYWORDS if kw in note_b_full_text]
    if triggered_keywords:
        has_safety_alert = True
        # Ensure it is logged as a safety flag if not already identified
        flag_exists = any(
            kw in (flag.get("flag", "") + flag.get("reason", "")).lower()
            for flag in safety_flags
            for kw in triggered_keywords
        )
        if not flag_exists:
            safety_flags.append({
                "flag": "Potential Crisis Language",
                "reason": f"Detected crisis-related language in session content: {', '.join(triggered_keywords)}"
            })
            parsed_result["safetyFlags"] = safety_flags

    parsed_result["hasSafetyAlert"] = has_safety_alert
    return parsed_result
