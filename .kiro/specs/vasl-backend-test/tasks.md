# VASL Health Backend — Test Tasks

## Task 1: Ingestion Endpoint Tests

- [ ] Verify `POST /v1/ingest/peer-post` returns 403 when `consent_active: false`
- [ ] Verify `POST /v1/ingest/peer-post` returns 202 with risk result when consent is true
- [ ] Verify `POST /v1/ingest/peer-post` rejects `text` longer than 2000 characters
- [ ] Verify `POST /v1/ingest/journal` validates `mood_score` is 1–5
- [ ] Verify `POST /v1/ingest/journal` rejects `text` longer than 5000 characters
- [ ] Verify `POST /v1/ingest/chat` validates `role` is `"member"` or `"coach"`
- [ ] Verify `POST /v1/ingest/chat` rejects `text` longer than 500 characters
- [ ] Verify `POST /v1/ingest/assessment` validates `instrument` is `PHQ8`, `GAD7`, or `ACES`
- [ ] Verify `POST /v1/ingest/assessment` validates `item_number` is ≥ 1
- [ ] Verify all ingest endpoints return `timing_llm_ms` and `timing_total_ms` in response
- [ ] Verify DB save runs as background task (response returned before save completes)

## Task 2: LLM Inference Pipeline Tests

- [ ] Verify `OPENROUTER_MODEL` env var overrides the default model
- [ ] Verify retry logic triggers on 429 and 503 responses (up to 3 attempts)
- [ ] Verify invalid JSON from OpenRouter returns HTTP 502 to caller
- [ ] Verify `review_deadline` is set to 2h for crisis, 24h for high, 72h for moderate, null for low
- [ ] Verify `active_signals` are parsed and included in the response
- [ ] Verify `shap_attributions` are parsed and included in the response
- [ ] Verify `cultural_context` array is parsed from LLM response

## Task 3: Risk Score Storage Tests

- [ ] Verify member is auto-created if not found (upsert on `member_token`)
- [ ] Verify `event_signals` rows are inserted for all active signals
- [ ] Verify `shap_attributions` rows are inserted
- [ ] Verify `upsert_member_risk_snapshot` is called after save
- [ ] Verify duplicate `event_id` is handled without error (idempotent)
- [ ] Verify Redis cache is busted for member after successful save

## Task 4: Clinician Review Actions Tests

- [ ] Verify `POST /v1/review/action` returns 404 for unknown `event_id`
- [ ] Verify `clinician_reviewed` is set to `true` on the inference event after review
- [ ] Verify `therapist_id`, `action`, `clinician_notes`, `reviewed_at` are stored

## Task 5: Member Dashboard Tests

- [ ] Verify `GET /v1/results/member/{member_token}` returns 404 for unknown member
- [ ] Verify default query returns last 30 days, max 50 events
- [ ] Verify `since`, `source`, `limit` query params are applied correctly
- [ ] Verify response is cached in Redis for default (no-filter) requests
- [ ] Verify cache TTL matches `CACHE_TTL` env var

## Task 6: Admin Dashboard Tests

- [ ] Verify `GET /v1/admin/summary/{org_id}` returns all 4 risk tier counts
- [ ] Verify `high_crisis_members` counts `high` and `crisis` tier snapshots
- [ ] Verify `top_signals` returns top 5 by frequency
- [ ] Verify admin summary is cached in Redis per org_id
- [ ] Verify `GET /v1/admin/events/{org_id}` returns events in ascending order
- [ ] Verify `GET /v1/admin/events/{org_id}` respects `limit` query param

## Task 7: Crisis Alert Fast Path Tests

- [ ] Verify Redis alert is published to `crisis_alerts:{org_id}` BEFORE DB write for crisis events
- [ ] Verify `CRISIS_SCORE_THRESHOLD` env var controls the threshold (default 0.90)
- [ ] Verify alert payload includes all required fields

## Task 8: Pipeline Timing Tests

- [ ] Verify 5 stage logs are written to `pipeline_stage_logs` per ingestion request
- [ ] Verify stage log failures do not affect the request/response cycle
- [ ] Verify Redis timing hash `vasl:timing:{event_id}` is written with TTL 600s
- [ ] Verify `POST /v1/pipeline/flush/{event_id}` upserts `pipeline_runs` row
- [ ] Verify `GET /v1/pipeline/stats` returns min/avg/p90/max per stage

## Task 9: HTTP Request Logging Tests

- [ ] Verify `/health`, `/docs`, `/redoc`, `/openapi.json`, `/favicon.ico` are NOT logged
- [ ] Verify `text` and `response_text` fields are stripped from stored request body
- [ ] Verify `event_id`, `member_token`, `org_id`, `session_id`, `role` are extracted and indexed
- [ ] Verify log write failures do not affect the response
- [ ] Verify `GET /v1/logs/requests` supports all filter params
- [ ] Verify `GET /v1/logs/stats` returns error rate and p90 duration

## Task 10: Kafka Ingestion Gateway Tests

- [ ] Verify gateway returns 403 when `consent_active: false`
- [ ] Verify gateway returns 503 when Kafka publish fails
- [ ] Verify message key is `member_token`
- [ ] Verify `flush(timeout=10)` is called synchronously before returning 202
- [ ] Verify `ingestion_id` is generated with `ing_` prefix

## Task 11: Security Hardening

- [ ] Add authentication middleware to all `/v1/*` FastAPI endpoints
- [ ] Restrict `allow_origins` in CORS middleware to known origins
- [ ] Document `CACHE_TTL` and `OPENROUTER_MODEL` in `backend/.env.example`
- [ ] Make `HTTP-Referer`, `X-Title`, `max_tokens`, `temperature` configurable via env vars

## Task 12: Bug Fixes

- [ ] Fix Kafka consumer signal field names (`s["code"]` → `s["signal_code"]`, `s["label"]` → `s["signal_label"]`)
- [ ] Remove unused `backend/node_modules/` Prisma client
- [ ] Implement `forgotPassword` password reset flow (currently a stub)
- [ ] Clarify and document which ingestion path is canonical for production (FastAPI direct vs Kafka gateway)
