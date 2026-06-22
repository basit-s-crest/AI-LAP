"""
Tone Analyzer — Real-time Vocal Feature Extraction
====================================================
Buffers raw audio arriving from the STT WebSocket, and on each STT final
transcript, extracts acoustic features using librosa to produce a ToneSnapshot.

Features extracted:
  • Pitch (F0): mean, std via librosa.pyin
  • Energy (RMS): mean + trend (rising/falling/stable)
  • Speech rate: words-per-minute estimate
  • Pause ratio: silence proportion via energy thresholding
  • Vocal texture markers: laughter, sighs, voice breaks

Affect congruence is computed by comparing text sentiment (TextBlob polarity)
against vocal delivery. When words and tone disagree, an incongruence flag
is raised — catching masking behavior that text analysis alone misses.
"""

from __future__ import annotations

import io
import time
import asyncio
import logging
import struct
from dataclasses import dataclass, asdict
from typing import Dict, Optional
from collections import deque

import numpy as np

logger = logging.getLogger(__name__)

# Try to import audio processing libraries — graceful degradation if unavailable
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("[ToneAnalyzer] librosa not installed. Tone analysis will be disabled.")

try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False
    logger.warning("[ToneAnalyzer] pydub not installed. Audio decoding will be disabled.")

try:
    from textblob import TextBlob
    TEXTBLOB_AVAILABLE = True
except ImportError:
    TEXTBLOB_AVAILABLE = False
    logger.warning("[ToneAnalyzer] textblob not installed. Text sentiment will use fallback.")


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class ToneSnapshot:
    """Acoustic + sentiment features for a segment of speech."""
    timestamp: str
    # Acoustic features
    pitch_mean: float = 0.0
    pitch_std: float = 0.0
    energy_mean: float = 0.0
    energy_trend: str = "stable"       # "rising" | "falling" | "stable"
    speech_rate_wpm: float = 0.0
    pause_ratio: float = 0.0           # 0.0–1.0
    # Vocal texture
    laughter_detected: bool = False
    sigh_detected: bool = False
    voice_break_detected: bool = False
    # Derived
    affect_label: str = "neutral"      # "flat" | "distressed" | "elevated" | "calm" | "nervous" | "incongruent"
    text_sentiment_score: float = 0.0  # -1.0 to 1.0
    congruence_score: float = 1.0      # 0.0 to 1.0
    incongruence_flag: bool = False

    def to_dict(self) -> dict:
        return asdict(self)

    def to_human_summary(self) -> str:
        """Human-readable summary for LLM context injection."""
        lines = []

        # Pitch
        pitch_desc = "normal"
        if self.pitch_mean > 250:
            pitch_desc = "elevated"
        elif self.pitch_mean > 0 and self.pitch_mean < 120:
            pitch_desc = "low"
        lines.append(
            f"- Pitch: {pitch_desc} (mean {self.pitch_mean:.0f}Hz, variability {self.pitch_std:.0f}Hz)"
        )

        # Energy
        lines.append(f"- Energy: {self.energy_trend} trend, mean RMS {self.energy_mean:.3f}")

        # Speech rate
        rate_desc = "normal"
        if self.speech_rate_wpm > 180:
            rate_desc = "rapid"
        elif self.speech_rate_wpm > 0 and self.speech_rate_wpm < 100:
            rate_desc = "slow"
        lines.append(f"- Speech rate: {self.speech_rate_wpm:.0f} WPM ({rate_desc})")

        # Pause ratio
        pause_desc = "minimal pausing"
        if self.pause_ratio > 0.4:
            pause_desc = "frequent long pauses"
        elif self.pause_ratio > 0.2:
            pause_desc = "moderate pausing"
        lines.append(f"- Pause ratio: {self.pause_ratio:.2f} ({pause_desc})")

        # Vocal markers
        markers = []
        if self.laughter_detected:
            markers.append("laughter")
        if self.sigh_detected:
            markers.append("sighing")
        if self.voice_break_detected:
            markers.append("voice breaks/tremor")
        if markers:
            lines.append(f"- Vocal markers: {', '.join(markers)} detected")
        else:
            lines.append("- Vocal markers: none detected")

        # Text sentiment
        sent_desc = "neutral"
        if self.text_sentiment_score < -0.3:
            sent_desc = "negative"
        elif self.text_sentiment_score > 0.3:
            sent_desc = "positive"
        lines.append(f"- Text sentiment: {sent_desc} ({self.text_sentiment_score:.2f})")

        # Congruence
        cong_desc = "HIGH"
        if self.congruence_score < 0.4:
            cong_desc = "LOW"
        elif self.congruence_score < 0.7:
            cong_desc = "MODERATE"

        cong_line = f"- Affect congruence: {cong_desc} ({self.congruence_score:.2f})"
        if self.incongruence_flag:
            cong_line += " — ⚠️ INCONGRUENCE DETECTED: words and vocal delivery do not align, possible deflection or masking"
        lines.append(cong_line)

        # Overall affect
        lines.append(f"- Overall affect label: {self.affect_label}")

        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Audio buffer — rolling window per session
