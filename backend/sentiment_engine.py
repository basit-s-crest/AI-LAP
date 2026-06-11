"""
ARIA STT Engine (M4) — Deepgram Nova-3 Streaming
=================================================
Provider: Deepgram nova-3 via persistent WebSocket per participant.

Architecture:
  Each participant gets one persistent Deepgram WebSocket for the duration
  of their session. PCM-16 audio is forwarded as it arrives — no buffering.

  Deepgram event strategy:
    • is_final=True      → TRANSCRIPT_READY  (model committed — fires immediately)
    • speech_final=True  → TRANSCRIPT_READY  (VAD detected end — secondary signal)
    • is_final=False     → TRANSCRIPT_PARTIAL (live preview)

  Why is_final over speech_final:
    is_final fires as soon as the ASR model commits to a transcription — no
    silence wait. This makes the last words of a sentence appear immediately.
    speech_final requires endpointing silence AFTER the last word, adding
    100-300ms of perceived delay. We use is_final as primary, speech_final
    as a fallback to catch any utterances is_final misses.

  Key design decisions:
    • utterance_end_ms REMOVED — conflicts with endpointing, causes double-
      firing of finals. Use endpointing alone for clean utterance boundaries.
    • Silence frames ARE forwarded to Deepgram — dropping silence breaks
      Deepgram's VAD timing and causes missed/split finals.
    • Silence gate kept but threshold lowered — only drops true dead silence
      (RMS < 30), not soft speech.
    • Transcript callbacks via asyncio.create_task() — Deepgram receive loop
      never blocked by downstream processing.
    • _failed set prevents retry storms on bad API keys.

EventBus:
  Listens  : AUDIO_CHUNK_RECEIVED (fallback path)
             PARTICIPANT_LEFT     (close Deepgram WS + clean up)
  Publishes: TRANSCRIPT_READY    (speech_final or is_final)
             TRANSCRIPT_PARTIAL  (interim)

Config (env vars):
  DEEPGRAM_API_KEY  — required
"""

from __future__ import annotations

import asyncio
import base64
import structlog
import os
from typing import TYPE_CHECKING, Callable, Coroutine, Any

from pydantic import BaseModel

if TYPE_CHECKING:
    from event_bus import EventBus

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DG_MODEL       = "nova-3"
DG_LANGUAGE    = "en"
DG_ENCODING    = "linear16"
DG_SAMPLE_RATE = 16_000
DG_CHANNELS    = 1

# Endpointing: ms of silence before speech_final fires.
# 100ms — fast enough that last words appear almost immediately.
# is_final is used as primary signal (fires when model commits, no silence wait).
# speech_final used as secondary to catch utterances is_final misses.
DG_ENDPOINTING_MS = 100
# How long to wait for Deepgram to flush final transcript on close.
# 8 s gives Deepgram enough time to finish endpointing + deliver the last
# speech_final even when the participant stops speaking right before leaving.
CLOSE_FLUSH_TIMEOUT = 8.0

# Retry configuration for transient Deepgram connection failures
MAX_CONNECT_RETRIES  = 3
RETRY_BACKOFF_BASE   = 1.0   # seconds — doubles each attempt

CallbackType = Callable[..., Coroutine[Any, Any, None]]


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class WordTiming(BaseModel):
    word:       str
    start:      float
    end:        float
    confidence: float


class TranscriptResult(BaseModel):
    sessionId:     str
    participantId: str
    speakerLabel:  str
    text:          str
    confidence:    float
    isPartial:     bool
    startTime:     float
    endTime:       float
    words:         list[WordTiming] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_participant_id(participant_id: str) -> str:
    """Strip the '-audio' suffix the frontend appends to audio-only connections."""
    return participant_id.removesuffix("-audio")


# ---------------------------------------------------------------------------
# DeepgramConnection — one persistent WS per participant
# ---------------------------------------------------------------------------

