-- Add organization_id column to acceptance_criteria table
-- This was missed in the previous organization support migration

-- Add organization_id column to acceptance_criteria table if it doesn't exist
DO $$
BEGIN
    BEGIN
        ALTER TABLE acceptance_criteria ADD COLUMN organization_id UUID;
    EXCEPTION
        WHEN duplicate_column THEN
            -- Column already exists, skip
            NULL;
    END;
END $$;

-- Add ac_id column for acceptance criteria identification if it doesn't exist
DO $$
BEGIN
    BEGIN
        ALTER TABLE acceptance_criteria ADD COLUMN ac_id TEXT;
    EXCEPTION
        WHEN duplicate_column THEN
            -- Column already exists, skip
            NULL;
    END;
END $$;

-- Create index for performance if it doesn't exist
DO $$
BEGIN
    BEGIN
        CREATE INDEX idx_acceptance_criteria_organization_id ON acceptance_criteria(organization_id);
    EXCEPTION
        WHEN duplicate_table THEN
            -- Index already exists, skip
            NULL;
    END;
END $$;

-- Create index on ac_id for faster lookups
DO $$
BEGIN
    BEGIN
        CREATE INDEX idx_acceptance_criteria_ac_id ON acceptance_criteria(ac_id);
    EXCEPTION
        WHEN duplicate_table THEN
            -- Index already exists, skip
            NULL;
    END;
END $$;
