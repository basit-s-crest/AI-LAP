from typing import Dict, Optional
from pydantic import BaseModel, Field

class EmotionSignal(BaseModel):
    type: str = Field(default="emotion_signal")
    sessionId: str
    participantId: str
    timestamp: str
    dominantEmotion: str
    confidence: float
    source: str

class EmotionSignalAck(BaseModel):
    type: str = Field(default="emotion_signal_ack")
    timestamp: str
    status: str = Field(default="received")

class EmotionAggregation(BaseModel):
    dominantEmotion: str
    emotionCounts: Dict[str, int]
    latestEmotion: Optional[str]
    lastUpdatedAt: Optional[str]

class SessionAggregation(BaseModel):
    sessionId: str
    participants: Dict[str, EmotionAggregation]
    dominantEmotion: str
    emotionCounts: Dict[str, int]
    latestEmotion: Optional[str]
    lastUpdatedAt: Optional[str]
