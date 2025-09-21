-- Enhance tasks table with task ownership model and self-selection

-- Add new fields for task ownership model
ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'owned', 'inprogress', 'completed'));

ALTER TABLE tasks ADD COLUMN owner_user_id UUID; -- References users in auth-gateway service
ALTER TABLE tasks ADD COLUMN estimated_hours INTEGER CHECK (estimated_hours IS NULL OR (estimated_hours > 0 AND estimated_hours <= 40));
ALTER TABLE tasks ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tasks ADD COLUMN owned_at TIMESTAMPTZ; -- When task was taken ownership
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMPTZ; -- When task was completed

-- Add acceptance_criteria_refs column if it doesn't exist (from previous migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'acceptance_criteria_refs'
    ) THEN
        ALTER TABLE tasks ADD COLUMN acceptance_criteria_refs TEXT[] NOT NULL DEFAULT '{}';
    END IF;
END $$;

-- Ensure acceptance_criteria_refs is not empty
ALTER TABLE tasks ADD CONSTRAINT tasks_acceptance_criteria_refs_not_empty
    CHECK (array_length(acceptance_criteria_refs, 1) > 0);

-- Create indexes for performance
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_owner_user_id ON tasks(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_tasks_story_id_status ON tasks(story_id, status);
CREATE INDEX idx_tasks_estimated_hours ON tasks(estimated_hours) WHERE estimated_hours IS NOT NULL;
CREATE INDEX idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX idx_tasks_owned_at ON tasks(owned_at) WHERE owned_at IS NOT NULL;
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;

-- Index for finding available tasks for ownership
CREATE INDEX idx_tasks_available_for_ownership ON tasks(story_id) WHERE status = 'available';

-- Index for finding tasks owned by a user
CREATE INDEX idx_tasks_owned_by_user ON tasks(owner_user_id, status) WHERE owner_user_id IS NOT NULL;

-- Create trigger to automatically update updated_at on tasks
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraint to ensure ownership consistency
-- If task is owned, in progress, or completed, it must have an owner
ALTER TABLE tasks ADD CONSTRAINT tasks_ownership_consistency
    CHECK (
        (status = 'available' AND owner_user_id IS NULL AND owned_at IS NULL) OR
        (status IN ('owned', 'inprogress', 'completed') AND owner_user_id IS NOT NULL AND owned_at IS NOT NULL)
    );

-- Add constraint to ensure completed tasks have completion timestamp
ALTER TABLE tasks ADD CONSTRAINT tasks_completion_consistency
    CHECK (
        (status != 'completed' AND completed_at IS NULL) OR
        (status = 'completed' AND completed_at IS NOT NULL)
    );