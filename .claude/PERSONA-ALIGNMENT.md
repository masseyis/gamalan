# Persona Alignment: Database Users ↔ MCP Configuration

## Overview

This document shows the complete alignment between Battra database users and the dogfooding setup.

## Complete Alignment

| Persona | Email | Database Role | API Key | MCP Server | Persona File | Status |
|---------|-------|---------------|---------|------------|--------------|---------|
| **Developer** | dev+clerk_test@mock.com | contributor (fullstack) | `battra-dev-key-1` | battra-dev | dev-contributor.md | ✅ Complete |
| **Scrum Master** | sm+clerk_test@mock.com | managing_contributor | `battra-sm-key-1` | battra-sm | scrum-master.md | ✅ Complete |
| **Product Owner** | po+clerk_test@mock.com | product_owner | `battra-po-key-1` | battra-po | product-owner.md | ✅ Complete |
| **QA** | qa+clerk_test@mock.com | contributor (qa) | `battra-qa-key-1` | battra-qa | qa-contributor.md | ✅ Complete |
| **Sponsor** | sponsor+clerk_test@mock.com | sponsor | `battra-sponsor-key-1` | battra-sponsor | sponsor.md | ✅ Complete |

## Other Database Users (Not in MCP Setup)

These users exist in the database but are not configured for dogfooding:

| Email | Role | Notes |
|-------|------|-------|
| mcp+clerk_test@mock.com | product_owner | Has API key `battra-local-key-1`, seems to be for general MCP testing |
| dummy+clerk_test@mock.com | product_owner | No API key found |
| org_33F8RYQBCb26heNI8AjkgfTvGC0@placeholder.local | product_owner | Organization placeholder |
| test1@example.com | contributor (backend) | No API key found |
| test2@example.com | contributor (frontend) | No API key found |

## Role Mapping

### Battra Database Roles → Personas

- **contributor** → Developer or QA (distinguished by specialty)
  - `specialty: fullstack` → Developer Contributor
  - `specialty: qa` → QA Contributor
  - `specialty: backend` → Backend Developer
  - `specialty: frontend` → Frontend Developer

- **managing_contributor** → Scrum Master
  - Can contribute code but also manages sprints and team

- **product_owner** → Product Owner
  - Defines requirements and accepts work
  - Cannot pick up development tasks

- **sponsor** → Executive Sponsor
  - Strategic oversight and decision-making
  - Read-only access to most operations

## Organization Context

All dogfooding personas belong to the same organization:
- **Organization ID:** `66fb8efe-76c0-4b0c-9a57-b5e1deb05b58`
- **Organization Name:** (Query to get name)

## File Structure

```
.claude/
├── mcp-config.json              # MCP server configurations (5 servers)
├── personas/
│   ├── dev-contributor.md       # Developer persona
│   ├── scrum-master.md          # Scrum Master persona
│   ├── product-owner.md         # Product Owner persona
│   ├── qa-contributor.md        # QA persona
│   └── sponsor.md               # Sponsor persona
├── API-KEYS.md                  # API key reference
├── DOGFOODING-GUIDE.md          # Complete workflow guide
├── MCP-TOOL-REFERENCE.md        # MCP tools documentation
├── QUICK-START.md               # Quick start guide
└── PERSONA-ALIGNMENT.md         # This file
```

## Usage Example

To use a persona in Claude Code:

1. **Start a new conversation**
2. **Declare your persona:**
   ```
   I am acting as the Developer (dev+clerk_test@mock.com).
   Please use the battra-dev MCP server.
   ```
3. **Claude Code will:**
   - Load the battra-dev MCP server
   - Authenticate with `battra-dev-key-1`
   - Have access to all MCP tools with Developer permissions

## Verification Checklist

- [x] All 5 personas have database users
- [x] All 5 personas have API keys
- [x] All 5 personas have MCP server configs
- [x] All 5 personas have persona files
- [x] API keys are stored in database
- [x] Documentation is complete and consistent

## Next Steps

To fully test the alignment:

1. **Verify API keys work:**
   ```bash
   curl -H "X-API-Key: battra-dev-key-1" http://localhost:8000/api/v1/projects
   ```

2. **Test MCP server:**
   ```bash
   BATTRA_API_KEY=battra-dev-key-1 pnpm --filter @battra/mcp-server start
   ```

3. **Start dogfooding:**
   - Open Claude Code
   - Pick a persona
   - Follow the workflow in QUICK-START.md
