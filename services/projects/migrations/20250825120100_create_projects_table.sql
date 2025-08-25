-- Add migration script here
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    team_id UUID
);

CREATE TABLE project_settings (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    estimation_scale TEXT NOT NULL,
    dor_template JSONB NOT NULL
);
