"""
test_mock.py — Run this to test your endpoint before the LLM is ready.
Usage: python test_mock.py
"""
import requests
from datetime import datetime, timezone

BASE_URL = "http://localhost:8000"

# ── Test 1: Store a mock inference result (peer-post) ────────────────────────
print("\n--- Test 1: Store inference result (peer-post) ---")

payload = {
    "event_id":        "evt_01HX9Z_peer_001",
    "member_token":    "mbr_a3f9c2d8e1",
    "org_id":          "org_univ_maryland",
    "source_type":     "peer-post",
    "event_timestamp": datetime.now(timezone.utc).isoformat(),
    "model_version":   "1.0.0",
    "risk_tier":       "moderate",
    "risk_score":      0.620,
    "risk_trend":      "increasing",
    "cultural_context": ["AAVE_CODE_SWITCH", "MINIMIZATION"],
    "recommended_action": "schedule_followup",
    "active_signals": [
        {
            "signal_code":  "ISO-04",
            "signal_label": "Social isolation — indirect",
            "confidence":   0.810,
            "dimension":    "isolation"
        },
        {
            "signal_code":  "HOP-03",
            "signal_label": "Indirect hopelessness",
            "confidence":   0.740,
            "dimension":    "hopelessness"
        }
    ],
    "shap_attributions": [
        {"span": "cant keep going",      "weight": 0.4200, "signal_code": "HOP-03", "rank": 1},
        {"span": "nobody checks on me",  "weight": 0.3100, "signal_code": "ISO-04", "rank": 2}
    ]
}

r = requests.post(f"{BASE_URL}/v1/store-result", json=payload)
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")


# ── Test 2: Store another event (journal) for same member ────────────────────
print("\n--- Test 2: Store inference result (journal) ---")

payload2 = {
    "event_id":        "evt_01HX9Z_journal_001",
    "member_token":    "mbr_a3f9c2d8e1",   # same member
    "org_id":          "org_univ_maryland",
    "source_type":     "journal",
    "event_timestamp": datetime.now(timezone.utc).isoformat(),
    "model_version":   "1.0.0",
    "risk_tier":       "high",
    "risk_score":      0.810,
    "risk_trend":      "increasing",
    "cultural_context": [],
    "recommended_action": "immediate_crisis_protocol",
    "active_signals": [
        {
            "signal_code":  "HOP-03",
            "signal_label": "Hopelessness",
            "confidence":   0.920,
            "dimension":    "hopelessness"
        }
    ],
    "shap_attributions": [
        {"span": "no point anymore", "weight": 0.5500, "signal_code": "HOP-03", "rank": 1}
    ]
}

r2 = requests.post(f"{BASE_URL}/v1/store-result", json=payload2)
print(f"Status: {r2.status_code}")
print(f"Response: {r2.json()}")


# ── Test 3: Submit a clinician review ────────────────────────────────────────
print("\n--- Test 3: Submit clinician review ---")

review_payload = {
    "review_id":       "rev_01HX9Z_001",
    "event_id":        "evt_01HX9Z_peer_001",
    "member_token":    "mbr_a3f9c2d8e1",
    "therapist_id":    "thr_dr_osei_001",
    "action":          "scheduled_session",
    "clinician_notes": "Member showing signs of increasing isolation. Scheduled follow-up for Friday.",
    "reviewed_at":     datetime.now(timezone.utc).isoformat()
}

r3 = requests.post(f"{BASE_URL}/v1/review/action", json=review_payload)
print(f"Status: {r3.status_code}")
print(f"Response: {r3.json()}")


# ── Test 4: Health check ─────────────────────────────────────────────────────
print("\n--- Test 4: Health check ---")
r4 = requests.get(f"{BASE_URL}/health")
print(f"Status: {r4.status_code} | Response: {r4.json()}")
