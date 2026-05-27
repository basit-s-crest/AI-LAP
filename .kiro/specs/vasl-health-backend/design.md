# VASL Health Backend — Design

## Overview

The backend consists of two services:

1. **FastAPI Application** (`backend/`) — port 8000. Handles LLM inference, risk storage, dashboard APIs, pipeline timing, and HTTP request logging.
2. **vasl-db Kafka Pipeline** (`backend/vasl-db/`) — Dockerized. Ingestion gateway publishes to Kafka; consumer reads annotated results and writes to PostgreSQL.

## System Architecture

```
Next.js FE  →  POST /api/chat  →  BullMQ  →  worker.mjs
                                                  │
Node.js BE (port 4000)  ──────────────────►  FastAPI (port 8000)
  sentimentForwarder.ts                      /v1/ingest/chat
  forwardPeerPostToSentiment                 /v1/ingest/peer-post
                                                  │
                                   ┌──────────────┤
                                   ▼              ▼
                             OpenRouter LLM   pipeline_stage_logs
                                   │
                                   ▼
                             PostgreSQL (vasl DB)
                             inference_events, event_signals,
                             shap_attributions, member_risk_snapshots
                                   │
                                   ▼
                             Redis pub/sub
                             channel: vasl_score_updates
                                   │
                                   ▼
                             SSE /api/scores/stream → Next.js FE
```

## FastAPI Application (`backend/app/`)

### Entry Point (`main.py`)

- `FastAPI` app with title "VASL ALAP API", version "1.0.0"
- Middleware stack (applied in reverse order):
  1. `RequestLoggerMiddleware` — logs every request to `request_logs`
  2. `CORSMiddleware` — `allow_origins=["*"]` (open CORS — production risk)
- Routers: `ingest`, `store`, `dashboard`, `request_logs`, `pipeline`
- Windows: `asyncio.WindowsSelectorEventLoopPolicy` set before uvicorn starts

### Database Layer (`core/database.py`)

- SQLAlchemy async engine with `psycopg` v3 driver
- `DATABASE_URL` env var (default: `postgresql+psycopg://postgres:yourpassword@localhost:5432/vasl`)
- `pool_pre_ping=True` for connection health checks
- `get_db()` FastAPI dependency — yields `AsyncSession` per request

### LLM Inference (`core/llm.py`)

- OpenAI SDK pointed at `https://openrouter.ai/api/v1`
- Lazy singleton `AsyncOpenAI` client
- System prompt: 43-signal culturally-informed mental health risk assessment
- Signal taxonomy: 5 dimensions — HOP (8), ISO (9), SHA (7), CRS (6), CCM (12)
- Risk tier thresholds: crisis [0.85–1.0], high [0.65–0.84], moderate [0.35–0.64], low [0.00–0.34]
- Retry logic: 3 attempts, 10s/20s backoff on 429/503
- `temperature=0.1`, `max_tokens=7144`, `response_format={"type": "json_object"}`

### Ingestion Flow (`routers/ingest.py`)

```
Request arrives
    │
    ▼
Stage 1: log fastapi_received
    │
    ▼
Stage 2: consent_check → 403 if false
    │
    ▼
Stage 3: run_inference() → OpenRouter LLM
    │
    ├── Write timing to Redis hash vasl:timing:{event_id}
    ├── Log stage 3 to pipeline_stage_logs
    │
    ▼
Return 202 IngestOut (includes risk result + timing)
    │
    ▼ (BackgroundTask — fire and forget)
Stage 4: save_inference_result() → PostgreSQL
    │
    ├── bust_member_cache()
    ├── Write s4 timing to Redis hash
    └── Log stage 4 to pipeline_stage_logs
```

### Cache Layer (`core/cache.py`)

- Lazy Redis client via `redis.asyncio`
- Graceful degradation: if Redis unavailable, all operations are no-ops
- Key patterns:
  - `vasl:member:{member_token}` — member dashboard cache
  - `vasl:admin:{org_id}` — admin summary cache
- TTL: `CACHE_TTL` env var (default 60s)

## Data Models

### Member
```
members
  id            SERIAL PRIMARY KEY
  member_token  VARCHAR(64) NOT NULL UNIQUE
  org_id        VARCHAR(64) NOT NULL
  created_at    TIMESTAMPTZ DEFAULT NOW()
  updated_at    TIMESTAMPTZ DEFAULT NOW()
```

