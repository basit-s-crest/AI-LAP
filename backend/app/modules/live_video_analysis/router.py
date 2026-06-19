import logging
import base64
import io
from typing import Dict, Optional
from pydantic import BaseModel
from PIL import Image
import numpy as np
import torch
from fastapi import APIRouter, HTTPException
from app.modules.live_video_analysis.schemas import SessionAggregation
from app.modules.live_video_analysis.service import get_session_wide_aggregation

# Patch torch.load to bypass weights_only=True and map cuda to cpu for PyTorch 2.6+
orig_load = torch.load
def patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    kwargs['map_location'] = 'cpu'
    return orig_load(*args, **kwargs)
torch.load = patched_load

from hsemotion.facial_emotions import HSEmotionRecognizer

logger = logging.getLogger(__name__)

# Router with no fixed prefix to allow registering both v1 and non-v1 routes
router = APIRouter(tags=["Live Video Analysis"])

# Initialize model once at module load
try:
    logger.info("[LiveVideoAnalysis] Initializing HSEmotion EfficientNet-B2 model...")
    fer_model = HSEmotionRecognizer(model_name='enet_b2_8', device='cpu')
    logger.info("[LiveVideoAnalysis] HSEmotion model initialized successfully.")
except Exception as e:
    logger.error(f"[LiveVideoAnalysis] Failed to load HSEmotion model: {e}")
    fer_model = None

EMOTION_MAP = {
    'Anger': 'angry',
    'Contempt': 'contempt',
    'Disgust': 'disgust',
    'Fear': 'fear',
    'Happiness': 'happy',
    'Neutral': 'neutral',
    'Sadness': 'sad',
    'Surprise': 'surprise'
}

class EmotionDetectRequest(BaseModel):
    frame: str

class EmotionDetectResponse(BaseModel):
    emotion: str
    confidence: float
    all_scores: Optional[Dict[str, float]] = None

@router.post("/api/emotion/detect", response_model=EmotionDetectResponse)
async def detect_emotion_endpoint(payload: EmotionDetectRequest):
    """
    Classify facial emotion from a base64 encoded image frame using HSEmotion EfficientNet-B2.
    """
    if fer_model is None:
        logger.error("[LiveVideoAnalysis] HSEmotion model is not loaded.")
        return EmotionDetectResponse(emotion="unknown", confidence=0.0)

    try:
        base64_frame = payload.frame
        if "," in base64_frame:
            base64_frame = base64_frame.split(",")[1]

        img_bytes = base64.b64decode(base64_frame)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_np = np.array(img)

        # Run inference
        emotion, scores = fer_model.predict_emotions(img_np, logits=False)

        mapped_emotion = EMOTION_MAP.get(emotion, emotion.lower())
        all_scores = {}
        for idx, score_val in enumerate(scores):
            class_name = fer_model.idx_to_class[idx]
            mapped_name = EMOTION_MAP.get(class_name, class_name.lower())
            all_scores[mapped_name] = float(score_val)

        confidence = all_scores.get(mapped_emotion, 0.0)

        return EmotionDetectResponse(
            emotion=mapped_emotion,
            confidence=confidence,
            all_scores=all_scores
        )
    except Exception as e:
        logger.error(f"[LiveVideoAnalysis] Error detecting emotion: {e}")
        return EmotionDetectResponse(emotion="unknown", confidence=0.0)

@router.get("/v1/live-video-analysis/{session_id}/aggregation", response_model=SessionAggregation)
async def get_session_aggregation_endpoint(session_id: str):
    """
    Get the in-memory emotion aggregation for the given session.
    """
    try:
        agg = get_session_wide_aggregation(session_id)
        return agg
    except Exception as e:
        logger.error(f"Error fetching session aggregation for {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

