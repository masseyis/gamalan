-- Enhance stories table with new opinionated agile workflow fields

-- Add new fields for enhanced story model
ALTER TABLE stories ADD COLUMN story_points INTEGER CHECK (story_points IS NULL OR (story_points > 0 AND story_points <= 8));
ALTER TABLE stories ADD COLUMN sprint_id UUID; -- Will reference sprints in auth-gateway service
ALTER TABLE stories ADD COLUMN assigned_to_user_id UUID; -- References users in auth-gateway service
ALTER TABLE stories ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE stories ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Update status column to use new workflow statuses
-- First, update any existing stories to use new statuses
UPDATE stories SET status = 'draft' WHERE status NOT IN ('draft', 'needsrefinement', 'ready', 'committed', 'inprogress', 'taskscomplete', 'deployed', 'awaitingacceptance', 'accepted');

-- Add constraint for new status values
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check;
ALTER TABLE stories ADD CONSTRAINT stories_status_check
    CHECK (status IN ('draft', 'needsrefinement', 'ready', 'committed', 'inprogress', 'taskscomplete', 'deployed', 'awaitingacceptance', 'accepted'));

-- Create acceptance criteria table
CREATE TABLE acceptance_criteria (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    given TEXT NOT NULL, -- Given context
    when_clause TEXT NOT NULL, -- When action (using when_clause to avoid SQL keyword)
    then_clause TEXT NOT NULL, -- Then outcome (using then_clause to avoid SQL keyword)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_sprint_id ON stories(sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX idx_stories_assigned_user ON stories(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_stories_story_points ON stories(story_points) WHERE story_points IS NOT NULL;
CREATE INDEX idx_stories_updated_at ON stories(updated_at);

CREATE INDEX idx_acceptance_criteria_story_id ON acceptance_criteria(story_id);

-- Add a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on stories
CREATE TRIGGER update_stories_updated_at
    BEFORE UPDATE ON stories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();