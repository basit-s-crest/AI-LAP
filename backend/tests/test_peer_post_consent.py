"""
Test: POST /v1/ingest/peer-post returns 403 when consent_active: false

This test verifies that the endpoint properly rejects requests when
the member has not provided active consent.
"""

import httpx
from datetime import datetime, timezone


def test_peer_post_consent_false_returns_403():
    """
    Test that POST /v1/ingest/peer-post returns HTTP 403
    when consent_active is set to false.
    """
    # Arrange: Create a request payload with consent_active: false
    payload = {
        "event_id": "test_evt_consent_false_001",
        "org_id": "test_org_001",
        "member_token": "test_member_001",
        "group_id": "test_group_001",
        "text": "This is a test peer post message.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "consent_active": False
    }
    
    # Act: Make POST request to the endpoint
    response = httpx.post(
        "http://localhost:8000/v1/ingest/peer-post",
        json=payload,
        timeout=10.0
    )
    
    # Assert: Verify response status code is 403
    assert response.status_code == 403, (
        f"Expected status code 403, but got {response.status_code}. "
        f"Response body: {response.text}"
    )
    
    # Assert: Verify error details in response
    response_data = response.json()
    assert "detail" in response_data, "Response should contain 'detail' field"
    
    detail = response_data["detail"]
    assert "error" in detail, "Detail should contain 'error' field"
    assert detail["error"] == "consent_required", (
        f"Expected error 'consent_required', got '{detail.get('error')}'"
    )
    
    assert "message" in detail, "Detail should contain 'message' field"
    assert "consent" in detail["message"].lower(), (
        "Error message should mention consent"
    )
    
    print("✓ Test passed: POST /v1/ingest/peer-post returns 403 when consent_active: false")
    print(f"  Response status: {response.status_code}")
    print(f"  Error type: {detail['error']}")
    print(f"  Message: {detail['message']}")


if __name__ == "__main__":
    test_peer_post_consent_false_returns_403()
