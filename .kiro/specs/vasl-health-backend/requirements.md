# VASL Health Backend — Requirements

## Introduction

The VASL Health backend consists of two services: a FastAPI application (`backend/`) that handles LLM inference, risk storage, and dashboard APIs; and a Kafka-based pipeline (`backend/vasl-db/`) for event ingestion and consumer processing. This document captures all functional requirements discovered from reading the source code.

## Glossary

- **member_token**: Pseudonymized identifier for a platform member — no PII stored in the Python backend
- **org_id**: Organization identifier scoping all data
- **risk_tier**: Classification output — `low | moderate | high | crisis`
- **SHAP attribution**: Text span + weight explaining which words drove the risk score
- **consent_active**: Boolean flag — inference is only run when `true`
- **pipeline_run**: A single end-to-end processing record tracking all 6 timing stages

---

## Requirement 1: Text Ingestion — Peer Post

**User Story:** As a platform service, I want to submit a peer group post for AI risk analysis, so that member distress signals in community posts are detected early.

### Acceptance Criteria

1. WHEN a POST request is made to `/v1/ingest/peer-post` with `consent_active: false`, THEN the system SHALL return HTTP 403 with `error: "consent_required"` and SHALL NOT run inference.
2. WHEN a POST request is made with `consent_active: true`, THEN the system SHALL run LLM inference and return HTTP 202 with `risk_tier`, `risk_score`, `risk_trend`, `recommended_action`, `active_signals`, `timing_llm_ms`, and `timing_total_ms`.
3. WHEN the request body is received, THEN the system SHALL validate that `text` does not exceed 2000 characters.
4. WHEN inference completes, THEN the system SHALL save the result to PostgreSQL as a background task without delaying the 202 response.
5. WHEN the background save completes, THEN the system SHALL bust the Redis cache for the member token.

## Requirement 2: Text Ingestion — Journal Entry

**User Story:** As a platform service, I want to submit a mood journal entry for AI risk analysis, so that emotional deterioration in journal writing is detected.

### Acceptance Criteria

1. WHEN a POST request is made to `/v1/ingest/journal` with `consent_active: false`, THEN the system SHALL return HTTP 403.
2. WHEN a POST request is made, THEN the system SHALL validate that `text` does not exceed 5000 characters.
3. WHEN a POST request is made, THEN the system SHALL validate that `mood_score` is an integer between 1 and 5 inclusive.
4. WHEN inference completes, THEN the system SHALL store `mood_score` on the inference event record.

## Requirement 3: Text Ingestion — Chat Message

**User Story:** As a platform service, I want to submit a coach chat message for AI risk analysis, so that distress signals in member-coach conversations are detected in real time.

### Acceptance Criteria

1. WHEN a POST request is made to `/v1/ingest/chat` with `consent_active: false`, THEN the system SHALL return HTTP 403.
2. WHEN a POST request is made, THEN the system SHALL validate that `text` does not exceed 500 characters.
3. WHEN a POST request is made, THEN the system SHALL validate that `role` is either `"member"` or `"coach"`.
4. WHEN inference completes, THEN the system SHALL store `session_id`, `role`, and `original_source_id` on the inference event record.

## Requirement 4: Text Ingestion — Clinical Assessment

**User Story:** As a platform service, I want to submit a clinical assessment free-text response for AI risk analysis, so that distress in PHQ-8, GAD-7, and ACES responses is detected.

### Acceptance Criteria

1. WHEN a POST request is made to `/v1/ingest/assessment` with `consent_active: false`, THEN the system SHALL return HTTP 403.
2. WHEN a POST request is made, THEN the system SHALL validate that `response_text` does not exceed 5000 characters.
3. WHEN a POST request is made, THEN the system SHALL validate that `instrument` is one of `PHQ8`, `GAD7`, or `ACES`.
4. WHEN a POST request is made, THEN the system SHALL validate that `item_number` is an integer ≥ 1.

## Requirement 5: LLM Inference Pipeline

**User Story:** As the system, I want to call an LLM via OpenRouter with a culturally-informed prompt, so that risk assessments are accurate across diverse youth communities including AAVE speakers, LGBTQ+ youth, and first-generation immigrant youth.

