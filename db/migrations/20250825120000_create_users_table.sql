-- Add migration script here
CREATE TABLE users (
    id UUID PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
