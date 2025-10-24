-- Add additional columns to projects table for backlog service integration
-- The projects service creates the base table, this adds columns needed by backlog
-- Add organization_id column if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add description column if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- Add timestamps if they don't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
