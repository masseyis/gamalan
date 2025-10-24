CREATE TABLE IF NOT EXISTS context_sprint_projections (
    id UUID PRIMARY KEY,
    organization_id UUID,
    team_id UUID NOT NULL,
    name TEXT NOT NULL,
    goal TEXT,
    status TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    committed_points INTEGER,
    completed_points INTEGER,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_sprint_org ON context_sprint_projections(organization_id);
CREATE INDEX IF NOT EXISTS idx_context_sprint_team ON context_sprint_projections(team_id);