### InferenceEvent
```
inference_events
  id                  SERIAL PRIMARY KEY
  event_id            VARCHAR(64) NOT NULL UNIQUE
  original_source_id  VARCHAR(64)
  member_id           INTEGER FK → members.id CASCADE
  org_id              VARCHAR(64) NOT NULL
  source_type         VARCHAR(32) NOT NULL   -- peer-post|journal|chat|assessment
  event_timestamp     TIMESTAMPTZ NOT NULL
  ingested_at         TIMESTAMPTZ DEFAULT NOW()
  group_id            VARCHAR(64)            -- peer-post only
  mood_score          SMALLINT               -- journal only (1-5)
  session_id          VARCHAR(64)            -- chat only
  role                VARCHAR(16)            -- chat only: member|coach
  instrument          VARCHAR(16)            -- assessment only: PHQ8|GAD7|ACES
  item_number         SMALLINT               -- assessment only
  risk_tier           VARCHAR(16) NOT NULL
  risk_score          NUMERIC(4,3) NOT NULL
  risk_trend          VARCHAR(16)
  cultural_context    TEXT[]
  recommended_action  VARCHAR(64)
  clinician_reviewed  BOOLEAN NOT NULL DEFAULT FALSE
  review_deadline     TIMESTAMPTZ
  model_version       VARCHAR(64)
  created_at          TIMESTAMPTZ DEFAULT NOW()
```

### EventSignal
```
event_signals
  id           SERIAL PRIMARY KEY
  event_id     INTEGER FK → inference_events.id CASCADE
  signal_code  VARCHAR(16) NOT NULL   -- e.g. HOP-03
  signal_label VARCHAR(128)
  confidence   NUMERIC(4,3) NOT NULL
  dimension    VARCHAR(32)            -- hopelessness|isolation|self_harm|crisis|cultural
```

### ShapAttribution
```
shap_attributions
  id          SERIAL PRIMARY KEY
  event_id    INTEGER FK → inference_events.id CASCADE
  span        VARCHAR(64) NOT NULL   -- max 5 verbatim words
  weight      NUMERIC(5,4) NOT NULL
  signal_code VARCHAR(16)
  rank        INTEGER
```

### ReviewAction
```
review_actions
  id              SERIAL PRIMARY KEY
  review_id       VARCHAR(64) NOT NULL UNIQUE
  event_id        INTEGER FK → inference_events.id CASCADE
  member_id       INTEGER FK → members.id
  therapist_id    VARCHAR(64) NOT NULL
  action          VARCHAR(64) NOT NULL
  clinician_notes TEXT
  reviewed_at     TIMESTAMPTZ NOT NULL
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
```

### MemberRiskSnapshot
```
member_risk_snapshots
  id                      SERIAL PRIMARY KEY
  member_id               INTEGER FK → members.id CASCADE UNIQUE
  org_id                  VARCHAR(64) NOT NULL
  therapist_id            VARCHAR(64)
  current_risk_tier       VARCHAR(16) NOT NULL DEFAULT 'low'
  current_risk_score      NUMERIC(4,3)
  risk_trend              VARCHAR(16)
  total_events            INTEGER NOT NULL DEFAULT 0
  high_crisis_event_count INTEGER NOT NULL DEFAULT 0
  avg_risk_score_7d       NUMERIC(4,3)
  avg_risk_score_30d      NUMERIC(4,3)
  max_risk_score_30d      NUMERIC(4,3)
  latest_event_id         INTEGER FK → inference_events.id
  latest_event_at         TIMESTAMPTZ
  pending_reviews         INTEGER NOT NULL DEFAULT 0
  overdue_reviews         INTEGER NOT NULL DEFAULT 0
  last_calculated_at      TIMESTAMPTZ
  updated_at              TIMESTAMPTZ
```
Updated via PL/pgSQL function `upsert_member_risk_snapshot(member_id)` (migration V7).

### RequestLog
```
request_logs
  id             BIGSERIAL PRIMARY KEY
  request_id     VARCHAR(64) NOT NULL UNIQUE
  method         VARCHAR(10) NOT NULL
  path           TEXT NOT NULL
  query_string   TEXT
  full_url       TEXT NOT NULL
  client_ip      VARCHAR(64)
  user_agent     TEXT
  origin         TEXT
  referer        TEXT
  request_body   JSONB        -- text/response_text fields stripped
  content_type   VARCHAR(128)
  content_length INTEGER
  event_id       VARCHAR(64)
  member_token   VARCHAR(64)
  org_id         VARCHAR(64)
  source_type    VARCHAR(32)
  session_id     VARCHAR(64)
  role           VARCHAR(16)
  status_code    SMALLINT NOT NULL DEFAULT 0
  response_body  JSONB
  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  responded_at   TIMESTAMPTZ
  duration_ms    INTEGER
  error_message  TEXT
  is_error       BOOLEAN NOT NULL DEFAULT FALSE
```

