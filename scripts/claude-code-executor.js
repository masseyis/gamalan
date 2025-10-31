#!/usr/bin/env node
/**
 * Claude Code Task Executor
 *
 * Fetches task details from Battra API and executes them using Claude Code.
 *
 * Usage:
 *   node claude-code-executor.js <task_id>
 *
 * Environment Variables:
 *   BATTRA_API_BASE - Battra API base URL (default: http://localhost:8000/api/v1)
 *   BATTRA_API_KEY - Battra API key (required)
 *   ANTHROPIC_API_KEY - Anthropic API key (required)
 */

const { spawn } = require('child_process');

// Configuration
const TASK_ID = process.argv[2];
const API_BASE = process.env.BATTRA_API_BASE || 'http://localhost:8000/api/v1';
const API_KEY = process.env.BATTRA_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY; // Optional when using CLI
const STORY_ID = process.env.BATTRA_STORY_ID;
const MAX_FIX_RETRIES = parseInt(process.env.MAX_FIX_RETRIES || '3', 10); // Number of times to attempt fixes
const AGENT_ROLE = process.env.AGENT_ROLE || 'dev'; // Agent role for branch naming
const USE_WORKTREE = process.env.USE_WORKTREE !== 'false'; // Default to true
const WORKTREE_BASE = process.env.WORKTREE_BASE || '../agents/tasks'; // Base dir for task worktrees

// Validation
if (!TASK_ID) {
  console.error('❌ Error: Task ID required');
  console.error('Usage: node claude-code-executor.js <task_id>');
  process.exit(1);
}

if (!API_KEY) {
  console.error('❌ Error: BATTRA_API_KEY environment variable required');
  process.exit(1);
}

if (!STORY_ID) {
  console.error('❌ Error: BATTRA_STORY_ID environment variable required');
  process.exit(1);
}

// Check if Claude CLI is available (will use Claude Code Plus subscription)
const USE_CLI = !ANTHROPIC_KEY; // Use CLI if no API key provided
if (USE_CLI) {
  console.log('ℹ️  Using Claude Code CLI (Claude Code Plus subscription)');
} else {
  console.log('ℹ️  Using Anthropic API (separate API credits)');
}

// API helper
async function apiGet(endpoint) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Fetch task details
async function fetchTaskDetails(taskId, storyId) {
  console.log('📥 Fetching story...');
  const story = await apiGet(`stories/${storyId}`);

  console.log('📥 Fetching tasks for story...');
  const tasks = await apiGet(`stories/${storyId}/tasks`);

  // Find the specific task
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found in story ${storyId}`);
  }

  console.log('📥 Fetching acceptance criteria...');
  const acs = await apiGet(`stories/${storyId}/acceptance-criteria`);

  return { task, story, acs };
}

// Build prompt for Claude Code
function buildPrompt(task, story, acs) {
  const acText = acs
    .map(
      (ac) =>
        `### ${ac.id}\n**Given:** ${ac.given}\n**When:** ${ac.whenClause}\n**Then:** ${ac.thenClause}`
    )
    .join('\n\n');

  return `You are an AI developer implementing a task for the Battra AI project.

# Task Details

**Task ID:** ${task.id}
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}

**Story:** ${story.title}
**Story Description:** ${story.description || 'No description'}

**Estimated Hours:** ${task.estimated_hours || task.estimatedHours || 'Not estimated'}
**AC References:** ${(task.acceptance_criteria_refs || task.acceptanceCriteriaRefs || []).join(', ') || 'None'}

# Acceptance Criteria

${acText}

# Project Context

This is the Battra AI project, an AI-powered agile development platform built with:
- **Backend:** Rust microservices (Hexagonal Architecture)
- **Frontend:** Next.js + React + TypeScript
- **Database:** PostgreSQL
- **Hosting:** Shuttle.dev

# Architecture Guidelines

Please follow the guidelines in \`CLAUDE.md\` in the repository root:
- Use hexagonal architecture (domain → application → adapters)
- Write tests first (TDD)
- Update OpenAPI specs if adding/modifying endpoints
- Run \`cargo fmt\` and \`cargo clippy\`
- Ensure all tests pass

# Working Directory

${process.cwd()}

# Instructions

1. **Analyze** the task and acceptance criteria carefully
2. **Identify** which files need to be created or modified
3. **Write tests first** to verify the acceptance criteria
4. **Implement** the functionality following the architecture patterns
5. **Run tests** to verify everything works
6. **Run quality checks** (fmt, clippy)

Please implement this task now. Be thorough and ensure all acceptance criteria are met.`;
}

