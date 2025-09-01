-- Context Orchestrator Service Tables

-- Intent history table for tracking user interactions
CREATE TABLE IF NOT EXISTS intent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    utterance_hash VARCHAR(64) NOT NULL,  -- SHA256 hash for privacy
    parsed_intent JSONB NOT NULL,
    llm_confidence FLOAT NOT NULL CHECK (llm_confidence >= 0 AND llm_confidence <= 1),
    service_confidence FLOAT NOT NULL CHECK (service_confidence >= 0 AND service_confidence <= 1),
    candidates_considered UUID[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action audit log for tracking executed actions
CREATE TABLE IF NOT EXISTS action_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_entities UUID[] NOT NULL,
    parameters JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    rollback_token UUID,
    execution_duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting table for tracking user request counts
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,  -- 'interpret' or 'act'
    token_count INTEGER NOT NULL,
    last_refill TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, resource_type)
);

-- Context snapshots for storing system state at points in time
CREATE TABLE IF NOT EXISTS context_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    entities JSONB NOT NULL,  -- Array of ContextEntity
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_intent_user ON intent_history(user_id);
CREATE INDEX IF NOT EXISTS idx_intent_tenant ON intent_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intent_created ON intent_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_hash ON intent_history(utterance_hash);

CREATE INDEX IF NOT EXISTS idx_audit_user ON action_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON action_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON action_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON action_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_success ON action_audit_log(success);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_resource ON rate_limit_buckets(user_id, resource_type);

CREATE INDEX IF NOT EXISTS idx_context_tenant ON context_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_context_user ON context_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_context_created ON context_snapshots(created_at DESC);