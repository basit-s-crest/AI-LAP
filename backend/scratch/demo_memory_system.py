import os
import sys
import asyncio
import time
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import text

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.core.database import AsyncSessionLocal
from app.modules.live_analysis.live_analysis import WorkingBuffer
from app.modules.live_analysis.memory_tasks import classify_episode, extract_significant_events, recompute_member_profile, get_llm_client_and_model
from app.modules.rag.retriever import get_patient_profile, get_relevant_memory_events, get_recent_episodes
from app.modules.rag.embedder import get_embedding
from app.shared.encryption import decrypt_phi
from strands import Agent

load_dotenv()

async def main():
    print("=" * 70)
    print("DEMONSTRATION: 3-LAYER CLINICAL MEMORY SYSTEM & SEMANTIC RETRIEVAL")
    print("=" * 70)

    member_id = "cmp29zx640000111oybng3kz4"
    coach_id = "cmp3zxunj000011gzs9sp7mvf"
    session_id = f"demo-session-{int(time.time())}"

    print(f"\n[Setup] Creating simulated active session: {session_id}")
    print(f"[Setup] Member ID: {member_id} | Coach ID: {coach_id}")

    async with AsyncSessionLocal() as db:
        # Create session row
        await db.execute(text("""
            INSERT INTO public."Session" (id, "coachId", "memberId", "scheduledAt", duration, type, status, "createdAt", "updatedAt")
            VALUES (:session_id, :coach_id, :member_id, :scheduled_at, 50, 'Weekly Check-in', 'active', now(), now())
        """), {
            "session_id": session_id,
            "coach_id": coach_id,
            "member_id": member_id,
            "scheduled_at": datetime.now()
        })
        await db.commit()

    try:
        # ----------------------------------------------------
        # 1. LAYER 1: WORKING BUFFER (IN-MEMORY)
        # ----------------------------------------------------
        print("\n--- 1. LAYER 1: WORKING BUFFER (In-Memory, last 60s) ---")
        buffer = WorkingBuffer(window_seconds=60)
        
        simulated_transcript = [
            "I've been feeling extremely stressed about my exams lately.",
            "My parents have very high expectations, and I'm terrified of letting them down.",
            "Honestly, sometimes I just want to push everyone away and isolate before they reject me."
        ]
        
        for line in simulated_transcript:
            print(f"  [Transcribing] Client: \"{line}\"")
            await buffer.add(line)
            
        l1_text = await buffer.get_text()
        print(f"  [L1 Output] Retained buffer content:\n    => \"{l1_text}\"")

        # ----------------------------------------------------
        # 2. LAYER 2: SESSION EPISODIC MEMORY (CHRONOLOGICAL SQL)
        # ----------------------------------------------------
        print("\n--- 2. LAYER 2: SESSION EPISODIC MEMORY (Chronological SQL) ---")
        client, model = get_llm_client_and_model()
        print(f"  [L2 Summarizing] Generating 2-minute episode summary using {model}...")
        
        prompt = (
            "Compress this 2-minute therapy session transcript into "
            "3-4 sentences. Preserve emotional tone, key themes, "
            "unresolved statements, and patient self-disclosure. Discard filler "
            "and repetition.\n\nTRANSCRIPT:\n" + l1_text
        )
        
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a clinical psychiatric assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=250
        )
        summary = response.choices[0].message.content.strip()
        print(f"  [L2 Summary] {summary}")
        
        print("  [L2 Classifying] Determining sentiment and themes...")
        sentiment, themes = await classify_episode(client, model, summary)
        print(f"    Sentiment: {sentiment} | Themes: {themes}")

        # Save to Database
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": member_id})
            await db.execute(text("SELECT set_config('app.current_user_role', :role, true)"), {"role": "system"})
            
            await db.execute(text("""
                INSERT INTO public.session_live_episodes (session_id, member_id, episode_index, summary, sentiment, themes)
                VALUES (:session_id, :member_id, 0, :summary, :sentiment, :themes)
            """), {
                "session_id": session_id,
                "member_id": member_id,
                "summary": summary,
                "sentiment": sentiment,
                "themes": themes
            })
            await db.commit()
        print("  [L2 Save] Saved episode 0 to public.session_live_episodes.")

        # ----------------------------------------------------
        # 3. LAYER 3A: SIGNIFICANT EVENT STORE (VECTOR DATABASE)
        # ----------------------------------------------------
        print("\n--- 3. LAYER 3A: SIGNIFICANT EVENT STORE (pgvector + Encryption) ---")
        print("  [Session Complete] Completing session and launching L3 extraction pipeline...")
        
        async with AsyncSessionLocal() as db:
            await db.execute(text("""
                UPDATE public."Session"
                SET status = 'completed', "updatedAt" = now()
                WHERE id = :session_id
            """), {"session_id": session_id})
            await db.commit()

        # Run extraction task
        await extract_significant_events(session_id)
        
        # Verify and fetch saved event
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": member_id})
            await db.execute(text("SELECT set_config('app.current_user_role', :role, true)"), {"role": "system"})
            
            res = await db.execute(text("""
                SELECT id, category, narrative_encrypted, emotional_valence, significance_score, themes, embedding
                FROM public.member_memory_events
                WHERE session_id = :session_id
            """), {"session_id": session_id})
            
            events = res.fetchall()
            print(f"  [L3a Verification] Extracted {len(events)} events from the database.")
            for row in events:
                ev_id, cat, narr_enc, val, score, th, emb = row
                narr_dec = await decrypt_phi(db, narr_enc)
                print(f"    - Category: {cat}")
                print(f"    - Narrative (Decrypted): \"{narr_dec}\"")
                print(f"    - Significance Score: {score}/10")
                print(f"    - Themes: {th}")
                # embedding preview
                emb_dim = len(emb) if emb else 0
                emb_preview = emb[:3] if emb else []
                print(f"    - Vector Embedding Dimension: {emb_dim} (bge-small-en-v1.5)")
                print(f"    - Vector Preview: {emb_preview}...")

        # ----------------------------------------------------
        # 4. LAYER 3B: LONGITUDINAL PROFILE (STRUCTURED ROLLUP)
        # ----------------------------------------------------
        print("\n--- 4. LAYER 3B: LONGITUDINAL PROFILE (Synthesized Rollup) ---")
        print("  [L3b Rollup] Synthesizing client longitudinal profile...")
        await recompute_member_profile(member_id)
        
        async with AsyncSessionLocal() as db:
            profile = await get_patient_profile(db, member_id)
            print("  [L3b Output] Synthesized Profile:")
            print(f"    - Core Wounds: {profile.get('core_wounds')}")
            print(f"    - Presenting Conditions: {profile.get('presenting_conditions')}")
            print(f"    - Recurring Themes: {profile.get('recurring_themes')}")
            print(f"    - Risk flags: {profile.get('risk_flags')}")
            print(f"    - Progress score: {profile.get('overall_progress_score')}/100")
            print(f"    - Risk tier: {profile.get('current_risk_tier')}")

        # ----------------------------------------------------
        # 5. LIVE RAG RETRIEVAL & CLOSING THE LOOP
        # ----------------------------------------------------
        print("\n--- 5. SIMULATING A NEW SESSION (Live RAG retrieval) ---")
        session_id_rag = f"demo-session-rag-{int(time.time())}"
        print(f"  [Start New Session] Session ID: {session_id_rag}")
        
        # New live speech window
        new_speech = "I got a bad grade on my math pop quiz today. I'm so scared to tell my parents."
        print(f"  [L1 Live Ingestion] Client: \"{new_speech}\"")
        
        # Build search query
        from app.modules.rag.agent import get_litellm_model
        model_obj = get_litellm_model()
        topic_agent = Agent(
            model=model_obj,
            system_prompt=(
                "You are an AI psychiatric assistant. Analyze the transcript snippet of the current mental health coaching session "
                "and extract the main psychological concern, feeling, or struggle mentioned by the patient. "
                "Output exactly a single sentence or keyword phrase describing this topic to be used for semantic search (RAG)."
            )
        )
        search_query = topic_agent(f"TRANSCRIPT SNIPPET:\n{new_speech}")
        search_query = str(search_query).strip()
        print(f"  [RAG Query Generated] \"{search_query}\"")
        
        # Compute vector and query DB
        print("  [RAG Vector Search] Fetching relevant historical events using pgvector (1 - cosine distance)...")
        query_vector = get_embedding(search_query)
        
        async with AsyncSessionLocal() as db:
            matched_events = await get_relevant_memory_events(db, member_id, query_vector)
            print(f"  [RAG Search Output] Found {len(matched_events)} matching historical events:")
            for idx, ev in enumerate(matched_events):
                print(f"    {idx+1}. [{ev['category']}] (Similarity: {ev['similarity']:.2f})")
                print(f"       Narrative: \"{ev['narrative']}\"")
                
            # Build prompts
            from app.modules.rag.agent import run_rag_analysis
            print("\n  [RAG Suggested Questions] Invoking RAG Agent with L1 + L2 + L3 context...")
            suggested_output = await run_rag_analysis(
                db=db,
                session_id=session_id_rag,
                member_id=member_id,
                recent_lines=[f"Client: {new_speech}"],
                working_buffer_text=new_speech
            )
            print(f"\n--- RAG DECISION & SUGGESTIONS FOR THE COACH ---\n{suggested_output}\n")

    except Exception as e:
        print(f"\n[Error] Exception during simulation: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        # Cleanup
        print("--- CLEANUP ---")
        async with AsyncSessionLocal() as db:
            print(f"  [Cleanup] Soft-deleting memory events for session {session_id}...")
            await db.execute(text("""
                UPDATE public.member_memory_events
                SET deleted_at = now()
                WHERE session_id = :session_id
            """), {"session_id": session_id})
            
            print(f"  [Cleanup] Deleting session live episodes for session {session_id}...")
            await db.execute(text("DELETE FROM public.session_live_episodes WHERE session_id = :session_id"), {"session_id": session_id})
            
            print(f"  [Cleanup] Deleting simulated sessions...")
            await db.execute(text('DELETE FROM public."Session" WHERE id IN (:s1, :s2)'), {"s1": session_id, "s2": session_id_rag})
            await db.commit()
        print("  [Cleanup Complete] Database restored to original state.")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
