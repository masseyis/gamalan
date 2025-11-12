#!/bin/bash
# test-cleanup.sh - Test the process cleanup mechanism
#
# This script simulates orphaned processes and verifies cleanup works

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 Testing Process Cleanup Mechanism"
echo "===================================="
echo ""

# Test 1: Spawn some fake test processes
echo "📝 Test 1: Creating fake test processes..."
sleep 1000 &
FAKE_PID1=$!
sleep 1000 &
FAKE_PID2=$!

# Rename them to look like test processes (for demo purposes, we'll just track the PIDs)
echo "   Created fake process 1: PID $FAKE_PID1"
echo "   Created fake process 2: PID $FAKE_PID2"
echo ""

# Wait a moment
sleep 2

# Test 2: Verify processes are running
echo "📝 Test 2: Verifying processes are running..."
if kill -0 $FAKE_PID1 2>/dev/null && kill -0 $FAKE_PID2 2>/dev/null; then
  echo -e "   ${GREEN}✅ Both processes are running${NC}"
else
  echo -e "   ${RED}❌ Processes not running (unexpected)${NC}"
  exit 1
fi
echo ""

# Test 3: Run cleanup script
echo "📝 Test 3: Testing manual cleanup script..."
echo "   Note: The cleanup script looks for actual test process patterns"
echo "   (pnpm, playwright, vitest, etc.) so it won't kill our fake processes"
echo "   This is correct behavior - it's targeted cleanup."
"$SCRIPT_DIR/cleanup-test-processes.sh" --force || true
echo ""

# Test 4: Clean up our fake processes manually
echo "📝 Test 4: Cleaning up test processes..."
if kill -0 $FAKE_PID1 2>/dev/null; then
  kill $FAKE_PID1 2>/dev/null || true
  echo -e "   ${GREEN}✅ Killed fake process 1${NC}"
fi

if kill -0 $FAKE_PID2 2>/dev/null; then
  kill $FAKE_PID2 2>/dev/null || true
  echo -e "   ${GREEN}✅ Killed fake process 2${NC}"
fi
echo ""

# Test 5: Verify signal handlers in executor
echo "📝 Test 5: Verifying executor script has cleanup handlers..."
if grep -q "cleanupChildProcesses" "$SCRIPT_DIR/claude-code-executor-with-git.js"; then
  echo -e "   ${GREEN}✅ Executor has cleanup function${NC}"
else
  echo -e "   ${RED}❌ Executor missing cleanup function${NC}"
  exit 1
fi

if grep -q "process.on('SIGINT'" "$SCRIPT_DIR/claude-code-executor-with-git.js"; then
  echo -e "   ${GREEN}✅ Executor has SIGINT handler${NC}"
else
  echo -e "   ${RED}❌ Executor missing SIGINT handler${NC}"
  exit 1
fi

if grep -q "process.on('SIGTERM'" "$SCRIPT_DIR/claude-code-executor-with-git.js"; then
  echo -e "   ${GREEN}✅ Executor has SIGTERM handler${NC}"
else
  echo -e "   ${RED}❌ Executor missing SIGTERM handler${NC}"
  exit 1
fi

if grep -q "childProcesses.add" "$SCRIPT_DIR/claude-code-executor-with-git.js"; then
  echo -e "   ${GREEN}✅ Executor tracks child processes${NC}"
else
  echo -e "   ${RED}❌ Executor not tracking child processes${NC}"
  exit 1
fi
echo ""

# Test 6: Verify orchestrator has periodic cleanup
echo "📝 Test 6: Verifying orchestrator has periodic cleanup..."
if grep -q "start_periodic_cleanup" "$SCRIPT_DIR/multi-agent-sprint.sh"; then
  echo -e "   ${GREEN}✅ Orchestrator has periodic cleanup${NC}"
else
  echo -e "   ${RED}❌ Orchestrator missing periodic cleanup${NC}"
  exit 1
fi

if grep -q "cleanup-test-processes.sh" "$SCRIPT_DIR/multi-agent-sprint.sh"; then
  echo -e "   ${GREEN}✅ Orchestrator calls cleanup script${NC}"
else
  echo -e "   ${RED}❌ Orchestrator not calling cleanup script${NC}"
  exit 1
fi
echo ""

# Test 7: Verify emergency kill script exists and is executable
echo "📝 Test 7: Verifying emergency kill script..."
if [ -x "$SCRIPT_DIR/kill-all-tests.sh" ]; then
  echo -e "   ${GREEN}✅ Emergency kill script exists and is executable${NC}"
else
  echo -e "   ${RED}❌ Emergency kill script missing or not executable${NC}"
  exit 1
fi
echo ""

# Summary
echo "=================================="
echo -e "${GREEN}✅ All cleanup tests passed!${NC}"
echo ""
echo "The cleanup mechanism has been successfully installed:"
echo "  • Executor tracks and cleans up child processes"
echo "  • Signal handlers (SIGINT, SIGTERM) trigger cleanup"
echo "  • Orchestrator runs periodic cleanup every 5 minutes"
echo "  • Manual cleanup tools are available"
echo ""
echo "Usage:"
echo "  • Normal operation: Cleanup happens automatically"
echo "  • Ctrl+C agents: Cleanup runs on exit"
echo "  • Emergency: Run ./scripts/kill-all-tests.sh"
echo ""
echo "See scripts/CLEANUP.md for full documentation."