### Acceptance Criteria

1. WHEN the LLM is called, THEN the system SHALL use the model specified by `OPENROUTER_MODEL` env var, defaulting to `google/gemini-2.0-flash-001`.
2. WHEN OpenRouter returns HTTP 429 or 503, THEN the system SHALL retry up to 3 times with 10-second and 20-second backoff delays.
3. WHEN the LLM response is received, THEN the system SHALL parse it as JSON and map it to `InferenceResultIn` including `risk_tier`, `risk_score`, `risk_trend`, `cultural_context`, `recommended_action`, `active_signals`, and `shap_attributions`.
4. WHEN `risk_tier` is `crisis`, THEN the system SHALL set `review_deadline` to 2 hours from now.
5. WHEN `risk_tier` is `high`, THEN the system SHALL set `review_deadline` to 24 hours from now.
6. WHEN `risk_tier` is `moderate`, THEN the system SHALL set `review_deadline` to 72 hours from now.
7. WHEN `risk_tier` is `low`, THEN the system SHALL set `review_deadline` to null.
8. WHEN the LLM returns invalid JSON, THEN the system SHALL raise a `ValueError` and return HTTP 502 to the caller.

## Requirement 6: Risk Score Storage

**User Story:** As the system, I want to persist inference results to PostgreSQL, so that therapists and admins can review member risk history.

### Acceptance Criteria

1. WHEN `save_inference_result` is called, THEN the system SHALL upsert the member record by `member_token` and `org_id`.
2. WHEN an inference event is saved, THEN the system SHALL insert all `active_signals` as `event_signals` rows.
3. WHEN an inference event is saved, THEN the system SHALL insert all `shap_attributions` rows.
4. WHEN an inference event is saved, THEN the system SHALL call `upsert_member_risk_snapshot(:member_id)` to refresh the member's aggregate snapshot.
5. WHEN an `event_id` already exists in the database, THEN the system SHALL skip the insert without error (idempotent).

## Requirement 7: Clinician Review Actions

**User Story:** As a clinician, I want to submit a review action on a flagged inference event, so that the event is marked as reviewed and the action is recorded.

### Acceptance Criteria

1. WHEN `POST /v1/review/action` is called with an `event_id` that does not exist, THEN the system SHALL return HTTP 404.
2. WHEN a review is saved, THEN the system SHALL set `clinician_reviewed = true` on the inference event.
3. WHEN a review is saved, THEN the system SHALL record `therapist_id`, `action`, `clinician_notes`, and `reviewed_at`.

## Requirement 8: Member Dashboard (Therapist View)

**User Story:** As a therapist, I want to retrieve a member's risk history and current snapshot, so that I can monitor their wellbeing over time.

### Acceptance Criteria

1. WHEN `GET /v1/results/member/{member_token}` is called for an unknown member, THEN the system SHALL return HTTP 404.
2. WHEN called without filters, THEN the system SHALL return events from the last 30 days, limited to 50.
3. WHEN `since`, `source`, or `limit` query params are provided, THEN the system SHALL apply them as filters.
4. WHEN called without filters, THEN the system SHALL cache the response in Redis under `vasl:member:{member_token}` with TTL from `CACHE_TTL` env var (default 60s).
5. WHEN a new inference event is saved for a member, THEN the system SHALL delete the member's Redis cache entry.

## Requirement 9: Admin Organisation Summary

**User Story:** As an admin, I want to see aggregate risk distribution and review status for my organisation, so that I can identify members who need attention.

### Acceptance Criteria

1. WHEN `GET /v1/admin/summary/{org_id}` is called, THEN the system SHALL return `total_members`, `members_analyzed`, `risk_distribution` (all 4 tiers), `high_crisis_members`, `pending_reviews`, `overdue_reviews`, and `top_signals`.
2. WHEN computing `high_crisis_members`, THEN the system SHALL count members whose snapshot `current_risk_tier` is `high` or `crisis`.
3. WHEN computing `top_signals`, THEN the system SHALL return the top 5 signal codes ranked by frequency (count / total events for org).
4. WHEN called, THEN the system SHALL cache the response in Redis under `vasl:admin:{org_id}` with TTL from `CACHE_TTL` env var.

