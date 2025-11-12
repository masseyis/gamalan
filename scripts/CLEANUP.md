# Process Cleanup Documentation

## Problem

When autonomous agents run tests (especially QA agents running frontend tests via `pnpm test`), they spawn child processes that can become orphaned if the agent crashes, is killed, or exits abnormally. This causes:

- System slowdown (CPU usage from hanging test processes)
- Port conflicts (dev servers still running)
- Resource exhaustion (too many node/playwright processes)
- Computer hanging/freezing

## Solution

We've implemented a **multi-layered cleanup mechanism** to prevent orphaned processes:

### 1. Automatic Cleanup in Executor Scripts

**File:** `scripts/claude-code-executor-with-git.js`

The Node.js executor now:
- **Tracks all spawned child processes** in a global `childProcesses` Set
- **Registers signal handlers** for `SIGINT`, `SIGTERM`, `exit`, and `uncaughtException`
- **Automatically kills child processes** when the executor exits (gracefully or forcefully)
- **Uses SIGTERM first**, then SIGKILL after a timeout for stubborn processes

**How it works:**
```javascript
// Track processes
const childProcesses = new Set();

function execCommand(command, args) {
  const proc = spawn(command, args);
  childProcesses.add(proc.pid);  // Track it

  proc.on('close', () => {
    childProcesses.delete(proc.pid);  // Remove when done
  });
}

// Cleanup on exit
process.on('exit', cleanupChildProcesses);
process.on('SIGINT', cleanupChildProcesses);
```

### 2. Periodic Background Cleanup

**File:** `scripts/multi-agent-sprint.sh`

The orchestrator now:
- **Starts a periodic cleanup task** that runs every 5 minutes
- **Silently kills orphaned test processes** in the background
- **Runs during the entire agent session**

**Benefits:**
- Catches processes that slip through the executor's cleanup
- Prevents gradual accumulation of orphaned processes
- No user intervention needed

### 3. Graceful Shutdown on Ctrl+C

**File:** `scripts/multi-agent-sprint.sh`

When you press Ctrl+C:
1. The orchestrator catches the signal
2. Sends SIGTERM to all agent processes
3. Waits 2 seconds for graceful exit
4. Force kills any remaining agents with SIGKILL
5. Runs the cleanup script to kill any test processes
6. Exits cleanly

### 4. Manual Cleanup Tools

#### Emergency Kill Switch
```bash
./scripts/kill-all-tests.sh
```

**Use when:**
- You notice your computer is slow
- You see many `pnpm` or `playwright` processes in Activity Monitor
- The agents have crashed and left processes behind
- You need to immediately free up resources

**What it does:**
- Kills ALL test-related processes (pnpm, npm, playwright, vitest, turbo)
- No confirmation required (force mode)
- Safe to run anytime

#### Targeted Cleanup
```bash
./scripts/cleanup-test-processes.sh
```

**Options:**
- `--force` - Skip confirmation
- `--pid PID` - Only kill processes related to specific PID

**Use when:**
- You want to review processes before killing them
- You want to target specific orphaned processes
- You need more control than the emergency script

## Process Patterns Detected

The cleanup scripts look for:
- `pnpm.*test` - pnpm running tests
- `npm.*test` - npm running tests
- `turbo.*test` - turbo running tests
- `vitest` - vitest test runner
- `playwright test` - playwright test runner
- `node.*playwright` - node running playwright
- `node.*vitest` - node running vitest

## Best Practices

### For Users

1. **Let agents exit gracefully** - Use Ctrl+C instead of force quit
2. **Run periodic cleanup** - The orchestrator does this automatically
3. **Use the emergency kill switch** - If you notice slowdown
4. **Monitor system resources** - Check Activity Monitor for orphaned processes

### For Developers

1. **Always track spawned processes** - Add them to the `childProcesses` Set
2. **Clean up on exit** - Use signal handlers
3. **Test cleanup logic** - Verify processes actually die
4. **Use SIGTERM before SIGKILL** - Give processes a chance to clean up

## Testing the Cleanup

To verify cleanup works:

```bash
# 1. Start the agents
./scripts/multi-agent-sprint.sh <sprint-id>

# 2. Wait for tests to start running
sleep 30

# 3. Check for test processes
ps aux | grep -E "pnpm|playwright|vitest" | grep -v grep

# 4. Stop agents with Ctrl+C
# Press Ctrl+C

# 5. Verify all processes are gone
ps aux | grep -E "pnpm|playwright|vitest" | grep -v grep
# Should return no results
```

## Troubleshooting

### "Process XYZ still alive after cleanup"

**Cause:** Process is stuck and won't respond to SIGKILL

**Solution:**
1. Note the PID
2. Try: `sudo kill -9 <PID>`
3. If that fails, the process is in an uninterruptible state (rare)
4. Reboot if necessary

### "Cleanup script not found"

**Cause:** Script path issue or not executable

**Solution:**
```bash
chmod +x scripts/cleanup-test-processes.sh
chmod +x scripts/kill-all-tests.sh
```

### "Permission denied killing process"

**Cause:** Process owned by different user or system process

**Solution:**
- Use `sudo` if you own the process
- Don't kill system processes
- Check process owner: `ps -p <PID> -o user=`

## Architecture

```
┌─────────────────────────────────────┐
│   Multi-Agent Orchestrator          │
│   (multi-agent-sprint.sh)           │
│                                     │
│   ┌─────────────────────────┐      │
│   │ Periodic Cleanup Task   │      │
│   │ (every 5 minutes)       │      │
│   └─────────────────────────┘      │
│                                     │
│   ┌─────────────────────────┐      │
│   │ Signal Handlers         │      │
│   │ (SIGINT, SIGTERM)       │      │
│   └─────────────────────────┘      │
└─────────────────────────────────────┘
            │
            ├─→ Agent 1 (Dev)
            │   ├─→ Executor.js
            │   │   ├─→ Tracks child PIDs
            │   │   └─→ Cleanup on exit
            │   └─→ Claude CLI
            │       └─→ pnpm test
            │           └─→ Tracked & cleaned
            │
            ├─→ Agent 2 (QA)
            │   └─→ ... (same pattern)
            │
            └─→ Agent N (...)
                └─→ ... (same pattern)

Manual Tools:
  • kill-all-tests.sh (emergency)
  • cleanup-test-processes.sh (targeted)
```

## Summary

The cleanup mechanism has **4 layers of protection**:

1. ✅ **Automatic cleanup** in executor scripts (tracks all processes)
2. ✅ **Periodic background cleanup** every 5 minutes
3. ✅ **Graceful shutdown** on Ctrl+C with signal handlers
4. ✅ **Manual emergency tools** for immediate cleanup

This should prevent orphaned processes from accumulating and hanging your computer.