### PipelineRun
```
pipeline_runs
  id              BIGSERIAL PRIMARY KEY
  event_id        VARCHAR(64) NOT NULL UNIQUE
  job_num         INTEGER
  text            TEXT
  member_token    VARCHAR(64)
  -- 6 stages × (started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, ms INTEGER)
  s1_enqueue_*    -- frontend → BullMQ enqueue
  s1_queue_wait_* -- BullMQ queue wait
  s2_*            -- worker → FastAPI HTTP
  s3_*            -- FastAPI LLM call
  s4_*            -- FastAPI background DB save
  s5_*            -- worker Redis publish
  s6_*            -- full end-to-end
  risk_tier       VARCHAR(16)
  risk_score      NUMERIC(4,3)
  fastapi_total_ms INTEGER
  is_complete     BOOLEAN NOT NULL DEFAULT FALSE
  has_error       BOOLEAN NOT NULL DEFAULT FALSE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### PipelineStageLog
```
pipeline_stage_logs
  id           BIGSERIAL PRIMARY KEY
  event_id     VARCHAR(64) NOT NULL
  member_token VARCHAR(64) NOT NULL
  org_id       VARCHAR(64) NOT NULL
  source_type  VARCHAR(32) NOT NULL
  stage_num    SMALLINT NOT NULL
  stage_name   VARCHAR(64) NOT NULL   -- fastapi_received|consent_check|llm_call|db_save|response_sent
  started_at   TIMESTAMPTZ NOT NULL
  finished_at  TIMESTAMPTZ
  duration_ms  INTEGER
  status       VARCHAR(16) NOT NULL DEFAULT 'ok'
  error_message TEXT
  risk_tier    VARCHAR(16)
  risk_score   NUMERIC(4,3)
```

## API Documentation

### FastAPI REST Endpoints (port 8000)

#### Health
| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{"status": "ok"}` |

#### Ingestion (`/v1/ingest/`)
| Method | Path | Status | Body Schema |
|--------|------|--------|-------------|
| POST | `/v1/ingest/peer-post` | 202/403/502 | `PeerPostIn` |
| POST | `/v1/ingest/journal` | 202/403/502 | `JournalIn` |
| POST | `/v1/ingest/chat` | 202/403/502 | `ChatIn` |
| POST | `/v1/ingest/assessment` | 202/403/502 | `AssessmentIn` |

All ingest responses (`IngestOut`):
```json
{
  "status": "processed", "event_id": "string", "source": "string",
  "risk_tier": "low|moderate|high|crisis", "risk_score": 0.0,
  "risk_trend": "stable|increasing|decreasing",
  "recommended_action": "string",
  "active_signals": [{"signal_code":"HOP-03","signal_label":"string","confidence":0.85,"dimension":"hopelessness"}],
  "timing_llm_ms": 1200, "timing_total_ms": 1250
}
```

#### Store (`/v1/`)
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/v1/store-result` | 201/500 | Save inference result directly |
| POST | `/v1/review/action` | 200/404/500 | Clinician submits review |

#### Dashboard (`/v1/`)
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/v1/results/member/{member_token}` | 200/404 | Therapist member view (Redis-cached) |
| GET | `/v1/admin/summary/{org_id}` | 200 | Admin org aggregate (Redis-cached) |
| GET | `/v1/admin/events/{org_id}` | 200 | Recent events ascending |

#### Request Logs (`/v1/logs/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/logs/requests` | Paginated list (filters: path, method, source_type, member_token, org_id, is_error, since, until, limit≤500, offset) |
| GET | `/v1/logs/requests/{request_id}` | Single request detail |
| GET | `/v1/logs/stats` | Aggregate stats (total, errors, error_rate, avg_ms, p90_ms, by_path, by_source_type, by_status_code) |

#### Pipeline Runs (`/v1/pipeline/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/pipeline/flush/{event_id}` | Read Redis hash → upsert pipeline_runs |
| GET | `/v1/pipeline/runs` | Paginated list (filters: risk_tier, is_complete, member_token) |
| GET | `/v1/pipeline/runs/{event_id}` | Single run detail |
| GET | `/v1/pipeline/stats` | Aggregate timing stats per stage (min/avg/p90/max) |

## Kafka Pipeline (vasl-db/)

### Topics
| Topic | Partitions | Retention | Description |
|-------|-----------|-----------|-------------|
| `alap.text.raw` | 3 | 24h | Raw text from ingestion gateway |
| `alap.text.annotated` | 3 | 90 days | Inference results from AI service |
| `alap.text.dlq` | 1 | 7 days | Dead-letter queue |

### Consumer
- Group ID: `vasl-dashboard-consumer`
- Offset commit: manual synchronous (at-least-once delivery)
- Crisis fast path: publishes to `crisis_alerts:{org_id}` BEFORE DB write
- DB write: single transaction — upsert member → insert event → insert signals → insert SHAP → upsert snapshot

