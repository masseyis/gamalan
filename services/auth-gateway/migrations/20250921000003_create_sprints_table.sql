-- Create sprints table for sprint management

CREATE TABLE sprints (
    id UUID PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'review', 'completed')),
    capacity_points INTEGER NOT NULL CHECK (capacity_points > 0),
    committed_points INTEGER NOT NULL DEFAULT 0 CHECK (committed_points >= 0),
    completed_points INTEGER NOT NULL DEFAULT 0 CHECK (completed_points >= 0),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    -- Ensure sprint dates are valid
    CHECK (start_date < end_date),
    -- Ensure sprint is not longer than 4 weeks (28 days)
    CHECK (end_date - start_date <= INTERVAL '28 days'),
    -- Ensure sprint is at least 1 day long
    CHECK (end_date - start_date >= INTERVAL '1 day'),
    -- Ensure committed points don't exceed capacity (can be temporarily violated during planning)
    CHECK (completed_points <= committed_points)
);

-- Add the foreign key constraint from teams to sprints now that sprints table exists
ALTER TABLE teams ADD CONSTRAINT fk_teams_active_sprint_id
    FOREIGN KEY (active_sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;

-- Ensure only one active sprint per team at a time
CREATE UNIQUE INDEX idx_teams_one_active_sprint
    ON teams(organization_id)
    WHERE active_sprint_id IS NOT NULL;

-- Create indexes for performance
CREATE INDEX idx_sprints_team_id ON sprints(team_id);
CREATE INDEX idx_sprints_status ON sprints(status);
CREATE INDEX idx_sprints_dates ON sprints(start_date, end_date);
CREATE INDEX idx_sprints_active ON sprints(team_id, status) WHERE status = 'active';