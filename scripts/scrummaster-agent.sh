#!/bin/bash
# scrummaster-agent.sh - Autonomous Scrum Master agent for sprint management
#
# Usage:
#   ./scrummaster-agent.sh <api_key> <project_id>
#
# Example:
#   ./scrummaster-agent.sh battra-sm-key-1 <project-uuid>
#
# Responsibilities:
#   - Check for active sprint
#   - Plan new sprint if none exists (select ready stories)
#   - Monitor sprint progress
#   - Close sprint when complete
#   - Generate sprint reports

set -e

# Configuration
API_BASE="${BATTRA_API_BASE:-http://localhost:8000/api/v1}"
API_KEY="${1:-${BATTRA_API_KEY}}"
PROJECT_ID="${2:-${BATTRA_PROJECT_ID}}"
POLL_INTERVAL="${POLL_INTERVAL:-300}"  # 5 minutes
SPRINT_CAPACITY="${SPRINT_CAPACITY:-40}"  # Story points per sprint
SPRINT_DURATION="${SPRINT_DURATION:-14}"  # Days

# Validation
if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY required. Pass as first argument or set BATTRA_API_KEY env var"
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID required. Pass as second argument or set BATTRA_PROJECT_ID env var"
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[SCRUMMASTER]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SCRUMMASTER]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[SCRUMMASTER]${NC} $1"
}

log_error() {
  echo -e "${RED}[SCRUMMASTER]${NC} $1"
}

log_sprint() {
  echo -e "${MAGENTA}[SPRINT]${NC} $1"
}

# API helper functions
api_get() {
  local endpoint="$1"
  curl -s "$API_BASE/$endpoint" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json"
}

api_post() {
  local endpoint="$1"
  local data="$2"
  curl -s -X POST "$API_BASE/$endpoint" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$data"
}

# Get active sprint
get_active_sprint() {
  local response=$(api_get "projects/$PROJECT_ID/sprints/active")

  # Check if response is empty or null
  if [ -z "$response" ] || [ "$response" = "null" ] || [ "$response" = "{}" ]; then
    return 1
  fi

  echo "$response"
  return 0
}

# Get sprint status
get_sprint_status() {
  local sprint_id="$1"
  api_get "sprints/$sprint_id/status"
}

# Plan new sprint using sprint-planner.js
plan_sprint() {
  log_info "Planning new sprint..."

  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # Call sprint planner
  if ! sprint_data=$(node "$script_dir/sprint-planner.js" "$PROJECT_ID"); then
    log_error "Sprint planning failed"
    return 1
  fi

  echo "$sprint_data"
  return 0
}

# Close sprint
close_sprint() {
  local sprint_id="$1"
  log_info "Closing sprint $sprint_id..."

  api_post "sprints/$sprint_id/complete" "{}"
}

# Generate sprint report
generate_sprint_report() {
  local sprint_data="$1"

  local sprint_id=$(echo "$sprint_data" | jq -r '.id')
  local sprint_name=$(echo "$sprint_data" | jq -r '.name')
  local total_tasks=$(echo "$sprint_data" | jq -r '.total_tasks // 0')
  local completed_tasks=$(echo "$sprint_data" | jq -r '.completed_tasks // 0')
  local total_points=$(echo "$sprint_data" | jq -r '.total_points // 0')
  local completed_points=$(echo "$sprint_data" | jq -r '.completed_points // 0')

  log_sprint "════════════════════════════════════════"
  log_sprint "Sprint Report: $sprint_name"
  log_sprint "════════════════════════════════════════"
  log_sprint "Sprint ID: $sprint_id"
  log_sprint "Tasks: $completed_tasks / $total_tasks completed"
  log_sprint "Points: $completed_points / $total_points completed"

  if [ "$total_tasks" -gt 0 ]; then
    local completion_pct=$((completed_tasks * 100 / total_tasks))
    log_sprint "Completion: ${completion_pct}%"
  fi

  log_sprint "════════════════════════════════════════"
}

# Check if sprint is complete
is_sprint_complete() {
  local sprint_data="$1"

  local total_tasks=$(echo "$sprint_data" | jq -r '.total_tasks // 0')
  local completed_tasks=$(echo "$sprint_data" | jq -r '.completed_tasks // 0')

  if [ "$total_tasks" -eq 0 ]; then
    return 1  # Empty sprint, not complete
  fi

  if [ "$completed_tasks" -eq "$total_tasks" ]; then
    return 0  # All tasks done
  fi

  return 1  # Not complete
}

# Main scrummaster loop
run_scrummaster() {
  local iteration=0

  log_info "Starting Scrum Master agent"
  log_info "  API Base: $API_BASE"
  log_info "  Project ID: $PROJECT_ID"
  log_info "  Poll Interval: ${POLL_INTERVAL}s"
  log_info "  Sprint Capacity: ${SPRINT_CAPACITY} points"
  log_info "  Sprint Duration: ${SPRINT_DURATION} days"
  echo ""

  while true; do
    iteration=$((iteration + 1))

    log_info "=== Iteration $iteration ==="

    # Check for active sprint
    log_info "Checking for active sprint..."
    if active_sprint=$(get_active_sprint); then
      sprint_id=$(echo "$active_sprint" | jq -r '.id')
      sprint_name=$(echo "$active_sprint" | jq -r '.name')

      log_success "Active sprint found: $sprint_name (ID: $sprint_id)"

      # Get sprint status
      log_info "Fetching sprint status..."
      sprint_status=$(get_sprint_status "$sprint_id")

      # Generate report
      generate_sprint_report "$sprint_status"

      # Check if sprint is complete
      if is_sprint_complete "$sprint_status"; then
        log_success "Sprint is complete! Closing sprint..."

        if ! close_sprint "$sprint_id"; then
          log_error "Failed to close sprint"
        else
          log_success "Sprint closed successfully"
          log_info "Next iteration will plan a new sprint"
        fi
      else
        log_info "Sprint in progress. Will check again in ${POLL_INTERVAL}s"
      fi
    else
      log_warning "No active sprint found"

      # Plan new sprint
      log_info "Initiating sprint planning..."
      if new_sprint=$(plan_sprint); then
        new_sprint_id=$(echo "$new_sprint" | jq -r '.id')
        new_sprint_name=$(echo "$new_sprint" | jq -r '.name')
        story_count=$(echo "$new_sprint" | jq -r '.story_count // 0')
        total_points=$(echo "$new_sprint" | jq -r '.total_points // 0')

        log_success "New sprint created: $new_sprint_name (ID: $new_sprint_id)"
        log_sprint "Stories: $story_count"
        log_sprint "Total Points: $total_points"

        # List stories
        log_sprint "Stories in sprint:"
        echo "$new_sprint" | jq -r '.stories[]? | "  - [\(.estimated_points)pts] \(.title)"'
      else
        log_error "Sprint planning failed. Will retry in ${POLL_INTERVAL}s"
      fi
    fi

    echo ""
    log_info "Waiting ${POLL_INTERVAL}s before next check..."
    sleep $POLL_INTERVAL
  done

  log_info "Scrum Master agent stopped"
}

# Trap Ctrl+C to exit gracefully
trap 'echo ""; log_info "Scrum Master interrupted. Exiting..."; exit 0' INT

# Run the scrummaster
run_scrummaster
