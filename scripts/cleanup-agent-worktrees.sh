#!/bin/bash
# cleanup-agent-worktrees.sh - Remove all agent worktrees
#
# This script safely removes all git worktrees created for agents.
# It preserves the main repository and only removes worktree directories.
#
# Usage:
#   ./scripts/cleanup-agent-worktrees.sh [--force]
#
# Options:
#   --force  Skip confirmation prompt

set -e

WORKTREE_BASE="${WORKTREE_BASE:-../agents}"
FORCE="${1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  log_error "Not in a git repository"
  exit 1
fi

# Get repository root
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

log_info "Current worktrees:"
git worktree list

echo ""

# Confirm deletion unless --force
if [ "$FORCE" != "--force" ]; then
  echo -e "${YELLOW}⚠️  This will remove all worktrees in: $WORKTREE_BASE${NC}"
  echo -e "${YELLOW}    The main repository will be preserved.${NC}"
  echo ""
  read -p "Continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Cancelled"
    exit 0
  fi
fi

# Get list of worktrees (excluding main repo)
WORKTREES=$(git worktree list --porcelain | grep -E "^worktree " | cut -d' ' -f2 | grep -v "^$REPO_ROOT$" || true)

if [ -z "$WORKTREES" ]; then
  log_info "No worktrees to remove"
  exit 0
fi

# Remove each worktree
echo "$WORKTREES" | while read -r worktree_path; do
  if [ -n "$worktree_path" ] && [ -d "$worktree_path" ]; then
    log_info "Removing worktree: $worktree_path"

    # Get branch name from worktree
    BRANCH=$(cd "$worktree_path" && git branch --show-current 2>/dev/null || echo "")

    # Remove worktree
    git worktree remove "$worktree_path" --force

    # Optionally delete the branch if it's a task branch
    if [[ "$BRANCH" == task/* ]]; then
      log_warning "Branch $BRANCH still exists. Delete manually if needed: git branch -D $BRANCH"
    fi
  fi
done

# Remove worktree base directory if empty
if [ -d "$WORKTREE_BASE" ]; then
  if [ -z "$(ls -A "$WORKTREE_BASE")" ]; then
    log_info "Removing empty worktree base directory: $WORKTREE_BASE"
    rmdir "$WORKTREE_BASE"
  else
    log_warning "Worktree base directory not empty: $WORKTREE_BASE"
  fi
fi

# Prune worktree metadata
log_info "Pruning worktree metadata..."
git worktree prune

log_info ""
log_info "✅ Cleanup complete!"
log_info ""
log_info "Remaining worktrees:"
git worktree list
