-- Add migration script here
CREATE TABLE stories (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id),
    title TEXT NOT NULL,
    description TEXT
);

CREATE TABLE labels (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE story_labels (
    story_id UUID NOT NULL REFERENCES stories(id),
    label_id UUID NOT NULL REFERENCES labels(id),
    PRIMARY KEY (story_id, label_id)
);
