import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.shared.encryption import decrypt_phi

logger = logging.getLogger(__name__)

async def get_patient_profile(db: AsyncSession, member_id: str) -> dict:
    """
    Retrieves the patient's longitudinal profile from the database.
    Also records an audit log entry in phi_access_log.
    """
    try:
        # Set contextual credentials for audit log trigger
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": member_id})
        await db.execute(text("SELECT set_config('app.current_user_role', :role, true)"), {"role": "system"})
        
        # Log SELECT/READ audit log entry for member_longitudinal_profile
        await db.execute(text("""
            INSERT INTO public.phi_access_log (actor_id, actor_role, action, resource_table, resource_id, patient_id)
            VALUES ('system', 'system', 'READ', 'member_longitudinal_profile', :patient_id, :patient_id)
        """), {"patient_id": member_id})
        
        res = await db.execute(text("""
            SELECT presenting_conditions, core_wounds, recurring_themes, progress_markers, risk_flags, unresolved_threads, overall_progress_score, current_risk_tier
            FROM public.member_longitudinal_profile
            WHERE member_id = :member_id
        """), {"member_id": member_id})
        row = res.fetchone()
        if row:
            conditions, wounds, recurring, progress, risk, unresolved, score, risk_tier = row
            return {
                "presenting_conditions": conditions,
                "core_wounds": wounds,
                "recurring_themes": recurring,
                "progress_markers": progress,
                "risk_flags": risk,
                "unresolved_threads": unresolved,
                "overall_progress_score": score,
                "current_risk_tier": risk_tier
            }
    except Exception as e:
        logger.error(f"[RAG Retriever] Error fetching patient profile: {e}")
    return {}

async def get_relevant_memory_events(
    db: AsyncSession, 
    member_id: str, 
    query_vector: list[float], 
    threshold: float = 0.38, 
    limit: int = 3
) -> list[dict]:
    """
    Performs vector similarity search on member_memory_events.
    Also records an audit log entry in phi_access_log.
    """
    decrypted_events = []
    try:
        # Set contextual credentials for audit log trigger
        await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": member_id})
        await db.execute(text("SELECT set_config('app.current_user_role', :role, true)"), {"role": "system"})
        
        # Log SELECT/READ audit log entry for member_memory_events
        await db.execute(text("""
            INSERT INTO public.phi_access_log (actor_id, actor_role, action, resource_table, resource_id, patient_id)
            VALUES ('system', 'system', 'READ', 'member_memory_events', 'multiple', :patient_id)
        """), {"patient_id": member_id})
        
        res = await db.execute(text("""
            SELECT id, category, narrative_encrypted, raw_quote_encrypted, significance_score, themes,
                   (1 - (embedding <=> CAST(:query_vector AS vector))) AS similarity
            FROM public.member_memory_events
            WHERE member_id = :member_id 
              AND deleted_at IS NULL
              AND (1 - (embedding <=> CAST(:query_vector AS vector))) > :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """), {
            "member_id": member_id,
            "query_vector": str(query_vector),
            "threshold": threshold,
            "limit": limit
        })
        rows = res.fetchall()
        
        for row in rows:
            ev_id, category, narrative_enc, raw_quote_enc, score, themes, similarity = row
            try:
                decrypted_narrative = await decrypt_phi(db, narrative_enc)
                decrypted_quote = await decrypt_phi(db, raw_quote_enc) if raw_quote_enc else ""
                decrypted_events.append({
                    "category": category,
                    "narrative": decrypted_narrative,
                    "raw_quote": decrypted_quote,
                    "similarity": similarity
                })
            except Exception as e:
                logger.error(f"[RAG Retriever] Decryption error for event {ev_id}: {e}")
    except Exception as e:
        logger.error(f"[RAG Retriever] Error performing vector search: {e}")
    return decrypted_events

async def get_recent_episodes(db: AsyncSession, session_id: str, limit: int = 3) -> list[dict]:
    """
    Retrieves recent L2 episodes from session_live_episodes.
    """
    episodes = []
    try:
        res = await db.execute(text("""
            SELECT summary, sentiment, themes
            FROM public.session_live_episodes
            WHERE session_id = :session_id
            ORDER BY episode_index DESC
            LIMIT :limit
        """), {"session_id": session_id, "limit": limit})
        rows = res.fetchall()
        for row in rows:
            episodes.append({
                "summary": row[0],
                "sentiment": row[1],
                "themes": row[2]
            })
    except Exception as e:
        logger.error(f"[RAG Retriever] Error fetching recent episodes: {e}")
    return episodes
