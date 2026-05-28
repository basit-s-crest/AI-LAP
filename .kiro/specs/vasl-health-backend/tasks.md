# Implementation Plan:

## Overview

This spec contains test verification tasks for the VASL Health Backend system. Each task group verifies specific functionality of the FastAPI backend including ingestion endpoints, LLM inference pipeline, risk score storage, dashboard APIs, crisis alerts, pipeline timing, request logging, Kafka gateway, security, and bug fixes.

## Tasks

- [x] 1. Test ingestion endpoint consent validation - Verify `POST /v1/ingest/peer-post` returns 403 when `consent_active: false`
- [ ] 2. Test ingestion endpoint with consent - Verify `POST /v1/ingest/peer-post` returns 202 with risk result when consent is true
- [ ] 3. Test peer-post text length validation - Verify `POST /v1/ingest/peer-post` rejects `text` longer than 2000 characters
- [ ] 4. Test journal mood score validation - Verify `POST /v1/ingest/journal` validates `mood_score` is 1–5
- [ ] 5. Test journal text length validation - Verify `POST /v1/ingest/journal` rejects `text` longer than 5000 characters
- [ ] 6. Test chat role validation - Verify `POST /v1/ingest/chat` validates `role` is `"member"` or `"coach"`
- [ ] 7. Test chat text length validation - Verify `POST /v1/ingest/chat` rejects `text` longer than 500 characters
- [ ] 8. Test assessment instrument validation - Verify `POST /v1/ingest/assessment` validates `instrument` is `PHQ8`, `GAD7`, or `ACES`
- [ ] 9. Test assessment item number validation - Verify `POST /v1/ingest/assessment` validates `item_number` is ≥ 1
- [ ] 10. Test ingestion timing metrics - Verify all ingest endpoints return `timing_llm_ms` and `timing_total_ms` in response
- [ ] 11. Test background DB save - Verify DB save runs as background task (response returned before save completes)
- [ ] 12. Test LLM model override - Verify `OPENROUTER_MODEL` env var overrides the default model
- [ ] 13. Test LLM retry logic - Verify retry logic triggers on 429 and 503 responses (up to 3 attempts)
- [ ] 14. Test LLM invalid JSON handling - Verify invalid JSON from OpenRouter returns HTTP 502 to caller
- [ ] 15. Test review deadline calculation - Verify `review_deadline` is set to 2h for crisis, 24h for high, 72h for moderate, null for low
- [ ] 16. Test active signals parsing - Verify `active_signals` are parsed and included in the response
- [ ] 17. Test SHAP attributions parsing - Verify `shap_attributions` are parsed and included in the response
- [ ] 18. Test cultural context parsing - Verify `cultural_context` array is parsed from LLM response
- [ ] 19. Test member auto-creation - Verify member is auto-created if not found (upsert on `member_token`)
- [ ] 20. Test event signals storage - Verify `event_signals` rows are inserted for all active signals
- [ ] 21. Test SHAP attributions storage - Verify `shap_attributions` rows are inserted
- [ ] 22. Test risk snapshot update - Verify `upsert_member_risk_snapshot` is called after save
- [ ] 23. Test idempotent event handling - Verify duplicate `event_id` is handled without error (idempotent)
- [ ] 24. Test Redis cache invalidation - Verify Redis cache is busted for member after successful save
- [ ] 25. Test review action with unknown event - Verify `POST /v1/review/action` returns 404 for unknown `event_id`
- [ ] 26. Test clinician reviewed flag - Verify `clinician_reviewed` is set to `true` on the inference event after review
- [ ] 27. Test review action storage - Verify `therapist_id`, `action`, `clinician_notes`, `reviewed_at` are stored
- [ ] 28. Test member dashboard unknown member - Verify `GET /v1/results/member/{member_token}` returns 404 for unknown member
- [ ] 29. Test member dashboard default query - Verify default query returns last 30 days, max 50 events
- [ ] 30. Test member dashboard query params - Verify `since`, `source`, `limit` query params are applied correctly
- [ ] 31. Test member dashboard caching - Verify response is cached in Redis for default (no-filter) requests
- [ ] 32. Test member dashboard cache TTL - Verify cache TTL matches `CACHE_TTL` env var
- [ ] 33. Test admin summary tier counts - Verify `GET /v1/admin/summary/{org_id}` returns all 4 risk tier counts
- [ ] 34. Test admin high crisis count - Verify `high_crisis_members` counts `high` and `crisis` tier snapshots
- [ ] 35. Test admin top signals - Verify `top_signals` returns top 5 by frequency
- [ ] 36. Test admin summary caching - Verify admin summary is cached in Redis per org_id
- [ ] 37. Test admin events ordering - Verify `GET /v1/admin/events/{org_id}` returns events in ascending order
- [ ] 38. Test admin events limit - Verify `GET /v1/admin/events/{org_id}` respects `limit` query param
- [ ] 39. Test crisis alert fast path - Verify Redis alert is published to `crisis_alerts:{org_id}` BEFORE DB write for crisis events
- [ ] 40. Test crisis threshold config - Verify `CRISIS_SCORE_THRESHOLD` env var controls the threshold (default 0.90)
- [ ] 41. Test crisis alert payload - Verify alert payload includes all required fields
- [ ] 42. Test pipeline stage logging - Verify 5 stage logs are written to `pipeline_stage_logs` per ingestion request
- [ ] 43. Test stage log failure handling - Verify stage log failures do not affect the request/response cycle
- [ ] 44. Test Redis timing hash - Verify Redis timing hash `vasl:timing:{event_id}` is written with TTL 600s
- [ ] 45. Test pipeline flush endpoint - Verify `POST /v1/pipeline/flush/{event_id}` upserts `pipeline_runs` row
- [ ] 46. Test pipeline stats endpoint - Verify `GET /v1/pipeline/stats` returns min/avg/p90/max per stage
- [ ] 47. Test request logging exclusions - Verify `/health`, `/docs`, `/redoc`, `/openapi.json`, `/favicon.ico` are NOT logged
- [ ] 48. Test request body sanitization - Verify `text` and `response_text` fields are stripped from stored request body
- [ ] 49. Test request metadata extraction - Verify `event_id`, `member_token`, `org_id`, `session_id`, `role` are extracted and indexed
- [ ] 50. Test request log failure handling - Verify log write failures do not affect the response
- [ ] 51. Test request logs query endpoint - Verify `GET /v1/logs/requests` supports all filter params
- [ ] 52. Test request logs stats endpoint - Verify `GET /v1/logs/stats` returns error rate and p90 duration
- [ ] 53. Test Kafka gateway consent validation - Verify gateway returns 403 when `consent_active: false`
- [ ] 54. Test Kafka gateway failure handling - Verify gateway returns 503 when Kafka publish fails
- [ ] 55. Test Kafka message key - Verify message key is `member_token`
- [ ] 56. Test Kafka flush timeout - Verify `flush(timeout=10)` is called synchronously before returning 202
- [ ] 57. Test Kafka ingestion ID format - Verify `ingestion_id` is generated with `ing_` prefix
- [ ] 58. Add authentication middleware - Add authentication middleware to all `/v1/*` FastAPI endpoints
- [ ] 59. Restrict CORS origins - Restrict `allow_origins` in CORS middleware to known origins
- [ ] 60. Document environment variables - Document `CACHE_TTL` and `OPENROUTER_MODEL` in `backend/.env.example`
- [ ] 61. Make LLM params configurable - Make `HTTP-Referer`, `X-Title`, `max_tokens`, `temperature` configurable via env vars
- [ ] 62. Fix Kafka consumer signal fields - Fix Kafka consumer signal field names (`s["code"]` → `s["signal_code"]`, `s["label"]` → `s["signal_label"]`)
- [ ] 63. Remove unused Prisma client - Remove unused `backend/node_modules/` Prisma client
- [ ] 64. Implement password reset - Implement `forgotPassword` password reset flow (currently a stub)
- [ ] 65. Document canonical ingestion path - Clarify and document which ingestion path is canonical for production (FastAPI direct vs Kafka gateway)

