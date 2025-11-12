#!/bin/bash
# cleanup-test-processes.sh - Kill orphaned test processes
#
# Usage:
#   ./cleanup-test-processes.sh [--force] [--pid PID]
#
# Options:
#   --force    Kill all test processes without confirmation
#   --pid PID  Kill only processes related to specific PID
#
# This script kills:
# - pnpm test processes
# - node processes running tests
# - playwright test runners
# - vitest processes
# - turbo test processes

set -e

FORCE=false
TARGET_PID=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE=true
      shift
      ;;
    --pid)
      TARGET_PID="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--force] [--pid PID]"
      exit 1
      ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[CLEANUP]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[CLEANUP]${NC} $1"
}

log_error() {
  echo -e "${RED}[CLEANUP]${NC} $1"
}

# Find and kill test-related processes
cleanup_test_processes() {
  local found_processes=false

  # Build process search patterns
  local patterns=(
    "pnpm.*test"
    "npm.*test"
    "turbo.*test"
    "vitest"
    "playwright test"
    "node.*playwright"
    "node.*vitest"
  )

  log_info "Searching for test processes..."

  # Collect PIDs to kill
  local pids_to_kill=()

  for pattern in "${patterns[@]}"; do
    # Find matching processes (exclude grep and this script)
    local matching_pids=$(ps aux | grep -E "$pattern" | grep -v grep | grep -v "cleanup-test-processes" | awk '{print $2}')

    if [ -n "$matching_pids" ]; then
      while IFS= read -r pid; do
        # If TARGET_PID is set, only include processes related to it
        if [ -n "$TARGET_PID" ]; then
          # Check if this process is a child of TARGET_PID
          local ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
          if [ "$ppid" = "$TARGET_PID" ] || [ "$pid" = "$TARGET_PID" ]; then
            pids_to_kill+=("$pid")
            found_processes=true
          fi
        else
          pids_to_kill+=("$pid")
          found_processes=true
        fi
      done <<< "$matching_pids"
    fi
  done

  if [ "$found_processes" = false ]; then
    log_info "No test processes found"
    return 0
  fi

  # Remove duplicates
  local unique_pids=($(printf "%s\n" "${pids_to_kill[@]}" | sort -u))

  log_warning "Found ${#unique_pids[@]} test process(es) to kill:"
  for pid in "${unique_pids[@]}"; do
    local cmd=$(ps -p "$pid" -o command= 2>/dev/null || echo "unknown")
    echo "  PID $pid: $cmd"
  done

  # Confirm before killing (unless --force)
  if [ "$FORCE" = false ]; then
    echo ""
    read -p "Kill these processes? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Aborted"
      return 0
    fi
  fi

  # Kill processes (gracefully first, then forcefully)
  log_info "Sending SIGTERM to processes..."
  for pid in "${unique_pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  # Wait a moment for graceful shutdown
  sleep 2

  # Check if any processes are still alive and force kill them
  local remaining=false
  for pid in "${unique_pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      log_warning "Process $pid still alive, sending SIGKILL..."
      kill -KILL "$pid" 2>/dev/null || true
      remaining=true
    fi
  done

  if [ "$remaining" = true ]; then
    sleep 1
  fi

  # Verify all processes are gone
  local still_alive=0
  for pid in "${unique_pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      log_error "Failed to kill process $pid"
      still_alive=$((still_alive + 1))
    fi
  done

  if [ $still_alive -eq 0 ]; then
    log_info "Successfully killed ${#unique_pids[@]} process(es)"
  else
    log_error "$still_alive process(es) could not be killed"
    return 1
  fi
}

# Main execution
main() {
  log_info "Test process cleanup starting..."

  if [ -n "$TARGET_PID" ]; then
    log_info "Targeting processes related to PID: $TARGET_PID"
  fi

  cleanup_test_processes

  log_info "Cleanup complete"
}

# Run cleanup
main
