-- ============================================================
-- VASL ALAP — Consolidated Supabase Migration
-- Merges: vasl_ts (TypeScript/Prisma) + vasl (Python/FastAPI)
-- Target:  postgresql://postgres:***@db.yadujibjugyegtombulb.supabase.co:5432/postgres
--
-- Run order:
--   1. TypeScript app tables  (User, Coach, Org, Sessions, etc.)
--   2. Python AI/inference tables (members, inference_events, etc.)
--
-- Safe to run on a fresh Supabase database.
-- ============================================================


-- ============================================================
-- PART 1 — TypeScript App Tables  (was: vasl_ts)
-- ============================================================

-- ── User ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
    "id"                     TEXT         NOT NULL,
    "email"                  TEXT         NOT NULL,
    "name"                   TEXT         NOT NULL,
    "password"               TEXT         NOT NULL,
    "role"                   TEXT         NOT NULL DEFAULT 'member',
    "avatar"                 TEXT,
    "isVerified"             BOOLEAN      NOT NULL DEFAULT false,
    "organizationId"         TEXT,
    "notifyDailyCheckin"     BOOLEAN      NOT NULL DEFAULT false,
    "notifyGroupActivity"    BOOLEAN      NOT NULL DEFAULT true,
    "notifySessionReminders" BOOLEAN      NOT NULL DEFAULT true,
    "notifyWeeklySummary"    BOOLEAN      NOT NULL DEFAULT true,
    "lastActiveAt"           TIMESTAMP(3),
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- ── Organization ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Organization" (
    "id"                     TEXT             NOT NULL,
    "name"                   TEXT             NOT NULL,
    "type"                   TEXT             NOT NULL DEFAULT 'University',
    "plan"                   TEXT             NOT NULL DEFAULT 'Starter',
    "primaryContactName"     TEXT             NOT NULL,
    "primaryContactEmail"    TEXT             NOT NULL,
    "primaryContactPassword" TEXT             NOT NULL,
    "domain"                 TEXT,
    "monthlySpend"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"                 TEXT             NOT NULL DEFAULT 'active',
    "notifyWeeklyReport"     BOOLEAN          NOT NULL DEFAULT true,
    "notifyCrisisAlerts"     BOOLEAN          NOT NULL DEFAULT true,
    "notifyNewMembers"       BOOLEAN          NOT NULL DEFAULT false,
    "lastActiveAt"           TIMESTAMP(3),
    "createdAt"              TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_primaryContactEmail_key"
    ON "Organization"("primaryContactEmail");

-- ── Coach ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Coach" (
    "id"                      TEXT         NOT NULL,
    "email"                   TEXT         NOT NULL,
    "name"                    TEXT         NOT NULL,
    "password"                TEXT         NOT NULL,
    "avatar"                  TEXT,
    "bio"                     TEXT,
    "speciality"              TEXT,
    "isActive"                BOOLEAN      NOT NULL DEFAULT true,
    "organizationId"          TEXT,
    "notifyMessageAlerts"     BOOLEAN      NOT NULL DEFAULT true,
    "notifyNewClientAssigned" BOOLEAN      NOT NULL DEFAULT true,
    "notifySessionReminders"  BOOLEAN      NOT NULL DEFAULT true,
    "lastActiveAt"            TIMESTAMP(3),
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coach_email_key" ON "Coach"("email");

-- ── OrganizationCoach ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OrganizationCoach" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "coachId"        TEXT         NOT NULL,
    "assignedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationCoach_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationCoach_organizationId_coachId_key"
    ON "OrganizationCoach"("organizationId", "coachId");
CREATE INDEX IF NOT EXISTS "OrganizationCoach_organizationId_idx" ON "OrganizationCoach"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationCoach_coachId_idx"         ON "OrganizationCoach"("coachId");

-- ── CoachMember ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CoachMember" (
    "id"         TEXT         NOT NULL,
    "coachId"    TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CoachMember_coachId_userId_key" ON "CoachMember"("coachId", "userId");
CREATE INDEX IF NOT EXISTS "CoachMember_coachId_idx" ON "CoachMember"("coachId");
CREATE INDEX IF NOT EXISTS "CoachMember_userId_idx"  ON "CoachMember"("userId");

