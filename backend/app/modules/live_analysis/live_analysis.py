import os
import logging
import asyncio
import time
from collections import deque
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
from app.modules.session_analysis.llm import _get_client as get_fallback_client
from app.modules.live_analysis.tone_analyzer import ToneSnapshot
from app.modules.live_video_analysis import get_session_wide_aggregation

logger = logging.getLogger(__name__)

class WorkingBuffer:
    """Rolling window of raw transcribed speech held in application memory (L1)."""
    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        self.chunks: deque[tuple[float, str]] = deque()
        self.lock = asyncio.Lock()

    async def add(self, text: str):
        async with self.lock:
            self.chunks.append((time.time(), text))
            self._evict_old()

    def _evict_old(self):
        cutoff = time.time() - self.window_seconds
        while self.chunks and self.chunks[0][0] < cutoff:
            self.chunks.popleft()

    async def get_text(self) -> str:
        async with self.lock:
            self._evict_old()
            return " ".join(text for _, text in self.chunks)

SYSTEM_PROMPT = """
You are an AI psychiatric clinical assistant observing a live mental health coaching session.
Analyze the following transcript snippet of the session. Check the user's mental status, identifying:
1. Key themes and emotional state.
2. Potential indicators of distress, anxiety, or depression.
3. Immediate safety or crisis concerns.

FORMAT RULES:
- Start your response with a clear risk tier tag on the very first line: either `[LOW]`, `[MODERATE]`, `[HIGH]`, or `[CRISIS]`.
- Follow it with 1-2 concise bullet points summarizing the clinical findings.
- Keep observations brief, objective, and easy for a doctor/coach to read at a glance.

CRITICAL SAFETY RULE:
- If there is ANY mention, indicator, or hint of suicidal ideation, self-harm, or homicidal thoughts/intent in the transcript, you MUST immediately classify the session as `[CRISIS]` or `[HIGH]`, ignoring all other milder context or previous status.
""".strip()

