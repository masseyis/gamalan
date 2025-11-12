#!/bin/bash
# multi-agent-sprint.sh - Run multiple agents for a sprint
#
# Usage:
#   ./multi-agent-sprint.sh [--parallel] <sprint_id>
#
# Example:
#   ./multi-agent-sprint.sh <sprint-uuid>                    # Round-robin (sequential, saves Claude usage)
#   ./multi-agent-sprint.sh --parallel <sprint-uuid>         # Parallel (faster, uses more Claude)
#
# This script starts:
# - 1 dev agent (battra-dev-key-1)
# - 1 qa agent (battra-qa-key-1)
# - 1 po agent (battra-po-key-1)
# - 1 devops agent (battra-devops-key-1)
# - 1 documenter agent (battra-documenter-key-1)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Make sure we're in the repo root for consistent paths
cd "$REPO_ROOT"

# Configuration
API_BASE="${BATTRA_API_BASE:-http://localhost:8000/api/v1}"
API_KEY="${BATTRA_API_KEY:-battra-dev-key-1}"  # Use dev key for queries

# Parse arguments
PARALLEL_MODE=false
VERBOSE_MODE=false
SPRINT_ID=""
AI_MODE="claude-cli"  # Default execution mode

while [[ $# -gt 0 ]]; do
  case $1 in
    --parallel)
      PARALLEL_MODE=true
      shift
      ;;
    --verbose|-v)
      VERBOSE_MODE=true
      shift
      ;;
    --debug)
      VERBOSE_MODE=true
      set -x  # Enable bash debug mode
      shift
      ;;
    --ai-mode)
      AI_MODE="$2"
      shift 2
      ;;
    *)
      SPRINT_ID="$1"
      shift
      ;;
  esac
done

# Validate AI mode
case "$AI_MODE" in
  claude-cli|claude-api|codex-cli)
    # Valid mode
    ;;
  *)
    echo "❌ Error: Invalid AI mode '$AI_MODE'"
    echo "   Valid options: claude-cli, claude-api, codex-cli"
    exit 1
    ;;
esac

# Fall back to env var if not provided
SPRINT_ID="${SPRINT_ID:-${BATTRA_SPRINT_ID}}"

# If no sprint ID provided, auto-detect active sprint
if [ -z "$SPRINT_ID" ]; then
  echo "No sprint ID provided, auto-detecting active sprint..."

  # Get first team
  TEAM_ID=$(curl -s "$API_BASE/teams" -H "X-API-Key: $API_KEY" | jq -r '.[0].id // empty')

  if [ -z "$TEAM_ID" ]; then
    echo "Error: No teams found. Cannot auto-detect sprint."
    echo ""
    echo "Usage:"
    echo "  ./multi-agent-sprint.sh [OPTIONS] [sprint_id]"
    echo ""
    echo "Options:"
    echo "  --parallel              Run agents in parallel (faster, uses more AI credits)"
    echo "  --verbose, -v           Show real-time agent output"
    echo "  --debug                 Enable verbose mode + bash debug tracing"
    echo "  --ai-mode <mode>        Choose AI execution mode (default: claude-cli)"
    echo ""
    echo "AI Modes:"
    echo "  claude-cli              Use Claude Code CLI (default, local CLI)"
    echo "  claude-api              Use Claude API (requires ANTHROPIC_API_KEY env var)"
    echo "  codex-cli               Use Codex CLI (OpenAI, optional CODEX_API_KEY env var)"
    echo ""
    echo "Examples:"
    echo "  ./multi-agent-sprint.sh                                # Auto-detect sprint, Claude CLI"
    echo "  ./multi-agent-sprint.sh --verbose                      # Auto-detect + show output"
    echo "  ./multi-agent-sprint.sh --debug                        # Auto-detect + full debug"
    echo "  ./multi-agent-sprint.sh --ai-mode codex-cli            # Use Codex instead of Claude"
    echo "  ./multi-agent-sprint.sh --ai-mode claude-api abc-123   # Specific sprint + Claude API"
    echo "  ./multi-agent-sprint.sh --parallel --verbose           # Parallel mode with output"
    exit 1
  fi

  # Get active sprint for team
  SPRINT_ID=$(curl -s "$API_BASE/teams/$TEAM_ID/sprints/active" -H "X-API-Key: $API_KEY" | jq -r '.id // empty')

  if [ -z "$SPRINT_ID" ]; then
    echo "Error: No active sprint found for team $TEAM_ID"
    echo ""
    echo "Please create and activate a sprint first, or specify a sprint ID:"
    echo "  ./multi-agent-sprint.sh <sprint_id>"
    exit 1
  fi

  SPRINT_NAME=$(curl -s "$API_BASE/teams/$TEAM_ID/sprints/active" -H "X-API-Key: $API_KEY" | jq -r '.name // "Unknown"')
  echo "✓ Found active sprint: $SPRINT_NAME ($SPRINT_ID)"
  echo ""
