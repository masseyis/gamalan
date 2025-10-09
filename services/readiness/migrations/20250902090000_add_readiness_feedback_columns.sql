ALTER TABLE readiness_evals
    ADD COLUMN IF NOT EXISTS organization_id UUID,
    ADD COLUMN summary TEXT NOT NULL DEFAULT '',
    ADD COLUMN recommendations TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
