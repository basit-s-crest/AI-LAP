-- ============================================================
-- Migration V1: Members table
-- Stores pseudonymized member tokens — no PII ever stored here
-- ============================================================

CREATE TABLE members (
    id              SERIAL PRIMARY KEY,
    member_token    VARCHAR(64)  NOT NULL UNIQUE,  -- e.g. mbr_7c3a9f2e1b8d4c6a0e5f (pseudonymized)
    org_id          VARCHAR(64)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_org_id ON members(org_id);
CREATE INDEX idx_members_token  ON members(member_token);