fi

# Worktree and logging configuration (use absolute paths)
WORKTREE_BASE="$(cd "$REPO_ROOT/.." && pwd)/agents"
LOG_DIR="$REPO_ROOT/logs/autonomous-agents"
mkdir -p "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[ORCHESTRATOR]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[ORCHESTRATOR]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[ORCHESTRATOR]${NC} $1"
}

log_error() {
  echo -e "${RED}[ORCHESTRATOR]${NC} $1"
}

log_agent() {
  local role="$1"
  local message="$2"
  echo -e "${CYAN}[$role]${NC} $message"
}

# Agent configurations
# Documenter goes FIRST to create ADRs/contracts that QA and Dev reference
declare -a AGENT_ROLES=("documenter" "dev" "qa" "devops" "po")
declare -a AGENT_KEYS=("battra-documenter-key-1" "battra-dev-key-1" "battra-qa-key-1" "battra-devops-key-1" "battra-po-key-1")
declare -a AGENT_NAMES=("documenter-1" "dev-1" "qa-1" "devops-1" "po-1")

# PID tracking
AGENT_PIDS=()

# Cleanup function
cleanup() {
  log_info "Stopping all agents and cleaning up test processes..."

  # First, stop all agent processes
  for pid in "${AGENT_PIDS[@]}"; do
    if kill -0 $pid 2>/dev/null; then
      log_info "Stopping agent (PID: $pid)"
      # Send TERM signal and wait briefly
      kill -TERM $pid 2>/dev/null || true
    fi
  done

  # Wait a moment for agents to exit gracefully
  sleep 2

  # Force kill any remaining agents
  for pid in "${AGENT_PIDS[@]}"; do
    if kill -0 $pid 2>/dev/null; then
      log_warning "Force killing agent (PID: $pid)"
      kill -KILL $pid 2>/dev/null || true
    fi
  done

  # Now clean up any orphaned test processes
  log_info "Cleaning up orphaned test processes..."
  if [ -f "$SCRIPT_DIR/cleanup-test-processes.sh" ]; then
    "$SCRIPT_DIR/cleanup-test-processes.sh" --force 2>/dev/null || true
  fi

  log_success "All agents and test processes cleaned up"
  exit 0
}

# Trap signals
trap cleanup INT TERM

# Setup worktrees
setup_worktrees() {
  log_info "Setting up agent worktrees..."
  log_info "Worktree base: $WORKTREE_BASE"

  # Export WORKTREE_BASE for the setup script
  export WORKTREE_BASE

  # Create 5 agent worktrees
  if ! "$SCRIPT_DIR/setup-agent-worktrees.sh" 5; then
    log_error "Failed to setup worktrees"
    exit 1
  fi

  # Verify worktrees were created
  if [ ! -d "$WORKTREE_BASE/dev-1" ]; then
    log_error "Worktree creation failed - dev-1 not found at $WORKTREE_BASE/dev-1"
    exit 1
  fi

  log_success "Agent worktrees ready"
  log_info "Worktrees created at: $WORKTREE_BASE"
}