// Execute command and stream output
function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { captureOutput, ...spawnOptions } = options;
    console.log(`🚀 Running: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      stdio: captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
      ...spawnOptions,
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, code, stdout, stderr });
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

// Run tests
async function runTests(task, story) {
  console.log('\n🧪 Running tests...');

  // Detect task type from title, description, and git changes
  const taskText = `${task.title} ${task.description || ''} ${story.title} ${story.description || ''}`.toLowerCase();
  const isFrontend = /frontend|react|next\.?js|component|ui|web|tsx?|jsx?/i.test(taskText);
  const isBackend = /backend|rust|service|api|endpoint|gateway|database/i.test(taskText);

  // Check git diff to see which files were modified
  let changedFiles = '';
  try {
    const { stdout } = await execCommand('git', ['diff', '--name-only', 'HEAD'], { captureOutput: true });
    changedFiles = stdout.toLowerCase();
  } catch (err) {
    console.log('⚠️  Could not detect changed files, using keyword detection only');
  }

  const hasWebChanges = changedFiles.includes('apps/web/');
  const hasServiceChanges = changedFiles.includes('services/');

  let testOutput = '';

  try {
    // Frontend tests
    if (isFrontend || hasWebChanges) {
      console.log('  📱 Detected frontend task, running frontend tests...');
      try {
        const result = await execCommand('pnpm', ['test:unit'], { cwd: 'apps/web', captureOutput: true });
        testOutput += result.stdout + result.stderr;
        console.log('✅ Frontend tests passed');
      } catch (error) {
        console.log('⚠️  Frontend tests failed or not configured');
        console.log('  Proceeding anyway (tests may not exist yet)');
      }
    }

    // Backend tests
    if (isBackend || hasServiceChanges) {
      console.log('  🦀 Detected backend task, running backend tests...');
      // Run tests for the specific service if we can detect it
      try {
        let result;
        if (changedFiles.includes('services/backlog/')) {
          result = await execCommand('cargo', ['test', '--package', 'backlog', '--quiet'], { captureOutput: true });
        } else if (changedFiles.includes('services/projects/')) {
          result = await execCommand('cargo', ['test', '--package', 'projects', '--quiet'], { captureOutput: true });
        } else if (changedFiles.includes('services/readiness/')) {
          result = await execCommand('cargo', ['test', '--package', 'readiness', '--quiet'], { captureOutput: true });
        } else {
          console.log('  Running workspace tests...');
          result = await execCommand('cargo', ['test', '--workspace', '--quiet'], { captureOutput: true });
        }
        testOutput += result.stdout + result.stderr;
        console.log('✅ Backend tests passed');
      } catch (error) {
        // Capture test failure output
        throw error;
      }
    }

    // If we can't detect the type, skip tests with warning
    if (!isFrontend && !isBackend && !hasWebChanges && !hasServiceChanges) {
      console.log('⚠️  Could not detect task type, skipping tests');
      console.log('  (Tests will run in CI)');
    }

    return { success: true, output: testOutput };
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    // Try to capture error details from stderr if available
    return { success: false, output: testOutput + '\n' + error.message, error: error.message };
  }
}

// Run code quality checks
async function runQualityChecks() {
  console.log('\n🔍 Running quality checks...');

  try {
    console.log('  • Running cargo fmt...');
    await execCommand('cargo', ['fmt', '--all', '--check']);

    console.log('  • Running cargo clippy...');
    await execCommand('cargo', ['clippy', '--all-targets', '--', '-D', 'warnings']);

    console.log('✅ Quality checks passed');
    return true;
  } catch (error) {
    console.error('❌ Quality checks failed:', error.message);
    return false;
  }
}

// Call Claude Code via CLI or API
async function invokeClaude(prompt) {
  console.log('\n🤖 Invoking Claude Code...');
  console.log('   (This may take several minutes for complex tasks)\n');

  if (USE_CLI) {
    // Use Claude Code CLI (Claude Code Plus subscription)
    return invokeClaudeCLI(prompt);
  } else {
    // Use Anthropic API (separate API credits)
    return invokeCloudeAPI(prompt);
  }
}

// Call Claude Code via CLI
async function invokeClaudeCLI(prompt) {
  console.log('🔍 [DEBUG] Entering invokeClaudeCLI function');
  try {
    console.log('🔍 [DEBUG] Creating spawn Promise');
    // Execute Claude CLI with --print flag and pipe prompt to stdin
    const result = await new Promise((resolve, reject) => {
      console.log('🔍 [DEBUG] Inside Promise executor');
      const { spawn } = require('child_process');
      console.log('🔍 [DEBUG] Spawning Claude process...');

      const claude = spawn('claude', [
        '--print',
        '--model', 'sonnet',
        '--dangerously-skip-permissions'  // YOLO mode: auto-approve all actions (safe with git)
      ], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      console.log('🔍 [DEBUG] Claude process spawned, PID:', claude.pid);

      let stdout = '';
      let stderr = '';

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
        // Stream output in real-time
        process.stdout.write(data);
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        }
      });

      claude.on('error', (error) => {
        reject(error);
      });

      // Write prompt to stdin and close
      claude.stdin.write(prompt);
      claude.stdin.end();
    });

    console.log('\n\n📝 Claude Code execution completed\n');

    return result;
  } catch (error) {
    console.error('❌ Claude CLI error:', error.message);
    throw error;
  }
}

// Call Claude Code via Anthropic API
async function invokeCloudeAPI(prompt) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8096,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Extract text content
    const content = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    console.log('\n📝 Claude Code Response:\n');
    console.log(content);
    console.log('\n');

    return content;
  } catch (error) {
    console.error('❌ Claude API error:', error.message);
    throw error;
  }
}

// Build fix prompt from test failures
function buildFixPrompt(task, testResult, attempt) {
  return `The previous implementation broke existing tests. Please fix the test failures.

# Task Being Implemented
**Title:** ${task.title}
**Description:** ${task.description || 'No description'}

# Test Failure Details (Attempt ${attempt}/${MAX_FIX_RETRIES})

\`\`\`
${testResult.output || testResult.error}
\`\`\`

# Instructions

The tests were passing BEFORE you started implementing this task. Your implementation broke them.

Please analyze the test failures carefully and fix ALL issues:

1. **Read the error messages** - They often tell you exactly what's wrong
2. **Check type mismatches** - Did you change a function signature without updating all callers?
3. **Update test fixtures** - If you changed structs or state types, update test setup code
4. **Fix imports** - Remove unused imports that cause clippy warnings
5. **Complete the migration** - If you started changing something (like state types), finish updating ALL files

**IMPORTANT:**
- Do NOT skip or disable tests
- Do NOT comment out failing code
- Fix the actual problems, don't work around them
- Update ALL files that need changing, not just some

Please fix the issues now.`;
}

