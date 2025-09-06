-- Add migration script here
CREATE TABLE readiness_evals (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    score INTEGER NOT NULL,
    missing_items TEXT[] NOT NULL
);

CREATE TABLE criteria (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    ac_id TEXT NOT NULL,
    given TEXT NOT NULL,
    "when" TEXT NOT NULL,
    "then" TEXT NOT NULL,
    UNIQUE(story_id, ac_id)
);