# Run one iteration of an agent (for round-robin mode)
run_agent_iteration() {
  local role="$1"
  local api_key="$2"
  local agent_name="$3"
  local worktree_path="$WORKTREE_BASE/$agent_name"
  local log_file="$LOG_DIR/${role}-agent.log"

  log_agent "$role" "Starting task iteration..."

  # Verify worktree exists
  if [ ! -d "$worktree_path" ]; then
    log_error "Worktree not found: $worktree_path"
    return 1
  fi

  # Export environment for this agent
  export BATTRA_API_KEY="$api_key"
  export BATTRA_API_BASE="${BATTRA_API_BASE:-http://localhost:8000/api/v1}"
  export BATTRA_SPRINT_ID="$SPRINT_ID"
  export AGENT_ROLE="$role"
  export USE_WORKTREE="true"
  export GIT_WORKFLOW_ENABLED="true"
  export GIT_PR_BASE_BRANCH="main"
  export MAX_ITERATIONS="1"  # Only one iteration in round-robin mode
  export POLL_INTERVAL="5"    # Short poll interval

  # Configure AI execution mode
  case "$AI_MODE" in
    claude-cli)
      export USE_CLAUDE_CLI="true"
      ;;
    claude-api)
      export USE_CLAUDE_API="true"
      # ANTHROPIC_API_KEY should be set in environment
      ;;
    codex-cli)
      export USE_CODEX_CLI="true"
      # CODEX_API_KEY can be set in environment (optional)
      ;;
  esac

  # Change to agent's worktree and run (use absolute path for log file)
  if [ "$VERBOSE_MODE" = true ]; then
    # Verbose mode: show output in real-time AND log to file
    (
      cd "$worktree_path" || exit 1
      "$SCRIPT_DIR/autonomous-agent.sh" "$api_key" "$SPRINT_ID" "$role"
    ) 2>&1 | tee -a "$log_file"
    local exit_code=${PIPESTATUS[0]}
  else
    # Normal mode: just log to file
    (
      cd "$worktree_path" || exit 1
      "$SCRIPT_DIR/autonomous-agent.sh" "$api_key" "$SPRINT_ID" "$role"
    ) >> "$log_file" 2>&1
    local exit_code=$?
  fi

  if [ $exit_code -eq 0 ]; then
    log_agent "$role" "Iteration completed successfully"
  else
    log_agent "$role" "Iteration completed (no tasks available or error)"
  fi

  return $exit_code
}

# Start agent in background (for parallel mode)
start_agent_parallel() {
  local role="$1"
  local api_key="$2"
  local agent_name="$3"
  local worktree_path="$WORKTREE_BASE/$agent_name"
  local log_file="$LOG_DIR/${role}-agent.log"

  log_info "Starting $role agent (parallel mode)..."

  # Verify worktree exists
  if [ ! -d "$worktree_path" ]; then
    log_error "Worktree not found: $worktree_path"
    return 1
  fi

  # Export environment for this agent
  export BATTRA_API_KEY="$api_key"
  export BATTRA_API_BASE="${BATTRA_API_BASE:-http://localhost:8000/api/v1}"
  export BATTRA_SPRINT_ID="$SPRINT_ID"
  export AGENT_ROLE="$role"
  export USE_WORKTREE="true"
  export GIT_WORKFLOW_ENABLED="true"
  export GIT_PR_BASE_BRANCH="main"
  export MAX_ITERATIONS="0"  # Infinite iterations in parallel mode
  export POLL_INTERVAL="30"

  # Configure AI execution mode
  case "$AI_MODE" in
    claude-cli)
      export USE_CLAUDE_CLI="true"
      ;;
    claude-api)
      export USE_CLAUDE_API="true"
      # ANTHROPIC_API_KEY should be set in environment
      ;;
    codex-cli)
      export USE_CODEX_CLI="true"
      # CODEX_API_KEY can be set in environment (optional)
      ;;
  esac

  # Start agent in background (use absolute path for log file)
  if [ "$VERBOSE_MODE" = true ]; then
    # Verbose mode: show output in real-time AND log to file
    (
      cd "$worktree_path" || exit 1
      "$SCRIPT_DIR/autonomous-agent.sh" "$api_key" "$SPRINT_ID" "$role"
    ) 2>&1 | tee -a "$log_file" &
  else
    # Normal mode: just log to file
    (
      cd "$worktree_path" || exit 1
      "$SCRIPT_DIR/autonomous-agent.sh" "$api_key" "$SPRINT_ID" "$role"
    ) > "$log_file" 2>&1 &
  fi

  local pid=$!
  AGENT_PIDS+=($pid)

  log_success "$role agent started (PID: $pid, Log: $log_file)"
}

