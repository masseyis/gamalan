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

# Mark task as complete
complete_task() {
  local task_id="$1"
  api_post "tasks/$task_id/work/complete"
}

# Execute task with Claude Code and Git workflow
execute_task() {
  local task_id="$1"
  local task_title="$2"
  local task_description="$3"

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

  log_info "Starting autonomous agent"
  log_info "  API Base: $API_BASE"
  log_info "  Sprint ID: $SPRINT_ID"
  log_info "  Role: $ROLE"
  log_info "  Poll Interval: ${POLL_INTERVAL}s"
  echo ""

  while true; do
    iteration=$((iteration + 1))

    if [ $MAX_ITERATIONS -gt 0 ] && [ $iteration -gt $MAX_ITERATIONS ]; then
      log_info "Reached maximum iterations ($MAX_ITERATIONS). Exiting."
      break
    fi

    log_info "=== Iteration $iteration ==="

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
    task_score=$(echo "$task_data" | jq -r '.[0].score')
    task_reason=$(echo "$task_data" | jq -r '.[0].reason')

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
    if ! execute_task "$task_id" "$task_title" "$task_description"; then
      log_error "Task execution failed. Releasing task..."
      # TODO: Add release_task API call here
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
