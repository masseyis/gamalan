-- Add organization support to backlog service

-- Add organization_id column to stories table if it doesn't exist
DO $$
BEGIN
    BEGIN
        ALTER TABLE stories ADD COLUMN organization_id UUID;
    EXCEPTION
        WHEN duplicate_column THEN
            -- Column already exists, skip
            NULL;
    END;
END $$;

-- Add organization_id column to tasks table if it doesn't exist
DO $$
BEGIN
    BEGIN
        ALTER TABLE tasks ADD COLUMN organization_id UUID;
    EXCEPTION
        WHEN duplicate_column THEN
            -- Column already exists, skip
            NULL;
    END;
END $$;

-- Create indexes for performance if they don't exist
DO $$
BEGIN
    BEGIN
        CREATE INDEX idx_stories_organization_id ON stories(organization_id);
    EXCEPTION
        WHEN duplicate_table THEN
            -- Index already exists, skip
            NULL;
    END;
END $$;

DO $$
BEGIN
    BEGIN
        CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);
    EXCEPTION
        WHEN duplicate_table THEN
            -- Index already exists, skip
            NULL;
    END;
END $$;

-- Add constraints to ensure organization isolation
-- Stories within an organization must have unique titles (optional constraint)
-- CREATE UNIQUE INDEX idx_stories_org_title_unique
-- ON stories(organization_id, title)
-- WHERE organization_id IS NOT NULL AND deleted_at IS NULL;