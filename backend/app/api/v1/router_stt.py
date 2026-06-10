import os
import logging
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import websockets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/stt", tags=["STT"])

# Deepgram live streaming endpoint
DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-3"
    "&language=en"
    "&smart_format=true"
    "&interim_results=true"
    "&endpointing=100"
)

@router.websocket("")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("[STT Proxy] Client WebSocket connected")

    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        logger.error("[STT Proxy] DEEPGRAM_API_KEY is not set on the server")
        await websocket.close(code=1011, reason="Deepgram API key not configured on server")
        return

    headers = {
        "Authorization": f"Token {api_key}"
    }

    try:
        async with websockets.connect(DEEPGRAM_URL, extra_headers=headers) as dg_socket:
            logger.info("[STT Proxy] Connected to Deepgram streaming service")

            # Concurrently forward data back and forth
            async def client_to_dg():
                try:
                    while True:
                        message = await websocket.receive()
                        if "bytes" in message:
                            await dg_socket.send(message["bytes"])
                        elif "text" in message:
                            await dg_socket.send(message["text"])
                except WebSocketDisconnect:
                    logger.info("[STT Proxy] Client connection closed (normal disconnect)")
                except Exception as e:
                    logger.warning(f"[STT Proxy] Exception in client_to_dg loop: {e}")
                finally:
                    raise asyncio.CancelledError()

            async def dg_to_client():
                try:
                    async for msg in dg_socket:
                        if isinstance(msg, bytes):
                            await websocket.send_bytes(msg)
                        else:
                            await websocket.send_text(msg)
                except Exception as e:
                    logger.warning(f"[STT Proxy] Exception in dg_to_client loop: {e}")
                finally:
                    raise asyncio.CancelledError()

            try:
                await asyncio.gather(client_to_dg(), dg_to_client())
            except asyncio.CancelledError:
                logger.info("[STT Proxy] Concurrent forwarding tasks cancelled")

    except Exception as err:
        logger.error(f"[STT Proxy] Connection to Deepgram failed: {err}")
    finally:
        logger.info("[STT Proxy] Connection finalized")
        try:
            await websocket.close()
        except Exception:
            pass
