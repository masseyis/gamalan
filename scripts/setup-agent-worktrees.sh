#!/bin/bash
# setup-agent-worktrees.sh - Set up git worktrees for multi-agent development
#
# This script creates separate git worktrees for multiple autonomous agents
# to work concurrently without conflicts. Each worktree is an isolated
# workspace sharing the same .git directory.
#
# Usage:
#   ./scripts/setup-agent-worktrees.sh [num_agents]
#
# Example:
#   ./scripts/setup-agent-worktrees.sh 4  # Creates 4 agent worktrees
#
# Default: Creates worktrees for 1 scrum master + 2 devs + 1 qa

set -e

# Configuration
NUM_AGENTS="${1:-4}"
WORKTREE_BASE="${WORKTREE_BASE:-../agents}"
BASE_BRANCH="${GIT_PR_BASE_BRANCH:-main}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Get repository root
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

log_info "Setting up agent worktrees..."
log_info "Base directory: $WORKTREE_BASE"
log_info "Number of agents: $NUM_AGENTS"
log_info ""

# Ensure we're on the base branch and up to date
log_info "Updating $BASE_BRANCH branch..."
git checkout "$BASE_BRANCH" 2>/dev/null || git checkout -b "$BASE_BRANCH"
git pull origin "$BASE_BRANCH" 2>/dev/null || log_warning "Could not pull from origin (may be new repo)"

# Create worktree base directory
mkdir -p "$WORKTREE_BASE"

# Agent configurations
declare -a AGENT_NAMES=("dev-1" "qa-1" "po-1" "devops-1" "documenter-1" "dev-2" "dev-3" "qa-2")
declare -a AGENT_ROLES=("dev" "qa" "po" "devops" "documenter" "dev" "dev" "qa")

# Create worktrees
for i in $(seq 0 $((NUM_AGENTS - 1))); do
  AGENT_NAME="${AGENT_NAMES[$i]}"
  AGENT_ROLE="${AGENT_ROLES[$i]}"
  WORKTREE_PATH="$WORKTREE_BASE/$AGENT_NAME"

  log_info "Creating worktree: $AGENT_NAME (role: $AGENT_ROLE)"

  # Remove existing worktree if it exists
  if [ -d "$WORKTREE_PATH" ]; then
    log_warning "Worktree $WORKTREE_PATH already exists, removing..."
    git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || rm -rf "$WORKTREE_PATH"
  fi

  # Create worktree on main branch (worktrees start on main, then agents create task branches)
  # Use -B to create/reset a branch for this worktree
  WORKTREE_BRANCH="${AGENT_NAME}-workspace"
  git worktree add -B "$WORKTREE_BRANCH" "$WORKTREE_PATH" "$BASE_BRANCH"

  # Create agent config file
  cat > "$WORKTREE_PATH/.agent-config" << EOF
# Agent Configuration
AGENT_NAME=$AGENT_NAME
AGENT_ROLE=$AGENT_ROLE
AGENT_INDEX=$i

# API Configuration (set these before running)
# export BATTRA_API_KEY=battra-${AGENT_ROLE}-key-$((i + 1))
# export BATTRA_PROJECT_ID=<your-project-uuid>
# export BATTRA_SPRINT_ID=<your-sprint-uuid>
# export ANTHROPIC_API_KEY=<your-anthropic-key>

# Git Configuration
export GIT_WORKFLOW_ENABLED=true
export GIT_PR_BASE_BRANCH=$BASE_BRANCH
export GIT_PR_REVIEWERS=""
EOF

  chmod +x "$WORKTREE_PATH/.agent-config"

  log_success "Created worktree: $WORKTREE_PATH"
done

log_info ""
log_success "✅ Worktree setup complete!"
log_info ""
log_info "Worktrees created:"
git worktree list

log_info ""
log_info "📋 Next steps:"
log_info ""
log_info "1. Configure API keys in each worktree:"
echo "   cd $WORKTREE_BASE/dev-1"
echo "   # Edit .agent-config and set your API keys"
log_info ""
log_info "2. Start agents in separate terminals:"
echo "   # Terminal 1 - Scrum Master"
echo "   cd $WORKTREE_BASE/scrum-master"
echo "   source .agent-config"
echo "   ./scripts/scrummaster-agent.sh"
log_info ""
echo "   # Terminal 2 - Dev Agent 1"
echo "   cd $WORKTREE_BASE/dev-1"
echo "   source .agent-config"
echo "   export BATTRA_API_KEY=battra-dev-key-1"
echo "   export BATTRA_SPRINT_ID=<sprint-uuid>"
echo "   export ANTHROPIC_API_KEY=<your-key>"
echo "   ./scripts/autonomous-agent.sh battra-dev-key-1 <sprint-uuid> dev"
log_info ""
echo "   # Terminal 3 - Dev Agent 2"
echo "   cd $WORKTREE_BASE/dev-2"
echo "   source .agent-config"
echo "   export BATTRA_API_KEY=battra-dev-key-2"
echo "   export BATTRA_SPRINT_ID=<sprint-uuid>"
echo "   export ANTHROPIC_API_KEY=<your-key>"
echo "   ./scripts/autonomous-agent.sh battra-dev-key-2 <sprint-uuid> dev"
log_info ""
log_info "3. To clean up worktrees later:"
echo "   ./scripts/cleanup-agent-worktrees.sh"
log_info ""
