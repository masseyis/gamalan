# Integrating Claude Code with Autonomous Agents

This guide explains how to integrate Claude Code into the autonomous agent execution loop so that AI can actually implement tasks.

## Overview

The `execute_task()` function in `scripts/autonomous-agent.sh` currently just simulates work. To make it functional, we need to:

1. Format the task into a prompt for Claude Code
2. Invoke Claude Code with the prompt
3. Monitor the execution
4. Handle success/failure

## Requirements

### 1. Claude Code CLI Access

The agent needs to be able to invoke Claude Code from the command line. There are several approaches:

#### Option A: Claude CLI (Preferred)
```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-cli

# Configure API key
export ANTHROPIC_API_KEY="your-key-here"

# Invoke Claude Code
echo "Your task description" | claude-code
```

#### Option B: Direct API Integration
```bash
# Call Anthropic API directly via curl
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 8096,
    "messages": [
      {"role": "user", "content": "Your task prompt"}
    ]
  }'
```

#### Option C: Node.js Wrapper
```javascript
// scripts/claude-code-executor.js
const Anthropic = require("@anthropic-ai/sdk");

async function executeTask(taskTitle, taskDescription, acceptanceCriteria) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = formatTaskPrompt(taskTitle, taskDescription, acceptanceCriteria);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8096,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content;
}
```

### 2. Task Context Retrieval

The agent needs to fetch complete task details including:
- Acceptance criteria (GET `/api/v1/stories/{story_id}/acceptance-criteria`)
- Related story context (GET `/api/v1/stories/{story_id}`)
- Codebase location (working directory)

### 3. Prompt Engineering

The prompt needs to include:
- **Task objective** (title + description)
- **Acceptance criteria** (Given/When/Then)
- **Technical constraints** (architecture, testing requirements)
- **File locations** (from enhanced task descriptions)
- **Success criteria** (tests must pass, etc.)

## Implementation Options

### Option 1: Simple Inline Execution (Bash)

Replace the TODO in `execute_task()`:

```bash
execute_task() {
  local task_id="$1"
  local task_title="$2"
  local task_description="$3"

  log_info "Executing task: $task_title"

  # Get full task details including ACs
  local task_full=$(api_get "tasks/$task_id")
  local story_id=$(echo "$task_full" | jq -r '.story_id')
  local ac_refs=$(echo "$task_full" | jq -r '.acceptance_criteria_refs[]')

  # Get acceptance criteria text
  local acs=$(api_get "stories/$story_id/acceptance-criteria")

  # Build prompt
  local prompt="$(cat <<EOF
You are an AI developer implementing a task for the Battra project.

## Task
**Title:** $task_title
**Description:** $task_description

## Acceptance Criteria
$(echo "$acs" | jq -r '.[] | "### \(.id)\n**Given:** \(.given)\n**When:** \(.when_clause)\n**Then:** \(.then_clause)\n"')

## Requirements
- Follow the hexagonal architecture pattern
- Write tests first (TDD)
- Ensure all tests pass
- Follow the CLAUDE.md guidelines in the repo

## Working Directory
$(pwd)

Please implement this task. Run tests to verify your implementation.
EOF
)"

  # Execute with Claude Code
  log_info "Sending task to Claude Code..."

  if ! echo "$prompt" | claude-code --non-interactive; then
    log_error "Claude Code execution failed"
    return 1
  fi

  # Verify tests pass
  log_info "Verifying tests..."
  if ! cargo test --package backlog --quiet; then
    log_error "Tests failed after implementation"
    return 1
  fi

  log_success "Task implementation completed successfully"
  return 0
}
```

### Option 2: Node.js Wrapper (More Control)

Create `scripts/claude-code-executor.js`:

