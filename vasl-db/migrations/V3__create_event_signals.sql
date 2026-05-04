-- ============================================================
-- Migration V3: Event signals table
-- Stores the active_signals array from each inference result.
-- Signal codes map to the Cultural Signal Taxonomy V1 (42 codes
-- across 5 dimensions: HOP, ISO, SHA, CRS, CCM).
-- ============================================================

CREATE TABLE event_signals (
    id              SERIAL       PRIMARY KEY,
    event_id        INTEGER      NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    signal_code     VARCHAR(16)  NOT NULL,   -- e.g. ISO-04, HOP-03, CRS-05
    signal_label    VARCHAR(128),            -- e.g. "Social isolation — indirect"
    confidence      NUMERIC(4,3) NOT NULL,   -- 0.000 – 1.000
    dimension       VARCHAR(32)              -- hopelessness | isolation | self_harm | crisis | cultural
);

CREATE INDEX idx_signals_event_id    ON event_signals(event_id);

-- Allows querying: which members have ISO-04 signals this week?
CREATE INDEX idx_signals_signal_code ON event_signals(signal_code);
