import asyncio
import time
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
import httpx

from app.modules.live_analysis.live_analysis import LiveMeetingAnalysisEngine
from main import app

# Mock run_rag_analysis to avoid real LLM API calls
@pytest.fixture
def mock_run_rag_analysis():
    with patch("app.modules.rag.run_rag_analysis", new_callable=AsyncMock) as mock:
        mock.return_value = "[LOW] Mocked RAG summary result."
        yield mock

def test_debounce_gate_skips_and_triggers(mock_run_rag_analysis):
    async def run_test():
        engine = LiveMeetingAnalysisEngine(line_threshold=5, word_threshold=40)
        session_id = "test_session_gate"
        lock = asyncio.Lock()
        
        # 1. Add only coach transcripts.
        # Total threshold is met (5 lines total), but client has 0 lines/words since last success.
        # It should skip triggering RAG.
        for i in range(5):
            await engine.add_transcript(
                session_id=session_id,
                text=f"Coach speaking line {i}",
                websocket=None,
                write_lock=lock,
                speaker="coach"
            )
            await asyncio.sleep(0.01)
        
        # Give event loop a chance to process background task
        await asyncio.sleep(0.05)
        assert mock_run_rag_analysis.call_count == 0
        
        # Verify that total activity counters were reset
        buf = engine._buffers[session_id]
        assert buf["lines_since_last"] == 0
        assert buf["words_since_last"] == 0
        # Client counters should still be 0
        assert buf["client_lines_since_last_success"] == 0
        assert buf["client_words_since_last_success"] == 0

        # 2. Add client transcript that meets the threshold (5 lines from client)
        for i in range(5):
            await engine.add_transcript(
                session_id=session_id,
                text=f"Client speaking line {i}",
                websocket=None,
                write_lock=lock,
                speaker="member"
            )
            await asyncio.sleep(0.01)
            
        await asyncio.sleep(0.05)
        # The client threshold is now met (5 client lines). RAG analysis should trigger.
        assert mock_run_rag_analysis.call_count == 1
        
        # Check that client counters are reset after success
        assert buf["client_lines_since_last_success"] == 0
        assert buf["client_words_since_last_success"] == 0

    asyncio.run(run_test())


def test_force_trigger_fallback(mock_run_rag_analysis):
    async def run_test():
        engine = LiveMeetingAnalysisEngine(line_threshold=5, word_threshold=40)
        session_id = "test_session_force"
        lock = asyncio.Lock()
        
        # Initialize the buffer by sending a line
        await engine.add_transcript(
            session_id=session_id,
            text="Initial client line",
            websocket=None,
            write_lock=lock,
            speaker="member"
        )
        
        # Set the last success time in the past (> 2 minutes ago)
        engine._buffers[session_id]["last_success_time"] = time.time() - 130
        # Reset client counters to ensure they are below threshold (e.g. only 1 line, 3 words)
        engine._buffers[session_id]["client_lines_since_last_success"] = 1
        engine._buffers[session_id]["client_words_since_last_success"] = 3
        
        # Add 5 coach lines to meet the overall activity threshold (5 lines total)
        # This should trigger checking the gate, and force trigger because of elapsed time.
        for i in range(5):
            await engine.add_transcript(
                session_id=session_id,
                text=f"Coach line {i}",
                websocket=None,
                write_lock=lock,
                speaker="coach"
            )
            await asyncio.sleep(0.01)
            
        await asyncio.sleep(0.05)
        # Should force-trigger because elapsed > 120s
        assert mock_run_rag_analysis.call_count == 1

    asyncio.run(run_test())


class DummyFERModel:
    def __init__(self):
        self.idx_to_class = {
            0: "Anger", 1: "Contempt", 2: "Disgust", 3: "Fear",
            4: "Happiness", 5: "Neutral", 6: "Sadness", 7: "Surprise"
        }
        
    def predict_emotions(self, img_np, logits=False):
        time.sleep(0.2)
        return "Neutral", [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0]


def test_concurrent_emotion_detection():
    # Generate dummy base64 frame (a small solid JPEG)
    from PIL import Image
    import io
    import base64
    img = Image.new("RGB", (10, 10), color="blue")
    buf_img = io.BytesIO()
    img.save(buf_img, format="JPEG")
    img_base64 = base64.b64encode(buf_img.getvalue()).decode("utf-8")
    payload_frame = f"data:image/jpeg;base64,{img_base64}"
    
    # Instantiate custom dummy class (no mock internal locks to serialize threads)
    dummy_fer = DummyFERModel()
    
    async def run_test():
        with patch("app.modules.live_video_analysis.router.fer_model", dummy_fer), \
             patch("app.middleware.request_logger._write_log", new_callable=AsyncMock):
            # We will use httpx AsyncClient to test the FastAPI app concurrently
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                t_start = time.perf_counter()
                
                # Send two concurrent requests with different session IDs
                res1_task = client.post("/api/emotion/detect", json={"frame": payload_frame, "sessionId": "sess1"})
                res2_task = client.post("/api/emotion/detect", json={"frame": payload_frame, "sessionId": "sess2"})
                
                res1, res2 = await asyncio.gather(res1_task, res2_task)
                
                duration = time.perf_counter() - t_start
                
                assert res1.status_code == 200
                assert res2.status_code == 200
                
                # Verify response mapping worked
                assert res1.json()["emotion"] == "neutral"
                assert res2.json()["emotion"] == "neutral"
                
                # If serialized, it would take >= 0.4 seconds. If concurrent (via thread pool), it should take ~0.2-0.3 seconds.
                assert duration < 0.35, f"Requests took {duration:.2f}s, indicating serialization occurred."

    asyncio.run(run_test())


def test_slow_sparse_coach_speech_force_trigger(mock_run_rag_analysis):
    async def run_test():
        engine = LiveMeetingAnalysisEngine(line_threshold=5, word_threshold=40)
        session_id = "test_session_slow_coach"
        lock = asyncio.Lock()
        
        # Initialize the buffer by sending a line
        await engine.add_transcript(
            session_id=session_id,
            text="Initial client line",
            websocket=None,
            write_lock=lock,
            speaker="member"
        )
        
        # Set last success time in the past (> 2 minutes ago)
        engine._buffers[session_id]["last_success_time"] = time.time() - 130
        # Reset client counters and total counters to represent very sparse dialogue (well below thresholds)
        engine._buffers[session_id]["client_lines_since_last_success"] = 1
        engine._buffers[session_id]["client_words_since_last_success"] = 3
        engine._buffers[session_id]["lines_since_last"] = 1
        engine._buffers[session_id]["words_since_last"] = 3
        
        # Send a single sparse coach line (1 line, 2 words). 
        # Total activity is now 2 lines, 5 words (well below 5 lines / 40 words threshold).
        # But because 130 seconds have elapsed, it must force trigger immediately!
        await engine.add_transcript(
            session_id=session_id,
            text="Sparse coach",
            websocket=None,
            write_lock=lock,
            speaker="coach"
        )
        
        await asyncio.sleep(0.05)
        # The elapsed time fallback should trigger it
        assert mock_run_rag_analysis.call_count == 1

    asyncio.run(run_test())
