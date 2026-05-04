# VASL ALAP — Database & Kafka Consumer

Stores structured inference results from the ALAP API into PostgreSQL
and exposes pre-aggregated risk data for the therapist/admin dashboards.

---

## Project Structure

```
vasl-db/
├── migrations/                   # Flyway-style SQL migrations (run in order)
│   ├── V1__create_members.sql
│   ├── V2__create_inference_events.sql
│   ├── V3__create_event_signals.sql
│   ├── V4__create_shap_attributions.sql
│   ├── V5__create_review_actions.sql
│   ├── V6__create_member_risk_snapshots.sql
│   └── V7__snapshot_upsert_function.sql   ← PL/pgSQL function + trigger
│
├── queries/                      # Named SQL queries for the dashboard API
│   ├── dashboard_therapist.sql
│   ├── dashboard_member_history.sql
│   ├── dashboard_admin_org_summary.sql
│   ├── dashboard_overdue_reviews.sql
│   └── dashboard_event_detail.sql
│
├── consumer/                     # Kafka consumer service (Python)
│   ├── consumer.py               ← entry point
│   ├── db.py                     ← all PostgreSQL writes
│   ├── alerts.py                 ← crisis alert Redis pub/sub
│   ├── config.py                 ← env-var configuration
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml            ← local dev stack
├── .env.example                  ← copy to .env, fill in values
└── README.md
```

---

## Data Flow

```
alap.text.annotated (Kafka)
        │
        ▼
  consumer.poll()
        │
        ├── crisis? ──► Redis pub/sub ──► Dashboard WebSocket  (< 90s SLA)
        │
        ▼
  Single DB transaction:
  ├── INSERT members              (upsert — token may already exist)
  ├── INSERT inference_events     (idempotent on event_id)
  ├── INSERT event_signals
  ├── INSERT shap_attributions
  └── CALL upsert_member_risk_snapshot()   ← pre-aggregated snapshot
        │
        ▼
  consumer.commit()   ← only after DB write succeeds (at-least-once)
```

---

## Local Development

### 1. Start the stack

```bash
cp .env.example .env
docker compose up -d
```

This starts Postgres, Redis, Kafka (with Zookeeper), creates the three
Kafka topics, runs all migrations, and starts the consumer.

### 2. Publish a test message

```bash
# Publish a sample moderate-risk event
docker exec -i vasl_kafka kafka-console-producer \
  --bootstrap-server localhost:9092 \
  --topic alap.text.annotated \
  < consumer/fixtures/sample_moderate.json
```

### 3. Check the database

```bash
docker exec -it vasl_postgres psql -U vasl_user -d vasl -c \
  "SELECT member_token, current_risk_tier, current_risk_score, total_events
   FROM member_risk_snapshots s
   JOIN members m ON m.id = s.member_id;"
```

---

## Running Migrations Manually

Migrations are plain SQL files named `V{n}__{description}.sql`.
They run automatically via the Docker Compose volume mount on first start.

To run manually against any Postgres instance:

```bash
for f in migrations/V*.sql; do
  echo "Running $f..."
  psql "$DATABASE_URL" -f "$f"
done
```

Or use [Flyway](https://flywaydb.org/) / [golang-migrate](https://github.com/golang-migrate/migrate)
pointing at the `migrations/` directory.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| `member_risk_snapshots` table | Pre-aggregated per member — dashboard reads are O(1), not O(n events) |
| Manual Kafka offset commit | Offset committed only after DB write — no data loss on crash |
| `ON CONFLICT DO NOTHING` on `event_id` | Idempotent — safe to replay Kafka topic without duplicates |
| Single transaction per message | All inserts succeed together or all roll back |
| Redis pub/sub for crisis alerts | Bypasses DB query latency to meet the 90-second SLA (spec AC-S05) |
| No raw text in any table | Matches spec Section 3.3 — only structured output is persisted |
| `member_token` not `member_id` | Pseudonymized — matches spec Section 7.2 data classification |