class DeepgramConnection:
    """
    Wraps a single Deepgram streaming WebSocket for one participant.

    Uses speech_final as the primary signal for final transcripts.
    Falls back to is_final if speech_final is not present in the result.
    """

    def __init__(
        self,
        api_key:        str,
        session_id:     str,
        participant_id: str,
        on_partial:     CallbackType,
        on_final:       CallbackType,
    ):
        self._api_key        = api_key
        self._session_id     = session_id
        self._participant_id = participant_id
        self._on_partial     = on_partial
        self._on_final       = on_final
        self._dg_connection  = None
        self._connected      = False
        self._close_event: asyncio.Event | None = None
        self._fallback_task: asyncio.Task | None = None
        self._last_partial_text: str = ""

    async def connect(self) -> None:
        """Open the Deepgram streaming connection."""
        from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions

        self._close_event = asyncio.Event()
        dg = DeepgramClient(self._api_key)

        options = LiveOptions(
            model           = DG_MODEL,
            language        = DG_LANGUAGE,
            encoding        = DG_ENCODING,
            sample_rate     = DG_SAMPLE_RATE,
            channels        = DG_CHANNELS,
            smart_format    = True,              # punctuation + capitalisation
            interim_results = True,              # enables partials + speech_final
            vad_events      = True,              # voice activity detection events
            endpointing     = DG_ENDPOINTING_MS, # ms silence → speech_final
            # utterance_end_ms intentionally omitted — conflicts with endpointing
            # and causes double-firing of finals. endpointing alone is cleaner.
        )

        self._dg_connection = dg.listen.asyncwebsocket.v("1")
        self._dg_connection.on(LiveTranscriptionEvents.Transcript, self._on_transcript)
        self._dg_connection.on(LiveTranscriptionEvents.Error,      self._on_error)
        self._dg_connection.on(LiveTranscriptionEvents.Close,      self._on_close)

        started = await self._dg_connection.start(options)
        if not started:
            raise RuntimeError(
                f"[STT] Deepgram connection failed for {self._participant_id}"
            )

        self._connected = True
        logger.info(
            f"[STT] Deepgram connected: session={self._session_id} "
            f"participant={self._participant_id}"
        )

    async def send(self, pcm16: bytes) -> None:
        """Forward a PCM-16 chunk to Deepgram."""
        if not self._connected or not self._dg_connection:
            return
        try:
            await self._dg_connection.send(pcm16)
        except Exception as e:
            logger.warning(f"[STT] send failed for {self._participant_id}: {e}")
            self._connected = False

    async def close(self) -> None:
        """
        Gracefully close: send finish() then wait for the Close event so
        Deepgram can flush buffered audio and deliver the final transcript.
        """
        self._connected = False
        if self._dg_connection:
            try:
                await self._dg_connection.finish()
                if self._close_event:
                    try:
                        await asyncio.wait_for(
                            self._close_event.wait(),
                            timeout=CLOSE_FLUSH_TIMEOUT,
                        )
                    except asyncio.TimeoutError:
                        logger.debug(
                            f"[STT] Close flush timeout for {self._participant_id}"
                        )
            except Exception:
                pass
            self._dg_connection = None

        logger.info(
            f"[STT] Deepgram closed: session={self._session_id} "
            f"participant={self._participant_id}"
        )

    @property
    def is_connected(self) -> bool:
        return self._connected

    # ── Deepgram event callbacks ────────────────────────────────────────────

    async def _on_transcript(self, _client, result, **_kwargs) -> None:
        try:
            alt = result.channel.alternatives[0]
        except (AttributeError, IndexError):
            return

        text = (alt.transcript or "").strip()
        if not text:
            return

        # is_final fires as soon as the ASR model commits — no silence wait.
        # This is what makes the last words appear immediately.
        # speech_final fires after endpointing silence — used as a secondary
        # signal to catch any utterances where is_final didn't fire.
        is_final     = result.is_final
        speech_final = getattr(result, "speech_final", False)

        # Treat as final on either signal
        treat_as_final = bool(is_final) or bool(speech_final)

        speaker    = _clean_participant_id(self._participant_id)
        confidence = float(getattr(alt, "confidence", 0.9))

        words: list[WordTiming] = []
        for w in (getattr(alt, "words", None) or []):
            words.append(WordTiming(
                word       = getattr(w, "word",        ""),
                start      = float(getattr(w, "start",      0.0)),
                end        = float(getattr(w, "end",        0.0)),
                confidence = float(getattr(w, "confidence", 0.9)),
            ))

        start_t = words[0].start if words else 0.0
        end_t   = words[-1].end  if words else 0.0

        result_obj = TranscriptResult(
            sessionId     = self._session_id,
            participantId = self._participant_id,
            speakerLabel  = speaker,
            text          = text,
            confidence    = confidence,
            isPartial     = not treat_as_final,
            startTime     = start_t,
            endTime       = end_t,
            words         = words,
        )

        # Fire-and-forget via create_task so the Deepgram receive loop
        # is never blocked by downstream EventBus publish / broadcast.
        if treat_as_final:
            # Cancel fallback timer — real final arrived
            if self._fallback_task and not self._fallback_task.done():
                self._fallback_task.cancel()
                self._fallback_task = None
            self._last_partial_text = ""
            task = asyncio.create_task(self._on_final(result_obj))
            task.add_done_callback(
                lambda t: logger.error(
                    f"[STT] Final callback failed for {self._participant_id}: {t.exception()}"
                ) if not t.cancelled() and t.exception() else None
            )
            logger.debug(
                f"[STT] FINAL (is_final={is_final} speech_final={speech_final}) "
                f"| {speaker}: \"{text[:80]}\""
            )
        else:
            # Cancel previous fallback timer and start a new one
            if self._fallback_task and not self._fallback_task.done():
                self._fallback_task.cancel()
            self._fallback_task = asyncio.create_task(
                self._fallback_finalize(result_obj)
            )
            self._last_partial_text = text
            task = asyncio.create_task(self._on_partial(result_obj))
            task.add_done_callback(
                lambda t: logger.warning(
                    f"[STT] Partial callback failed for {self._participant_id}: {t.exception()}"
                ) if not t.cancelled() and t.exception() else None
            )

    async def _fallback_finalize(self, result_obj: "TranscriptResult") -> None:
        """
        Safety net: if a partial has not been superseded by is_final
        within 8s, force-publish it as a final transcript.
        Handles dropped Deepgram connections, network interruptions,
        and any edge case where speech_final never fires.
        """
        await asyncio.sleep(8.0)
        # Only fire if this partial text is still the last one seen
        if self._last_partial_text != result_obj.text:
            return
        forced = TranscriptResult(
            sessionId     = result_obj.sessionId,
            participantId = result_obj.participantId,
            speakerLabel  = result_obj.speakerLabel,
            text          = result_obj.text,
            confidence    = result_obj.confidence,
            isPartial     = False,
            startTime     = result_obj.startTime,
            endTime       = result_obj.endTime,
            words         = result_obj.words,
        )
        self._last_partial_text = ""
        self._fallback_task = None
        await self._on_final(forced)
        logger.warning(
            f"[STT] Fallback finalizer fired for {self._participant_id}: "
            f'"{result_obj.text[:60]}"'
        )

    async def _on_error(self, _client, error, **_kwargs) -> None:
        logger.error(f"[STT] Deepgram error for {self._participant_id}: {error}")
        self._connected = False

    async def _on_close(self, _client, close, **_kwargs) -> None:
        self._connected = False
        if self._close_event:
            self._close_event.set()
        logger.info(f"[STT] Deepgram stream closed for {self._participant_id}")


