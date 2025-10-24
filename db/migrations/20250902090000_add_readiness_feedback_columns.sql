ALTER TABLE readiness_evals
    ADD COLUMN IF NOT EXISTS organization_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'readiness_evals'
          AND column_name = 'summary'
    ) THEN
        ALTER TABLE readiness_evals
            ADD COLUMN summary TEXT NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'readiness_evals'
          AND column_name = 'recommendations'
    ) THEN
        ALTER TABLE readiness_evals
            ADD COLUMN recommendations TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
    END IF;
END
$$;