## Requirement 10: Admin Recent Events Feed

**User Story:** As an admin, I want to retrieve recent inference events across my organisation in chronological order, so that I can replay history on the live dashboard.

### Acceptance Criteria

1. WHEN `GET /v1/admin/events/{org_id}` is called, THEN the system SHALL return events ordered ascending by `event_timestamp`.
2. WHEN called, THEN the system SHALL default to a limit of 50 events, configurable via `limit` query param.
3. WHEN returning events, THEN the system SHALL include `member_token`, `event_id`, `source_type`, `event_timestamp`, `risk_tier`, `risk_score`, `risk_trend`, `recommended_action`, and `active_signals`.

## Requirement 11: Crisis Alert Fast Path (Kafka Consumer)

**User Story:** As the system, I want to publish a Redis alert immediately when a crisis-tier event is detected, so that the therapist dashboard receives the alert within 90 seconds of ingestion.

### Acceptance Criteria

1. WHEN the Kafka consumer processes a message with `risk_tier == "crisis"` OR `risk_score >= CRISIS_SCORE_THRESHOLD`, THEN the system SHALL publish to Redis channel `crisis_alerts:{org_id}` BEFORE completing the DB write.
2. WHEN `CRISIS_SCORE_THRESHOLD` env var is set, THEN the system SHALL use that value; otherwise it SHALL default to `0.90`.
3. WHEN publishing the alert, THEN the system SHALL include `event_id`, `member_token`, `risk_score`, `risk_tier`, `recommended_action`, `active_signals`, `cultural_context`, `alerted_at`, and `review_deadline`.

## Requirement 12: Pipeline Timing Instrumentation

**User Story:** As a developer, I want every ingestion request to log per-stage timing into both PostgreSQL and Redis, so that I can measure and optimise end-to-end latency.

### Acceptance Criteria

1. WHEN any ingestion request is processed, THEN the system SHALL log 5 stages: `fastapi_received` (1), `consent_check` (2), `llm_call` (3), `db_save` (4), `response_sent` (5).
2. WHEN a stage log write fails, THEN the system SHALL log a warning and SHALL NOT affect the request/response cycle.
3. WHEN timing data is written to Redis, THEN the system SHALL use key `vasl:timing:{event_id}` with TTL of 600 seconds.
4. WHEN `POST /v1/pipeline/flush/{event_id}` is called, THEN the system SHALL read the Redis timing hash and upsert a `pipeline_runs` row with all 6 stage timings.

## Requirement 13: HTTP Request Logging

**User Story:** As a developer, I want every HTTP request to the FastAPI server logged to PostgreSQL, so that I can inspect real traffic for debugging and observability.

### Acceptance Criteria

1. WHEN any request arrives at paths other than `/health`, `/docs`, `/redoc`, `/openapi.json`, `/favicon.ico`, THEN the system SHALL log it to `request_logs`.
2. WHEN logging a POST/PUT/PATCH request, THEN the system SHALL strip `text` and `response_text` fields from the stored request body.
3. WHEN logging a request, THEN the system SHALL extract and index `event_id`, `member_token`, `org_id`, `session_id`, `role` from the body.
4. WHEN a log write fails, THEN the system SHALL log a warning and SHALL NOT affect the response.

## Requirement 14: Kafka Ingestion Gateway

**User Story:** As a platform service, I want to publish raw text events to Kafka, so that the AI inference pipeline can process them asynchronously.

### Acceptance Criteria

1. WHEN a POST request is made with `consent_active: false`, THEN the gateway SHALL return HTTP 403.
2. WHEN Kafka publish fails after retries, THEN the gateway SHALL return HTTP 503 with `error: "stream_unavailable"`.
3. WHEN publishing a message, THEN the gateway SHALL use `member_token` as the Kafka message key to preserve per-member ordering.
4. WHEN publishing, THEN the gateway SHALL call `flush(timeout=10)` synchronously — HTTP 202 is only returned after Kafka acknowledges.
5. WHEN a message is published, THEN the gateway SHALL generate a unique `ingestion_id` prefixed with `ing_` and return it in the response.