# ---------------------------------------------------------------------------
# STTEngine — EventBus integration
# ---------------------------------------------------------------------------

class STTEngine:
    """
    Maintains one DeepgramConnection per active participant.
    Audio is ingested directly from the WebSocket handler (fast path),
    bypassing the EventBus queue entirely.
    """

    def __init__(self, bus: "EventBus"):
        self._bus     = bus
        self._api_key = os.getenv("DEEPGRAM_API_KEY", "")

        if not self._api_key:
            logger.error("[STT] DEEPGRAM_API_KEY is not set — STT will be disabled!")

        # { "session_id/participant_id" → DeepgramConnection }
        self._connections: dict[str, DeepgramConnection] = {}
        self._conn_lock = asyncio.Lock()

        # Tracks transient failures with retry count.
        # Cleared when participant disconnects or after max retries.
        self._failed: set[str] = set()
        self._retry_counts: dict[str, int] = {}

        self.SILENCE_TIMEOUT_S = float(os.getenv("SILENCE_TIMEOUT_S", "2.5"))
        self._answer_buffers: dict[str, dict] = {}

    # ------------------------------------------------------------------
    def register(self) -> None:
        from core.events import EventType
        self._bus.subscribe(EventType.AUDIO_CHUNK_RECEIVED, self._on_audio_chunk)
        self._bus.subscribe(EventType.PARTICIPANT_LEFT,     self._on_participant_left)
        logger.info(
            f"[STT] Engine registered — Deepgram {DG_MODEL} "
            f"endpointing={DG_ENDPOINTING_MS}ms"
        )

    async def warmup(self) -> None:
        """
        Open and immediately close a test connection at startup.
        Surfaces bad API keys before the first real participant joins.
        """
        if not self._api_key:
            return
        try:
            from deepgram import DeepgramClient, LiveOptions
            dg   = DeepgramClient(self._api_key)
            conn = dg.listen.asyncwebsocket.v("1")
            opts = LiveOptions(
                model=DG_MODEL, language=DG_LANGUAGE,
                encoding=DG_ENCODING, sample_rate=DG_SAMPLE_RATE, channels=DG_CHANNELS,
            )
            started = await conn.start(opts)
            if started:
                await conn.finish()
                logger.info(f"[STT] Deepgram warmup OK — {DG_MODEL} ready")
            else:
                logger.error(
                    "[STT] Deepgram warmup FAILED — check API key and network. "
                    f"Key prefix: {self._api_key[:8]}..."
                )
        except Exception as e:
            logger.error(f"[STT] Deepgram warmup exception: {e}")

    # ------------------------------------------------------------------
    # Direct audio ingestion — fast path from WebSocket handler
    # ------------------------------------------------------------------

    async def ingest_audio(
        self,
        session_id:     str,
        participant_id: str,
        pcm16:          bytes,
    ) -> None:
        """
        Called directly from the WebSocket handler with raw PCM-16 bytes.
        Bypasses EventBus entirely — zero queue overhead.

        Silence gate: only drops true dead silence (RMS < 30).
        Normal silence IS forwarded so Deepgram's VAD works correctly.
        """
        if not self._api_key or not pcm16:
            return

        # All audio including silence is forwarded to Deepgram.
        # Deepgram's own VAD handles silence detection for endpointing.
        # DO NOT gate silence here — Deepgram needs it to fire speech_final.

        key = f"{session_id}/{participant_id}"

        if key in self._failed:
            return

        # All connection management is done inside the lock to prevent
        # race conditions where two concurrent audio chunks both see
        # conn=None and both try to open a Deepgram connection.
        async with self._conn_lock:
            if key in self._failed:
                return

            conn = self._connections.get(key)

            # Detect and replace stale connections inside the lock
            if conn is not None and not conn.is_connected:
                logger.info(f"[STT] Stale connection for {participant_id} — reconnecting")
                # Close the stale connection without blocking the lock for too long
                asyncio.create_task(conn.close())
                self._connections.pop(key, None)
                conn = None

            # Lazily open connection with retry backoff
            if conn is None:
                retries = self._retry_counts.get(key, 0)
                if retries >= MAX_CONNECT_RETRIES:
                    logger.error(
                        f"[STT] Max retries ({MAX_CONNECT_RETRIES}) reached for "
                        f"{participant_id} — marking failed"
                    )
                    self._failed.add(key)
                    return

                conn = DeepgramConnection(
                    api_key        = self._api_key,
                    session_id     = session_id,
                    participant_id = participant_id,
                    on_partial     = self._on_partial_result,
                    on_final       = self._on_final_result,
                )
                try:
                    await conn.connect()
                    self._connections[key] = conn
                    self._retry_counts.pop(key, None)  # reset on success
                except asyncio.CancelledError:
                    logger.debug(
                        f"[STT] Connect cancelled for {participant_id} "
                        f"(client disconnected during handshake)"
                    )
                    raise
                except Exception as e:
                    self._retry_counts[key] = retries + 1
                    backoff = RETRY_BACKOFF_BASE * (2 ** retries)
                    logger.error(
                        f"[STT] Failed to open Deepgram connection "
                        f"for {participant_id} (attempt {retries + 1}/{MAX_CONNECT_RETRIES}): {e}. "
                        f"Retry in {backoff:.1f}s"
                    )
                    # Schedule a retry after backoff by clearing the failed state
                    async def _schedule_retry(k: str, delay: float) -> None:
                        await asyncio.sleep(delay)
                        async with self._conn_lock:
                            # Only clear if still at the same retry count
                            # (participant may have left and rejoined)
                            if self._retry_counts.get(k) == retries + 1:
                                self._retry_counts.pop(k, None)
                    asyncio.create_task(_schedule_retry(key, backoff))
                    return

        await conn.send(pcm16)

    # ------------------------------------------------------------------
    # EventBus fallback path
    # ------------------------------------------------------------------

    async def _on_audio_chunk(self, event) -> None:
        payload = event.payload
        raw     = payload.get("pcm16Data", b"")
        if isinstance(raw, str):
            raw = base64.b64decode(raw)
        elif isinstance(raw, list):
            raw = bytes(raw)
        if not raw:
            return
        await self.ingest_audio(event.session_id, event.participant_id, raw)

    async def _on_participant_left(self, event) -> None:
        key  = f"{event.session_id}/{event.participant_id}"
        conn = self._connections.pop(key, None)
        if conn:
            await conn.close()
        # Clear failed sentinel and retry count — fresh reconnect should work
        self._failed.discard(key)
        self._retry_counts.pop(key, None)

    async def close_all(self) -> None:
        """Close all open Deepgram connections — called on server shutdown."""
        keys = list(self._connections.keys())
        await asyncio.gather(
            *(self._close_one(key) for key in keys),
            return_exceptions=True,
        )
        logger.info(f"[STT] close_all: closed {len(keys)} connection(s)")

    async def _close_one(self, key: str) -> None:
        async with self._conn_lock:
            conn = self._connections.pop(key, None)
            self._failed.discard(key)
            self._retry_counts.pop(key, None)
        if conn:
            try:
                await conn.close()
            except Exception as e:
                logger.warning(f"[STT] close_all error for {key}: {e}")

    # ------------------------------------------------------------------
    # Transcript callbacks
    # ------------------------------------------------------------------

    async def _on_partial_result(self, result: TranscriptResult) -> None:
        from core.events import ARIAEvent, EventType
        event = ARIAEvent(
            event_type     = EventType.TRANSCRIPT_PARTIAL,
            session_id     = result.sessionId,
            participant_id = result.participantId,
            payload        = result.model_dump(),
        )
        await self._bus.publish(event)

    def flush_answer(self, session_id: str) -> None:
        """Flush buffered interview answer immediately (WS ANSWER_COMPLETE)."""
        buf = self._answer_buffers.get(session_id)
        if not buf:
            return
        timer = buf.get("timer")
        if timer and not timer.done():
            timer.cancel()
        asyncio.create_task(self._emit_buffered_answer(session_id))

    def _append_interview_final(self, session_id: str, text: str, participant_id: str) -> None:
        import time as _time
        buf = self._answer_buffers.setdefault(
            session_id,
            {"text": "", "participant_id": participant_id, "timer": None},
        )
        if buf["text"]:
            buf["text"] += " " + text.strip()
        else:
            buf["text"] = text.strip()
        buf["participant_id"] = participant_id
        buf["last_final_at"] = _time.monotonic()

        timer = buf.get("timer")
        if timer and not timer.done():
            timer.cancel()

        async def _fire_after_silence() -> None:
            await asyncio.sleep(self.SILENCE_TIMEOUT_S)
            await self._emit_buffered_answer(session_id)

        buf["timer"] = asyncio.create_task(_fire_after_silence())

    async def _emit_buffered_answer(self, session_id: str) -> None:
        from core.events import ARIAEvent, EventType
        buf = self._answer_buffers.pop(session_id, None)
        if not buf or not buf.get("text", "").strip():
            return
        interview_id = session_id.split(":", 1)[1] if ":" in session_id else session_id
        await self._bus.publish(ARIAEvent(
            event_type=EventType.CANDIDATE_TURN_READY,
            session_id=session_id,
            participant_id=buf.get("participant_id", "candidate"),
            payload={
                "interview_id": interview_id,
                "answer_text": buf["text"].strip(),
            },
        ))
        logger.info(
            f"[STT] CANDIDATE_TURN_READY buffered session={session_id} "
            f"len={len(buf['text'])}"
        )

    async def _on_final_result(self, result: TranscriptResult) -> None:
        from core.events import ARIAEvent, EventType
        event = ARIAEvent(
            event_type     = EventType.TRANSCRIPT_READY,
            session_id     = result.sessionId,
            participant_id = result.participantId,
            payload        = result.model_dump(),
        )
        await self._bus.publish(event)
        if result.sessionId.startswith("interview:"):
            self._append_interview_final(
                result.sessionId,
                result.text,
                result.participantId,
            )
        logger.info(
            f"[STT] FINAL | session={result.sessionId} "
            f"speaker={result.speakerLabel} conf={result.confidence:.2f} "
            f"| \"{result.text[:100]}\""
        )