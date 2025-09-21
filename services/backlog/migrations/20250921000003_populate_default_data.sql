-- Populate default data and add helpful metadata

-- Update existing stories to have creation/update timestamps if they don't
UPDATE stories SET
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

-- Update existing tasks to have creation/update timestamps and default status
UPDATE tasks SET
    status = COALESCE(status, 'available'),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL OR status IS NULL;

-- Create indexes for better query performance on frequently accessed patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_status_organization ON stories(status, organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_story_owner ON tasks(story_id, owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_acceptance_criteria_refs ON tasks USING GIN(acceptance_criteria_refs);

-- Add helpful comments to tables
COMMENT ON TABLE stories IS 'User stories with opinionated agile workflow - Draft to Accepted progression';
COMMENT ON TABLE tasks IS 'Tasks with self-selection ownership model - contributors take ownership via "I''m on it"';
COMMENT ON TABLE acceptance_criteria IS 'Given/When/Then acceptance criteria for stories';

COMMENT ON COLUMN stories.status IS 'Opinionated workflow: draft->needsrefinement->ready->committed->inprogress->taskscomplete->deployed->awaitingacceptance->accepted';
COMMENT ON COLUMN stories.story_points IS 'Story estimation in points (1-8 maximum to enforce splitting)';
COMMENT ON COLUMN stories.sprint_id IS 'Sprint this story is committed to (references auth-gateway.sprints)';
COMMENT ON COLUMN stories.assigned_to_user_id IS 'Product Owner or Managing Contributor responsible for this story';

COMMENT ON COLUMN tasks.status IS 'Self-selection lifecycle: available->owned->inprogress->completed';
COMMENT ON COLUMN tasks.owner_user_id IS 'Contributor who owns this task via self-selection ("I''m on it")';
COMMENT ON COLUMN tasks.estimated_hours IS 'Estimated effort in hours (1-40 maximum to enforce task splitting)';
COMMENT ON COLUMN tasks.acceptance_criteria_refs IS 'References to acceptance criteria IDs this task implements';
COMMENT ON COLUMN tasks.owned_at IS 'Timestamp when contributor took ownership';
COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when task was completed';

COMMENT ON COLUMN acceptance_criteria.given IS 'Given context for the acceptance criteria';
COMMENT ON COLUMN acceptance_criteria.when_clause IS 'When action for the acceptance criteria';
COMMENT ON COLUMN acceptance_criteria.then_clause IS 'Then expected outcome for the acceptance criteria';