class LiveMeetingAnalysisEngine:
    """
    Manages live session transcripts, buffers them per session,
    and triggers real-time mental status analysis on Groq / fallback LLM.
    """
    def __init__(
        self,
        line_threshold: int = 5,
        word_threshold: int = 40,
    ):
        self._line_threshold = line_threshold
        self._word_threshold = word_threshold
        
        # Session state: { session_id -> { "lines": [], "words_since_last": int, "lines_since_last": int, "working_buffer": WorkingBuffer, "lock": asyncio.Lock } }
        self._buffers: Dict[str, Dict[str, Any]] = {}
        self._engine_lock = asyncio.Lock()
        self._client: Optional[AsyncOpenAI] = None
        self._model: str = "llama-3.1-8b-instant"

    def _get_api_client(self) -> Optional[AsyncOpenAI]:
        """Lazy initialization of the LLM API client."""
        if self._client is not None:
            return self._client

        groq_api_key = os.getenv("GROQ_API_KEY", "")
        # Clean any surrounding quotes from .env
        groq_api_key = groq_api_key.strip().strip("'\"")
        
        if groq_api_key:
            model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
            model = model.strip().strip("'\"")
            self._model = model
            self._client = AsyncOpenAI(
                api_key=groq_api_key,
                base_url="https://api.groq.com/openai/v1"
            )
            logger.info(f"[Live Analysis] Initialized Groq API client with model: {self._model}")
        else:
            try:
                # Fallback to the system default OpenRouter / Gemini client
                self._client = get_fallback_client()
                # Resolve fallback model
                api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENROUTER_API_KEY") or ""
                api_key = api_key.strip().strip("'\"")
                if api_key.startswith("AIzaSy"):
                    self._model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip().strip("'\"")
                else:
                    self._model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001").strip().strip("'\"")
                logger.info(f"[Live Analysis] GROQ_API_KEY not set. Falling back to default client with model: {self._model}")
            except Exception as e:
                logger.error(f"[Live Analysis] Failed to initialize fallback LLM client: {e}")
                self._client = None
                
        return self._client

    async def add_transcript(
        self,
        session_id: str,
        text: str,
        websocket: Any,
        write_lock: asyncio.Lock,
        tone_snapshot: Optional[ToneSnapshot] = None,
        speaker: str = "member",
    ) -> None:
        """
        Add a transcript line to the buffer for session_id.
        Triggers background analysis if threshold conditions are met.
        Optionally accepts a ToneSnapshot for vocal tone context.
        """
        if not text.strip():
            return

        async with self._engine_lock:
            if session_id not in self._buffers:
                member_id = None
                try:
                    from app.core.database import AsyncSessionLocal
                    from sqlalchemy import text as sqla_text
                    async with AsyncSessionLocal() as db:
                        res = await db.execute(
                            sqla_text('SELECT "memberId" FROM public."Session" WHERE id = :session_id LIMIT 1'),
                            {"session_id": session_id}
                        )
                        row = res.fetchone()
                        if row:
                            member_id = row[0]
                except Exception as e:
                    logger.error(f"[Live Analysis] Error fetching member_id for session {session_id}: {e}")

                self._buffers[session_id] = {
                    "lines": [],
                    "words_since_last": 0,
                    "lines_since_last": 0,
                    "client_words_since_last_success": 0,
                    "client_lines_since_last_success": 0,
                    "last_success_time": time.time(),
                    "working_buffer": WorkingBuffer(60),
                    "lock": asyncio.Lock(),
                    "member_id": member_id,
                    "tone_snapshots": [],  # Accumulate tone snapshots for context
                    "latest_tone": None,   # Most recent ToneSnapshot
                }
            
            buf = self._buffers[session_id]

        # Process counts
        words_count = len(text.split())
        buf["lines"].append(text)
        await buf["working_buffer"].add(text)
        buf["words_since_last"] += words_count
        buf["lines_since_last"] += 1

        if speaker.lower() in ("member", "client"):
            buf["client_words_since_last_success"] += words_count
            buf["client_lines_since_last_success"] += 1

        # Accumulate tone snapshot if available
        if tone_snapshot:
            buf["tone_snapshots"].append(tone_snapshot)
            buf["latest_tone"] = tone_snapshot
            # Keep only last 10 snapshots to prevent memory bloat
            if len(buf["tone_snapshots"]) > 10:
                buf["tone_snapshots"] = buf["tone_snapshots"][-10:]

        # Check elapsed-time condition FIRST (regardless of speaker or total count)
        last_success = buf.get("last_success_time", 0.0)
        elapsed = time.time() - last_success
        if elapsed > 120.0:
            logger.info(
                f"[Live Analysis] Force-trigger safety net met: elapsed time {elapsed:.1f}s > 120s. "
                f"Triggering analysis for session {session_id}."
            )
            # Reset total activity counters since we are performing an analysis now
            buf["lines_since_last"] = 0
            buf["words_since_last"] = 0
            
            # Launch analysis asynchronously in the background
            asyncio.create_task(
                self._run_analysis(session_id, websocket, write_lock)
            )
        else:
            # Check if thresholds are met
            if (buf["lines_since_last"] >= self._line_threshold or 
                    buf["words_since_last"] >= self._word_threshold):
                
                logger.debug(
                    f"[Live Analysis] Threshold met for session {session_id}. "
                    f"Lines since last: {buf['lines_since_last']}, Words since last: {buf['words_since_last']}"
                )
                
                # Reset counters always (independent of gate)
                buf["lines_since_last"] = 0
                buf["words_since_last"] = 0
                
                # Check debounce gate
                client_words = buf.get("client_words_since_last_success", 0)
                client_lines = buf.get("client_lines_since_last_success", 0)
                
                if (client_lines >= self._line_threshold or 
                    client_words >= self._word_threshold):
                    
                    # Launch analysis asynchronously in the background
                    asyncio.create_task(
                        self._run_analysis(session_id, websocket, write_lock)
                    )
                else:
                    logger.info(
                        f"[Live Analysis] skipped: only {client_words} new client words and {client_lines} "
                        f"new client lines since last call (elapsed: {elapsed:.1f}s)"
                    )

    async def _run_analysis(
        self,
        session_id: str,
        websocket: Any,
        write_lock: asyncio.Lock,
    ) -> None:
        """Perform Groq/LLM request with RAG (L2 summaries, L3 memory, profile) and forward result."""
        client = self._get_api_client()
        if not client:
            logger.warning("[Live Analysis] No active LLM client configured. Skipping live analysis.")
            return

        async with self._engine_lock:
            buf = self._buffers.get(session_id)
            if not buf:
                return
            
            # Extract current session context (last 30 lines to prevent context bloat)
            recent_lines = buf["lines"][-30:]
            session_lock = buf["lock"]
            member_id = buf.get("member_id")
            tone_snapshots = list(buf.get("tone_snapshots", []))
            latest_tone = buf.get("latest_tone")

        # Prevent concurrent LLM calls for the same session (skip if already analyzing)
        if session_lock.locked():
            logger.debug(f"[Live Analysis] Analysis already in progress for session {session_id}. Skipping trigger.")
            return

        async with session_lock:
            raw_buffer_text = await buf["working_buffer"].get_text()
            
            logger.info(f"[Live Analysis] Triggering Strands RAG clinical status analysis for session {session_id}...")
            t_start = asyncio.get_event_loop().time()
            
            try:
                from app.modules.rag import run_rag_analysis
                
                # Build tone context for the LLM
                tone_context = ""
                if tone_snapshots:
                    # Use the most recent snapshot for the human-readable summary
                    latest = tone_snapshots[-1]
                    tone_context = latest.to_human_summary()
                    logger.info(
                        f"[Live Analysis] Tone context for session {session_id}: "
                        f"affect={latest.affect_label} congruence={latest.congruence_score:.2f} "
                        f"incongruence={latest.incongruence_flag}"
                    )
                
                # Get video emotion aggregation for the last 30 seconds (matching AI summary interval)
                video_context = ""
                try:
                    video_agg = get_session_wide_aggregation(session_id, window_seconds=30)
                    if video_agg and video_agg.participants:
                        video_lines = []
                        for pid, part_agg in video_agg.participants.items():
                            counts_str = ", ".join(f"{k}: {v}" for k, v in part_agg.emotionCounts.items())
                            video_lines.append(
                                f"Participant {pid}: dominantEmotion={part_agg.dominantEmotion} (Counts: {counts_str})"
                            )
                        video_context = "\n".join(video_lines)
                        logger.info(f"[Live Analysis] Aligned video context: {video_context.replace('\n', ' | ')}")
                except Exception as ex:
                    logger.warning(f"[Live Analysis] Failed to get video aggregation: {ex}")
                
                analysis_text = await run_rag_analysis(
                    session_id=session_id,
                    member_id=member_id,
                    recent_lines=recent_lines,
                    working_buffer_text=raw_buffer_text,
                    tone_context=tone_context,
                    video_context=video_context
                )

                async with self._engine_lock:
                    buf = self._buffers.get(session_id)
                    if buf:
                        buf["client_words_since_last_success"] = 0
                        buf["client_lines_since_last_success"] = 0
                        buf["last_success_time"] = time.time()
                
                duration = int((asyncio.get_event_loop().time() - t_start) * 1000)
                logger.info(f"[Live Analysis] Completed in {duration}ms. Result: \"{analysis_text}\"")
                
                # Build response payload with tone data
                response_payload = {
                    "type": "live_analysis",
                    "analysis": analysis_text
                }
                
                # Include tone data if available
                if latest_tone:
                    response_payload["tone"] = {
                        "pitch_mean": latest_tone.pitch_mean,
                        "pitch_std": latest_tone.pitch_std,
                        "energy_mean": latest_tone.energy_mean,
                        "energy_trend": latest_tone.energy_trend,
                        "speech_rate_wpm": latest_tone.speech_rate_wpm,
                        "pause_ratio": latest_tone.pause_ratio,
                        "affect_label": latest_tone.affect_label,
                        "congruence_score": latest_tone.congruence_score,
                        "incongruence_flag": latest_tone.incongruence_flag,
                        "text_sentiment_score": latest_tone.text_sentiment_score,
                        "vocal_markers": [
                            m for m, detected in [
                                ("laughter", latest_tone.laughter_detected),
                                ("sigh", latest_tone.sigh_detected),
                                ("voice_break", latest_tone.voice_break_detected),
                            ] if detected
                        ]
                    }
                
                # Forward to client over WebSocket in a thread-safe manner
                async with write_lock:
                    if websocket:
                        try:
                            await websocket.send_json(response_payload)
                        except Exception as ws_err:
                            # WebSocket may have been closed while RAG was running — that's fine
                            logger.debug(f"[Live Analysis] Could not send result for session {session_id} (WS closed?): {ws_err}")
                    
            except Exception as e:
                logger.error(f"[Live Analysis] RAG Agent execution error for session {session_id}: {e}")

    async def clear_session(self, session_id: str) -> None:
        """Clean up buffers on session end/disconnect."""
        async with self._engine_lock:
            if session_id in self._buffers:
                logger.info(f"[Live Analysis] Clearing buffered transcript for session: {session_id}")
                del self._buffers[session_id]
