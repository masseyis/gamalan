#!/bin/bash
# autonomous-agent.sh - Simple autonomous agent for executing sprint tasks
#
# Usage:
#   ./autonomous-agent.sh <api_key> <sprint_id> <role>
#
# Example:
#   ./autonomous-agent.sh battra-dev-key-1 <sprint-uuid> dev
#
# Roles: dev, qa, po

set -e

# Configuration
API_BASE="${BATTRA_API_BASE:-http://localhost:8000/api/v1}"
API_KEY="${1:-${BATTRA_API_KEY}}"
SPRINT_ID="${2:-${BATTRA_SPRINT_ID}}"
ROLE="${3:-dev}"
PROJECT_ID="${4:-${BATTRA_PROJECT_ID}}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"  # seconds
MAX_ITERATIONS="${MAX_ITERATIONS:-0}"  # 0 = infinite

# Validation
if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY required. Pass as first argument or set BATTRA_API_KEY env var"
  exit 1
fi

if [ -z "$SPRINT_ID" ]; then
  echo "Error: SPRINT_ID required. Pass as second argument or set BATTRA_SPRINT_ID env var"
  exit 1
fi

if [ "$ROLE" = "po" ] && [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID required for PO agents. Pass as fourth argument or set BATTRA_PROJECT_ID env var"
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# API helper functions
api_get() {
  local endpoint="$1"
  curl -s "$API_BASE/$endpoint" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json"
}

api_put() {
  local endpoint="$1"
  curl -s -X PUT "$API_BASE/$endpoint" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json"
}

api_post() {
  local endpoint="$1"
  curl -s -X POST "$API_BASE/$endpoint" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json"
}

api_delete() {
  local endpoint="$1"
  curl -s -X DELETE "$API_BASE/$endpoint" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json"
}

# Get recommended tasks
get_recommended_task() {
  local response=$(api_get "tasks/recommended?sprint_id=$SPRINT_ID&role=$ROLE&exclude_mine=false&limit=1")

  # Check if we got any tasks
  if [ "$(echo "$response" | jq 'length')" -eq 0 ]; then
    return 1
  fi

  echo "$response"
  return 0
}

# Take ownership of a task
take_task() {
  local task_id="$1"
  api_put "tasks/$task_id/ownership"
}

# Release task ownership
release_task() {
  local task_id="$1"
  api_delete "tasks/$task_id/ownership"
}

# Mark task as complete
complete_task() {
  local task_id="$1"
  api_post "tasks/$task_id/work/complete"
}

# Fetch all stories assigned to the sprint for PO workflows
get_sprint_stories() {
  local stories=$(api_get "projects/$PROJECT_ID/stories")
  echo "$stories" | jq --arg sprint "$SPRINT_ID" '[.[] | select(.sprintId == $sprint)]'
}

# Retrieve the highest-priority story recommendation for PO agents
get_po_story_recommendation() {
  local sprint_stories
  sprint_stories=$(get_sprint_stories)

  if [ -z "$sprint_stories" ] || [ "$(echo "$sprint_stories" | jq 'length')" -eq 0 ]; then
    return 1
  fi

  local fallback=""
  local story_id

  while IFS= read -r story_id; do
    [ -z "$story_id" ] && continue

    local recommendation
    recommendation=$(api_get "readiness/stories/$story_id/recommendations")
    if [ -z "$recommendation" ] || [ "$recommendation" = "null" ]; then
      continue
    fi

    local missing_count
    missing_count=$(echo "$recommendation" | jq '.readiness.missingItems | length')
    local is_ready
    is_ready=$(echo "$recommendation" | jq -r '.readiness.isReady')

    if [ "$missing_count" -gt 0 ] || [ "$is_ready" != "true" ]; then
      echo "$recommendation"
      return 0
    fi

    if [ -z "$fallback" ]; then
      fallback="$recommendation"
    fi
  done <<<"$(echo "$sprint_stories" | jq -r '.[].id')"

  if [ -n "$fallback" ]; then
    echo "$fallback"
    return 0
  fi

  return 1
}

# Present PO recommendation details
process_po_recommendation() {
  local recommendation="$1"

  local story_title
  story_title=$(echo "$recommendation" | jq -r '.story.title')
  local story_id
  story_id=$(echo "$recommendation" | jq -r '.story.id')
  local story_points
  story_points=$(echo "$recommendation" | jq -r '.story.storyPoints // "unestimated"')
  local summary
  summary=$(echo "$recommendation" | jq -r '.readiness.summary')
  local readiness_score
  readiness_score=$(echo "$recommendation" | jq -r '.readiness.score')

  log_success "Story recommendation: $story_title"
  log_info "  Story ID: $story_id"
  log_info "  Story Points: $story_points"
  log_info "  Readiness Score: $readiness_score"
  log_info "  Summary: $summary"

  local missing_count
  missing_count=$(echo "$recommendation" | jq '.readiness.missingItems | length')
  if [ "$missing_count" -gt 0 ]; then
    log_warning "  Missing items:"
    echo "$recommendation" | jq -r '.readiness.missingItems[]' | while IFS= read -r item; do
      log_warning "    - $item"
    done
  fi

  local rec_count
  rec_count=$(echo "$recommendation" | jq '.readiness.recommendations | length')
  if [ "$rec_count" -gt 0 ]; then
    log_info "  Recommended actions:"
    echo "$recommendation" | jq -r '.readiness.recommendations[]' | while IFS= read -r action; do
      log_info "    • $action"
    done
  fi
}

# Execute task with Claude Code and Git workflow
execute_task() {
  local task_id="$1"
  local task_title="$2"
  local task_description="$3"
  local task_story_id="$4"

  log_info "Executing task: $task_title"
  log_info "Task ID: $task_id"

  if [ -n "$task_description" ]; then
    log_info "Description: $task_description"
  fi

  # Choose executor based on GIT_WORKFLOW_ENABLED
  local executor="claude-code-executor.js"
  if [ "${GIT_WORKFLOW_ENABLED:-false}" = "true" ]; then
    executor="claude-code-executor-with-git.js"
    log_info "Using git workflow (branch + PR)"
  else
    log_warning "Git workflow disabled (direct commits)"
  fi

  # Execute with Claude Code
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # Export environment variables for the executor
  export BATTRA_API_KEY="$API_KEY"
  export BATTRA_API_BASE="$API_BASE"
  export BATTRA_STORY_ID="$task_story_id"
  export AGENT_ROLE="$ROLE"
  export USE_WORKTREE="${USE_WORKTREE:-true}"  # Enable worktree mode by default

  # Pass through ANTHROPIC_API_KEY from environment (optional - if not set, uses Claude Code CLI)
  if [ -n "$ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
    echo "  Using Anthropic API (separate API credits)"
  else
    echo "  Using Claude Code CLI (Claude Code Plus subscription)"
  fi

  if ! node "$script_dir/$executor" "$task_id"; then
    log_error "Task execution failed"
    return 1
  fi

  log_success "Task execution completed"
  return 0
}

# Main agent loop
run_agent() {
  local iteration=0
  local -a skipped_tasks=()  # Track tasks we've failed on to avoid infinite loops

  log_info "Starting autonomous agent"
log_info "  API Base: $API_BASE"
log_info "  Sprint ID: $SPRINT_ID"
log_info "  Role: $ROLE"
if [ "$ROLE" = "po" ]; then
  log_info "  Project ID: $PROJECT_ID"
fi
  log_info "  Poll Interval: ${POLL_INTERVAL}s"
  echo ""

  while true; do
    iteration=$((iteration + 1))

    if [ $MAX_ITERATIONS -gt 0 ] && [ $iteration -gt $MAX_ITERATIONS ]; then
      log_info "Reached maximum iterations ($MAX_ITERATIONS). Exiting."
      break
    fi

    log_info "=== Iteration $iteration ==="

    if [ "$ROLE" = "po" ]; then
      log_info "Fetching story readiness recommendations..."
      if ! recommendation=$(get_po_story_recommendation); then
        log_warning "No stories in sprint require attention. Waiting ${POLL_INTERVAL}s..."
        sleep $POLL_INTERVAL
        continue
      fi

      process_po_recommendation "$recommendation"
      sleep $POLL_INTERVAL
      continue
    fi

    # Get recommended task
    log_info "Fetching recommended tasks..."
    if ! task_data=$(get_recommended_task); then
      log_warning "No tasks available. Waiting ${POLL_INTERVAL}s..."
      sleep $POLL_INTERVAL
      continue
    fi

    # Parse task details
    task_id=$(echo "$task_data" | jq -r '.[0].task.id')
    task_title=$(echo "$task_data" | jq -r '.[0].task.title')
    task_description=$(echo "$task_data" | jq -r '.[0].task.description // empty')
    task_story_id=$(echo "$task_data" | jq -r '.[0].task.story_id')
    task_score=$(echo "$task_data" | jq -r '.[0].score')
    task_reason=$(echo "$task_data" | jq -r '.[0].reason')

    # Check if we've already tried and failed this task
    if [ ${#skipped_tasks[@]} -gt 0 ] && printf '%s\n' "${skipped_tasks[@]}" | grep -q "^${task_id}$"; then
      log_warning "Task already attempted and failed: $task_title"
      log_warning "Skipping to avoid infinite loop. Another agent or role may be better suited."
      log_info "Tasks in skip list: ${#skipped_tasks[@]}"
      sleep $POLL_INTERVAL
      continue
    fi

    log_success "Found task: $task_title"
    log_info "  Score: $task_score"
    log_info "  Reason: $task_reason"

    # Take ownership
    log_info "Taking ownership of task..."
    if ! take_response=$(take_task "$task_id"); then
      log_error "Failed to take ownership. Task may have been claimed by another agent."
      log_warning "Waiting ${POLL_INTERVAL}s before retrying..."
      sleep $POLL_INTERVAL
      continue
    fi

    log_success "Ownership acquired"

    # Execute task
    if ! execute_task "$task_id" "$task_title" "$task_description" "$task_story_id"; then
      log_error "Task execution failed"

      # Add to skip list to prevent infinite loops
      skipped_tasks+=("$task_id")
      log_warning "Added task to skip list (${#skipped_tasks[@]} tasks skipped this session)"
      log_warning "This task may need manual intervention, clarification, or a different agent/role"

      # Release the task so another agent can try
      log_info "Releasing task ownership..."
      if ! release_task "$task_id"; then
        log_error "Failed to release task ownership"
      else
        log_success "Task ownership released (available for other agents)"
      fi

      sleep $POLL_INTERVAL
      continue
    fi

    # Mark complete
    log_info "Marking task as complete..."
    if ! complete_response=$(complete_task "$task_id"); then
      log_error "Failed to mark task complete"
      sleep $POLL_INTERVAL
      continue
    fi

    log_success "Task completed: $task_title"
    echo ""

    # Brief pause before next iteration
    sleep 2
  done

  log_info "Agent stopped"
}

# Trap Ctrl+C to exit gracefully
trap 'echo ""; log_info "Agent interrupted. Exiting..."; exit 0' INT

# Run the agent
run_agent
