CREATE TABLE IF NOT EXISTS prompt_sprint_projections (
    id UUID PRIMARY KEY,
    organization_id UUID,
    team_id UUID NOT NULL,
    name TEXT NOT NULL,
    goal TEXT,
    capacity_points INTEGER,
    status TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    committed_points INTEGER,
    completed_points INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_sprint_org ON prompt_sprint_projections(organization_id);
CREATE INDEX IF NOT EXISTS idx_prompt_sprint_team ON prompt_sprint_projections(team_id);