```javascript
#!/usr/bin/env node
const Anthropic = require("@anthropic-ai/sdk");
const { spawn } = require("child_process");

async function executeTask(taskId, apiBase, apiKey) {
  // Fetch task details
  const taskRes = await fetch(`${apiBase}/tasks/${taskId}`, {
    headers: { "X-API-Key": apiKey },
  });
  const task = await taskRes.json();

  // Fetch story and ACs
  const acsRes = await fetch(
    `${apiBase}/stories/${task.story_id}/acceptance-criteria`,
    { headers: { "X-API-Key": apiKey } }
  );
  const acs = await acsRes.json();

  // Build prompt
  const prompt = buildPrompt(task, acs);

  // Execute with Claude Code
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log("🤖 Sending task to Claude Code...");

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8096,
    messages: [{ role: "user", content: prompt }],
  });

  // Stream response
  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      process.stdout.write(event.delta.text);
    }
  }

  console.log("\n\n✅ Task execution completed");

  // Run tests
  console.log("🧪 Running tests...");
  const testResult = await runTests();

  if (!testResult.success) {
    console.error("❌ Tests failed:", testResult.error);
    process.exit(1);
  }

  console.log("✅ All tests passed");
  process.exit(0);
}

function buildPrompt(task, acs) {
  const acText = acs
    .map(
      (ac) =>
        `### ${ac.id}\n**Given:** ${ac.given}\n**When:** ${ac.when_clause}\n**Then:** ${ac.then_clause}`
    )
    .join("\n\n");

  return `You are an AI developer implementing a task for the Battra project.

## Task
**Title:** ${task.title}
**Description:** ${task.description || "No description provided"}

## Acceptance Criteria
${acText}

## Task Details
- **Story ID:** ${task.story_id}
- **Task ID:** ${task.id}
- **Estimated Hours:** ${task.estimated_hours || "Not estimated"}
- **AC References:** ${task.acceptance_criteria_refs.join(", ")}

## Requirements
- Follow the hexagonal architecture pattern defined in CLAUDE.md
- Write tests first (TDD approach)
- Ensure all tests pass before completing
- Update OpenAPI specs if adding/modifying endpoints
- Follow Rust best practices (clippy, fmt)

## Working Directory
${process.cwd()}

## Instructions
1. Read the task description and acceptance criteria carefully
2. Identify which files need to be created or modified
3. Write tests first to verify the acceptance criteria
4. Implement the functionality
5. Run tests to verify everything works
6. Run cargo fmt and cargo clippy to ensure code quality

Please implement this task now.`;
}

async function runTests() {
  return new Promise((resolve) => {
    const test = spawn("cargo", ["test", "--package", "backlog", "--quiet"], {
      stdio: "inherit",
    });

    test.on("close", (code) => {
      resolve({
        success: code === 0,
        error: code !== 0 ? `Tests exited with code ${code}` : null,
      });
    });
  });
}

// Parse CLI args
const taskId = process.argv[2];
const apiBase = process.env.BATTRA_API_BASE || "http://localhost:8000/api/v1";
const apiKey = process.env.BATTRA_API_KEY;

if (!taskId || !apiKey) {
  console.error("Usage: claude-code-executor.js <task_id>");
  console.error("Environment variables required: BATTRA_API_KEY, ANTHROPIC_API_KEY");
  process.exit(1);
}

executeTask(taskId, apiBase, apiKey).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
```

Then update `autonomous-agent.sh`:

```bash
execute_task() {
  local task_id="$1"
  local task_title="$2"
  local task_description="$3"

  log_info "Executing task: $task_title"

  # Execute via Node.js wrapper
  if ! node "$SCRIPT_DIR/claude-code-executor.js" "$task_id"; then
    log_error "Task execution failed"
    return 1
  fi

  log_success "Task completed successfully"
  return 0
}
```

### Option 3: Claude Code via MCP Server (Most Integrated)

When you create the `@battra/mcp-server` package, add a tool:

```typescript
// packages/mcp-server/src/tools/execute-task.ts
import { z } from "zod";
import { spawn } from "child_process";

export const executeTaskTool = {
  name: "execute_task",
  description: "Execute a task by implementing it with Claude Code",
  inputSchema: z.object({
    task_id: z.string().uuid(),
  }),
  async handler({ task_id }) {
    // Fetch task details from Battra API
    const task = await fetchTask(task_id);
    const acs = await fetchAcceptanceCriteria(task.story_id);

    // Build prompt
    const prompt = buildTaskPrompt(task, acs);

    // Invoke Claude Code
    const result = await invokeClaude(prompt);

    // Run tests
    const testsPassed = await runTests();

    if (!testsPassed) {
      throw new Error("Tests failed after implementation");
    }

    return {
      success: true,
      output: result,
    };
  },
};
```

## Practical Challenges

### 1. Long-Running Tasks

Some tasks may take 5-10 minutes to implement. The agent needs to:
- Set reasonable timeouts
- Stream progress updates
- Handle partial failures

```bash
# Add timeout to execute_task
timeout 600 node "$SCRIPT_DIR/claude-code-executor.js" "$task_id" || {
  log_error "Task execution timed out (10 minutes)"
  return 1
}
```

### 2. Test Failures

If tests fail after implementation:
- Should the agent retry?
- Should it release the task?
- Should it attempt to fix the failures?

```bash
# Retry logic
local max_retries=2
local retry=0

