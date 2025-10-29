#!/bin/bash
# test-claude-integration.sh - Test the Claude Code integration
#
# This script helps you test the Claude Code integration step-by-step

set -e

API_BASE="${BATTRA_API_BASE:-http://localhost:8000/api/v1}"
API_KEY="${BATTRA_API_KEY:-battra-dev-key-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "=========================================="
echo "Claude Code Integration Test"
echo "=========================================="
echo ""

# Step 1: Check environment
log_info "Step 1: Checking environment..."

if [ -z "$BATTRA_API_KEY" ]; then
  log_warning "BATTRA_API_KEY not set, using default: battra-dev-key-1"
  export BATTRA_API_KEY="battra-dev-key-1"
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  log_error "ANTHROPIC_API_KEY not set!"
  log_info "Please set your Anthropic API key:"
  log_info "  export ANTHROPIC_API_KEY='your-key-here'"
  exit 1
fi

log_success "Environment configured"
echo ""

# Step 2: Get active sprint
log_info "Step 2: Finding active sprint..."

PROJECT_ID="35299584-b133-4b20-af2d-446bb1dead6a"  # Default project

SPRINT=$(curl -s "$API_BASE/projects/$PROJECT_ID/sprints/active" \
  -H "X-API-Key: battra-sm-key-1")

SPRINT_ID=$(echo "$SPRINT" | jq -r '.id')

if [ "$SPRINT_ID" = "null" ] || [ -z "$SPRINT_ID" ]; then
  log_error "No active sprint found for project $PROJECT_ID"
  log_info "Create a sprint first or use a different project ID"
  exit 1
fi

log_success "Active sprint: $SPRINT_ID"
echo ""

# Step 3: Get recommended task
log_info "Step 3: Getting recommended dev task..."

TASK_REC=$(curl -s "$API_BASE/tasks/recommended?sprint_id=$SPRINT_ID&role=dev&limit=1" \
  -H "X-API-Key: $API_KEY")

TASK_COUNT=$(echo "$TASK_REC" | jq 'length')

if [ "$TASK_COUNT" -eq 0 ]; then
  log_error "No dev tasks available in sprint $SPRINT_ID"
  log_info "Add some tasks to the sprint first"
  exit 1
fi

TASK_ID=$(echo "$TASK_REC" | jq -r '.[0].task.id')
TASK_TITLE=$(echo "$TASK_REC" | jq -r '.[0].task.title')
TASK_SCORE=$(echo "$TASK_REC" | jq -r '.[0].score')
TASK_REASON=$(echo "$TASK_REC" | jq -r '.[0].reason')

log_success "Found task: $TASK_TITLE"
log_info "  Task ID: $TASK_ID"
log_info "  Score: $TASK_SCORE"
log_info "  Reason: $TASK_REASON"
echo ""

# Step 4: Display task details
log_info "Step 4: Fetching full task details..."

TASK=$(curl -s "$API_BASE/tasks/$TASK_ID" -H "X-API-Key: $API_KEY")
STORY_ID=$(echo "$TASK" | jq -r '.storyId')
STORY=$(curl -s "$API_BASE/stories/$STORY_ID" -H "X-API-Key: $API_KEY")
ACS=$(curl -s "$API_BASE/stories/$STORY_ID/acceptance-criteria" -H "X-API-Key: $API_KEY")

STORY_TITLE=$(echo "$STORY" | jq -r '.title')
AC_COUNT=$(echo "$ACS" | jq 'length')

log_success "Task details:"
log_info "  Story: $STORY_TITLE"
log_info "  Acceptance Criteria: $AC_COUNT"
echo ""

# Step 5: Ask for confirmation
log_warning "You are about to execute this task with Claude Code:"
echo ""
echo "  Task: $TASK_TITLE"
echo "  Story: $STORY_TITLE"
echo "  ACs: $AC_COUNT"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log_info "Cancelled"
  exit 0
fi

# Step 6: Take ownership
log_info "Step 6: Taking ownership of task..."

curl -s -X PUT "$API_BASE/tasks/$TASK_ID/ownership" \
  -H "X-API-Key: $API_KEY" > /dev/null

log_success "Ownership acquired"
echo ""

# Step 7: Execute with Claude Code
log_info "Step 7: Executing task with Claude Code..."
log_warning "This may take several minutes..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! node "$SCRIPT_DIR/claude-code-executor.js" "$TASK_ID"; then
  log_error "Task execution failed!"
  log_info "Releasing task ownership..."

  curl -s -X DELETE "$API_BASE/tasks/$TASK_ID/ownership" \
    -H "X-API-Key: $API_KEY" > /dev/null

  exit 1
fi

echo ""
log_success "Task executed successfully!"
echo ""

# Step 8: Mark complete
log_info "Step 8: Marking task as complete..."

curl -s -X POST "$API_BASE/tasks/$TASK_ID/work/complete" \
  -H "X-API-Key: $API_KEY" > /dev/null

log_success "Task marked complete!"
echo ""

# Summary
echo "=========================================="
log_success "Integration Test Complete!"
echo "=========================================="
echo ""
echo "Task: $TASK_TITLE"
echo "Status: Completed"
echo ""
echo "Next steps:"
echo "  1. Review the implementation in your code"
echo "  2. Run the full test suite"
echo "  3. Try running the autonomous agent:"
echo "     ./scripts/autonomous-agent.sh $API_KEY $SPRINT_ID dev"
