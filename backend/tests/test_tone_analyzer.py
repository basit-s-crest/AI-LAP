import numpy as np
import pytest
from app.modules.live_analysis.tone_analyzer import (
    _classify_vocal_affect,
    _compute_congruence,
    ToneAnalyzer,
    ToneSnapshot
)

def test_classify_vocal_affect():
    # Test neutral affect
    valence = _classify_vocal_affect(
        pitch_mean=150.0,
        pitch_std=15.0,
        energy_mean=0.04,
        energy_trend="stable",
        pause_ratio=0.1,
        laughter=False,
        sigh=False,
        voice_break=False
    )
    assert -0.2 <= valence <= 0.2

    # Test laughter pushes valence positive
    valence_laughter = _classify_vocal_affect(
        pitch_mean=220.0,
        pitch_std=60.0,
        energy_mean=0.09,
        energy_trend="rising",
        pause_ratio=0.1,
        laughter=True,
        sigh=False,
        voice_break=False
    )
    assert valence_laughter > 0.3

    # Test voice break pushes valence negative
    valence_break = _classify_vocal_affect(
        pitch_mean=150.0,
        pitch_std=15.0,
        energy_mean=0.04,
        energy_trend="stable",
        pause_ratio=0.1,
        laughter=False,
        sigh=False,
        voice_break=True
    )
    assert valence_break < -0.2

def test_compute_congruence():
    # Test congruent positive delivery
    score, flag, affect = _compute_congruence(
        text_sentiment=0.8,     # positive text
        vocal_valence=0.7,      # positive delivery
        laughter=True,
        sigh=False,
        voice_break=False,
        pitch_std=60.0,
        energy_mean=0.09,
        pause_ratio=0.1
    )
    assert score >= 0.7
    assert flag is False
    assert affect == "elevated"

    # Test incongruent negative text + laughter (deflection/masking)
    score, flag, affect = _compute_congruence(
        text_sentiment=-0.91,    # negative words
        vocal_valence=0.5,       # laughing delivery
        laughter=True,
        sigh=False,
        voice_break=False,
        pitch_std=60.0,
        energy_mean=0.09,
        pause_ratio=0.1
    )
    assert score < 0.4
    assert flag is True
    assert affect == "incongruent"

    # Test incongruent positive words + flat delivery
    score, flag, affect = _compute_congruence(
        text_sentiment=0.8,      # positive words
        vocal_valence=-0.3,      # flat/monotone delivery
        laughter=False,
        sigh=False,
        voice_break=False,
        pitch_std=8.0,          # low pitch variability
        energy_mean=0.015,       # low energy
        pause_ratio=0.1
    )
    assert score < 0.4
    assert flag is True
    assert affect == "incongruent"

def test_tone_analyzer_analyze_empty():
    analyzer = ToneAnalyzer()
    # If no audio buffered, analyze should return None
    import asyncio
    snapshot = asyncio.run(analyzer.analyze("test-session", "hello"))
    assert snapshot is None

def test_audio_buffer_header():
    import asyncio
    from app.modules.live_analysis.tone_analyzer import AudioBuffer

    async def run_test():
        buf = AudioBuffer(max_seconds=2.0)
        
        # Add header chunk
        header_bytes = b"webmheaderinfo"
        await buf.add(header_bytes)
        assert buf.header == header_bytes

        # Add another chunk
        await buf.add(b"chunk1")

        # Get all
        all_data = await buf.get_all()
        assert all_data == b"webmheaderinfo" + b"chunk1"

        # Drain
        drained_data = await buf.drain()
        assert drained_data == b"webmheaderinfo" + b"chunk1"
        assert len(buf.chunks) == 0

        # Header should still be preserved
        assert buf.header == header_bytes

        # Add more chunks (header should be prepended even though chunks queue was drained/cleared)
        await buf.add(b"chunk2")
        drained_again = await buf.drain()
        assert drained_again == b"webmheaderinfo" + b"chunk2"

    asyncio.run(run_test())