## Notes

These tasks verify the VASL Health Backend implementation. Tasks 1-57 are verification/testing tasks, while tasks 58-65 are implementation tasks for security hardening and bug fixes.

## Task Dependency Graph

```mermaid
graph TD
    1[1. Test ingestion endpoint consent validation]
    2[2. Test ingestion endpoint with consent]
    3[3. Test peer-post text length validation]
    4[4. Test journal mood score validation]
    5[5. Test journal text length validation]
    6[6. Test chat role validation]
    7[7. Test chat text length validation]
    8[8. Test assessment instrument validation]
    9[9. Test assessment item number validation]
    10[10. Test ingestion timing metrics]
    11[11. Test background DB save]
    12[12. Test LLM model override]
    13[13. Test LLM retry logic]
    14[14. Test LLM invalid JSON handling]
    15[15. Test review deadline calculation]
    16[16. Test active signals parsing]
    17[17. Test SHAP attributions parsing]
    18[18. Test cultural context parsing]
    19[19. Test member auto-creation]
    20[20. Test event signals storage]
    21[21. Test SHAP attributions storage]
    22[22. Test risk snapshot update]
    23[23. Test idempotent event handling]
    24[24. Test Redis cache invalidation]
    25[25. Test review action with unknown event]
    26[26. Test clinician reviewed flag]
    27[27. Test review action storage]
    28[28. Test member dashboard unknown member]
    29[29. Test member dashboard default query]
    30[30. Test member dashboard query params]
    31[31. Test member dashboard caching]
    32[32. Test member dashboard cache TTL]
    33[33. Test admin summary tier counts]
    34[34. Test admin high crisis count]
    35[35. Test admin top signals]
    36[36. Test admin summary caching]
    37[37. Test admin events ordering]
    38[38. Test admin events limit]
    39[39. Test crisis alert fast path]
    40[40. Test crisis threshold config]
    41[41. Test crisis alert payload]
    42[42. Test pipeline stage logging]
    43[43. Test stage log failure handling]
    44[44. Test Redis timing hash]
    45[45. Test pipeline flush endpoint]
    46[46. Test pipeline stats endpoint]
    47[47. Test request logging exclusions]
    48[48. Test request body sanitization]
    49[49. Test request metadata extraction]
    50[50. Test request log failure handling]
    51[51. Test request logs query endpoint]
    52[52. Test request logs stats endpoint]
    53[53. Test Kafka gateway consent validation]
    54[54. Test Kafka gateway failure handling]
    55[55. Test Kafka message key]
    56[56. Test Kafka flush timeout]
    57[57. Test Kafka ingestion ID format]
    58[58. Add authentication middleware]
    59[59. Restrict CORS origins]
    60[60. Document environment variables]
    61[61. Make LLM params configurable]
    62[62. Fix Kafka consumer signal fields]
    63[63. Remove unused Prisma client]
    64[64. Implement password reset]
    65[65. Document canonical ingestion path]
```