### Ingestion Gateway Endpoints (port 8000 in Docker)
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/v1/ingest/peer-post` | 202/403/503 | Publish to `alap.text.raw` |
| POST | `/v1/ingest/journal` | 202/403/503 | Publish to `alap.text.raw` |
| POST | `/v1/ingest/chat` | 202/403/503 | Publish to `alap.text.raw` |
| POST | `/v1/ingest/assessment` | 202/403/503 | Publish to `alap.text.raw` |

## Redis Key Patterns and TTLs

| Key / Channel | Type | TTL | Written By | Read By |
|---------------|------|-----|-----------|---------|
| `vasl:member:{member_token}` | String (JSON) | CACHE_TTL (60s) | cache.py | dashboard.py |
| `vasl:admin:{org_id}` | String (JSON) | CACHE_TTL (60s) | cache.py | dashboard.py |
| `vasl:timing:{event_id}` | Hash | 600s | ingest.py, worker.mjs | pipeline.py flush |
| `vasl_score_updates` | Pub/Sub | N/A | sentimentForwarder.ts, worker.mjs | SSE /api/scores/stream |
| `crisis_alerts:{org_id}` | Pub/Sub | N/A | vasl-db/consumer/alerts.py | Dashboard WebSocket |

## Infrastructure

### Environment Variables (`backend/.env.example`)
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+psycopg://postgres:yourpassword@localhost:5432/vasl` | PostgreSQL (psycopg v3) |
| `OPENROUTER_API_KEY` | — | Required. OpenRouter API key |
| `OPENROUTER_MODEL` | `google/gemini-2.0-flash-001` | LLM model slug |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis URL |
| `CACHE_TTL` | `60` | Dashboard cache TTL (seconds) |

### Environment Variables (`backend/vasl-db/.env.example`)
| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | — | Required |
| `KAFKA_TOPIC_RAW` | `alap.text.raw` | Raw topic |
| `KAFKA_TOPIC_ANNOTATED` | `alap.text.annotated` | Annotated topic |
| `KAFKA_CONSUMER_GROUP` | `vasl-dashboard-consumer` | Consumer group |
| `KAFKA_SSL_CA_LOCATION` | `""` | Empty = no TLS (local dev) |
| `DB_HOST/PORT/NAME/USER/PASSWORD` | — | Required |
| `DB_SSLMODE` | `require` | `disable` for local dev |
| `REDIS_HOST/PORT/SSL` | — | Required |
| `CRISIS_SCORE_THRESHOLD` | `0.90` | Crisis alert threshold |

### Python Dependencies (`backend/requirements.txt`)
| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.111.0 | Web framework |
| `uvicorn[standard]` | 0.29.0 | ASGI server |
| `sqlalchemy[asyncio]` | 2.0.30 | Async ORM |
| `psycopg[binary,pool]` | 3.2.9 | PostgreSQL async driver |
| `pydantic` | 2.7.1 | Validation |
| `openai` | 1.30.1 | OpenRouter client |
| `redis` | 5.0.4 | Redis async client |
| `httpx` | 0.27.0 | Async HTTP |

### Docker Compose Services (`vasl-db/docker-compose.yml`)
| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `postgres` | postgres:15-alpine | 5433:5432 | PostgreSQL |
| `redis` | redis:7-alpine | 6379:6379 | Redis with AOF |
| `zookeeper` | cp-zookeeper:7.6.0 | — | Kafka dependency |
| `kafka` | cp-kafka:7.6.0 | 9092:9092 | Kafka broker |
| `kafka-setup` | cp-kafka:7.6.0 | — | One-shot topic creation |
| `ingestion` | ./ingestion/Dockerfile | 8000:8000 | Ingestion gateway |
| `consumer` | ./consumer/Dockerfile | — | Kafka consumer |

## Known Tech Debt

1. **Dual ingestion paths**: `backend/app/routers/ingest.py` (direct LLM) and `backend/vasl-db/ingestion/main.py` (Kafka gateway) both exist. The Node.js backend calls the FastAPI path directly. The Kafka path is the original architecture. Canonical production path is unclear.
2. **No authentication on FastAPI endpoints**: All `/v1/*` endpoints have no auth middleware. Any caller with network access can read member data.
3. **Open CORS**: `allow_origins=["*"]` in production is a security risk.
4. **Kafka consumer signal field mismatch**: Consumer reads `s["code"]` and `s["label"]`; FastAPI schema uses `signal_code` and `signal_label`.
5. **`CACHE_TTL` and `OPENROUTER_MODEL` not in `.env.example`**: Used in code but undocumented.
6. **Hardcoded values**: `HTTP-Referer: http://localhost:8000`, `X-Title: VASL ALAP`, `max_tokens=7144`, `temperature=0.1` in `llm.py`.
7. **`backend/node_modules/`**: Unused Prisma client leftover from earlier architecture.
8. **`forgotPassword` stub**: Always returns 200 — no password reset flow implemented.