# ---------------------------------------------------------------------------

class AudioBuffer:
    """Accumulates raw audio bytes for a session with a max age."""

    def __init__(self, max_seconds: float = 15.0):
        self.max_seconds = max_seconds
        self.chunks: deque[tuple[float, bytes]] = deque()
        self.header: bytes = b""
        self.lock = asyncio.Lock()

    async def add(self, audio_bytes: bytes) -> None:
        async with self.lock:
            if not self.header and audio_bytes:
                self.header = audio_bytes
            self.chunks.append((time.time(), audio_bytes))
            self._evict_old()

    def _evict_old(self) -> None:
        cutoff = time.time() - self.max_seconds
        while self.chunks and self.chunks[0][0] < cutoff:
            self.chunks.popleft()

    async def drain(self) -> bytes:
        """Return all buffered audio and clear the buffer."""
        async with self.lock:
            if not self.chunks:
                return b""
            combined = b"".join(chunk for _, chunk in self.chunks)
            self.chunks.clear()
            if self.header and not combined.startswith(self.header):
                return self.header + combined
            return combined

    async def get_all(self) -> bytes:
        """Return all buffered audio without clearing."""
        async with self.lock:
            if not self.chunks:
                return b""
            combined = b"".join(chunk for _, chunk in self.chunks)
            if self.header and not combined.startswith(self.header):
                return self.header + combined
            return combined



# ---------------------------------------------------------------------------
# ToneAnalyzer — main service
# ---------------------------------------------------------------------------

SAMPLE_RATE = 16000  # Standard for speech analysis


