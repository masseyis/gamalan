# Battra Dogfooding Guide with Claude Code

This guide explains how to use Claude Code as different team members to dogfood Battra while developing it.

## Prerequisites

1. **Backend Services Running:**
   ```bash
   # Make sure all services are running
   docker-compose up -d postgres
   DATABASE_URL="postgres://postgres:password@localhost:5432/gamalan" cargo shuttle run --port 8000
   ```

2. **Frontend Running:**
   ```bash
   cd apps/web
   pnpm dev
   ```

3. **MCP Server Built:**
   ```bash
   pnpm --filter @battra/mcp-server install
   pnpm --filter @battra/mcp-server build
   ```

## Setup: Enable MCP Servers in Claude Code

Claude Code should auto-discover the `.claude/mcp-config.json` file in your workspace. If not, you may need to configure MCP servers in your Claude Code settings.

## Available Personas

### 1. Developer Contributor (`battra-dev`)
- **Use when:** Implementing features, writing code, fixing bugs
- **API Key:** `battra-dev-key-1`
- **Email:** dev+clerk_test@mock.com
- **Persona file:** `.claude/personas/dev-contributor.md`

### 2. Scrum Master (`battra-sm`)
- **Use when:** Sprint planning, monitoring progress, unblocking team
- **API Key:** `battra-sm-key-1`
- **Email:** sm+clerk_test@mock.com
- **Persona file:** `.claude/personas/scrum-master.md`

### 3. Product Owner (`battra-po`)
- **Use when:** Creating stories, prioritizing backlog, accepting work
- **API Key:** `battra-po-key-1`
- **Email:** po+clerk_test@mock.com
- **Persona file:** `.claude/personas/product-owner.md`

### 4. QA Contributor (`battra-qa`)
- **Use when:** Writing tests, performing QA, validating acceptance criteria
- **API Key:** `battra-qa-key-1`
- **Email:** qa+clerk_test@mock.com
- **Persona file:** `.claude/personas/qa-contributor.md`

### 5. Executive Sponsor (`battra-sponsor`)
- **Use when:** Strategic oversight, portfolio management, executive decisions
- **API Key:** `battra-sponsor-key-1`
- **Email:** sponsor+clerk_test@mock.com
- **Persona file:** `.claude/personas/sponsor.md`

## Typical Workflow

### Phase 1: Product Owner Creates Stories

Start Claude Code with context:
```
I am acting as the Product Owner (po+clerk_test@mock.com).
Please use the battra-po MCP server.

Let me check the current backlog and create a new story for [feature description].
```

Available MCP tools:
- `mcp__battra-po__list_projects` - List all projects
- `mcp__battra-po__list_project_stories` - List stories in a project
- `mcp__battra-po__create_story` - Create a new story
- `mcp__battra-po__update_story_status` - Update story status

### Phase 2: Scrum Master Plans Sprint

Start a new Claude Code session or switch context:
```
I am acting as the Scrum Master (sm+clerk_test@mock.com).
Please use the battra-sm MCP server.

Let me review ready stories and plan our next sprint.
```

Available MCP tools:
- `mcp__battra-sm__get_active_sprint` - Get current active sprint
- `mcp__battra-sm__create_sprint` - Create a new sprint
- `mcp__battra-sm__list_project_stories` - Review backlog

### Phase 3: Developer Picks Up Task

Start a new Claude Code session:
```
I am acting as a Developer (dev+clerk_test@mock.com).
Please use the battra-dev MCP server.

Let me check for available tasks I can work on, take ownership, and start implementing.
```

Available MCP tools:
- `mcp__battra-dev__list_story_tasks` - List tasks for a story
- `mcp__battra-dev__update_task_status` - Update task ownership/status
- `mcp__battra-dev__create_task` - Create new tasks if needed

### Phase 4: Developer Implements

Continue in the developer session:
```
Now that I've taken ownership of task [task-id], let me:
1. Read the acceptance criteria
2. Write tests first (TDD)
3. Implement the feature
4. Run quality checks (cargo fmt, clippy, tests)
5. Update the task status to 'completed'
```

## Example Session: Full Cycle

### 1. PO: Create a Story
```
Act as PO. Use battra-po MCP server.

Create a story in project [project-id]:
- Title: "Add task filtering by status"
- Description: "As a contributor, I want to filter tasks by status so I can focus on relevant work"
- Priority: high
```

### 2. SM: Create Sprint
```
Act as SM. Use battra-sm MCP server.

Review ready stories and create a 2-week sprint starting today.
Commit stories with total ~20 story points.
```

### 3. Dev: Pick Up Task
```
Act as Developer. Use battra-dev MCP server.

1. List tasks in story [story-id]
2. Take ownership of first available task
3. Start work on it
```

### 4. Dev: Implement
```
Continue as Developer.

Implement the task following TDD:
- Write tests in apps/web/components/tasks/__tests__/
- Implement TaskFilter component
- Ensure all tests pass
- Update task status to 'completed'
```

## Tips for Dogfooding

1. **Use Real Workflow:** Follow the same workflow you'd expect real users to follow
2. **Test Edge Cases:** Try edge cases and error scenarios
3. **Switch Personas:** Experience the product from different role perspectives
4. **Document Issues:** Create stories for bugs and improvements you discover
5. **Update Status:** Always update task/story status to reflect reality
6. **Validate UI:** Check http://localhost:3000 to see changes reflected in the UI

## Troubleshooting

### MCP Server Not Found
```bash
# Rebuild the MCP server
cd tools/battra-mcp-server
pnpm install
pnpm build
```

### Authentication Errors
- Verify the API key in mcp-config.json is correct (battra-dev-key-1, battra-sm-key-1, etc.)
- Check that the API gateway is running on port 8000
- Ensure the API key exists in the database (check api_keys table)

### Task Not Showing in UI
- Refresh the page
- Check browser console for errors
- Verify the case conversion is working (should see camelCase in network tab)

## Advanced: Multi-Agent Collaboration

To simulate multiple agents working simultaneously:

1. Open multiple Claude Code windows/tabs
2. Each configured with a different MCP server
3. Work on different tasks in parallel
4. Watch the system handle concurrent updates

This tests:
- Concurrent task ownership
- Real-time UI updates
- Race condition handling
- Multi-user collaboration flows
