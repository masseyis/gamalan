CREATE TABLE IF NOT EXISTS task_analyses (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL,
    story_id UUID NOT NULL,
    organization_id UUID,
    analysis_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_analyses_task_id ON task_analyses(task_id);
CREATE INDEX IF NOT EXISTS idx_task_analyses_story_id ON task_analyses(story_id);
CREATE INDEX IF NOT EXISTS idx_task_analyses_org_id ON task_analyses(organization_id);
