DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sprints'
    ) THEN
        CREATE TABLE sprints (
            id UUID PRIMARY KEY,
            project_id UUID NOT NULL REFERENCES projects(id),
            organization_id UUID,
            name VARCHAR(255) NOT NULL,
            goal TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    END IF;
END $$;