# Round-robin execution
run_round_robin() {
  log_info "=== Round-Robin Mode (Sequential) ==="
  log_info "Sprint ID: $SPRINT_ID"
  log_info "Agents will execute one task at a time in rotation"
  log_info "This saves Claude usage by running one agent at a time"
  echo ""

  local iteration=0
  local consecutive_failures=0
  local max_consecutive_failures=$((${#AGENT_ROLES[@]} * 2))  # Allow 2 full rounds of failures

  while true; do
    iteration=$((iteration + 1))
    log_info "=== Round $iteration ==="

    local tasks_completed=false

    # Iterate through each agent
    for i in "${!AGENT_ROLES[@]}"; do
      local role="${AGENT_ROLES[$i]}"
      local api_key="${AGENT_KEYS[$i]}"
      local agent_name="${AGENT_NAMES[$i]}"

      log_info "Agent turn: $role"

      if run_agent_iteration "$role" "$api_key" "$agent_name"; then
        tasks_completed=true
        consecutive_failures=0
      else
        consecutive_failures=$((consecutive_failures + 1))

        if [ $consecutive_failures -ge $max_consecutive_failures ]; then
          log_warning "No tasks available for $max_consecutive_failures consecutive attempts"
          log_info "All agents appear to have no work. Exiting."
          return 0
        fi
      fi

      # Small delay between agents
      sleep 2
    done

    if [ "$tasks_completed" = false ]; then
      log_warning "No tasks completed this round"
    fi

    echo ""
  done
}

# Parallel execution
run_parallel() {
  log_info "=== Parallel Mode ==="
  log_info "Sprint ID: $SPRINT_ID"
  log_info "All agents will run simultaneously"
  log_warning "This uses more Claude usage but completes faster"
  echo ""

  # Start all agents in parallel
  for i in "${!AGENT_ROLES[@]}"; do
    local role="${AGENT_ROLES[$i]}"
    local api_key="${AGENT_KEYS[$i]}"
    local agent_name="${AGENT_NAMES[$i]}"

    start_agent_parallel "$role" "$api_key" "$agent_name"
    sleep 1
  done

  echo ""
  log_success "All agents running!"
  log_info "Press Ctrl+C to stop all agents"
  log_info ""
  log_info "Monitor agent logs:"
  for role in "${AGENT_ROLES[@]}"; do
    log_info "  tail -f $LOG_DIR/${role}-agent.log"
  done

  # Wait for all agents
  wait
}

# Periodic cleanup task (runs in background)
start_periodic_cleanup() {
  (
    while true; do
      sleep 300  # Every 5 minutes
      if [ -f "$SCRIPT_DIR/cleanup-test-processes.sh" ]; then
        # Silently clean up any orphaned processes
        "$SCRIPT_DIR/cleanup-test-processes.sh" --force >/dev/null 2>&1 || true
      fi
    done
  ) &
  local cleanup_pid=$!
  AGENT_PIDS+=($cleanup_pid)
  log_info "Started periodic cleanup task (PID: $cleanup_pid)"
}

# Main execution
main() {
  log_info "=== Multi-Agent Sprint Execution ==="
  log_info "Sprint ID: $SPRINT_ID"
  log_info "Mode: $([ "$PARALLEL_MODE" = true ] && echo "PARALLEL" || echo "ROUND-ROBIN (sequential)")"
  log_info "AI Mode: $AI_MODE"
  log_info "Verbose: $([ "$VERBOSE_MODE" = true ] && echo "ON" || echo "OFF")"
  log_info "Log directory: $LOG_DIR"
  echo ""

  # Validate AI mode configuration
  if [ "$AI_MODE" = "claude-api" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    log_error "AI Mode is 'claude-api' but ANTHROPIC_API_KEY environment variable is not set"
    log_error "Please set ANTHROPIC_API_KEY or use --ai-mode claude-cli (default)"
    exit 1
  fi

  # Check available tasks
  log_info "Checking available tasks..."
  TASK_COUNT=$(curl -s "$API_BASE/sprints/$SPRINT_ID/tasks" -H "X-API-Key: $API_KEY" | jq 'length')
  AVAILABLE_COUNT=$(curl -s "$API_BASE/sprints/$SPRINT_ID/tasks" -H "X-API-Key: $API_KEY" | jq '[.[] | select(.status == "available")] | length')
  log_info "Total tasks: $TASK_COUNT, Available: $AVAILABLE_COUNT"
  echo ""

  if [ "$AVAILABLE_COUNT" -eq 0 ]; then
    log_warning "No available tasks in sprint. Agents will have nothing to do."
    echo ""
  fi

  # Setup worktrees
  setup_worktrees
  echo ""

  # Start periodic cleanup task
  start_periodic_cleanup
  echo ""

  # Run in selected mode
  if [ "$PARALLEL_MODE" = true ]; then
    run_parallel
  else
    run_round_robin
  fi

  log_success "Sprint execution completed"

  # Final cleanup
  cleanup
}

# Run main
main
