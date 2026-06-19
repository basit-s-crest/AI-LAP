import os
import logging
import asyncio
import json
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

async def summarize_episode_loop(engine: "LiveMeetingAnalysisEngine", session_id: str, member_id: str):
    """
    Loop that runs every 2 minutes for active sessions, drains the raw L1 buffer,
    summarizes it using the LLM, and inserts it into the session_live_episodes table.
    """
    logger.info(f"[L2 Summarizer] Starting loop for session {session_id}, member {member_id}")
    episode_index = 0
    
    # Check interval (default 2 minutes / 120 seconds)
    # We can read this from environment or default
    interval = int(os.getenv("L2_SUMMARY_INTERVAL_SECONDS", "120"))
    
    try:
        while True:
            await asyncio.sleep(interval)
            
            # Retrieve session buffer from engine
            async with engine._engine_lock:
                buf = engine._buffers.get(session_id)
                if not buf:
                    logger.info(f"[L2 Summarizer] Session {session_id} is no longer active. Exiting loop.")
                    break
                working_buffer = buf.get("working_buffer")
                if not working_buffer:
                    logger.warning(f"[L2 Summarizer] Working buffer not found for session {session_id}. Exiting loop.")
                    break
            
            raw_text = await working_buffer.get_text()
            word_count = len(raw_text.split())
            if word_count < 20:
                logger.debug(f"[L2 Summarizer] Skipping summary for session {session_id}: only {word_count} words in L1 buffer.")
                continue
                
            client = engine._get_api_client()
            if not client:
                logger.warning("[L2 Summarizer] No active LLM client. Skipping this tick.")
                continue
                
            logger.info(f"[L2 Summarizer] Summarizing episode {episode_index} for session {session_id} ({word_count} words)...")
            
            prompt = (
                "Compress this 2-minute therapy session transcript into "
                "3-4 sentences. Preserve emotional tone, key themes, "
                "unresolved statements, and patient self-disclosure. Discard filler "
                "and repetition.\n\nTRANSCRIPT:\n" + raw_text
            )
            
            try:
                # Summarize
                response = await client.chat.completions.create(
                    model=engine._model,
                    messages=[
                        {"role": "system", "content": "You are a clinical psychiatric assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    max_tokens=250
                )
                summary = response.choices[0].message.content.strip()
                
                # Classify sentiment/themes
                sentiment, themes = await classify_episode(client, engine._model, summary)
                
                # Save to Database
                async with AsyncSessionLocal() as db:
                    # Set contextual credentials for audit log trigger
                    await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": member_id})
                    await db.execute(text("SELECT set_config('app.current_user_role', :role, true)"), {"role": "system"})
                    
                    await db.execute(text("""
                        INSERT INTO public.session_live_episodes (session_id, member_id, episode_index, summary, sentiment, themes)
                        VALUES (:session_id, :member_id, :episode_index, :summary, :sentiment, :themes)
                    """), {
                        "session_id": session_id,
                        "member_id": member_id,
                        "episode_index": episode_index,
                        "summary": summary,
                        "sentiment": sentiment,
                        "themes": themes
                    })
                    await db.commit()
                    
                logger.info(f"[L2 Summarizer] Successfully saved episode {episode_index} for session {session_id}")
                episode_index += 1
                
            except Exception as e:
                logger.error(f"[L2 Summarizer] Error during L2 summarization execution: {e}")
                
    except asyncio.CancelledError:
        logger.info(f"[L2 Summarizer] Loop cancelled for session {session_id}")
    except Exception as e:
        logger.error(f"[L2 Summarizer] Unexpected error in loop: {e}")

async def classify_episode(client, model: str, summary: str) -> tuple[str, list]:
    """Helper to classify clinical sentiment and themes of an episode."""
    prompt = (
        "Analyze this 2-minute clinical summary. Output a JSON object with two fields:\n"
        "1. 'sentiment': either 'CRISIS', 'HIGH', 'MEDIUM', or 'LOW'\n"
        "2. 'themes': a JSON list of key mental health themes (e.g. ['anxiety', 'school-stress'])\n\n"
        "CRITICAL: If there is self-harm, suicidal, or homicidal intent, sentiment MUST be CRISIS.\n"
        f"SUMMARY:\n{summary}"
    )
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=150,
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content.strip())
        sentiment = data.get("sentiment", "LOW").upper()
        if sentiment not in ("CRISIS", "HIGH", "MEDIUM", "LOW"):
            sentiment = "LOW"
        themes = data.get("themes", [])
        return sentiment, themes
    except Exception as e:
        logger.warning(f"[L2 Summarizer] Failed to classify sentiment/themes, falling back to defaults: {e}")
        return "LOW", []

from app.modules.rag.embedder import get_embedding

def get_llm_client_and_model():
    from openai import AsyncOpenAI
    from app.modules.session_analysis.llm import _get_client as get_fallback_client
    
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip().strip("'\"")
    if groq_api_key:
        model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip().strip("'\"")
        client = AsyncOpenAI(
            api_key=groq_api_key,
            base_url="https://api.groq.com/openai/v1"
        )
    else:
        client = get_fallback_client()
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENROUTER_API_KEY") or ""
        api_key = api_key.strip().strip("'\"")
        if api_key.startswith("AIzaSy"):
            model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip().strip("'\"")
        else:
            model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001").strip().strip("'\"")
    return client, model

async def extract_significant_events(session_id: str):
    """
    Retrieves all L2 episodes for a completed session, uses an LLM to identify
    significant memory events (breakthroughs, disclosures, turning points, risk signals),
    computes narrative vector embeddings, encrypts narrative text, and writes to database.
    """
    logger.info(f"[L3a Extractor] Starting significant event extraction for session {session_id}")
    from app.shared.encryption import encrypt_phi
    
    async with AsyncSessionLocal() as db:
        # Get session details
        res = await db.execute(text("""
            SELECT "coachId", "memberId", "scheduledAt"
            FROM public."Session"
            WHERE id = :session_id
        """), {"session_id": session_id})
        session_row = res.fetchone()
        if not session_row:
            logger.error(f"[L3a Extractor] Session {session_id} not found.")
            return
        
        coach_id, member_id, scheduled_at = session_row
        session_date = scheduled_at.date()
        
        # Get session number (count completed sessions for this member up to this scheduled_at)
        res = await db.execute(text("""
            SELECT COUNT(*)
            FROM public."Session"
            WHERE "memberId" = :member_id
              AND status = 'completed'
              AND "scheduledAt" <= :scheduled_at
        """), {"member_id": member_id, "scheduled_at": scheduled_at})
        session_number = res.scalar() or 0
        session_number = max(1, session_number)
        
        # Get L2 summaries
        res = await db.execute(text("""
            SELECT summary, sentiment, themes
            FROM public.session_live_episodes
            WHERE session_id = :session_id
            ORDER BY episode_index ASC
        """), {"session_id": session_id})
        episodes = res.fetchall()
        if not episodes:
            logger.warning(f"[L3a Extractor] No live episodes found for session {session_id}. Skipping extraction.")
            return

        episodes_text = ""
        for idx, ep in enumerate(episodes):
            episodes_text += f"\nEpisode {idx}:\nSummary: {ep[0]}\nSentiment: {ep[1]}\nThemes: {', '.join(ep[2])}\n"
        
        prompt = (
            "You are an AI clinical psychiatric assistant analyzing a completed therapy session. "
            "Review the chronological 2-minute episode summaries below and extract any clinically "
            "significant events that occurred. Specifically, identify events in the following categories:\n"
            "- BREAKTHROUGH: realized insights, sudden changes in perspective, breakthroughs in understanding.\n"
            "- DISCLOSURE: major confessions, details about life, relationship issues, past traumas.\n"
            "- TURNING_POINT: major decisions, commitments to action/coping strategies, active changes.\n"
            "- RISK_SIGNAL: self-harm, suicide mentions, severe depressive symptoms, safety/crisis indicators.\n\n"
            "Format your output as a JSON object containing a key 'events' which is an array of objects. "
            "Each object must have the following fields:\n"
            "- 'category': 'BREAKTHROUGH' | 'DISCLOSURE' | 'TURNING_POINT' | 'RISK_SIGNAL'\n"
            "- 'narrative': A clear 2-3 sentence narrative describing the event, what happened, and its clinical context.\n"
            "- 'raw_quote': A direct or close quote/phrase from the patient representing this event (or null/empty if not present).\n"
            "- 'emotional_valence': 'POSITIVE' | 'NEGATIVE' | 'AMBIVALENT'\n"
            "- 'significance_score': A float from 1.0 (lowest significance) to 10.0 (highest significance).\n"
            "- 'themes': A JSON array of string themes for the event (e.g. ['anxiety', 'family-conflict']).\n\n"
            "If no significant events occurred in the session, return an empty array `[]` for the 'events' key.\n"
            "Ensure the output is valid JSON.\n\n"
            "EPISODES:\n" + episodes_text
        )
        
        client, model = get_llm_client_and_model()
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content.strip()
            data = json.loads(content)
            events = data.get("events", [])
        except Exception as e:
            logger.error(f"[L3a Extractor] LLM event extraction failed: {e}")
            return
            
        if not events:
            logger.info(f"[L3a Extractor] No significant events extracted for session {session_id}")
            return
            
        logger.info(f"[L3a Extractor] Extracted {len(events)} significant events. Encrypting and saving...")
        
        # Set contextual credentials for audit log trigger
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": member_id})
        await db.execute(text("SELECT set_config('app.current_user_role', :role, true)"), {"role": "system"})
        
        for event in events:
            narrative = event.get("narrative", "").strip()
            if not narrative:
                continue
            
            raw_quote = event.get("raw_quote", "")
            if raw_quote is None:
                raw_quote = ""
            raw_quote = raw_quote.strip()
            
            # Encrypt narrative and raw quote
            narrative_encrypted = await encrypt_phi(db, narrative)
            raw_quote_encrypted = await encrypt_phi(db, raw_quote) if raw_quote else None
            
            # Generate embedding
            embedding = get_embedding(narrative)
            
            # Insert event
            await db.execute(text("""
                INSERT INTO public.member_memory_events (
                    member_id, session_id, coach_id, session_number, session_date,
                    category, narrative_encrypted, raw_quote_encrypted,
                    emotional_valence, significance_score, themes, embedding
                ) VALUES (
                    :member_id, :session_id, :coach_id, :session_number, :session_date,
                    :category, :narrative_encrypted, :raw_quote_encrypted,
                    :emotional_valence, :significance_score, :themes, :embedding
                )
            """), {
                "member_id": member_id,
                "session_id": session_id,
                "coach_id": coach_id,
                "session_number": session_number,
                "session_date": session_date,
                "category": event["category"],
                "narrative_encrypted": narrative_encrypted,
                "raw_quote_encrypted": raw_quote_encrypted,
                "emotional_valence": event.get("emotional_valence"),
                "significance_score": float(event.get("significance_score", 5.0)),
                "themes": event.get("themes", []),
                "embedding": embedding
            })
            
        await db.commit()
        logger.info(f"[L3a Extractor] Successfully saved all significant events for session {session_id}")


async def recompute_member_profile(member_id: str):
    """
    Loads all historical memory events for a member, decrypts them,
    passes them to the LLM to synthesize presenting conditions, core wounds,
    recurring themes, progress markers, risk flags, unresolved threads,
    and risk levels. Performs an upsert on member_longitudinal_profile.
    """
    logger.info(f"[L3b Profile] Starting profile rollup for member {member_id}")
    
    async with AsyncSessionLocal() as db:
        # Get total completed sessions and last session date and coach_id
        res = await db.execute(text("""
            SELECT "coachId", "scheduledAt"
            FROM public."Session"
            WHERE "memberId" = :member_id AND status = 'completed'
            ORDER BY "scheduledAt" DESC
            LIMIT 1
        """), {"member_id": member_id})
        latest_session_row = res.fetchone()
        if not latest_session_row:
            logger.warning(f"[L3b Profile] No completed sessions found for member {member_id}. Skipping profile rollup.")
            return
            
        coach_id, last_session_dt = latest_session_row
        last_session_date = last_session_dt.date() if last_session_dt else None
        
        res = await db.execute(text("""
            SELECT COUNT(*)
            FROM public."Session"
            WHERE "memberId" = :member_id AND status = 'completed'
        """), {"member_id": member_id})
        total_sessions = res.scalar() or 0

        # Get memory events
        res = await db.execute(text("""
            SELECT id, category, narrative_encrypted, significance_score, themes, session_date
            FROM public.member_memory_events
            WHERE member_id = :member_id AND deleted_at IS NULL
            ORDER BY session_date ASC, created_at ASC
        """), {"member_id": member_id})
        event_rows = res.fetchall()
        
        if not event_rows:
            logger.info(f"[L3b Profile] No memory events found for member {member_id}. Skipping LLM aggregation.")
            return

        from app.shared.encryption import decrypt_phi
        events_list = []
        for idx, row in enumerate(event_rows):
            ev_id, category, narrative_enc, score, themes, session_date = row
            try:
                decrypted_narrative = await decrypt_phi(db, narrative_enc)
                events_list.append({
                    "date": str(session_date),
                    "category": category,
                    "score": score,
                    "themes": themes,
                    "narrative": decrypted_narrative
                })
            except Exception as e:
                logger.error(f"[L3b Profile] Failed to decrypt memory event {ev_id}: {e}")

        events_text = ""
        for idx, ev in enumerate(events_list):
            events_text += (
                f"\nEvent {idx} (Date: {ev['date']}, Category: {ev['category']}, Significance Score: {ev['score']}):\n"
                f"Narrative: {ev['narrative']}\n"
                f"Themes: {', '.join(ev['themes'])}\n"
            )

        client, model = get_llm_client_and_model()
        try:
            prompt = (
                "You are a senior clinical psychologist updating a patient's longitudinal profile based on their clinical memory events.\n"
                "Analyze the following list of historical clinical events extracted from their therapy sessions. Each event has a category, significance score, themes, and a decrypted narrative summary.\n\n"
                "HISTORICAL EVENTS:\n" + events_text + "\n\n"
                "Compile an updated clinical summary. You must respond with a JSON object matching this exact schema:\n"
                "- 'presenting_conditions': JSON list of strings representing the primary clinical presenting conditions (e.g. ['anxiety', 'mild-depression']).\n"
                "- 'core_wounds': JSON list of strings representing deep core psychological wounds or vulnerabilities identified (e.g. ['fear-of-failure', 'abandonment']).\n"
                "- 'recurring_themes': JSON list of strings representing persistent session themes (e.g. ['school-stress', 'boundary-setting']).\n"
                "- 'progress_markers': JSON list of strings representing concrete markers of clinical progress or positive change (e.g. ['insight-into-vulnerability', 'active-boundary-setting']).\n"
                "- 'risk_flags': JSON list of strings representing active safety or clinical risks (e.g. ['high-exam-stress', 'self-harm-ideation']).\n"
                "- 'unresolved_threads': JSON list of strings representing unresolved topics or ongoing struggles (e.g. ['parental-expectations', 'workload-management']).\n"
                "- 'overall_progress_score': A float/integer from 0.0 (no progress) to 100.0 (maximum recovery).\n"
                "- 'current_risk_tier': 'low' | 'medium' | 'high' | 'crisis'\n"
                "- 'risk_trend': 'improving' | 'stable' | 'worsening'\n\n"
                "Ensure the response is valid JSON."
            )
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content.strip()
            profile_data = json.loads(content)
        except Exception as e:
            logger.error(f"[L3b Profile] LLM profile synthesis failed: {e}")
            return

        # Set contextual credentials for audit log trigger
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": member_id})
        await db.execute(text("SELECT set_config('app.current_user_role', :role, true)"), {"role": "system"})
        
        # We check if profile exists to determine whether we insert or update
        res = await db.execute(text("""
            SELECT id FROM public.member_longitudinal_profile
            WHERE member_id = :member_id
        """), {"member_id": member_id})
        existing_profile = res.fetchone()
        
        # Sanitize risk tier
        risk_tier = profile_data.get("current_risk_tier", "low").lower()
        if risk_tier not in ("low", "medium", "high", "crisis"):
            risk_tier = "low"
            
        params = {
            "member_id": member_id,
            "coach_id": coach_id,
            "presenting_conditions": profile_data.get("presenting_conditions", []),
            "core_wounds": profile_data.get("core_wounds", []),
            "recurring_themes": profile_data.get("recurring_themes", []),
            "progress_markers": profile_data.get("progress_markers", []),
            "risk_flags": profile_data.get("risk_flags", []),
            "unresolved_threads": profile_data.get("unresolved_threads", []),
            "overall_progress_score": float(profile_data.get("overall_progress_score", 50.0)),
            "current_risk_tier": risk_tier,
            "risk_trend": profile_data.get("risk_trend", "stable"),
            "total_sessions": total_sessions,
            "last_session_date": last_session_date
        }
        
        if existing_profile:
            await db.execute(text("""
                UPDATE public.member_longitudinal_profile
                SET coach_id = :coach_id,
                    presenting_conditions = :presenting_conditions,
                    core_wounds = :core_wounds,
                    recurring_themes = :recurring_themes,
                    progress_markers = :progress_markers,
                    risk_flags = :risk_flags,
                    unresolved_threads = :unresolved_threads,
                    overall_progress_score = :overall_progress_score,
                    current_risk_tier = :current_risk_tier,
                    risk_trend = :risk_trend,
                    total_sessions = :total_sessions,
                    last_session_date = :last_session_date,
                    last_updated = now()
                WHERE member_id = :member_id
            """), params)
        else:
            await db.execute(text("""
                INSERT INTO public.member_longitudinal_profile (
                    member_id, coach_id, presenting_conditions, core_wounds,
                    recurring_themes, progress_markers, risk_flags, unresolved_threads,
                    overall_progress_score, current_risk_tier, risk_trend,
                    total_sessions, last_session_date
                ) VALUES (
                    :member_id, :coach_id, :presenting_conditions, :core_wounds,
                    :recurring_themes, :progress_markers, :risk_flags, :unresolved_threads,
                    :overall_progress_score, :current_risk_tier, :risk_trend,
                    :total_sessions, :last_session_date
                )
            """), params)
            
        await db.commit()
        logger.info(f"[L3b Profile] Successfully recomputed and saved longitudinal profile for member {member_id}")


