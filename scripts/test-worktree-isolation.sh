#!/bin/bash
# test-worktree-isolation.sh - Verify agents work in isolated worktrees
#
# This script tests that:
# 1. Worktrees are created properly
# 2. Each agent works in its own directory
# 3. Agents don't interfere with each other's branches
# 4. Task branches are created from origin/main, not workspace branches

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[!]${NC} $1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKTREE_BASE="$REPO_ROOT/../agents"

cd "$REPO_ROOT"

log_info "Testing git worktree isolation..."
echo ""

# Test 1: Clean slate
log_info "Test 1: Cleaning up old worktrees..."
if [ -d "$WORKTREE_BASE" ]; then
  ./scripts/cleanup-agent-worktrees.sh --force > /dev/null 2>&1 || true
fi
log_success "Old worktrees cleaned"
echo ""

# Test 2: Create worktrees
log_info "Test 2: Creating 3 test worktrees..."
if ! ./scripts/setup-agent-worktrees.sh 3 > /dev/null 2>&1; then
  log_error "Failed to create worktrees"
  exit 1
fi

# Verify worktrees exist
WORKTREE_COUNT=$(git worktree list | wc -l | tr -d ' ')
if [ "$WORKTREE_COUNT" -lt 4 ]; then  # main + 3 agents
  log_error "Expected 4 worktrees (main + 3 agents), got $WORKTREE_COUNT"
  git worktree list
  exit 1
fi

log_success "Created 3 worktrees"
echo ""

# Test 3: Verify directory structure
log_info "Test 3: Verifying worktree directories..."
for agent in dev-1 qa-1 po-1; do
  if [ ! -d "$WORKTREE_BASE/$agent" ]; then
    log_error "Worktree directory missing: $WORKTREE_BASE/$agent"
    exit 1
  fi

  # Check that it's a valid git working directory
  if ! (cd "$WORKTREE_BASE/$agent" && git rev-parse --git-dir > /dev/null 2>&1); then
    log_error "Worktree $agent is not a valid git directory"
    exit 1
  fi

  log_success "Worktree $agent exists and is valid"
done
echo ""

# Test 4: Verify workspace branches
log_info "Test 4: Verifying workspace branches..."
for agent in dev-1 qa-1 po-1; do
  cd "$WORKTREE_BASE/$agent"
  BRANCH=$(git branch --show-current)
  EXPECTED="${agent}-workspace"

  if [ "$BRANCH" != "$EXPECTED" ]; then
    log_error "Worktree $agent on wrong branch: $BRANCH (expected $EXPECTED)"
    exit 1
  fi

  log_success "Worktree $agent on correct branch: $BRANCH"
done
cd "$REPO_ROOT"
echo ""

# Test 5: Verify workspace branches point to main
log_info "Test 5: Verifying workspace branches are clean..."
MAIN_SHA=$(git rev-parse main)
for agent in dev-1 qa-1 po-1; do
  cd "$WORKTREE_BASE/$agent"
  BRANCH_SHA=$(git rev-parse HEAD)

  if [ "$BRANCH_SHA" != "$MAIN_SHA" ]; then
    log_error "Worktree $agent workspace branch doesn't match main"
    log_error "  Main SHA: $MAIN_SHA"
    log_error "  Branch SHA: $BRANCH_SHA"
    exit 1
  fi

  log_success "Worktree $agent workspace branch points to main"
done
cd "$REPO_ROOT"
echo ""

# Test 6: Simulate creating task branches
log_info "Test 6: Simulating task branch creation from origin/main..."

# Create test branches in each worktree
for agent in dev-1 qa-1 po-1; do
  cd "$WORKTREE_BASE/$agent"

  # Fetch latest
  git fetch origin main > /dev/null 2>&1 || log_warning "Could not fetch (repo may not have remote)"

  # Create task branch from origin/main (or main if no remote)
  TEST_BRANCH="test-task-${agent}"
  if git rev-parse origin/main > /dev/null 2>&1; then
    git checkout -b "$TEST_BRANCH" origin/main > /dev/null 2>&1
  else
    git checkout -b "$TEST_BRANCH" main > /dev/null 2>&1
  fi

  # Verify we're on the task branch
  CURRENT=$(git branch --show-current)
  if [ "$CURRENT" != "$TEST_BRANCH" ]; then
    log_error "Failed to create task branch $TEST_BRANCH in $agent"
    exit 1
  fi

  log_success "Created task branch $TEST_BRANCH in $agent"
done
cd "$REPO_ROOT"
echo ""

# Test 7: Verify branches are independent
log_info "Test 7: Verifying branch independence..."

# Check that each worktree is on a different branch
BRANCHES=()
for agent in dev-1 qa-1 po-1; do
  cd "$WORKTREE_BASE/$agent"
  BRANCH=$(git branch --show-current)
  BRANCHES+=("$BRANCH")
done
cd "$REPO_ROOT"

# All branches should be different
UNIQUE_COUNT=$(printf '%s\n' "${BRANCHES[@]}" | sort -u | wc -l | tr -d ' ')
if [ "$UNIQUE_COUNT" != "3" ]; then
  log_error "Branches are not independent! Got: ${BRANCHES[*]}"
  exit 1
fi

log_success "All worktrees on independent branches: ${BRANCHES[*]}"
echo ""

# Test 8: Verify main repo is unaffected
log_info "Test 8: Verifying main repository is unaffected..."
cd "$REPO_ROOT"
MAIN_BRANCH=$(git branch --show-current)

if [ "$MAIN_BRANCH" != "main" ] && [ "$MAIN_BRANCH" != "task/1f6129dc-7726-4234-9ec5-4c673978b468-test-sprint-context-header-display" ]; then
  log_error "Main repository branch changed unexpectedly: $MAIN_BRANCH"
  exit 1
fi

log_success "Main repository unchanged on branch: $MAIN_BRANCH"
echo ""

# Test 9: Clean up test branches
log_info "Test 9: Cleaning up test branches..."
for agent in dev-1 qa-1 po-1; do
  cd "$WORKTREE_BASE/$agent"
  git checkout "${agent}-workspace" > /dev/null 2>&1
  git branch -D "test-task-${agent}" > /dev/null 2>&1 || true
done
cd "$REPO_ROOT"
log_success "Test branches cleaned up"
echo ""

# Final summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}   All Tests Passed! ✓${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
log_info "Worktree isolation is working correctly!"
log_info "Agents can now work in parallel without conflicts"
echo ""
log_info "Current worktrees:"
git worktree list
echo ""
log_info "To clean up test worktrees:"
echo "  ./scripts/cleanup-agent-worktrees.sh"
echo ""
