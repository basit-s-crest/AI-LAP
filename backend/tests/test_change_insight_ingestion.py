import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from main import app
from app.modules.risk_engine.aggregator import compute_change_insights_score, compute_composite_score
from app.modules.risk_engine.constants import WEIGHT_CHANGE_INSIGHTS, HALF_LIFE_CHANGE_INSIGHT_DAYS
from app.modules.session_analysis.schemas import InferenceResultIn

client = TestClient(app)


# ── 1. Test Aggregator / Math Logic ───────────────────────────────────────────

def test_compute_change_insights_score_empty():
    """Verify source is not available if no change-insight events are found."""
    events = []
    contrib = compute_change_insights_score(events)
    assert contrib.available is False
    assert contrib.raw_score is None
    assert contrib.weighted_score is None


def test_compute_change_insights_score_single():
    """Verify single event score calculations."""
    now = datetime.now(timezone.utc)
    events = [
        {
            "source_type": "change-insight",
            "risk_score": 0.6,
            "event_timestamp": now
        }
    ]
    contrib = compute_change_insights_score(events)
    assert contrib.available is True
    assert contrib.raw_score == 0.6
    assert contrib.weighted_score == round(0.6 * WEIGHT_CHANGE_INSIGHTS, 4)


def test_compute_change_insights_score_decay():
    """Verify time-decay weights are applied properly."""
    now = datetime.now(timezone.utc)
    # Event 1: today (weight ~1.0)
    # Event 2: 14 days ago (weight 0.5 because half-life = 14)
    events = [
        {
            "source_type": "change-insight",
            "risk_score": 0.8,
            "event_timestamp": now
        },
        {
            "source_type": "change-insight",
            "risk_score": 0.4,
            "event_timestamp": now - timedelta(days=HALF_LIFE_CHANGE_INSIGHT_DAYS)
        }
    ]
    contrib = compute_change_insights_score(events)
    assert contrib.available is True
    # expected raw score: (0.8 * 1.0 + 0.4 * 0.5) / (1.0 + 0.5) = (0.8 + 0.2) / 1.5 = 1.0 / 1.5 ≈ 0.6667
    assert abs(contrib.raw_score - 0.6667) < 0.01


# ── 2. Test Ingestion Endpoint ────────────────────────────────────────────────

@patch("app.modules.session_analysis.router_ingest.run_inference")
def test_ingest_change_insight_endpoint(mock_run_inference):
    """Test POST /v1/ingest/change-insight with consent check & response parsing."""
    # Mock LLM response
    mock_run_inference.return_value = InferenceResultIn(
        event_id="test_evt_ci_001",
        member_token="test_member_001",
        org_id="org-test-001",
        source_type="change-insight",
        event_timestamp=datetime.now(timezone.utc),
        risk_tier="moderate",
        risk_score=0.55,
        risk_trend="stable",
        recommended_action="schedule_followup",
        active_signals=[]
    )

    payload = {
        "event_id": "test_evt_ci_001",
        "org_id": "org-test-001",
        "member_token": "test_member_001",
        "text": "Patient shows improving but moderate signs of anxiety.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "consent_active": True,
        "original_source_id": "insight_001"
    }

    response = client.post("/v1/ingest/change-insight", json=payload)
    assert response.status_code == 202
    
    resp_json = response.json()
    assert resp_json["status"] == "processed"
    assert resp_json["source"] == "change-insight"
    assert resp_json["risk_tier"] == "moderate"
    assert resp_json["risk_score"] == 0.55
