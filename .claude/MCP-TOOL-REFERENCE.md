# Battra MCP Tools Quick Reference

## Available Tools

All tools are prefixed with the MCP server name (e.g., `mcp__battra-dev__list_projects`).

### Project Management

#### `list_projects`
Lists all projects accessible to the user.

**Returns:** Array of projects with id, name, description, teamId

**Example:**
```
Use battra-dev server to list all projects
```

#### `get_project`
Get details of a specific project.

**Parameters:**
- `projectId` (string, required) - UUID of the project

**Example:**
```
Get project details for project ID: 35299584-b133-4b20-af2d-446bb1dead6a
```

### Story Management

#### `list_project_stories`
Lists all stories in a project.

**Parameters:**
- `projectId` (string, required) - UUID of the project
- `sprintId` (string, optional) - Filter by sprint ID

**Returns:** Array of stories with id, title, description, status, priority, tasks

**Example:**
```
List all stories in project 35299584-b133-4b20-af2d-446bb1dead6a
```

#### `create_story`
Creates a new story in a project.

**Parameters:**
- `projectId` (string, required) - UUID of the project
- `title` (string, required) - Story title
- `description` (string, optional) - Story description
- `priority` (string, optional) - low, medium, high, critical
- `labels` (array, optional) - Array of label strings

**Returns:** Created story object

**Example:**
```
Create a story in project 35299584-b133-4b20-af2d-446bb1dead6a:
- Title: "Add task filtering"
- Description: "As a user, I want to filter tasks by status"
- Priority: high
```

#### `update_story_status`
Updates the status of a story.

**Parameters:**
- `projectId` (string, required) - UUID of the project
- `storyId` (string, required) - UUID of the story
- `status` (string, required) - One of: draft, needsrefinement, ready, committed, inprogress, taskscomplete, deployed, awaitingacceptance, accepted

**Example:**
```
Update story 5bb8df3a-6e07-4872-a43d-2fd8f6ad5b57 to status 'ready'
```

### Task Management

#### `list_story_tasks`
Lists all tasks for a story.

**Parameters:**
- `projectId` (string, required) - UUID of the project
- `storyId` (string, required) - UUID of the story

**Returns:** Array of tasks with id, title, description, status, ownerUserId, estimatedHours, acceptanceCriteriaRefs

**Example:**
```
List tasks for story 5bb8df3a-6e07-4872-a43d-2fd8f6ad5b57
in project 35299584-b133-4b20-af2d-446bb1dead6a
```

#### `create_task`
Creates a new task in a story.

**Parameters:**
- `projectId` (string, required) - UUID of the project
- `storyId` (string, required) - UUID of the story
- `title` (string, required) - Task title
- `description` (string, optional) - Task description
- `acceptanceCriteriaRefs` (array, optional) - Array of AC IDs (e.g., ["AC1", "AC2"])

**Returns:** Created task object

**Example:**
```
Create a task in story 5bb8df3a-6e07-4872-a43d-2fd8f6ad5b57:
- Title: "Implement TaskFilter component"
- Description: "Create a dropdown filter for task status"
- AC Refs: ["AC1"]
```

#### `update_task_status`
Updates the status of a task (and ownership).

**Parameters:**
- `taskId` (string, required) - UUID of the task
- `status` (string, required) - One of: available, owned, inprogress, completed

**Note:**
- Setting status to 'owned' assigns the task to the current user
- Status transitions: available → owned → inprogress → completed

**Example:**
```
Update task 2ffbfa6d-ceb8-4f86-af40-32c17521a0df to status 'inprogress'
```

### Sprint Management

#### `get_active_sprint`
Gets the active sprint for a project.

**Parameters:**
- `projectId` (string, required) - UUID of the project

**Returns:** Sprint object or null if no active sprint

**Example:**
```
Get active sprint for project 35299584-b133-4b20-af2d-446bb1dead6a
```

#### `create_sprint`
Creates a new sprint for a project.

**Parameters:**
- `projectId` (string, required) - UUID of the project
- `name` (string, required) - Sprint name (e.g., "Sprint 5")
- `goal` (string, required) - Sprint goal description
- `startDate` (string, required) - ISO date string (e.g., "2025-01-27")
- `endDate` (string, required) - ISO date string (e.g., "2025-02-10")
- `capacityPoints` (number, optional) - Team capacity in story points

**Returns:** Created sprint object

**Example:**
```
Create a sprint in project 35299584-b133-4b20-af2d-446bb1dead6a:
- Name: "Sprint 6"
- Goal: "Implement task management improvements"
- Start: "2025-01-27"
- End: "2025-02-10"
- Capacity: 20
```

## Common Workflows

### Developer Takes Ownership of Task
```
1. mcp__battra-dev__list_story_tasks(projectId, storyId)
2. Find task with status='available'
3. mcp__battra-dev__update_task_status(taskId, status='owned')
4. mcp__battra-dev__update_task_status(taskId, status='inprogress')
```

### Scrum Master Plans Sprint
```
1. mcp__battra-sm__list_project_stories(projectId)
2. Filter stories with status='ready'
3. mcp__battra-sm__create_sprint(projectId, name, goal, startDate, endDate)
4. mcp__battra-sm__update_story_status(projectId, storyId, status='committed')
```

### Product Owner Creates and Prepares Story
```
1. mcp__battra-po__create_story(projectId, title, description, priority)
2. mcp__battra-po__create_task(projectId, storyId, title, description)
3. Review with team
4. mcp__battra-po__update_story_status(projectId, storyId, status='ready')
```

## Error Handling

All tools return errors in a standard format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

Common errors:
- **NOT_FOUND:** Resource doesn't exist
- **UNAUTHORIZED:** Invalid user or permissions
- **VALIDATION_ERROR:** Invalid parameters
- **CONFLICT:** Status transition not allowed

## Testing the MCP Server

Test the server manually (using API key authentication):
```bash
BATTRA_API_KEY=battra-dev-key-1 \
BATTRA_API_BASE=http://localhost:8000/api/v1 \
pnpm --filter @battra/mcp-server start
```

Available API keys by persona:
- Developer: `battra-dev-key-1`
- Scrum Master: `battra-sm-key-1`
- Product Owner: `battra-po-key-1`
- QA: `battra-qa-key-1`

The server expects JSON-RPC messages on stdin.
