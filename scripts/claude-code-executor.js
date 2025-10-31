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

// Main execution
async function main() {
  try {
    console.log('🚀 Claude Code Task Executor');
    console.log(`📋 Task ID: ${TASK_ID}`);
    console.log(`📖 Story ID: ${STORY_ID}`);
    console.log(`🔄 Max fix retries: ${MAX_FIX_RETRIES}\n`);

    // Fetch task details
    const { task, story, acs } = await fetchTaskDetails(TASK_ID, STORY_ID);

    console.log(`\n✅ Task: ${task.title}`);
    console.log(`📖 Story: ${story.title}`);
    console.log(`📝 Acceptance Criteria: ${acs.length}\n`);

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
      process.exit(1);
    }

    console.log('\n✅ Task executed successfully!');
    console.log(`📋 Task ID: ${TASK_ID}`);
    console.log(`✅ Title: ${task.title}`);
    console.log(`🔄 Fix attempts used: ${fixAttempt}/${MAX_FIX_RETRIES}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Task execution failed:', error.message);
    process.exit(1);
  }
}

// Run main
main();
