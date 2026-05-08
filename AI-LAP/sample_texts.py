"""
sample_texts.py
---------------
Raw text samples for testing the ingest → LLM → store pipeline.

Usage (from project root, with venv active):
    python sample_texts.py

This script hits POST /v1/ingest/peer-post for each sample,
which triggers the LLM pipeline and stores results in the DB.
You can then view them on the dashboard.

Adjust BASE_URL and MEMBER_TOKEN as needed.
"""

import httpx
import uuid
import time
from datetime import datetime, timezone

BASE_URL = "http://localhost:8000"

# Use a real member token from your DB:
#   psql -U postgres -d vasl -c "SELECT member_token FROM members LIMIT 5;"
MEMBER_TOKEN = "mbr_bf18c4d442624cd09a06"
ORG_ID       = "org_univ_maryland"

# ── Sample texts: crisis / moderate / okay ────────────────────────────────────

SAMPLES = [
    {
        "label": "CRISIS",
        "source": "peer-post",
        "text": (
            "I don't see the point anymore. Every single day I wake up and "
            "wonder why I'm still here. I've been thinking about ending it — "
            "I have a plan and I'm not sure I can stop myself. Nobody would "
            "even notice if I was gone. I'm so tired of pretending I'm okay."
        ),
    },
    {
        "label": "HIGH",
        "source": "journal",
        "text": (
            "Can't sleep again. Third night in a row. I keep replaying "
            "everything that went wrong this year. I feel completely worthless "
            "and like nothing will ever get better. I've been isolating myself "
            "from everyone — stopped answering texts, skipped class all week. "
            "I don't know how much longer I can keep going like this."
        ),
    },
    {
        "label": "MODERATE",
        "source": "peer-post",
        "text": (
            "Honestly been struggling lately. Work stress is through the roof "
            "and I've been feeling really down. Some days I just don't want to "
            "get out of bed. I know I should reach out to someone but it feels "
            "hard to talk about. Trying to stay positive but it's not easy."
        ),
    },
    {
        "label": "MODERATE",
        "source": "chat",
        "text": (
            "I've been feeling kind of disconnected from everything. Like I'm "
            "going through the motions but nothing feels real. I used to enjoy "
            "hanging out with friends but lately I just cancel plans. I don't "
            "know if this is just a phase or something more serious."
        ),
    },
    {
        "label": "LOW",
        "source": "journal",
        "text": (
            "Had a rough week with exams but feeling okay overall. A bit "
            "stressed about grades but I talked to my roommate about it and "
            "that helped. Looking forward to the weekend — planning to go for "
            "a hike and reset. Things feel manageable right now."
        ),
    },
    {
        "label": "LOW",
        "source": "peer-post",
        "text": (
            "Just checking in. Life is busy but good. Started going to the gym "
            "again which has been helping my mood a lot. Still dealing with "
            "some family stuff but nothing I can't handle. Grateful for this "
            "community — it helps to know others get it."
        ),
    },
]

# ── Source-specific extra fields ──────────────────────────────────────────────

SOURCE_EXTRAS = {
    "peer-post":  {"group_id": "grp_wellness_001"},
    "journal":    {"mood_score": 2},
    "chat":       {"session_id": "sess_test_001", "role": "member"},
    "assessment": {"instrument": "PHQ8", "item_number": 1},
}

SOURCE_TEXT_FIELD = {
    "peer-post":  "text",
    "journal":    "text",
    "chat":       "text",
    "assessment": "response_text",
}


def build_payload(sample: dict) -> dict:
    source = sample["source"]
    text_field = SOURCE_TEXT_FIELD[source]
    extras = SOURCE_EXTRAS.get(source, {})

    payload = {
        "event_id":       f"evt_{uuid.uuid4().hex[:16]}",
        "org_id":         ORG_ID,
        "member_token":   MEMBER_TOKEN,
        text_field:       sample["text"],
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "consent_active": True,
        **extras,
    }
    return payload


def run():
    print(f"Sending {len(SAMPLES)} sample texts to {BASE_URL}\n")
    print(f"Member token : {MEMBER_TOKEN}")
    print(f"Org          : {ORG_ID}\n")
    print("─" * 60)

    with httpx.Client(timeout=60.0) as client:
        for sample in SAMPLES:
            source  = sample["source"]
            label   = sample["label"]
            payload = build_payload(sample)

            url = f"{BASE_URL}/v1/ingest/{source}"
            print(f"\n[{label}] POST {url}")
            print(f"  text preview: {sample['text'][:80]}...")

            try:
                resp = client.post(url, json=payload)
                if resp.status_code in (200, 201, 202):
                    print(f"  ✓ {resp.status_code} — {resp.json()}")
                else:
                    print(f"  ✗ {resp.status_code} — {resp.text}")
            except Exception as e:
                print(f"  ✗ Error: {e}")

            # Small pause between requests to avoid rate limits
            time.sleep(3)

    print("\n" + "─" * 60)
    print("Done. Check the dashboard or run:")
    print(f"  GET {BASE_URL}/v1/results/member/{MEMBER_TOKEN}")


if __name__ == "__main__":
    run()
