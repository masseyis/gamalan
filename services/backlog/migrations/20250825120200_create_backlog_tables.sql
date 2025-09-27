-- Add migration script here
CREATE TABLE stories (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    organization_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    story_points INTEGER CHECK (story_points IS NULL OR (story_points > 0 AND story_points <= 8)),
    sprint_id UUID,
    assigned_to_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    labels TEXT[] DEFAULT '{}'::TEXT[]
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id),
    organization_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria_refs TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'owned', 'inprogress', 'completed')),
    owner_user_id UUID,
    estimated_hours INTEGER CHECK (estimated_hours IS NULL OR (estimated_hours > 0 AND estimated_hours <= 40)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT tasks_acceptance_criteria_refs_not_empty
        CHECK (array_length(acceptance_criteria_refs, 1) > 0),
    CONSTRAINT tasks_ownership_consistency
        CHECK (
            (status = 'available' AND owner_user_id IS NULL AND owned_at IS NULL) OR
            (status IN ('owned', 'inprogress', 'completed') AND owner_user_id IS NOT NULL AND owned_at IS NOT NULL)
        ),
    CONSTRAINT tasks_completion_consistency
        CHECK (
            (status != 'completed' AND completed_at IS NULL) OR
            (status = 'completed' AND completed_at IS NOT NULL)
        )
);

CREATE TABLE acceptance_criteria (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    given TEXT NOT NULL,
    when_clause TEXT NOT NULL,
    then_clause TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE labels (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE story_labels (
    story_id UUID NOT NULL REFERENCES stories(id),
    label_id UUID NOT NULL REFERENCES labels(id),
    PRIMARY KEY (story_id, label_id)
);

-- Basic constraints (status constraint will be added by enhancement migration)
ALTER TABLE stories ADD CONSTRAINT stories_status_check
    CHECK (status IN ('draft', 'needsrefinement', 'ready', 'committed', 'inprogress', 'taskscomplete', 'deployed', 'awaitingacceptance', 'accepted'));

-- Create basic indexes (more will be added by enhancement migrations)
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_organization_id ON stories(organization_id);
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_stories_updated_at
    BEFORE UPDATE ON stories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