-- ── EmailVerification ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EmailVerification" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "otp"       TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used"      BOOLEAN      NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- ── Message ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Message" (
    "id"         TEXT         NOT NULL,
    "senderId"   TEXT         NOT NULL,
    "receiverId" TEXT         NOT NULL,
    "content"    TEXT         NOT NULL,
    "read"       BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- ── CoachMessage ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CoachMessage" (
    "id"         TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "coachId"    TEXT         NOT NULL,
    "content"    TEXT         NOT NULL,
    "senderRole" TEXT         NOT NULL,
    "read"       BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CoachMessage_userId_coachId_createdAt_idx" ON "CoachMessage"("userId", "coachId", "createdAt");
CREATE INDEX IF NOT EXISTS "CoachMessage_coachId_read_idx"             ON "CoachMessage"("coachId", "read");
CREATE INDEX IF NOT EXISTS "CoachMessage_userId_read_idx"              ON "CoachMessage"("userId", "read");

-- ── CommunityGroup ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CommunityGroup" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "emoji"       TEXT         NOT NULL DEFAULT '👥',
    "description" TEXT,
    "tags"        TEXT[],
    "mod"         TEXT,
    "status"      TEXT         NOT NULL DEFAULT 'active',
    "memberIds"   TEXT[],
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityGroup_pkey" PRIMARY KEY ("id")
);

-- ── GroupMembership ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GroupMembership" (
    "id"       TEXT         NOT NULL,
    "memberId" TEXT         NOT NULL,
    "groupId"  TEXT         NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN      NOT NULL DEFAULT true,
    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMembership_memberId_groupId_key" ON "GroupMembership"("memberId", "groupId");
CREATE INDEX IF NOT EXISTS "GroupMembership_memberId_idx" ON "GroupMembership"("memberId");
CREATE INDEX IF NOT EXISTS "GroupMembership_groupId_idx"  ON "GroupMembership"("groupId");

-- ── PeerGroupPost ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PeerGroupPost" (
    "id"           TEXT         NOT NULL,
    "groupId"      TEXT         NOT NULL,
    "memberId"     TEXT         NOT NULL,
    "body"         TEXT         NOT NULL,
    "replyCount"   INTEGER      NOT NULL DEFAULT 0,
    "supportCount" INTEGER      NOT NULL DEFAULT 0,
    "isFlagged"    BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeerGroupPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PeerGroupPost_groupId_createdAt_idx" ON "PeerGroupPost"("groupId", "createdAt");
CREATE INDEX IF NOT EXISTS "PeerGroupPost_memberId_idx"          ON "PeerGroupPost"("memberId");

-- ── Mood ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Mood" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "mood"      TEXT         NOT NULL,
    "date"      TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mood_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Mood_userId_date_key"       ON "Mood"("userId", "date");
CREATE INDEX IF NOT EXISTS "Mood_userId_date_idx"              ON "Mood"("userId", "date" DESC);
CREATE INDEX IF NOT EXISTS "Mood_userId_createdAt_idx"         ON "Mood"("userId", "createdAt");

-- ── Session ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Session" (
    "id"                TEXT         NOT NULL,
    "coachId"           TEXT         NOT NULL,
    "memberId"          TEXT         NOT NULL,
    "scheduledAt"       TIMESTAMP(3) NOT NULL,
    "duration"          INTEGER      NOT NULL DEFAULT 50,
    "type"              TEXT         NOT NULL DEFAULT 'Weekly Check-in',
    "status"            TEXT         NOT NULL DEFAULT 'upcoming',
    "notes"             TEXT,
    "cancelledBy"       TEXT,
    "rescheduleRequest" TIMESTAMP(3),
    "rescheduleBy"      TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- ── CoachAvailability ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CoachAvailability" (
    "id"        TEXT         NOT NULL,
    "coachId"   TEXT         NOT NULL,
    "slots"     JSONB        NOT NULL,
    "duration"  INTEGER      NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachAvailability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CoachAvailability_coachId_key" ON "CoachAvailability"("coachId");

