-- Align acceptance_criteria with readiness projections expectations
DO $$
BEGIN
    BEGIN
        ALTER TABLE acceptance_criteria ADD COLUMN organization_id UUID;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

DO $$
BEGIN
    BEGIN
        ALTER TABLE acceptance_criteria ADD COLUMN ac_id TEXT;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

DO $$
BEGIN
    BEGIN
        ALTER TABLE acceptance_criteria ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    EXCEPTION
        WHEN duplicate_column THEN
            ALTER TABLE acceptance_criteria ALTER COLUMN updated_at SET DEFAULT NOW();
    END;
END $$;

UPDATE acceptance_criteria
SET ac_id = id::text
WHERE ac_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_acceptance_criteria_story_ac_id
    ON acceptance_criteria(story_id, ac_id)
    WHERE ac_id IS NOT NULL;

DROP TABLE IF EXISTS criteria CASCADE;
DROP VIEW IF EXISTS criteria CASCADE;

CREATE VIEW criteria AS
SELECT
    id,
    story_id,
    organization_id,
    ac_id,
    description,
    given,
    when_clause AS "when",
    then_clause AS "then",
    created_at,
    updated_at
FROM acceptance_criteria;
