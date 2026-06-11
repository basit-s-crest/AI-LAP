import os
import logging
import asyncio
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
from app.modules.sentiment.llm import _get_client as get_fallback_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an AI psychiatric clinical assistant observing a live mental health coaching session.
Analyze the following transcript snippet of the session. Check the user's mental status, identifying:
1. Key themes and emotional state.
2. Potential indicators of distress, anxiety, or depression.
3. Immediate safety or crisis concerns.

Provide a concise, clinical summary of the user's current mental status in 1-2 bullet points.
Be brief and objective, since this is displayed to the coach in real-time.
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
        
        # Session state: { session_id -> { "lines": [], "words_since_last": int, "lines_since_last": int, "lock": asyncio.Lock } }
        self._buffers: Dict[str, Dict[str, Any]] = {}
        self._engine_lock = asyncio.Lock()
        self._client: Optional[AsyncOpenAI] = None
        self._model: str = "llama3-8b-8192"

    def _get_api_client(self) -> Optional[AsyncOpenAI]:
        """Lazy initialization of the LLM API client."""
        if self._client is not None:
            return self._client

        groq_api_key = os.getenv("GROQ_API_KEY", "")
        # Clean any surrounding quotes from .env
        groq_api_key = groq_api_key.strip().strip("'\"")
        
        if groq_api_key:
            model = os.getenv("GROQ_MODEL", "llama3-8b-8192")
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
    ) -> None:
        """
        Add a transcript line to the buffer for session_id.
        Triggers background analysis if threshold conditions are met.
        """
        if not text.strip():
            return

        async with self._engine_lock:
            if session_id not in self._buffers:
                self._buffers[session_id] = {
                    "lines": [],
                    "words_since_last": 0,
                    "lines_since_last": 0,
                    "lock": asyncio.Lock(),
                }
            
            buf = self._buffers[session_id]

        # Process counts
        words_count = len(text.split())
        buf["lines"].append(text)
        buf["words_since_last"] += words_count
        buf["lines_since_last"] += 1

        # Check if thresholds are met
        if (buf["lines_since_last"] >= self._line_threshold or 
                buf["words_since_last"] >= self._word_threshold):
            
            logger.debug(
                f"[Live Analysis] Threshold met for session {session_id}. "
                f"Lines since last: {buf['lines_since_last']}, Words since last: {buf['words_since_last']}"
            )
            
            # Reset counters
            buf["lines_since_last"] = 0
            buf["words_since_last"] = 0
            
            # Launch analysis asynchronously in the background
            asyncio.create_task(
                self._run_analysis(session_id, websocket, write_lock)
            )

    async def _run_analysis(
        self,
        session_id: str,
        websocket: Any,
        write_lock: asyncio.Lock,
    ) -> None:
        """Perform Groq/LLM request and forward result to WebSocket."""
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

        # Prevent concurrent LLM calls for the same session (skip if already analyzing)
        if session_lock.locked():
            logger.debug(f"[Live Analysis] Analysis already in progress for session {session_id}. Skipping trigger.")
            return

        async with session_lock:
            transcript_context = "\n".join(recent_lines)
            
            logger.info(f"[Live Analysis] Triggering mental status analysis for session {session_id} using {self._model}...")
            t_start = asyncio.get_event_loop().time()
            
            try:
                response = await client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"Session Transcript:\n{transcript_context}"},
                    ],
                    temperature=0.2,
                    max_tokens=256,
                )
                
                analysis_text = response.choices[0].message.content.strip()
                duration = int((asyncio.get_event_loop().time() - t_start) * 1000)
                logger.info(f"[Live Analysis] Completed in {duration}ms. Result: \"{analysis_text}\"")
                
                # Forward to client over WebSocket in a thread-safe manner
                async with write_lock:
                    await websocket.send_json({
                        "type": "live_analysis",
                        "analysis": analysis_text
                    })
                    
            except Exception as e:
                logger.error(f"[Live Analysis] LLM API execution error for session {session_id}: {e}")

    async def clear_session(self, session_id: str) -> None:
        """Clean up buffers on session end/disconnect."""
        async with self._engine_lock:
            if session_id in self._buffers:
                logger.info(f"[Live Analysis] Clearing buffered transcript for session: {session_id}")
                del self._buffers[session_id]
