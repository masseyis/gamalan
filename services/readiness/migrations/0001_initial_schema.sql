-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stories table (shared with other services, used for joins)
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY,
    organization_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Readiness story projections table
CREATE TABLE IF NOT EXISTS readiness_story_projections (
    id UUID PRIMARY KEY,
    organization_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    story_points INTEGER,
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acceptance criteria table
CREATE TABLE IF NOT EXISTS acceptance_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL,
    organization_id UUID,
    ac_id TEXT NOT NULL,
    given TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "then" TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, ac_id)
);

-- Readiness evaluations table
CREATE TABLE IF NOT EXISTS readiness_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID NOT NULL,
    organization_id UUID,
    score INTEGER NOT NULL,
    missing_items TEXT[] NOT NULL DEFAULT '{}',
    summary TEXT NOT NULL,
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task analyses table
CREATE TABLE IF NOT EXISTS task_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL,
    story_id UUID NOT NULL,
    organization_id UUID,
    analysis_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Readiness task projections table
CREATE TABLE IF NOT EXISTS readiness_task_projections (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    organization_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria_refs TEXT[] DEFAULT '{}',
    estimated_hours INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_readiness_story_projections_org_id') THEN
        CREATE INDEX idx_readiness_story_projections_org_id ON readiness_story_projections(organization_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_acceptance_criteria_story_id') THEN
        CREATE INDEX idx_acceptance_criteria_story_id ON acceptance_criteria(story_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_acceptance_criteria_org_id') THEN
        CREATE INDEX idx_acceptance_criteria_org_id ON acceptance_criteria(organization_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_readiness_evaluations_story_id') THEN
        CREATE INDEX idx_readiness_evaluations_story_id ON readiness_evaluations(story_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_readiness_evaluations_org_id') THEN
        CREATE INDEX idx_readiness_evaluations_org_id ON readiness_evaluations(organization_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_analyses_task_id') THEN
        CREATE INDEX idx_task_analyses_task_id ON task_analyses(task_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_analyses_story_id') THEN
        CREATE INDEX idx_task_analyses_story_id ON task_analyses(story_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_task_analyses_org_id') THEN
        CREATE INDEX idx_task_analyses_org_id ON task_analyses(organization_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_readiness_task_projections_story_id') THEN
        CREATE INDEX idx_readiness_task_projections_story_id ON readiness_task_projections(story_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_readiness_task_projections_org_id') THEN
        CREATE INDEX idx_readiness_task_projections_org_id ON readiness_task_projections(organization_id);
    END IF;
END $$;

-- Create views (aliases for some tables)
CREATE OR REPLACE VIEW criteria AS SELECT * FROM acceptance_criteria;
CREATE OR REPLACE VIEW readiness_evals AS SELECT * FROM readiness_evaluations;
