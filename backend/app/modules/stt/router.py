import os
import logging
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import websockets
import jwt
from app.modules.live_analysis import LiveMeetingAnalysisEngine, ToneAnalyzer
from app.modules.live_video_analysis import handle_emotion_signal, clear_session_buffer, clear_participant_buffer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/stt", tags=["STT"])

# Instantiate the live meeting analysis engine and tone analyzer
live_analysis_engine = LiveMeetingAnalysisEngine()
tone_analyzer = ToneAnalyzer()

# Deepgram live streaming endpoint
DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-3"
    "&language=en"
    "&smart_format=true"
    "&interim_results=true"
    "&endpointing=100"
)

JWT_SECRET = os.getenv("JWT_SECRET")

def validate_transcription_token(token: str, query_session_id: str) -> bool:
    if not token or not query_session_id:
        logger.error("[STT Proxy] Token or sessionId query parameter missing")
        return False
    if not JWT_SECRET:
        logger.error("[STT Proxy] JWT_SECRET is not configured on the server")
        return False
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        
        # Validate exact fields
        if payload.get("purpose") != "transcription":
            logger.error(f"[STT Proxy] Invalid purpose: {payload.get('purpose')}")
            return False
        if payload.get("speaker") != "member":
            logger.error(f"[STT Proxy] Invalid speaker: {payload.get('speaker')}")
            return False
        if payload.get("sessionId") != query_session_id:
            logger.error(f"[STT Proxy] sessionId mismatch: {payload.get('sessionId')} vs {query_session_id}")
            return False
            
        return True
    except jwt.ExpiredSignatureError:
        logger.error("[STT Proxy] Token has expired")
        return False
    except jwt.InvalidTokenError as e:
        logger.error(f"[STT Proxy] Invalid token: {e}")
        return False

@router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    session_id = websocket.query_params.get("sessionId")
    
    if not validate_transcription_token(token, session_id):
        await websocket.accept()
        logger.warning(f"[STT Proxy] Rejecting unauthorized connection for sessionId={session_id}")
        await websocket.close(code=1008, reason="Invalid or missing transcription token")
        return

    # Check patient consent gating
    try:
        from app.core.database import AsyncSessionLocal
        from app.middleware.consent_gate import require_active_consent, ConsentRequiredError
        from sqlalchemy import text
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text('SELECT "memberId" FROM public."Session" WHERE id = :session_id LIMIT 1'),
                {"session_id": session_id}
            )
            row = result.fetchone()
            if not row:
                logger.warning(f"[STT Proxy] Session {session_id} not found in database")
                await websocket.accept()
                await websocket.close(code=1008, reason="Session not found")
                return
            member_id = row[0]
            
            await require_active_consent(db, member_id, ["recording", "ai_analysis"])
    except ConsentRequiredError as e:
        logger.warning(f"[STT Proxy] Consent validation failed for sessionId={session_id}: {e}")
        await websocket.accept()
        await websocket.close(code=1008, reason=str(e))
        return
    except Exception as e:
        logger.error(f"[STT Proxy] Unexpected error checking consent for sessionId={session_id}: {e}")
        await websocket.accept()
        await websocket.close(code=1011, reason="Internal server error checking consent")
        return

    await websocket.accept()
    logger.info("[STT Proxy] Client WebSocket connected and authorized")

    # Start L2 Summarizer background task loop
    from app.modules.live_analysis.memory_tasks import summarize_episode_loop
    asyncio.create_task(summarize_episode_loop(live_analysis_engine, session_id, member_id))

    # Lock to serialize writes to this WebSocket from different concurrent tasks
    websocket_write_lock = asyncio.Lock()

    # Track the participant ID dynamically from the incoming emotion signals
    connected_participant_id = None

    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        logger.error("[STT Proxy] DEEPGRAM_API_KEY is not set on the server")
        await websocket.close(code=1011, reason="Deepgram API key not configured on server")
        return

    headers = {
        "Authorization": f"Token {api_key}"
    }

    try:
        async with websockets.connect(DEEPGRAM_URL, additional_headers=headers) as dg_socket:
            logger.info("[STT Proxy] Connected to Deepgram streaming service")

            # Concurrently forward data back and forth
            async def client_to_dg():
                nonlocal connected_participant_id
                try:
                    while True:
                        message = await websocket.receive()
                        if "bytes" in message:
                            audio_bytes = message["bytes"]
                            await dg_socket.send(audio_bytes)
                            # Also buffer audio for tone analysis
                            await tone_analyzer.buffer_audio(session_id, audio_bytes)
                        elif "text" in message:
                            text_data = message["text"]
                            try:
                                data = json.loads(text_data)
                                if isinstance(data, dict):
                                    if data.get("type") == "emotion_signal":
                                        # Capture participant ID if available
                                        pid = data.get("participantId")
                                        if pid:
                                            connected_participant_id = pid
                                        # Delegate emotion validation and handling to the live_video_analysis service
                                        ack_msg = handle_emotion_signal(data)
                                        async with websocket_write_lock:
                                            await websocket.send_text(ack_msg.model_dump_json())
                                    else:
                                        # Unknown JSON types ignored safely
                                        pass
                                else:
                                    # Non-dict JSON ignored safely
                                    pass
                            except json.JSONDecodeError:
                                # Invalid JSON ignored safely
                                pass
                except WebSocketDisconnect:
                    logger.info("[STT Proxy] Client connection closed (normal disconnect)")
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.warning(f"[STT Proxy] Exception in client_to_dg loop: {e}")

            async def dg_to_client():
                try:
                    async for msg in dg_socket:
                        if isinstance(msg, bytes):
                            async with websocket_write_lock:
                                await websocket.send_bytes(msg)
                        else:
                            # Forward the raw Deepgram response to client first
                            async with websocket_write_lock:
                                await websocket.send_text(msg)
                            
                            # Parse final transcripts and buffer for live analysis
                            try:
                                data = json.loads(msg)
                                alt = data.get("channel", {}).get("alternatives", [{}])[0]
                                transcript = alt.get("transcript", "").strip()
                                is_final = data.get("is_final") or data.get("speech_final")
                                if is_final and transcript:
                                    # Run tone analysis on the buffered audio
                                    tone_snapshot = await tone_analyzer.analyze(
                                        session_id, transcript
                                    )
                                    asyncio.create_task(
                                        live_analysis_engine.add_transcript(
                                            session_id, transcript, websocket, websocket_write_lock,
                                            tone_snapshot=tone_snapshot
                                        )
                                    )
                            except Exception as e:
                                logger.debug(f"[STT Proxy] Live analysis parsing skipped/failed: {e}")
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.warning(f"[STT Proxy] Exception in dg_to_client loop: {e}")

            # Run both loops; cancel the sibling when either one finishes
            c2d_task = asyncio.create_task(client_to_dg())
            d2c_task = asyncio.create_task(dg_to_client())
            try:
                done, pending = await asyncio.wait(
                    [c2d_task, d2c_task],
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except (asyncio.CancelledError, Exception):
                        pass
            except asyncio.CancelledError:
                for task in [c2d_task, d2c_task]:
                    task.cancel()
                    try:
                        await task
                    except (asyncio.CancelledError, Exception):
                        pass
                raise

    except Exception as err:
        logger.error(f"[STT Proxy] Connection to Deepgram failed: {err}")
    finally:
        logger.info("[STT Proxy] Connection finalized")
        if session_id:
            await live_analysis_engine.clear_session(session_id)
            await tone_analyzer.clear_session(session_id)
            if connected_participant_id:
                clear_participant_buffer(session_id, connected_participant_id)
        try:
            await websocket.close()
        except Exception:
            pass