class ToneAnalyzer:
    """
    Per-session audio buffering and acoustic feature extraction.

    Audio arrives as WebM/Opus chunks from the browser's MediaRecorder.
    On each STT final transcript, we:
      1. Drain the audio buffer
      2. Decode WebM → PCM via pydub
      3. Extract acoustic features via librosa
      4. Compute text sentiment via TextBlob
      5. Compute affect congruence score
      6. Return a ToneSnapshot
    """

    def __init__(self):
        self._buffers: Dict[str, AudioBuffer] = {}
        self._lock = asyncio.Lock()
        self._enabled = LIBROSA_AVAILABLE and PYDUB_AVAILABLE

        if not self._enabled:
            logger.warning(
                "[ToneAnalyzer] Disabled — missing librosa and/or pydub. "
                "Install both for vocal tone analysis."
            )

    async def buffer_audio(self, session_id: str, audio_chunk: bytes) -> None:
        """Buffer an incoming audio chunk for a session."""
        if not self._enabled or not audio_chunk:
            return

        async with self._lock:
            if session_id not in self._buffers:
                self._buffers[session_id] = AudioBuffer(max_seconds=15.0)

        buf = self._buffers[session_id]
        await buf.add(audio_chunk)

    async def analyze(
        self,
        session_id: str,
        transcript_text: str,
        audio_duration_estimate: float = 0.0,
    ) -> Optional[ToneSnapshot]:
        """
        Extract acoustic features from buffered audio and compute
        text+tone sentiment fusion.

        Called when a final transcript arrives from Deepgram.
        """
        if not self._enabled:
            return None

        async with self._lock:
            buf = self._buffers.get(session_id)
        if not buf:
            return None

        # Drain the buffer — we analyze what we have and reset
        raw_audio = await buf.drain()
        if not raw_audio or len(raw_audio) < 1000:
            # Too little audio to analyze meaningfully
            return None

        try:
            # Decode WebM → float32 PCM
            pcm_array = await asyncio.get_event_loop().run_in_executor(
                None, self._decode_audio, raw_audio
            )
            if pcm_array is None or len(pcm_array) < SAMPLE_RATE * 0.5:
                # Less than 0.5s of audio — skip
                return None

            # Extract acoustic features
            features = await asyncio.get_event_loop().run_in_executor(
                None, self._extract_features, pcm_array, transcript_text
            )

            return features

        except Exception as e:
            logger.error(f"[ToneAnalyzer] Analysis failed for session {session_id}: {e}")
            return None

    async def clear_session(self, session_id: str) -> None:
        """Clean up buffers when a session ends."""
        async with self._lock:
            self._buffers.pop(session_id, None)

    # ------------------------------------------------------------------
    # Audio decoding (runs in executor — CPU-bound)
    # ------------------------------------------------------------------

    @staticmethod
    def _decode_audio(raw_webm: bytes) -> Optional[np.ndarray]:
        """Decode WebM/Opus audio bytes to float32 numpy array at 16kHz mono."""
        try:
            audio_segment = AudioSegment.from_file(
                io.BytesIO(raw_webm), format="webm"
            )
            # Convert to mono 16kHz
            audio_segment = audio_segment.set_channels(1).set_frame_rate(SAMPLE_RATE)

            # Convert to float32 numpy array
            samples = np.array(audio_segment.get_array_of_samples(), dtype=np.float32)
            # Normalize to [-1.0, 1.0]
            max_val = float(2 ** (audio_segment.sample_width * 8 - 1))
            samples = samples / max_val

            return samples

        except Exception as e:
            logger.warning(f"[ToneAnalyzer] Failed to decode audio: {e}")
            return None

    # ------------------------------------------------------------------
    # Feature extraction (runs in executor — CPU-bound)
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_features(pcm: np.ndarray, transcript_text: str) -> ToneSnapshot:
        """Extract pitch, energy, speech rate, pause ratio, and vocal markers."""
        duration = len(pcm) / SAMPLE_RATE
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

        # --- Pitch (F0) via pyin ---
        pitch_mean = 0.0
        pitch_std = 0.0
        voice_break_detected = False

        try:
            f0, voiced_flag, _ = librosa.pyin(
                pcm,
                sr=SAMPLE_RATE,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C7"),
            )
            # Filter out NaN (unvoiced segments)
            voiced_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])

            if len(voiced_f0) > 0:
                pitch_mean = float(np.mean(voiced_f0))
                pitch_std = float(np.std(voiced_f0))

                # Voice break detection: large pitch discontinuities
                if len(voiced_f0) > 2:
                    diffs = np.abs(np.diff(voiced_f0))
                    if np.any(diffs > pitch_mean * 0.5):
                        voice_break_detected = True

        except Exception as e:
            logger.debug(f"[ToneAnalyzer] Pitch extraction failed: {e}")

        # --- Energy (RMS) ---
        energy_mean = 0.0
        energy_trend = "stable"

        try:
            rms = librosa.feature.rms(y=pcm, frame_length=2048, hop_length=512)[0]
            if len(rms) > 0:
                energy_mean = float(np.mean(rms))

                # Trend: compare first half vs second half
                if len(rms) > 4:
                    mid = len(rms) // 2
                    first_half = np.mean(rms[:mid])
                    second_half = np.mean(rms[mid:])
                    ratio = second_half / (first_half + 1e-8)
                    if ratio > 1.3:
                        energy_trend = "rising"
                    elif ratio < 0.7:
                        energy_trend = "falling"

        except Exception as e:
            logger.debug(f"[ToneAnalyzer] Energy extraction failed: {e}")

        # --- Speech rate (WPM estimate) ---
        word_count = len(transcript_text.split()) if transcript_text else 0
        speech_rate_wpm = (word_count / duration) * 60.0 if duration > 0 else 0.0

        # --- Pause ratio ---
        pause_ratio = 0.0
        try:
            if len(rms) > 0:
                silence_threshold = 0.02  # RMS below this = silence
                silence_frames = np.sum(rms < silence_threshold)
                pause_ratio = float(silence_frames / len(rms))
        except Exception:
            pass

        # --- Vocal texture markers ---
        laughter_detected = False
        sigh_detected = False

        try:
            # Laughter heuristic: high pitch variance + high energy + rapid modulation
            if pitch_std > 40 and energy_mean > 0.05 and pitch_mean > 180:
                laughter_detected = True

            # Sigh heuristic: falling pitch contour + low energy at end
            if len(voiced_f0) > 4:
                last_quarter = voiced_f0[int(len(voiced_f0) * 0.75):]
                first_quarter = voiced_f0[:int(len(voiced_f0) * 0.25)]
                if len(first_quarter) > 0 and len(last_quarter) > 0:
                    if np.mean(last_quarter) < np.mean(first_quarter) * 0.7:
                        if energy_trend == "falling":
                            sigh_detected = True

        except Exception as e:
            logger.debug(f"[ToneAnalyzer] Vocal marker detection failed: {e}")

        # --- Text sentiment ---
        text_sentiment_score = 0.0
        if TEXTBLOB_AVAILABLE and transcript_text:
            try:
                blob = TextBlob(transcript_text)
                text_sentiment_score = float(blob.sentiment.polarity)  # -1.0 to 1.0
            except Exception:
                pass

        # --- Vocal affect classification ---
        vocal_valence = _classify_vocal_affect(
            pitch_mean, pitch_std, energy_mean, energy_trend,
            pause_ratio, laughter_detected, sigh_detected, voice_break_detected
        )

        # --- Affect congruence ---
        congruence_score, incongruence_flag, affect_label = _compute_congruence(
            text_sentiment_score, vocal_valence,
            laughter_detected, sigh_detected, voice_break_detected,
            pitch_std, energy_mean, pause_ratio
        )

        return ToneSnapshot(
            timestamp=timestamp,
            pitch_mean=round(pitch_mean, 1),
            pitch_std=round(pitch_std, 1),
            energy_mean=round(energy_mean, 4),
            energy_trend=energy_trend,
            speech_rate_wpm=round(speech_rate_wpm, 0),
            pause_ratio=round(pause_ratio, 3),
            laughter_detected=laughter_detected,
            sigh_detected=sigh_detected,
            voice_break_detected=voice_break_detected,
            affect_label=affect_label,
            text_sentiment_score=round(text_sentiment_score, 3),
            congruence_score=round(congruence_score, 3),
            incongruence_flag=incongruence_flag,
        )


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _classify_vocal_affect(
    pitch_mean: float,
    pitch_std: float,
    energy_mean: float,
    energy_trend: str,
    pause_ratio: float,
    laughter: bool,
    sigh: bool,
    voice_break: bool,
) -> float:
    """
    Map acoustic features to a vocal valence score: -1.0 (distressed) to +1.0 (elevated/happy).
    0.0 = neutral/calm.
    """
    score = 0.0

    # High pitch variance suggests emotional activation
    if pitch_std > 50:
        score += 0.3  # Could be positive (excitement) or negative (distress)
    elif pitch_std < 10 and pitch_mean > 0:
        score -= 0.3  # Monotone — possible flat affect

    # Energy
    if energy_mean > 0.08:
        score += 0.2  # Elevated energy
    elif energy_mean < 0.02 and energy_mean > 0:
        score -= 0.2  # Low energy

    # Pause ratio
    if pause_ratio > 0.4:
        score -= 0.2  # Lots of pauses — hesitancy/distress

    # Vocal markers
    if laughter:
        score += 0.4  # Laughter pushes vocal valence positive
    if sigh:
        score -= 0.3
    if voice_break:
        score -= 0.4  # Voice breaks suggest distress

    return max(-1.0, min(1.0, score))