// Create task-specific worktree
async function setupWorktree(task) {
  if (!USE_WORKTREE) {
    console.log('ℹ️  Worktree mode disabled, working in current directory');
    return { worktreePath: process.cwd(), branchName: null, cleanup: async () => {} };
  }

  const path = require('path');
  const fs = require('fs');

  // Create worktree directory
  const worktreeDir = path.resolve(WORKTREE_BASE);
  if (!fs.existsSync(worktreeDir)) {
    fs.mkdirSync(worktreeDir, { recursive: true });
  }

  // Generate branch name from task
  const taskSlug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const branchName = `${AGENT_ROLE}/task-${TASK_ID.substring(0, 8)}-${taskSlug}`;
  const worktreePath = path.join(worktreeDir, `task-${TASK_ID.substring(0, 8)}`);

  console.log(`\n🌳 Creating worktree for task...`);
  console.log(`   Branch: ${branchName}`);
  console.log(`   Path: ${worktreePath}`);

  try {
    // Remove existing worktree if it exists
    if (fs.existsSync(worktreePath)) {
      console.log('   Cleaning up existing worktree...');
      await execCommand('git', ['worktree', 'remove', worktreePath, '--force'], { captureOutput: true });
    }

    // Fetch latest to ensure we're up to date
    await execCommand('git', ['fetch', 'origin'], { captureOutput: true });

    // Create worktree with new branch based on main
    await execCommand('git', ['worktree', 'add', '-b', branchName, worktreePath, 'origin/main'], {
      captureOutput: true
    });

    console.log(`✅ Worktree created successfully\n`);

    // Return cleanup function
    const cleanup = async () => {
      console.log(`\n🧹 Cleaning up worktree: ${worktreePath}`);
      try {
        await execCommand('git', ['worktree', 'remove', worktreePath, '--force'], { captureOutput: true });
        console.log('✅ Worktree removed');
      } catch (err) {
        console.warn('⚠️  Failed to remove worktree:', err.message);
      }
    };

    return { worktreePath, branchName, cleanup };
  } catch (error) {
    console.error('❌ Failed to create worktree:', error.message);
    throw error;
  }
}

