CREATE TABLE IF NOT EXISTS readiness_story_projections (
    id UUID PRIMARY KEY,
    organization_id UUID,
    project_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    labels TEXT[] NOT NULL DEFAULT '{}',
    story_points INTEGER,
    acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    sprint_id UUID,
    assigned_to_user_id UUID,
    readiness_override BOOLEAN NOT NULL DEFAULT FALSE,
    readiness_override_by UUID,
    readiness_override_reason TEXT,
    readiness_override_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS readiness_task_projections (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES readiness_story_projections(id) ON DELETE CASCADE,
    organization_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria_refs TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    owner_user_id UUID,
    estimated_hours INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    owned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_readiness_task_story ON readiness_task_projections(story_id);
