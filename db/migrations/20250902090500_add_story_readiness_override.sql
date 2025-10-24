ALTER TABLE stories
    ADD COLUMN IF NOT EXISTS readiness_override BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS readiness_override_by UUID,
    ADD COLUMN IF NOT EXISTS readiness_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS readiness_override_at TIMESTAMPTZ;
