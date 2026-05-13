-- ============================================================
-- Migration V11: Request logs table
-- Captures every HTTP request that hits the Python backend
-- (port 8000) — used for real-time observability and pipeline
-- analysis from the frontend → Node backend → FastAPI flow.
-- ============================================================

CREATE TABLE request_logs (
    id              BIGSERIAL    PRIMARY KEY,

    -- ── Request identity ──────────────────────────────────────
    request_id      VARCHAR(64)  NOT NULL UNIQUE,   -- UUID generated per request
    method          VARCHAR(10)  NOT NULL,           -- GET | POST | PUT | PATCH | DELETE
    path            TEXT         NOT NULL,           -- /v1/ingest/chat
    query_string    TEXT,                            -- raw query params (if any)
    full_url        TEXT         NOT NULL,           -- full URL including query

    -- ── Caller context ────────────────────────────────────────
    client_ip       VARCHAR(64),                     -- forwarded or direct IP
    user_agent      TEXT,
    origin          TEXT,                            -- Origin header (frontend URL)
    referer         TEXT,

    -- ── Request body snapshot ─────────────────────────────────
    -- Stored only for POST/PUT/PATCH; NULL for GET/DELETE
    -- Sensitive fields (text content) are included for pipeline analysis
    request_body    JSONB,                           -- parsed JSON body
    content_type    VARCHAR(128),
    content_length  INTEGER,

    -- ── VASL-specific fields (extracted from body when present) ──
    event_id        VARCHAR(64),                     -- payload.event_id
    member_token    VARCHAR(64),                     -- payload.member_token
    org_id          VARCHAR(64),                     -- payload.org_id
    source_type     VARCHAR(32),                     -- inferred from path: chat | peer-post | journal | assessment
    session_id      VARCHAR(64),                     -- payload.session_id (chat only)
    role            VARCHAR(16),                     -- payload.role (chat only)

    -- ── Response ──────────────────────────────────────────────
    status_code     SMALLINT     NOT NULL DEFAULT 0, -- HTTP response status
    response_body   JSONB,                           -- parsed JSON response (if any)

    -- ── Timing ────────────────────────────────────────────────
    received_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- when request arrived
    responded_at    TIMESTAMPTZ,                          -- when response was sent
    duration_ms     INTEGER,                              -- total processing time

    -- ── Error capture ─────────────────────────────────────────
    error_message   TEXT,                            -- set if an exception was raised
    is_error        BOOLEAN      NOT NULL DEFAULT FALSE
);

-- ── Indexes for common query patterns ────────────────────────
CREATE INDEX idx_request_logs_received_at   ON request_logs(received_at DESC);
CREATE INDEX idx_request_logs_path          ON request_logs(path);
CREATE INDEX idx_request_logs_method        ON request_logs(method);
CREATE INDEX idx_request_logs_status_code   ON request_logs(status_code);
CREATE INDEX idx_request_logs_event_id      ON request_logs(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_request_logs_member_token  ON request_logs(member_token) WHERE member_token IS NOT NULL;
CREATE INDEX idx_request_logs_org_id        ON request_logs(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX idx_request_logs_source_type   ON request_logs(source_type) WHERE source_type IS NOT NULL;
CREATE INDEX idx_request_logs_is_error      ON request_logs(is_error) WHERE is_error = TRUE;