def _compute_congruence(
    text_sentiment: float,
    vocal_valence: float,
    laughter: bool,
    sigh: bool,
    voice_break: bool,
    pitch_std: float,
    energy_mean: float,
    pause_ratio: float,
) -> tuple[float, bool, str]:
    """
    Compute affect congruence between text sentiment and vocal delivery.

    Returns: (congruence_score, incongruence_flag, affect_label)

    Key cases:
    - Negative text + laughter → LOW congruence (deflection/masking)
    - Positive text + flat monotone → LOW congruence (anhedonia)
    - Calm words + spiking energy → LOW congruence (hidden agitation)
    """
    # Base congruence: how aligned are text and vocal valence?
    # Both on [-1, 1] scale. Perfect alignment = same sign and similar magnitude.
    alignment = 1.0 - abs(text_sentiment - vocal_valence) / 2.0

    congruence = alignment

    # Special incongruence detectors
    reasons = []

    # Case 1: Negative text + laughter (the "I'm gonna die" while laughing case)
    if text_sentiment < -0.3 and laughter:
        congruence = min(congruence, 0.25)
        reasons.append("negative_words_with_laughter")

    # Case 2: Positive/neutral text + flat monotone + low energy (anhedonia)
    if text_sentiment > 0.1 and pitch_std < 15 and energy_mean < 0.03 and energy_mean > 0:
        congruence = min(congruence, 0.35)
        reasons.append("positive_words_flat_delivery")

    # Case 3: Calm words + high energy/pitch variance (hidden agitation)
    if text_sentiment > -0.1 and text_sentiment < 0.3:
        if energy_mean > 0.1 and pitch_std > 45:
            congruence = min(congruence, 0.30)
            reasons.append("calm_words_agitated_delivery")

    # Case 4: Voice breaks on any topic
    if voice_break and abs(text_sentiment) < 0.3:
        congruence = min(congruence, 0.40)
        reasons.append("voice_break_on_neutral_topic")

    incongruence_flag = congruence < 0.4

    # Determine affect label
    if incongruence_flag:
        affect_label = "incongruent"
    elif text_sentiment < -0.4 and vocal_valence < -0.2:
        affect_label = "distressed"
    elif pitch_std < 12 and energy_mean < 0.03 and energy_mean > 0:
        affect_label = "flat"
    elif voice_break or (sigh and pause_ratio > 0.3):
        affect_label = "nervous"
    elif vocal_valence > 0.3 and text_sentiment > 0.1:
        affect_label = "elevated"
    elif abs(vocal_valence) < 0.2 and abs(text_sentiment) < 0.2:
        affect_label = "calm"
    else:
        affect_label = "neutral"

    return (round(congruence, 3), incongruence_flag, affect_label)
