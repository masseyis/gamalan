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
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

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

if (!ANTHROPIC_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY environment variable required');
  process.exit(1);
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
async function fetchTaskDetails(taskId) {
  console.log('📥 Fetching task details...');
  const task = await apiGet(`tasks/${taskId}`);

  console.log('📥 Fetching story...');
  const story = await apiGet(`stories/${task.storyId}`);

  console.log('📥 Fetching acceptance criteria...');
  const acs = await apiGet(`stories/${task.storyId}/acceptance-criteria`);

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

**Estimated Hours:** ${task.estimatedHours || 'Not estimated'}
**AC References:** ${task.acceptanceCriteriaRefs.join(', ')}

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
    console.log(`🚀 Running: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, code });
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
async function runTests() {
  console.log('\n🧪 Running tests...');
  try {
    await execCommand('cargo', ['test', '--package', 'backlog', '--quiet']);
    console.log('✅ All tests passed');
    return true;
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    return false;
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

// Call Claude Code via Anthropic API
async function invokeClaude(prompt) {
  console.log('\n🤖 Invoking Claude Code...');
  console.log('   (This may take several minutes for complex tasks)\n');

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

// Main execution
async function main() {
  try {
    console.log('🚀 Claude Code Task Executor');
    console.log(`📋 Task ID: ${TASK_ID}\n`);

    // Fetch task details
    const { task, story, acs } = await fetchTaskDetails(TASK_ID);

    console.log(`\n✅ Task: ${task.title}`);
    console.log(`📖 Story: ${story.title}`);
    console.log(`📝 Acceptance Criteria: ${acs.length}\n`);

    // Build prompt
    const prompt = buildPrompt(task, story, acs);

    // Save prompt to file for debugging
    const fs = require('fs');
    const promptFile = `/tmp/claude-task-${TASK_ID}.txt`;
    fs.writeFileSync(promptFile, prompt);
    console.log(`💾 Prompt saved to: ${promptFile}\n`);

    // Invoke Claude Code
    const result = await invokeClaude(prompt);

    // Run tests
    const testsPassed = await runTests();
    if (!testsPassed) {
      console.error('\n❌ Task execution failed: Tests did not pass');
      process.exit(1);
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

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Task execution failed:', error.message);
    process.exit(1);
  }
}

// Run main
main();
