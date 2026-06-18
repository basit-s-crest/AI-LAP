import logging
import threading
from datetime import datetime, timezone
from typing import Dict
from pydantic import ValidationError
from app.modules.live_video_analysis.schemas import EmotionSignal, EmotionSignalAck, EmotionAggregation, SessionAggregation

logger = logging.getLogger(__name__)

# Thread-safe in-memory buffer: session_id -> { participant_id -> list of EmotionSignal }
_buffer_lock = threading.Lock()
_session_buffers: Dict[str, Dict[str, list]] = {}

def parse_iso_timestamp(ts_str: str) -> datetime:
    try:
        if ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        return datetime.fromisoformat(ts_str)
    except Exception:
        return datetime.now(timezone.utc)

def _buffer_signal(signal: EmotionSignal) -> None:
    session_id = signal.sessionId
    participant_id = signal.participantId
    
    with _buffer_lock:
        if session_id not in _session_buffers:
            _session_buffers[session_id] = {}
        if participant_id not in _session_buffers[session_id]:
            _session_buffers[session_id][participant_id] = []
            
        buffer = _session_buffers[session_id][participant_id]
        buffer.append(signal)
        
        # Prune older than 2 minutes and keep max 10
        now = datetime.now(timezone.utc)
        valid_signals = []
        for sig in buffer:
            sig_time = parse_iso_timestamp(sig.timestamp)
            if (now - sig_time).total_seconds() <= 120:
                valid_signals.append(sig)
                
        # Keep only last 10
        if len(valid_signals) > 10:
            valid_signals = valid_signals[-10:]
            
        _session_buffers[session_id][participant_id] = valid_signals

def handle_emotion_signal(payload: dict) -> EmotionSignalAck:
    try:
        # Validate payload using schema
        signal = EmotionSignal(**payload)
        
        # Buffer validated signal
        _buffer_signal(signal)
        
        # Log minimal metadata
        logger.info(
            f"[LiveVideoAnalysis] Processing validated emotion signal: "
            f"sessionId={signal.sessionId}, participantId={signal.participantId}, "
            f"dominantEmotion={signal.dominantEmotion}, confidence={signal.confidence}"
        )
        
        # Return success ack
        return EmotionSignalAck(timestamp=signal.timestamp, status="received")
        
    except ValidationError as e:
        logger.warning(f"[LiveVideoAnalysis] Validation error: {e}")
        # Extract timestamp from payload safely if available, else generate one
        timestamp = payload.get("timestamp") if isinstance(payload, dict) else None
        if not timestamp or not isinstance(timestamp, str):
            timestamp = datetime.now(timezone.utc).isoformat()
            
        # Return ignored/invalid ack
        return EmotionSignalAck(timestamp=timestamp, status="ignored")

def get_participant_aggregation(session_id: str, participant_id: str) -> EmotionAggregation:
    with _buffer_lock:
        session_buf = _session_buffers.get(session_id, {})
        signals = session_buf.get(participant_id, [])
        
        # Prune older than 2 minutes
        now = datetime.now(timezone.utc)
        valid_signals = []
        for sig in signals:
            sig_time = parse_iso_timestamp(sig.timestamp)
            if (now - sig_time).total_seconds() <= 120:
                valid_signals.append(sig)
                
        # Update buffer
        if session_id in _session_buffers and participant_id in _session_buffers[session_id]:
            _session_buffers[session_id][participant_id] = valid_signals
            
    if not valid_signals:
        return EmotionAggregation(
            dominantEmotion="Neutral",
            emotionCounts={},
            latestEmotion=None,
            lastUpdatedAt=None
        )
        
    counts = {}
    for sig in valid_signals:
        counts[sig.dominantEmotion] = counts.get(sig.dominantEmotion, 0) + 1
        
    # Dominant emotion (highest count)
    dominant = max(counts, key=counts.get)
    
    latest_sig = valid_signals[-1]
    
    return EmotionAggregation(
        dominantEmotion=dominant,
        emotionCounts=counts,
        latestEmotion=latest_sig.dominantEmotion,
        lastUpdatedAt=latest_sig.timestamp
    )

def get_session_aggregation(session_id: str) -> Dict[str, EmotionAggregation]:
    with _buffer_lock:
        session_buf = _session_buffers.get(session_id, {})
        participant_ids = list(session_buf.keys())
        
    return {
        part_id: get_participant_aggregation(session_id, part_id)
        for part_id in participant_ids
    }

def clear_session_buffer(session_id: str) -> None:
    with _buffer_lock:
        if session_id in _session_buffers:
            del _session_buffers[session_id]
            logger.info(f"[LiveVideoAnalysis] Cleared in-memory emotion buffer for sessionId={session_id}")

def clear_participant_buffer(session_id: str, participant_id: str) -> None:
    with _buffer_lock:
        if session_id in _session_buffers:
            if participant_id in _session_buffers[session_id]:
                del _session_buffers[session_id][participant_id]
                logger.info(
                    f"[LiveVideoAnalysis] Cleared in-memory emotion buffer for "
                    f"sessionId={session_id}, participantId={participant_id}"
                )
            if not _session_buffers[session_id]:
                del _session_buffers[session_id]

def get_session_wide_aggregation(session_id: str) -> SessionAggregation:
    # 1. Get participant-level aggregations
    participants = get_session_aggregation(session_id)
    
    # If no participants are active or have sent any signals:
    if not participants:
        return SessionAggregation(
            sessionId=session_id,
            participants={},
            dominantEmotion="Neutral",
            emotionCounts={},
            latestEmotion=None,
            lastUpdatedAt=None
        )
        
    # 2. Compute session-wide metrics
    session_counts = {}
    latest_ts = None
    latest_emotion = None
    
    for part_id, part_agg in participants.items():
        # Accumulate emotion counts
        for emotion, count in part_agg.emotionCounts.items():
            session_counts[emotion] = session_counts.get(emotion, 0) + count
            
        # Track latest overall emotion based on lastUpdatedAt ISO strings
        if part_agg.lastUpdatedAt:
            if latest_ts is None or part_agg.lastUpdatedAt > latest_ts:
                latest_ts = part_agg.lastUpdatedAt
                latest_emotion = part_agg.latestEmotion
                
    # Dominant emotion across the session
    dominant = max(session_counts, key=session_counts.get) if session_counts else "Neutral"
    
    return SessionAggregation(
        sessionId=session_id,
        participants=participants,
        dominantEmotion=dominant,
        emotionCounts=session_counts,
        latestEmotion=latest_emotion,
        lastUpdatedAt=latest_ts
    )
