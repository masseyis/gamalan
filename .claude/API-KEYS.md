# Battra API Keys Reference

## Overview

Battra uses API key authentication for the MCP server and programmatic access. Each user persona has a dedicated API key stored in the database.

## Available API Keys

| Persona | Email | API Key | Role |
|---------|-------|---------|------|
| Developer | dev+clerk_test@mock.com | `battra-dev-key-1` | contributor |
| Scrum Master | sm+clerk_test@mock.com | `battra-sm-key-1` | managing_contributor |
| Product Owner | po+clerk_test@mock.com | `battra-po-key-1` | product_owner |
| QA | qa+clerk_test@mock.com | `battra-qa-key-1` | contributor |
| Sponsor | sponsor+clerk_test@mock.com | `battra-sponsor-key-1` | sponsor |

## Usage

### In MCP Configuration

The MCP configuration (`.claude/mcp-config.json`) uses API keys for authentication:

```json
{
  "mcpServers": {
    "battra-dev": {
      "env": {
        "BATTRA_API_BASE": "http://localhost:8000/api/v1",
        "BATTRA_API_KEY": "battra-dev-key-1"
      }
    }
  }
}
```

### In HTTP Requests

When making direct API calls, pass the API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: battra-dev-key-1" \
     http://localhost:8000/api/v1/projects
```

Or with the `ApiKey` prefix:

```bash
curl -H "X-API-Key: ApiKey battra-dev-key-1" \
     http://localhost:8000/api/v1/projects
```

### Authentication Flow

When an API key is provided:

1. API Gateway extracts the key from the `X-API-Key` header
2. Looks up the key in the `api_keys` table
3. Validates the user and organization
4. Creates authentication claims with user context
5. Updates `last_used_at` timestamp for the key

## Database Schema

API keys are stored in the `api_keys` table:

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
```

## Security Notes

- API keys authenticate as a specific user with their permissions
- Keys are scoped to an organization (if specified)
- The `last_used_at` field tracks key usage
- Keys should be treated as secrets and not committed to version control
- For production, use environment variables or secure secret management

## Troubleshooting

### Invalid API Key Error

If you get an "Invalid API key" error:

1. Verify the key exists in the database:
   ```bash
   psql "postgres://postgres:password@localhost:5432/gamalan" \
        -c "SELECT token, description FROM api_keys WHERE token = 'battra-dev-key-1';"
   ```

2. Check the API gateway is running and accessible:
   ```bash
   curl http://localhost:8000/health
   ```

3. Ensure the key is being sent in the correct header format

### Key Not Working After Update

If you update the database but the key doesn't work:

1. Restart the API gateway to clear any caches
2. Check the user and organization references are valid
3. Verify organization membership for the user
