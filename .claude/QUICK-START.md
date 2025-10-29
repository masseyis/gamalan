# Quick Start: Dogfooding with Claude Code

## Step 1: Verify Setup

Make sure everything is running:

```bash
# 1. Database
docker ps | grep postgres

# 2. Backend API Gateway
curl http://localhost:8000/health

# 3. Frontend
curl http://localhost:3000
```

## Step 2: Configure Claude Code

Claude Code should automatically detect the `.claude/mcp-config.json` file. If not:

1. Open Claude Code settings
2. Navigate to MCP Servers section
3. Add the configurations from `.claude/mcp-config.json`

## Step 3: Start Your First Dogfooding Session

### Example: Developer Picks Up a Task

Open Claude Code and start a new conversation:

```
I am acting as a Developer Contributor (dev+clerk_test@mock.com).

My goals:
1. Find an available task to work on
2. Take ownership of it
3. Implement it following TDD
4. Update the task status when done

Please help me accomplish this using the battra-dev MCP server.

Start by listing projects and their stories so I can find work.
```

Claude Code will:
1. Use `mcp__battra-dev__list_projects` to show available projects
2. Use `mcp__battra-dev__list_project_stories` to show stories
3. Use `mcp__battra-dev__list_story_tasks` to find available tasks
4. Help you take ownership with `mcp__battra-dev__update_task_status`

### Example: Scrum Master Plans Sprint

Start a new conversation:

```
I am acting as the Scrum Master (sm+clerk_test@mock.com).

My goals:
1. Review the backlog for ready stories
2. Check if there's an active sprint
3. Plan a new 2-week sprint if needed
4. Commit appropriate stories to the sprint

Please help me accomplish this using the battra-sm MCP server.

Start by checking the current sprint status for project 35299584-b133-4b20-af2d-446bb1dead6a.
```

### Example: Product Owner Creates Story

Start a new conversation:

```
I am acting as the Product Owner (po+clerk_test@mock.com).

My goal: Create a new story for improving the dashboard's task filtering.

Story details:
- Title: "Add task status filter to dashboard"
- Description: "As a developer, I want to filter my tasks by status (owned, inprogress) so I can focus on relevant work"
- Priority: high
- Should include tasks for:
  - UI component for filter dropdown
  - Update API to support filtering
  - Add tests for filter functionality

Please create this story using the battra-po MCP server in project 35299584-b133-4b20-af2d-446bb1dead6a.
```

## Step 4: Verify in UI

After each action, verify the changes in the web UI:

1. Navigate to http://localhost:3000
2. Sign in as the appropriate persona
3. Check that changes are reflected:
   - New stories appear in backlog
   - Task ownership shows correctly
   - Sprint appears on dashboard

## Step 5: Switch Personas

To experience different perspectives:

1. **Close current Claude Code conversation** (or open new window)
2. **Start fresh conversation** with different persona
3. **Use different MCP server** (battra-dev, battra-sm, battra-po, battra-qa)

This simulates different team members interacting with the system.

## Common First Tasks

### As Developer:
```
List available tasks in the current sprint and take ownership of one that matches my skills.
```

### As Scrum Master:
```
Check sprint progress - how many tasks are completed vs in progress? Are we on track?
```

### As Product Owner:
```
Create a story for [feature] and break it down into 3-5 tasks with clear acceptance criteria.
```

### As QA:
```
Find stories in 'taskscomplete' status and create test tasks for them.
```

## Tips for Effective Dogfooding

1. **Be Specific:** Tell Claude Code exactly which persona you are and which MCP server to use
2. **Verify Everything:** Check the UI after each operation to ensure it works
3. **Find Bugs:** Look for edge cases, UI glitches, workflow issues
4. **Create Stories:** When you find issues, create stories for them (as PO)
5. **Follow Real Workflow:** Don't shortcut - experience the full user journey

## Troubleshooting

### MCP Tools Not Available

Check that MCP server is configured:
```bash
# Test the MCP server manually
cd tools/battra-mcp-server
BATTRA_API_KEY=battra-dev-key-1 \
BATTRA_API_BASE=http://localhost:8000/api/v1 \
pnpm start
```

### Wrong User Context

Make sure you're using the correct MCP server for your persona:
- Developer → battra-dev
- Scrum Master → battra-sm
- Product Owner → battra-po
- QA → battra-qa

### Changes Not Showing in UI

1. Refresh the browser
2. Check browser console for errors
3. Verify the API returned success (ask Claude Code to show response)
4. Check network tab to see if case conversion is working

## Next Steps

Once comfortable with basic workflow:

1. **Test Complex Scenarios:** Sprint transitions, story movement, concurrent updates
2. **Find UX Issues:** Look for confusing flows, missing feedback, unclear states
3. **Performance Testing:** Create many tasks, test pagination, query performance
4. **Edge Cases:** Try invalid inputs, boundary conditions, error scenarios
5. **Create Improvements:** Document everything you find and create stories for fixes

Happy dogfooding! 🐕🍖
