#!/bin/bash
# multi-agent-sprint.sh - Run multiple agents in parallel for a sprint
#
# Usage:
#   ./multi-agent-sprint.sh <sprint_id>
#
# Example:
#   ./multi-agent-sprint.sh <sprint-uuid>
#
# This script starts:
# - 1 dev agent (battra-dev-key-1)
# - 1 qa agent (battra-qa-key-1)
# - 1 po agent (battra-po-key-1)
# - 1 devops agent (battra-devops-key-1)
# - 1 documenter agent (battra-documenter-key-1)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPRINT_ID="${1:-${BATTRA_SPRINT_ID}}"

# Validation
if [ -z "$SPRINT_ID" ]; then
  echo "Error: SPRINT_ID required. Pass as argument or set BATTRA_SPRINT_ID env var"
  exit 1
fi

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[ORCHESTRATOR]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[ORCHESTRATOR]${NC} $1"
}

# PID tracking
AGENT_PIDS=()
LOG_DIR="./logs/autonomous-agents"
mkdir -p "$LOG_DIR"

# Cleanup function
cleanup() {
  log_info "Stopping all agents..."

  for pid in "${AGENT_PIDS[@]}"; do
    if kill -0 $pid 2>/dev/null; then
      log_info "Stopping agent (PID: $pid)"
      kill $pid
    fi
  done

  log_success "All agents stopped"
  exit 0
}

# Trap signals
trap cleanup INT TERM

# Start agent helper
start_agent() {
  local role="$1"
  local api_key="$2"
  local log_file="$LOG_DIR/${role}-agent.log"

  log_info "Starting $role agent..."

  # Start agent in background and capture PID
  "$SCRIPT_DIR/autonomous-agent.sh" "$api_key" "$SPRINT_ID" "$role" > "$log_file" 2>&1 &
  local pid=$!

  AGENT_PIDS+=($pid)

  log_success "$role agent started (PID: $pid, Log: $log_file)"
}

# Main
log_info "=== Multi-Agent Sprint Execution ==="
log_info "Sprint ID: $SPRINT_ID"
log_info "Log directory: $LOG_DIR"
echo ""

# Start agents
start_agent "dev" "battra-dev-key-1"
sleep 1

start_agent "qa" "battra-qa-key-1"
sleep 1

start_agent "po" "battra-po-key-1"
sleep 1

start_agent "devops" "battra-devops-key-1"
sleep 1

start_agent "documenter" "battra-documenter-key-1"
echo ""

log_success "All agents running!"
log_info "Press Ctrl+C to stop all agents"
log_info ""
log_info "Monitor agent logs:"
log_info "  tail -f $LOG_DIR/dev-agent.log"
log_info "  tail -f $LOG_DIR/qa-agent.log"
log_info "  tail -f $LOG_DIR/po-agent.log"
log_info "  tail -f $LOG_DIR/devops-agent.log"
log_info "  tail -f $LOG_DIR/documenter-agent.log"

# Wait for all agents
wait
