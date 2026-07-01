import time
from datetime import datetime, timezone, timedelta
from app.modules.live_video_analysis.service import (
    handle_emotion_signal,
    get_session_wide_aggregation,
    clear_session_buffer,
    parse_iso_timestamp,
    _clock_skews,
    _session_buffers
)

def test_clock_skew_alignment_and_windowed_aggregation():
    session_id = "test_sync_session"
    participant_id = "test_sync_member"
    
    # 1. Clean up buffers
    clear_session_buffer(session_id)
    
    # 2. Simulate a client clock that is 5 seconds slow (client timestamp is in the past)
    client_now = datetime.now(timezone.utc) - timedelta(seconds=5)
    
    payload = {
        "sessionId": session_id,
        "participantId": participant_id,
        "timestamp": client_now.isoformat(),
        "dominantEmotion": "Anxious",
        "confidence": 0.9,
        "source": "local_mock"
    }
    
    # Act: Process the signal
    ack = handle_emotion_signal(payload)
    assert ack.status == "received"
    
    # Assert clock skew is calculated
    key = f"{session_id}/{participant_id}"
    assert key in _clock_skews
    skew_secs = _clock_skews[key].total_seconds()
    # Skew should be around 5 seconds
    assert 4.0 <= skew_secs <= 6.0
    
    # Assert timestamp in buffer is corrected to server clock (i.e. close to server's now)
    buffer = _session_buffers[session_id][participant_id]
    assert len(buffer) == 1
    buffered_sig = buffer[0]
    buffered_time = parse_iso_timestamp(buffered_sig.timestamp)
    now = datetime.now(timezone.utc)
    
    # The corrected timestamp should be within 1 second of server's now
    time_diff = abs((now - buffered_time).total_seconds())
    assert time_diff < 1.0
    
    # 3. Test sliding window aggregation
    # Add a signal from 70 seconds ago (in corrected server time).
    # Since we dynamically align client timestamps using clock skew, let's create a payload with client time = 75 seconds ago
    client_old = datetime.now(timezone.utc) - timedelta(seconds=75)
    payload_old = {
        "sessionId": session_id,
        "participantId": participant_id,
        "timestamp": client_old.isoformat(),
        "dominantEmotion": "Calm",
        "confidence": 0.8,
        "source": "local_mock"
    }
    handle_emotion_signal(payload_old)
    
    # Query aggregation with 60-second window. The old signal (70s corrected) should be excluded.
    agg_60s = get_session_wide_aggregation(session_id, window_seconds=60)
    # Total emotionCounts for Anxious should be 1, Calm should be 0
    assert agg_60s.emotionCounts.get("Anxious") == 1
    assert agg_60s.emotionCounts.get("Calm") is None
    
    # Query aggregation with 120-second window. Both should be included.
    agg_120s = get_session_wide_aggregation(session_id, window_seconds=120)
    assert agg_120s.emotionCounts.get("Anxious") == 1
    assert agg_120s.emotionCounts.get("Calm") == 1
    
    # Clean up buffers
    clear_session_buffer(session_id)
    assert key not in _clock_skews
    assert session_id not in _session_buffers
    
    print("test_clock_skew_alignment_and_windowed_aggregation passed successfully!")

if __name__ == "__main__":
    test_clock_skew_alignment_and_windowed_aggregation()
