-- Migration: Task Readiness Story-Level Features
-- AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)
-- AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration)
-- Date: 2025-01-13

-- Enhance task_analyses table with structured clarity scoring columns
-- Keep analysis_json for backward compatibility and full data
ALTER TABLE task_analyses
    ADD COLUMN IF NOT EXISTS overall_score INTEGER,
    ADD COLUMN IF NOT EXISTS clarity_level TEXT,
    ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS recommendations TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS flagged_terms TEXT[] DEFAULT '{}';

-- Story analysis summaries (aggregated projection)
CREATE TABLE IF NOT EXISTS story_analysis_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL,
    organization_id UUID,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    analyzed_tasks INTEGER NOT NULL DEFAULT 0,
    avg_clarity_score INTEGER,
    tasks_ai_ready INTEGER NOT NULL DEFAULT 0,
    tasks_needing_improvement INTEGER NOT NULL DEFAULT 0,
    common_issues TEXT[] DEFAULT '{}',
    last_analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, organization_id)
);

-- Task suggestions (pending approval)
CREATE TABLE IF NOT EXISTS task_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL,
    organization_id UUID,
    suggestion_batch_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria_refs TEXT[] DEFAULT '{}',
    estimated_hours INTEGER,
    relevant_files TEXT[] DEFAULT '{}',
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- GitHub repository configurations
CREATE TABLE IF NOT EXISTS github_repo_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE,
    organization_id UUID NOT NULL,
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    access_token_encrypted TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, organization_id)
);

-- Create indexes for new tables
DO $$
BEGIN
    -- task_analyses indexes for new columns
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_analyses_clarity_level') THEN
        CREATE INDEX idx_task_analyses_clarity_level ON task_analyses(clarity_level);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_analyses_overall_score') THEN
        CREATE INDEX idx_task_analyses_overall_score ON task_analyses(overall_score);
    END IF;

    -- story_analysis_summaries indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_story_analysis_summaries_story_id') THEN
        CREATE INDEX idx_story_analysis_summaries_story_id ON story_analysis_summaries(story_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_story_analysis_summaries_org_id') THEN
        CREATE INDEX idx_story_analysis_summaries_org_id ON story_analysis_summaries(organization_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_story_analysis_summaries_avg_score') THEN
        CREATE INDEX idx_story_analysis_summaries_avg_score ON story_analysis_summaries(avg_clarity_score);
    END IF;

    -- task_suggestions indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_suggestions_story_id') THEN
        CREATE INDEX idx_task_suggestions_story_id ON task_suggestions(story_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_suggestions_org_id') THEN
        CREATE INDEX idx_task_suggestions_org_id ON task_suggestions(organization_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_suggestions_batch_id') THEN
        CREATE INDEX idx_task_suggestions_batch_id ON task_suggestions(suggestion_batch_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_suggestions_status') THEN
        CREATE INDEX idx_task_suggestions_status ON task_suggestions(status);
    END IF;

    -- github_repo_configs indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_github_repo_configs_project_id') THEN
        CREATE INDEX idx_github_repo_configs_project_id ON github_repo_configs(project_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_github_repo_configs_org_id') THEN
        CREATE INDEX idx_github_repo_configs_org_id ON github_repo_configs(organization_id);
    END IF;
END $$;

-- Create a view for easy querying of AI-ready tasks
CREATE OR REPLACE VIEW ai_ready_tasks AS
SELECT
    ta.id,
    ta.task_id,
    ta.organization_id,
    ta.overall_score,
    ta.clarity_level,
    ta.created_at
FROM task_analyses ta
WHERE ta.overall_score >= 80
ORDER BY ta.created_at DESC;

-- Create a view for pending task suggestions
CREATE OR REPLACE VIEW pending_task_suggestions AS
SELECT *
FROM task_suggestions
WHERE status = 'pending'
ORDER BY confidence DESC, created_at DESC;

-- Comments for documentation
COMMENT ON TABLE story_analysis_summaries IS 'Aggregated clarity analysis for all tasks in a story (CQRS projection)';
COMMENT ON TABLE task_suggestions IS 'AI-generated task suggestions pending approval';
COMMENT ON TABLE github_repo_configs IS 'GitHub repository configuration for project-level code context';
COMMENT ON COLUMN task_analyses.overall_score IS 'Clarity score 0-100 (>= 80 = AI-ready)';
COMMENT ON COLUMN task_analyses.clarity_level IS 'Level: excellent, good, fair, poor';
COMMENT ON COLUMN task_suggestions.confidence IS 'AI confidence in suggestion (0.0-1.0)';
COMMENT ON COLUMN task_suggestions.suggestion_batch_id IS 'Groups suggestions from same generation request';