-- ── SessionNote ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SessionNote" (
    "id"              TEXT         NOT NULL,
    "coachId"         TEXT         NOT NULL,
    "memberId"        TEXT         NOT NULL,
    "sessionType"     TEXT         NOT NULL,
    "notes"           TEXT         NOT NULL DEFAULT '',
    "nextSessionGoal" TEXT         NOT NULL DEFAULT '',
    "status"          TEXT         NOT NULL DEFAULT 'draft',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SessionNote_coachId_idx"            ON "SessionNote"("coachId");
CREATE INDEX IF NOT EXISTS "SessionNote_memberId_idx"           ON "SessionNote"("memberId");
CREATE INDEX IF NOT EXISTS "SessionNote_coachId_createdAt_idx"  ON "SessionNote"("coachId", "createdAt" DESC);

-- ── OnboardingAssessment ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OnboardingAssessment" (
    "id"         TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "age"        TEXT,
    "identity"   TEXT,
    "gender"     TEXT,
    "orient"     TEXT,
    "phqAnswers" INTEGER[],
    "phqScore"   INTEGER      NOT NULL,
    "gadAnswers" INTEGER[],
    "gadScore"   INTEGER      NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingAssessment_userId_key" ON "OnboardingAssessment"("userId");

-- ── PlatformSettings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id"                     TEXT         NOT NULL DEFAULT 'platform',
    "brandTitle"             TEXT         NOT NULL DEFAULT 'SafeCircle',
    "brandTagline"           TEXT         NOT NULL DEFAULT 'Mental Wellness Platform',
    "logoUrl"                TEXT,
    "primaryColor"           TEXT         NOT NULL DEFAULT '#4E8C58',
    "supportEmail"           TEXT         NOT NULL DEFAULT 'support@safecircle.com',
    "maxMembersPerCoach"     INTEGER      NOT NULL DEFAULT 20,
    "sessionDurationDefault" INTEGER      NOT NULL DEFAULT 50,
    "sessionDurationMax"     INTEGER      NOT NULL DEFAULT 90,
    "sessionDurationMin"     INTEGER      NOT NULL DEFAULT 25,
    "allowSelfRegistration"  BOOLEAN      NOT NULL DEFAULT true,
    "maintenanceMode"        BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- ── WeeklyReport ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WeeklyReport" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "weekStartDate"  TIMESTAMP(3) NOT NULL,
    "weekEndDate"    TIMESTAMP(3) NOT NULL,
    "reportData"     JSONB        NOT NULL,
    "generatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyReport_organizationId_weekStartDate_key"
    ON "WeeklyReport"("organizationId", "weekStartDate");
CREATE INDEX IF NOT EXISTS "WeeklyReport_organizationId_weekStartDate_idx"
    ON "WeeklyReport"("organizationId", "weekStartDate" DESC);

