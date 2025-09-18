-- Add organization support to backlog service

-- Add organization_id column to stories table
ALTER TABLE stories ADD COLUMN organization_id UUID;

-- Add organization_id column to tasks table
ALTER TABLE tasks ADD COLUMN organization_id UUID;

-- Create indexes for performance
CREATE INDEX idx_stories_organization_id ON stories(organization_id);
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);

-- Add constraints to ensure organization isolation
-- Stories within an organization must have unique titles (optional constraint)
-- CREATE UNIQUE INDEX idx_stories_org_title_unique
-- ON stories(organization_id, title)
-- WHERE organization_id IS NOT NULL AND deleted_at IS NULL;