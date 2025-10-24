-- Create plan_packs table
CREATE TABLE plan_packs (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    acceptance_criteria_map JSONB NOT NULL,
    proposed_tasks JSONB NOT NULL,
    architecture_impact TEXT,
    risks TEXT[] NOT NULL DEFAULT '{}',
    unknowns TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_id)
);

-- Create task_packs table  
CREATE TABLE task_packs (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL,
    plan_pack_id UUID REFERENCES plan_packs(id),
    objectives TEXT NOT NULL,
    non_goals JSONB NOT NULL DEFAULT '[]',
    story_context TEXT NOT NULL,
    acceptance_criteria_covered JSONB NOT NULL,
    constraints JSONB NOT NULL,
    test_plan JSONB NOT NULL,
    do_not_list JSONB NOT NULL,
    commit_plan JSONB NOT NULL,
    run_instructions JSONB NOT NULL DEFAULT '[]',
    markdown_content TEXT NOT NULL,
    json_content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(task_id)
);

-- Create indexes for performance
CREATE INDEX idx_plan_packs_story_id ON plan_packs(story_id);
CREATE INDEX idx_task_packs_task_id ON task_packs(task_id);
CREATE INDEX idx_task_packs_plan_pack_id ON task_packs(plan_pack_id);
CREATE INDEX idx_plan_packs_created_at ON plan_packs(created_at);
CREATE INDEX idx_task_packs_created_at ON task_packs(created_at);