while [ $retry -lt $max_retries ]; do
  if execute_task_impl "$task_id"; then
    return 0
  fi

  retry=$((retry + 1))
  log_warning "Retry $retry/$max_retries..."
  sleep 5
done

log_error "Task failed after $max_retries retries"
return 1
```

### 3. Codebase Context

Claude Code needs to understand the codebase structure. Options:
- Pass relevant file paths in the prompt (from enhanced task descriptions)
- Let Claude Code explore the codebase via file operations
- Pre-load context about the architecture (CLAUDE.md)

### 4. Git Integration

Should the agent commit changes?

```bash
# After successful execution
git add .
git commit -m "feat: $task_title [task:$task_id]"

# Optionally push
git push origin HEAD
```

## Recommended Approach

**Phase 1: Manual Testing** (Start Here)
```bash
# Manually test the flow:
1. Get recommended task
2. Copy task details
3. Manually prompt Claude Code
4. Verify it works
5. Mark task complete
```

**Phase 2: Semi-Automated**
```bash
# Build the Node.js wrapper that:
- Fetches task details
- Builds the prompt
- Calls Claude Code API
- Runs tests
- Reports success/failure
```

**Phase 3: Fully Automated**
```bash
# Integrate into autonomous-agent.sh
- Agent automatically calls wrapper
- Handles retries
- Manages git commits
- Reports metrics
```

## Testing Your Integration

### Step 1: Get a Real Task

```bash
# Get active sprint
SPRINT_ID=$(curl -s "http://localhost:8000/api/v1/projects/{project_id}/sprints/active" \
  -H "X-API-Key: battra-sm-key-1" | jq -r '.id')

# Get a dev task
TASK=$(curl -s "http://localhost:8000/api/v1/tasks/recommended?sprint_id=$SPRINT_ID&role=dev&limit=1" \
  -H "X-API-Key: battra-dev-key-1")

TASK_ID=$(echo "$TASK" | jq -r '.[0].task.id')
TASK_TITLE=$(echo "$TASK" | jq -r '.[0].task.title')
```

### Step 2: Build the Prompt Manually

```bash
# Fetch ACs
STORY_ID=$(curl -s "http://localhost:8000/api/v1/tasks/$TASK_ID" \
  -H "X-API-Key: battra-dev-key-1" | jq -r '.story_id')

curl -s "http://localhost:8000/api/v1/stories/$STORY_ID/acceptance-criteria" \
  -H "X-API-Key: battra-dev-key-1" | jq
```

### Step 3: Test Claude Code Execution

```bash
# Build prompt and test
cat > /tmp/task-prompt.txt <<EOF
Implement this task:

Title: $TASK_TITLE

[Full task details here...]
EOF

# Test with Claude Code
cat /tmp/task-prompt.txt | claude-code
```

### Step 4: Verify Tests Pass

```bash
# Run tests
cargo test --package backlog --quiet
```

## Environment Variables Needed

```bash
# For the agent
export BATTRA_API_BASE="http://localhost:8000/api/v1"
export BATTRA_API_KEY="battra-dev-key-1"

# For Claude Code
export ANTHROPIC_API_KEY="your-key-here"

# Optional: Control behavior
export CLAUDE_CODE_TIMEOUT=600  # 10 minutes
export ENABLE_AUTO_COMMIT=true
export ENABLE_AUTO_PUSH=false
```

## Summary

To integrate Claude Code with the autonomous agent, you need to:

1. **Choose an approach** (Node.js wrapper recommended)
2. **Fetch task context** (task + ACs from Battra API)
3. **Build a detailed prompt** (task, ACs, architecture constraints)
4. **Invoke Claude Code** (API or CLI)
5. **Verify success** (run tests)
6. **Handle failures** (retry or release task)

Start with **manual testing** to validate the prompt format, then gradually automate the integration.

The most critical piece is the **prompt engineering** - it needs to give Claude Code enough context to implement the task correctly without additional guidance.
