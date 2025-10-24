-- Add organization support to projects service

-- Drop existing tables to recreate with proper structure
DROP TABLE IF EXISTS project_settings;
DROP TABLE IF EXISTS projects;

-- Create projects table with organization support
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID, -- NULL for personal projects
    name TEXT NOT NULL,
    description TEXT,
    team_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create project_settings table
CREATE TABLE project_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    estimation_scale TEXT NOT NULL DEFAULT 'fibonacci',
    dor_template JSONB NOT NULL DEFAULT '{"required_fields": ["title", "description", "acceptance_criteria"], "acceptance_criteria_required": true, "story_points_required": false, "labels_required": []}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Create indexes for performance
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_project_settings_project_id ON project_settings(project_id);

-- Add constraints to ensure organization isolation
-- Projects within an organization must have unique names
CREATE UNIQUE INDEX idx_projects_org_name_unique
ON projects(organization_id, name)
WHERE organization_id IS NOT NULL;

-- Personal projects (organization_id IS NULL) can have duplicate names across users
-- This will be enforced at the application level with user context