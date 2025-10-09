ALTER TABLE stories
    ADD COLUMN readiness_override BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN readiness_override_by UUID,
    ADD COLUMN readiness_override_reason TEXT,
    ADD COLUMN readiness_override_at TIMESTAMPTZ;