-- ── Foreign Keys (Part 1) ─────────────────────────────────────
ALTER TABLE "User"
    ADD CONSTRAINT "User_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Coach"
    ADD CONSTRAINT "Coach_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationCoach"
    ADD CONSTRAINT "OrganizationCoach_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationCoach"
    ADD CONSTRAINT "OrganizationCoach_coachId_fkey"
    FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachMember"
    ADD CONSTRAINT "CoachMember_coachId_fkey"
    FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachMember"
    ADD CONSTRAINT "CoachMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailVerification"
    ADD CONSTRAINT "EmailVerification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
    ADD CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message"
    ADD CONSTRAINT "Message_receiverId_fkey"
    FOREIGN KEY ("receiverId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CoachMessage"
    ADD CONSTRAINT "CoachMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachMessage"
    ADD CONSTRAINT "CoachMessage_coachId_fkey"
    FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupMembership"
    ADD CONSTRAINT "GroupMembership_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMembership"
    ADD CONSTRAINT "GroupMembership_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PeerGroupPost"
    ADD CONSTRAINT "PeerGroupPost_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeerGroupPost"
    ADD CONSTRAINT "PeerGroupPost_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mood"
    ADD CONSTRAINT "Mood_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionNote"
    ADD CONSTRAINT "SessionNote_coachId_fkey"
    FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionNote"
    ADD CONSTRAINT "SessionNote_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnboardingAssessment"
    ADD CONSTRAINT "OnboardingAssessment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyReport"
    ADD CONSTRAINT "WeeklyReport_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- PART 2 — Python AI / Inference Tables  (was: vasl)
-- ============================================================

-- ── members ───────────────────────────────────────────────────
-- Pseudonymized tokens only — no PII stored here
CREATE TABLE IF NOT EXISTS members (
    id           SERIAL      PRIMARY KEY,
    member_token VARCHAR(64) NOT NULL UNIQUE,  -- mbr_... token
    org_id       VARCHAR(64) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_org_id ON members(org_id);
CREATE INDEX IF NOT EXISTS idx_members_token  ON members(member_token);

-- ── inference_events ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inference_events (
    id                 SERIAL       PRIMARY KEY,
    event_id           VARCHAR(64)  NOT NULL UNIQUE,
    original_source_id VARCHAR(64),
    member_id          INTEGER      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id             VARCHAR(64)  NOT NULL,
    source_type        VARCHAR(32)  NOT NULL,
    event_timestamp    TIMESTAMPTZ  NOT NULL,
    ingested_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- source-specific metadata
    group_id           VARCHAR(64),
    mood_score         SMALLINT,
    session_id         VARCHAR(64),
    role               VARCHAR(16),
    instrument         VARCHAR(16),
    item_number        SMALLINT,

    -- risk output
    risk_tier          VARCHAR(16)  NOT NULL,
    risk_score         NUMERIC(4,3) NOT NULL,
    risk_trend         VARCHAR(16),
    cultural_context   TEXT[],
    recommended_action VARCHAR(64),

    -- review state
    clinician_reviewed BOOLEAN      NOT NULL DEFAULT FALSE,
    review_deadline    TIMESTAMPTZ,

    -- model metadata
    model_version      VARCHAR(64),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_member_id       ON inference_events(member_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id          ON inference_events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_risk_tier       ON inference_events(risk_tier);
CREATE INDEX IF NOT EXISTS idx_events_event_timestamp ON inference_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_unreviewed      ON inference_events(clinician_reviewed, review_deadline)
    WHERE clinician_reviewed = FALSE;
CREATE INDEX IF NOT EXISTS idx_events_source_type     ON inference_events(source_type);

-- ── event_signals ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_signals (
    id          SERIAL       PRIMARY KEY,
    event_id    INTEGER      NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    signal_code VARCHAR(16)  NOT NULL,
    signal_label VARCHAR(128),
    confidence  NUMERIC(4,3) NOT NULL,
    dimension   VARCHAR(32)
);
CREATE INDEX IF NOT EXISTS idx_signals_event_id    ON event_signals(event_id);
CREATE INDEX IF NOT EXISTS idx_signals_signal_code ON event_signals(signal_code);

-- ── shap_attributions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shap_attributions (
    id          SERIAL        PRIMARY KEY,
    event_id    INTEGER       NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    span        VARCHAR(64)   NOT NULL,
    weight      NUMERIC(5,4)  NOT NULL,
    signal_code VARCHAR(16),
    rank        SMALLINT
);
CREATE INDEX IF NOT EXISTS idx_shap_event_id ON shap_attributions(event_id);

-- ── review_actions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_actions (
    id               SERIAL       PRIMARY KEY,
    review_id        VARCHAR(64)  NOT NULL UNIQUE,
    event_id         INTEGER      NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    member_id        INTEGER      NOT NULL REFERENCES members(id),
    therapist_id     VARCHAR(64)  NOT NULL,
    action           VARCHAR(64)  NOT NULL,
    clinician_notes  TEXT,
    reviewed_at      TIMESTAMPTZ  NOT NULL,
    recorded_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_event_id  ON review_actions(event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_member_id ON review_actions(member_id);
CREATE INDEX IF NOT EXISTS idx_reviews_therapist ON review_actions(therapist_id);

-- ── member_risk_snapshots ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_risk_snapshots (
    id                      SERIAL        PRIMARY KEY,
    member_id               INTEGER       NOT NULL REFERENCES members(id) ON DELETE CASCADE UNIQUE,
    org_id                  VARCHAR(64)   NOT NULL,
    therapist_id            VARCHAR(64),
    current_risk_tier       VARCHAR(16)   NOT NULL DEFAULT 'low',
    current_risk_score      NUMERIC(4,3),
    risk_trend              VARCHAR(16),
    total_events            INTEGER       NOT NULL DEFAULT 0,
    high_crisis_event_count INTEGER       NOT NULL DEFAULT 0,
    avg_risk_score_7d       NUMERIC(4,3),
    avg_risk_score_30d      NUMERIC(4,3),
    max_risk_score_30d      NUMERIC(4,3),
    latest_event_id         INTEGER       REFERENCES inference_events(id),
    latest_event_at         TIMESTAMPTZ,
    pending_reviews         INTEGER       NOT NULL DEFAULT 0,
    overdue_reviews         INTEGER       NOT NULL DEFAULT 0,
    last_calculated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_snapshots_therapist ON member_risk_snapshots(therapist_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_org_id    ON member_risk_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_risk_tier ON member_risk_snapshots(current_risk_tier);

-- ── request_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_logs (
    id             BIGSERIAL    PRIMARY KEY,
    request_id     VARCHAR(64)  NOT NULL UNIQUE,
    method         VARCHAR(10)  NOT NULL,
    path           TEXT         NOT NULL,
    query_string   TEXT,
    full_url       TEXT         NOT NULL,
    client_ip      VARCHAR(64),
    user_agent     TEXT,
    origin         TEXT,
    referer        TEXT,
    request_body   JSONB,
    content_type   VARCHAR(128),
    content_length INTEGER,
    event_id       VARCHAR(64),
    member_token   VARCHAR(64),
    org_id         VARCHAR(64),
    source_type    VARCHAR(32),
    session_id     VARCHAR(64),
    role           VARCHAR(16),
    status_code    SMALLINT     NOT NULL DEFAULT 0,
    response_body  JSONB,
    received_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    responded_at   TIMESTAMPTZ,
    duration_ms    INTEGER,
    error_message  TEXT,
    is_error       BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_request_logs_received_at  ON request_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_path         ON request_logs(path);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code  ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_event_id     ON request_logs(event_id)     WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_logs_member_token ON request_logs(member_token) WHERE member_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_logs_org_id       ON request_logs(org_id)       WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_logs_is_error     ON request_logs(is_error)     WHERE is_error = TRUE;

-- ── pipeline_runs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id                       BIGSERIAL    PRIMARY KEY,
    event_id                 VARCHAR(64)  NOT NULL UNIQUE,
    job_num                  INTEGER,
    text                     TEXT,
    member_token             VARCHAR(64),
    org_id                   VARCHAR(64),
    session_id               VARCHAR(64),
    role                     VARCHAR(16),
    source_type              VARCHAR(32),
    s1_enqueue_started_at    TIMESTAMPTZ,
    s1_enqueue_finished_at   TIMESTAMPTZ,
    s1_enqueue_ms            INTEGER,
    s1_queue_wait_started_at  TIMESTAMPTZ,
    s1_queue_wait_finished_at TIMESTAMPTZ,
    s1_queue_wait_ms          INTEGER,
    s2_started_at            TIMESTAMPTZ,
    s2_finished_at           TIMESTAMPTZ,
    s2_ms                    INTEGER,
    s3_started_at            TIMESTAMPTZ,
    s3_finished_at           TIMESTAMPTZ,
    s3_ms                    INTEGER,
    s4_started_at            TIMESTAMPTZ,
    s4_finished_at           TIMESTAMPTZ,
    s4_ms                    INTEGER,
    s5_started_at            TIMESTAMPTZ,
    s5_finished_at           TIMESTAMPTZ,
    s5_ms                    INTEGER,
    s6_started_at            TIMESTAMPTZ,
    s6_finished_at           TIMESTAMPTZ,
    s6_ms                    INTEGER,
    risk_tier                VARCHAR(16),
    risk_score               NUMERIC(4,3),
    risk_trend               VARCHAR(16),
    fastapi_total_ms         INTEGER,
    is_complete              BOOLEAN      NOT NULL DEFAULT FALSE,
    has_error                BOOLEAN      NOT NULL DEFAULT FALSE,
    error_stage              VARCHAR(32),
    error_message            TEXT,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pr_event_id     ON pipeline_runs(event_id);
CREATE INDEX IF NOT EXISTS idx_pr_created_at   ON pipeline_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_member_token ON pipeline_runs(member_token) WHERE member_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_risk_tier    ON pipeline_runs(risk_tier)    WHERE risk_tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pr_is_complete  ON pipeline_runs(is_complete);

-- ── pipeline_stage_logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_stage_logs (
    id           BIGSERIAL    PRIMARY KEY,
    event_id     VARCHAR(64)  NOT NULL,
    request_id   VARCHAR(64),
    member_token VARCHAR(64)  NOT NULL,
    org_id       VARCHAR(64)  NOT NULL,
    session_id   VARCHAR(64),
    role         VARCHAR(16),
    source_type  VARCHAR(32)  NOT NULL,
    stage_num    SMALLINT     NOT NULL,
    stage_name   VARCHAR(64)  NOT NULL,
    started_at   TIMESTAMPTZ  NOT NULL,
    finished_at  TIMESTAMPTZ,
    duration_ms  INTEGER,
    status       VARCHAR(16)  NOT NULL DEFAULT 'ok',
    error_message TEXT,
    risk_tier    VARCHAR(16),
    risk_score   NUMERIC(4,3),
    risk_trend   VARCHAR(16)
);
CREATE INDEX IF NOT EXISTS idx_psl_event_id     ON pipeline_stage_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_psl_member_token ON pipeline_stage_logs(member_token);
CREATE INDEX IF NOT EXISTS idx_psl_started_at   ON pipeline_stage_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_psl_stage_name   ON pipeline_stage_logs(stage_name);


-- ============================================================
-- PART 3 — Snapshot upsert function + trigger
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_member_risk_snapshot(p_member_id INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO member_risk_snapshots (
        member_id, org_id, current_risk_tier, current_risk_score, risk_trend,
        total_events, high_crisis_event_count,
        avg_risk_score_7d, avg_risk_score_30d, max_risk_score_30d,
        latest_event_id, latest_event_at,
        pending_reviews, overdue_reviews,
        last_calculated_at, updated_at
    )
    SELECT
        m.id, m.org_id,
        latest.risk_tier, latest.risk_score, latest.risk_trend,
        COUNT(e.id),
        COUNT(e.id) FILTER (WHERE e.risk_tier IN ('high','crisis')),
        AVG(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '7 days'),
        AVG(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '30 days'),
        MAX(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '30 days'),
        latest.id, latest.event_timestamp,
        COUNT(e.id) FILTER (WHERE e.clinician_reviewed = FALSE),
        COUNT(e.id) FILTER (WHERE e.clinician_reviewed = FALSE AND e.review_deadline < NOW()),
        NOW(), NOW()
    FROM members m
    JOIN inference_events e ON e.member_id = m.id
    JOIN LATERAL (
        SELECT * FROM inference_events
        WHERE member_id = m.id
        ORDER BY event_timestamp DESC LIMIT 1
    ) latest ON TRUE
    WHERE m.id = p_member_id
    GROUP BY m.id, m.org_id, latest.id, latest.risk_tier,
             latest.risk_score, latest.risk_trend, latest.event_timestamp
    ON CONFLICT (member_id) DO UPDATE SET
        current_risk_tier       = EXCLUDED.current_risk_tier,
        current_risk_score      = EXCLUDED.current_risk_score,
        risk_trend              = EXCLUDED.risk_trend,
        total_events            = EXCLUDED.total_events,
        high_crisis_event_count = EXCLUDED.high_crisis_event_count,
        avg_risk_score_7d       = EXCLUDED.avg_risk_score_7d,
        avg_risk_score_30d      = EXCLUDED.avg_risk_score_30d,
        max_risk_score_30d      = EXCLUDED.max_risk_score_30d,
        latest_event_id         = EXCLUDED.latest_event_id,
        latest_event_at         = EXCLUDED.latest_event_at,
        pending_reviews         = EXCLUDED.pending_reviews,
        overdue_reviews         = EXCLUDED.overdue_reviews,
        last_calculated_at      = NOW(),
        updated_at              = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION trigger_snapshot_upsert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM upsert_member_risk_snapshot(NEW.member_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inference_event_snapshot ON inference_events;
CREATE TRIGGER trg_inference_event_snapshot
    AFTER INSERT ON inference_events
    FOR EACH ROW EXECUTE FUNCTION trigger_snapshot_upsert();


-- ============================================================
-- Done — all tables, indexes, foreign keys, and functions created.
-- ============================================================
