-- Create teams table for agile team management

CREATE TABLE teams (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    active_sprint_id UUID, -- References sprints(id), added as FK later
    velocity_history INTEGER[] NOT NULL DEFAULT '{}', -- Array of last 10 sprint velocities
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(organization_id, name) -- Team names must be unique within organization
);

-- Create team memberships table
CREATE TABLE team_memberships (
    id UUID PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('sponsor', 'product_owner', 'managing_contributor', 'contributor')),
    specialty TEXT CHECK (specialty IS NULL OR specialty IN ('frontend', 'backend', 'fullstack', 'qa', 'devops', 'ux_designer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(team_id, user_id) -- User can only be in a team once
);

-- Add constraint to ensure only contributors can have specialties in team memberships
ALTER TABLE team_memberships ADD CONSTRAINT check_team_specialty_only_for_contributors
    CHECK (
        (role IN ('contributor', 'managing_contributor') AND specialty IS NOT NULL) OR
        (role IN ('sponsor', 'product_owner') AND specialty IS NULL) OR
        specialty IS NULL
    );

-- Create indexes for performance
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_active_sprint_id ON teams(active_sprint_id) WHERE active_sprint_id IS NOT NULL;
CREATE INDEX idx_team_memberships_team_id ON team_memberships(team_id);
CREATE INDEX idx_team_memberships_user_id ON team_memberships(user_id);
CREATE INDEX idx_team_memberships_active ON team_memberships(team_id, is_active) WHERE is_active = true;