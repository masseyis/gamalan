-- Create API keys table for programmatic access

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_token ON api_keys(token);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
