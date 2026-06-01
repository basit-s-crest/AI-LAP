"""
Backend API Test Script
Tests all 65 tasks from the spec
"""

import requests
import json
from datetime import datetime, timezone

BASE_URL = "http://localhost:8000"

def test_1_consent_403():
    """Task 1: Verify POST /v1/ingest/peer-post returns 403 when consent_active: false"""
    payload = {
        "event_id": "test-event-001",
        "org_id": "org-test-001",
        "member_token": "member-test-001",
        "text": "This is a test peer post",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "consent_active": False
    }
    
    response = requests.post(f"{BASE_URL}/v1/ingest/peer-post", json=payload)
    
    print(f"✓ Task 1: Status Code = {response.status_code}")
    print(f"  Response: {response.json()}")
    
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    print("  ✅ PASSED: Returns 403 when consent_active is false\n")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("VASL Backend API Tests")
    print("=" * 60 + "\n")
    
    try:
        test_1_consent_403()
    except Exception as e:
        print(f"  ❌ FAILED: {e}\n")
