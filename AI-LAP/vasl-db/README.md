# VASL ALAP — Ingestion Gateway, Database & Kafka Consumer

End-to-end pipeline: 4 FastAPI ingestion endpoints → Kafka → AI inference → PostgreSQL → Dashboard.

---

## Project Structure

```
vasl-db/
│
├── ingestion/                        # FastAPI ingestion gateway
│   ├── main.py                       ← 4 POST endpoints (/v1/ingest/*)
│   ├── models.py                     ← Pydantic request/response schemas
│   ├── kafka_producer.py             ← publishes to alap.text.raw
│   ├── config.py                     ← env-var configuration
│   ├── requirements.txt
│   └── Dockerfile
│
├── migrations/                       # Flyway-style SQL migrations (run in order)
│   ├── V1__create_members.sql
│   ├── V2__create_inference_events.sql   ← includes source-specific fields
│   ├── V3__create_event_signals.sql
│   ├── V4__create_shap_attributions.sql
│   ├── V5__create_review_actions.sql
│   ├── V6__create_member_risk_snapshots.sql
│   └── V7__snapshot_upsert_function.sql  ← PL/pgSQL function + trigger
│
├── queries/                          # Named SQL queries for the dashboard API
│   ├── dashboard_therapist.sql
│   ├── dashboard_member_history.sql
│   ├── dashboard_admin_org_summary.sql
│   ├── dashboard_overdue_reviews.sql
│   └── dashboard_event_detail.sql
│
├── consumer/                         # Kafka consumer service (Python)
│   ├── consumer.py                   ← entry point, Kafka poll loop
│   ├── db.py                         ← all PostgreSQL writes
│   ├── alerts.py                     ← crisis alert Redis pub/sub
│   ├── config.py                     ← env-var configuration
│   ├── requirements.txt
│   ├── Dockerfile
│   └── fixtures/
│       ├── sample_moderate.json      ← test message for Kafka
│       └── sample_crisis.json
│
├── docker-compose.yml                ← full local dev stack
├── .env.example                      ← copy to .env, fill in values
└── README.md
```

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VASL PLATFORM (callers)                           │
│  POST /v1/ingest/peer-post                                           │
│  POST /v1/ingest/journal                                             │
│  POST /v1/ingest/chat                                                │
│  POST /v1/ingest/assessment                                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTP POST (JSON body)
                           ▼
              ┌────────────────────────┐
              │  INGESTION GATEWAY     │  ← vasl-db/ingestion/
              │  (FastAPI :8000)       │
              │                        │
              │  1. Validate schema    │
              │  2. Check consent_active│
              │     → 403 if false     │
              │  3. Generate ing_id    │
              │  4. Publish to Kafka   │
              │  5. Return 202         │
              └────────────┬───────────┘
                           │  JSON → alap.text.raw
                           ▼
              ┌────────────────────────┐
              │  KAFKA EVENT BUS       │
              │                        │
              │  alap.text.raw         │  ← ingestion gateway writes here
              │  (24h retention)       │
              │         │              │
              │  [AI Inference Service]│  ← NOT in this repo (VASL's service)
              │  CulturalBERT-ALAP     │
              │         │              │
              │  alap.text.annotated   │  ← consumer reads from here
              │  (90 days retention)   │
              └────────────┬───────────┘
                           │  JSON with inference_result attached
                           ▼
              ┌────────────────────────┐
              │  KAFKA CONSUMER        │  ← vasl-db/consumer/
              │                        │
              │  1. crisis? → Redis    │  ← fast path < 90s (AC-S05)
              │  2. Single DB txn:     │
              │     INSERT members     │
              │     INSERT inf_events  │
              │     INSERT signals     │
              │     INSERT shap        │
              │     UPSERT snapshot    │
              │  3. commit offset      │
              └────────────┬───────────┘
                           │
              ┌────────────▼───────────┐
              │  POSTGRESQL DATABASE   │
              │                        │
              │  members               │
              │  inference_events      │
              │  event_signals         │
              │  shap_attributions     │
              │  member_risk_snapshots │  ← dashboard reads this
              │  review_actions        │
              └────────────────────────┘
```

---

## Ingestion API

| Endpoint | Source ID field | Unique fields |
|---|---|---|
| `POST /v1/ingest/peer-post` | `post_id` | `group_id`, `text` (max 2000) |
| `POST /v1/ingest/journal` | `entry_id` | `mood_score` (1–5), `text` (max 5000) |
| `POST /v1/ingest/chat` | `message_id` | `session_id`, `role` (member\|coach), `text` (max 500) |
| `POST /v1/ingest/assessment` | `assessment_id` | `instrument` (PHQ8\|GAD7\|ACES), `response_text`, `item_number` |

All 4 share: `org_id`, `member_token`, `timestamp`, `consent_active`

**202 response** (all 4 endpoints):
```json
{ "ingestion_id": "ing_...", "queued_at": "2026-...", "status": "queued" }
```

**403 response** (consent_active = false):
```json
{ "error": "consent_required", "message": "Member has not provided active consent for AI analysis." }
```

Interactive docs available at `http://localhost:8000/docs` when running locally.

---

## Database: Source-Specific Fields

The `inference_events` table stores source-specific metadata alongside the inference output. Fields are NULL when not applicable to the source type:

| Column | peer-post | journal | chat | assessment |
|---|---|---|---|---|
| `group_id` | ✓ | — | — | — |
| `mood_score` | — | ✓ | — | — |
| `session_id` | — | — | ✓ | — |
| `role` | — | — | ✓ | — |
| `instrument` | — | — | — | ✓ |
| `item_number` | — | — | — | ✓ |

---

## Local Development

### 1. Start the full stack

```bash
cp .env.example .env
docker compose up -d
```

This starts: Postgres, Redis, Zookeeper, Kafka, creates topics, runs migrations, starts the ingestion gateway on `:8000`, and starts the consumer.

### 2. Send a test ingestion request

```bash
curl -X POST http://localhost:8000/v1/ingest/peer-post \
  -H "Content-Type: application/json" \
  -d '{
    "post_id":        "post_test_001",
    "org_id":         "org_test",
    "member_token":   "mbr_test_abc123",
    "group_id":       "grp_test_group",
    "text":           "idk why i even try anymore, nobody checks on me fr",
    "timestamp":      "2026-03-15T14:22:00Z",
    "consent_active": true
  }'
```

Expected response:
```json
{ "ingestion_id": "ing_...", "queued_at": "...", "status": "queued" }
```

### 3. Test consent rejection

```bash
curl -X POST http://localhost:8000/v1/ingest/journal \
  -H "Content-Type: application/json" \
  -d '{
    "entry_id":       "entry_001",
    "org_id":         "org_test",
    "member_token":   "mbr_test_abc123",
    "text":           "feeling okay today",
    "mood_score":     3,
    "timestamp":      "2026-03-15T14:22:00Z",
    "consent_active": false
  }'
```

Expected: `403 Forbidden`

### 4. Publish a mock AI result directly to Kafka (bypasses AI service)

```bash
docker exec -i vasl_kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic alap.text.annotated \
  < consumer/fixtures/sample_moderate.json
```

### 5. Check the database

```bash
docker exec -it vasl_postgres psql -U vasl_user -d vasl -c \
  "SELECT m.member_token, s.current_risk_tier, s.current_risk_score, s.total_events
   FROM member_risk_snapshots s
   JOIN members m ON m.id = s.member_id;"
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Ingestion gateway is stateless | No DB writes at ingestion time — just validate, consent-check, and publish to Kafka. Keeps the gateway fast and simple. |
| `consent_active=false` → 403 at gateway | Consent gate is the first check, before any processing. Matches spec Section 3.1 and AC-S01. |
| Source-specific fields in one table | All 4 source types share the same `inference_events` table with nullable source-specific columns. Simpler than 4 separate tables; easy to query across sources. |
| `original_source_id` column | Preserves the caller's `post_id`/`entry_id`/etc. alongside the internal `ingestion_id`. Useful for tracing back to the source system. |
| Manual Kafka offset commit (consumer) | Offset committed only after DB write — no data loss on crash. |
| `ON CONFLICT DO NOTHING` on `event_id` | Idempotent — safe to replay Kafka topic without duplicates. |
| Single transaction per message | All inserts succeed together or all roll back. |
| Redis pub/sub for crisis alerts | Bypasses DB query latency to meet the 90-second SLA (spec AC-S05). |
| `member_risk_snapshots` table | Pre-aggregated per member — dashboard reads are O(1). |