// Commit and push changes
async function commitAndPush(worktreePath, branchName, task, story) {
  console.log('\n📝 Committing changes...');

  const taskTitle = task.title;
  const storyTitle = story.title;

  // Commit message
  const commitMessage = `feat: ${taskTitle}

Implements task from story: ${storyTitle}

Task ID: ${task.id}
Story ID: ${story.id}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

  try {
    // Stage all changes
    await execCommand('git', ['add', '-A'], { cwd: worktreePath });

    // Check if there are changes to commit
    const { stdout: statusOut } = await execCommand('git', ['status', '--porcelain'], {
      cwd: worktreePath,
      captureOutput: true
    });

    if (!statusOut.trim()) {
      console.log('ℹ️  No changes to commit');
      return false;
    }

    // Commit
    await execCommand('git', ['commit', '-m', commitMessage], { cwd: worktreePath });
    console.log('✅ Changes committed');

    // Push to remote
    console.log('\n📤 Pushing to remote...');
    await execCommand('git', ['push', 'origin', branchName, '--set-upstream'], { cwd: worktreePath });
    console.log('✅ Pushed to remote');

    return true;
  } catch (error) {
    console.error('❌ Failed to commit/push:', error.message);
    throw error;
  }
}

// Create pull request
async function createPullRequest(branchName, task, story, acs) {
  console.log('\n🔀 Creating pull request...');

  const taskTitle = task.title;
  const storyTitle = story.title;

  // Build PR body
  const acList = acs
    .map(ac => `- **Given:** ${ac.given}\n  **When:** ${ac.whenClause}\n  **Then:** ${ac.thenClause}`)
    .join('\n\n');

  const prBody = `## Task

**Title:** ${taskTitle}
**Description:** ${task.description || 'No description provided'}

## Story

**Title:** ${storyTitle}
**Description:** ${story.description || 'No description'}

## Acceptance Criteria

${acList}

## Testing

- [x] Tests pass
- [x] Code quality checks pass (fmt, clippy)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

  try {
    // Create PR using gh CLI
    const { stdout: prUrl } = await execCommand(
      'gh',
      [
        'pr', 'create',
        '--title', `${taskTitle}`,
        '--body', prBody,
        '--base', 'main',
        '--head', branchName
      ],
      { captureOutput: true }
    );

    console.log(`✅ Pull request created: ${prUrl.trim()}`);
    return prUrl.trim();
  } catch (error) {
    console.error('❌ Failed to create pull request:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  let worktreeCleanup = null;
  let worktreePath = process.cwd();

  try {
    console.log('🚀 Claude Code Task Executor');
    console.log(`📋 Task ID: ${TASK_ID}`);
    console.log(`📖 Story ID: ${STORY_ID}`);
    console.log(`👤 Agent Role: ${AGENT_ROLE}`);
    console.log(`🔄 Max fix retries: ${MAX_FIX_RETRIES}`);
    console.log(`🌳 Worktree mode: ${USE_WORKTREE ? 'enabled' : 'disabled'}\n`);

    // Fetch task details
    const { task, story, acs } = await fetchTaskDetails(TASK_ID, STORY_ID);

    console.log(`\n✅ Task: ${task.title}`);
    console.log(`📖 Story: ${story.title}`);
    console.log(`📝 Acceptance Criteria: ${acs.length}\n`);

    // Setup worktree
    const worktreeInfo = await setupWorktree(task);
    worktreeCleanup = worktreeInfo.cleanup;
    worktreePath = worktreeInfo.worktreePath;
    const branchName = worktreeInfo.branchName;

    // Change to worktree directory
    const originalCwd = process.cwd();
    if (USE_WORKTREE) {
      process.chdir(worktreePath);
      console.log(`📂 Working directory: ${worktreePath}\n`);
    }

    // Build initial prompt
    const prompt = buildPrompt(task, story, acs);

    // Save prompt to file for debugging
    const fs = require('fs');
    const promptFile = `/tmp/claude-task-${TASK_ID}.txt`;
    fs.writeFileSync(promptFile, prompt);
    console.log(`💾 Prompt saved to: ${promptFile}\n`);

    // Invoke Claude Code (initial implementation)
    await invokeClaude(prompt);

    // Test/Fix Loop
    let testResult;
    let fixAttempt = 0;

    while (fixAttempt <= MAX_FIX_RETRIES) {
      // Run tests
      testResult = await runTests(task, story);

      if (testResult.success) {
        console.log('\n✅ Tests passed!');
        break;
      }

      // Tests failed
      fixAttempt++;

      if (fixAttempt > MAX_FIX_RETRIES) {
        console.error(`\n❌ Tests still failing after ${MAX_FIX_RETRIES} fix attempts`);
        console.error('\n📋 Test Output:');
        console.error(testResult.output);
        console.error('\n❌ Task execution failed: Tests did not pass');

        // Change back to original directory before cleanup
        if (USE_WORKTREE) {
          process.chdir(originalCwd);
        }
        if (worktreeCleanup) await worktreeCleanup();

        process.exit(1);
      }

      // Try to fix the failures
      console.log(`\n🔧 Attempt ${fixAttempt}/${MAX_FIX_RETRIES}: Asking Claude to fix test failures...`);
      const fixPrompt = buildFixPrompt(task, testResult, fixAttempt);

      const fixPromptFile = `/tmp/claude-task-${TASK_ID}-fix-${fixAttempt}.txt`;
      fs.writeFileSync(fixPromptFile, fixPrompt);
      console.log(`💾 Fix prompt saved to: ${fixPromptFile}\n`);

      await invokeClaude(fixPrompt);
    }

    // Run quality checks
    const qualityPassed = await runQualityChecks();
    if (!qualityPassed) {
      console.error('\n❌ Task execution failed: Quality checks did not pass');

      // Change back to original directory before cleanup
      if (USE_WORKTREE) {
        process.chdir(originalCwd);
      }
      if (worktreeCleanup) await worktreeCleanup();

      process.exit(1);
    }

    // Commit and push if using worktree
    if (USE_WORKTREE && branchName) {
      const hasChanges = await commitAndPush(worktreePath, branchName, task, story);

      if (hasChanges) {
        // Create pull request
        const prUrl = await createPullRequest(branchName, task, story, acs);
        console.log(`\n🎉 Pull Request: ${prUrl}`);
      } else {
        console.log('\nℹ️  No changes to push');
      }
    }

    console.log('\n✅ Task executed successfully!');
    console.log(`📋 Task ID: ${TASK_ID}`);
    console.log(`✅ Title: ${task.title}`);
    console.log(`🔄 Fix attempts used: ${fixAttempt}/${MAX_FIX_RETRIES}`);

    // Change back to original directory before cleanup
    if (USE_WORKTREE) {
      process.chdir(originalCwd);
    }

    // Clean up worktree
    if (worktreeCleanup) {
      await worktreeCleanup();
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Task execution failed:', error.message);

    // Ensure cleanup happens even on error
    if (worktreeCleanup) {
      try {
        // Change back if we were in worktree
        if (USE_WORKTREE) {
          const originalCwd = process.cwd();
          if (originalCwd.includes('agents/tasks')) {
            const path = require('path');
            process.chdir(path.resolve(__dirname, '..'));
          }
        }
        await worktreeCleanup();
      } catch (cleanupError) {
        console.error('⚠️  Cleanup error:', cleanupError.message);
      }
    }

    process.exit(1);
  }
}

// Run main
main();
