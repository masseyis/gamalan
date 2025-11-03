#!/usr/bin/env node
/**
 * Claude Code Task Executor with Git Workflow
 *
 * Implements task with proper git hygiene:
 * 1. Create branch per task
 * 2. Implement changes
 * 3. Commit with conventional format
 * 4. Push branch
 * 5. Create PR
 * 6. Wait for CI/reviews
 * 7. Mark complete after merge
 *
 * Usage:
 *   node claude-code-executor-with-git.js <task_id>
 */

const { spawn } = require('child_process');

// Configuration
const TASK_ID = process.argv[2];
const API_BASE = process.env.BATTRA_API_BASE || 'http://localhost:8000/api/v1';
const API_KEY = process.env.BATTRA_API_KEY;
const STORY_ID = process.env.BATTRA_STORY_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY; // Optional - uses Claude Code CLI if not set
const GIT_BASE_BRANCH = process.env.GIT_PR_BASE_BRANCH || 'main';
const AUTO_MERGE = process.env.GIT_AUTO_MERGE === 'true';
const PR_REVIEWERS = process.env.GIT_PR_REVIEWERS || '';
const MAX_FIX_RETRIES = parseInt(process.env.MAX_FIX_RETRIES || '3', 10);

// Determine which Claude invocation method to use
// Priority: USE_CLAUDE_CLI env var > presence of ANTHROPIC_API_KEY
const FORCE_CLI = process.env.USE_CLAUDE_CLI === 'true';
const FORCE_API = process.env.USE_CLAUDE_API === 'true';

let USE_CLI;
if (FORCE_CLI && FORCE_API) {
  console.error('❌ Error: Cannot set both USE_CLAUDE_CLI and USE_CLAUDE_API');
  process.exit(1);
} else if (FORCE_CLI) {
  USE_CLI = true;
  console.log('ℹ️  Forced to use Claude Code CLI (USE_CLAUDE_CLI=true)');
} else if (FORCE_API) {
  if (!ANTHROPIC_KEY) {
    console.error('❌ Error: USE_CLAUDE_API=true but ANTHROPIC_API_KEY not set');
    process.exit(1);
  }
  USE_CLI = false;
  console.log('ℹ️  Forced to use Anthropic API (USE_CLAUDE_API=true)');
} else {
  // Auto-detect based on API key presence
  USE_CLI = !ANTHROPIC_KEY;
  if (USE_CLI) {
    console.log('ℹ️  Using Claude Code CLI (Claude Code Plus subscription)');
  } else {
    console.log('ℹ️  Using Anthropic API (separate API credits)');
  }
}

// Validation
if (!TASK_ID || !API_KEY || !STORY_ID) {
  console.error('❌ Missing required environment variables');
  console.error('Usage: node claude-code-executor-with-git.js <task_id>');
  console.error('Required: BATTRA_API_KEY, BATTRA_STORY_ID');
  console.error('Optional: ANTHROPIC_API_KEY (uses Claude Code CLI if not provided)');
  process.exit(1);
}

// API helper
async function apiGet(endpoint) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function apiPost(endpoint, data) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// Git helpers
function execCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: options.silent ? 'pipe' : 'inherit', ...options });
    let stdout = '';
    let stderr = '';

    if (proc.stdout) proc.stdout.on('data', (data) => (stdout += data.toString()));
    if (proc.stderr) proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true, stdout, stderr });
      else reject(new Error(`Command failed with code ${code}: ${stderr}`));
    });
  });
}

function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);
}

async function createBranch(task) {
  console.log('\n🌿 Creating git branch...');

  const slug = createSlug(task.title);
  const branchName = `task/${TASK_ID}-${slug}`;

  // Check if branch already exists
  const branchExists = await checkBranchExists(branchName);

  if (branchExists) {
    console.log(`📌 Branch already exists: ${branchName}`);
    console.log('   Using existing branch (work may already be in progress)');

    // Just checkout the existing branch
    await execCommand('git', ['checkout', branchName]);

    // Pull latest changes for this branch
    try {
      await execCommand('git', ['pull', 'origin', branchName]);
      console.log('   Pulled latest changes from remote');
    } catch (error) {
      console.log('   Branch exists locally but not on remote (that\'s OK)');
    }

    console.log(`✅ Using existing branch: ${branchName}`);
    return branchName;
  }

  // Branch doesn't exist, create it
  const isWorktree = await checkIfWorktree();

  if (isWorktree) {
    console.log('📂 Detected git worktree environment');
    // In a worktree, we're already on a dedicated branch path
    // Just need to pull latest and create our branch
    const currentBranch = await getCurrentBranch();
    console.log(`   Current branch: ${currentBranch}`);

    // Pull latest changes
    try {
      await execCommand('git', ['pull', 'origin', GIT_BASE_BRANCH]);
    } catch (error) {
      console.log('⚠️  Could not pull from origin (may be new repo or no remote)');
    }

    // Create and checkout new branch
    await execCommand('git', ['checkout', '-b', branchName]);
  } else {
    console.log('📁 Standard git repository (not worktree)');
    // Standard repo: checkout base branch first
    await execCommand('git', ['checkout', GIT_BASE_BRANCH]);
    await execCommand('git', ['pull', 'origin', GIT_BASE_BRANCH]);

    // Create and checkout new branch
    await execCommand('git', ['checkout', '-b', branchName]);
  }

  console.log(`✅ Created branch: ${branchName}`);
  return branchName;
}

async function checkBranchExists(branchName) {
  try {
    // Check if branch exists (locally or remotely)
    const result = await execCommand('git', ['show-ref', '--verify', `refs/heads/${branchName}`], { silent: true });
    return true;
  } catch {
    return false;
  }
}

async function checkExistingPR(branchName) {
  try {
    // Check if there's already a PR for this branch
    const result = await execCommand(
      'gh',
      ['pr', 'list', '--head', branchName, '--json', 'url', '-q', '.[0].url'],
      { silent: true }
    );

    const prUrl = result.stdout.trim();
    return prUrl || null;
  } catch {
    // gh CLI might not be available or no PR exists
    return null;
  }
}

async function checkIfWorktree() {
  try {
    const result = await execCommand('git', ['rev-parse', '--is-inside-work-tree'], { silent: true });
    // Check if we're in a worktree by looking at git directory structure
    const gitDirResult = await execCommand('git', ['rev-parse', '--git-dir'], { silent: true });
    const gitDir = gitDirResult.stdout.trim();

    // If git dir is not '.git', we're likely in a worktree
    // Worktrees have git dir like '../.git/worktrees/agent-name'
    return !gitDir.endsWith('/.git') && gitDir.includes('/worktrees/');
  } catch {
    return false;
  }
}

async function getCurrentBranch() {
  try {
    const result = await execCommand('git', ['branch', '--show-current'], { silent: true });
    return result.stdout.trim();
  } catch {
    return 'unknown';
  }
}

async function cleanupBranch(branchName) {
  console.log('\n🧹 Cleaning up branch...');

  const isWorktree = await checkIfWorktree();

  if (isWorktree) {
    // In a worktree, we can't checkout main (it's in use by another worktree)
    // Just delete the branch and let the worktree manager handle cleanup
    try {
      await execCommand('git', ['branch', '-D', branchName]);
      console.log(`✅ Branch ${branchName} deleted`);
    } catch (error) {
      console.error(`⚠️  Could not delete branch: ${error.message}`);
    }
  } else {
    // In a standard repo, checkout main first, then delete the branch
    try {
      await execCommand('git', ['checkout', GIT_BASE_BRANCH]);
      await execCommand('git', ['branch', '-D', branchName]);
      console.log(`✅ Branch ${branchName} deleted`);
    } catch (error) {
      console.error(`⚠️  Could not cleanup branch: ${error.message}`);
    }
  }
}

async function commitChanges(task, story, acs) {
  console.log('\n💾 Committing changes...');

  // Stage all changes
  await execCommand('git', ['add', '.']);

  // Check if there are changes to commit
  const statusResult = await execCommand('git', ['status', '--porcelain'], { silent: true });
  const changes = statusResult.stdout.trim();

  if (!changes) {
    console.log('⚠️  No changes to commit (this should not happen - we already checked!)');
    console.log('   Something went wrong between change detection and commit.');
    return false;
  }

  console.log('📝 Changes staged:');
  changes.split('\n').forEach(line => console.log(`   ${line}`));

  // Determine commit type
  const commitType = determineCommitType(task.title);

  // Build commit message
  const acSummary = acs
    .map((ac) => `- ${ac.id}: ${ac.given} → ${ac.thenClause}`)
    .join('\n');

  const commitMessage = `${commitType}(${getScope(task)}): ${task.title.toLowerCase()}

${task.description || 'Implementation of task requirements'}

Acceptance Criteria:
${acSummary}

🤖 Generated with Claude Code
Task-ID: ${TASK_ID}
Story-ID: ${story.id}

Co-Authored-By: Claude <noreply@anthropic.com>`;

  // Commit
  await execCommand('git', ['commit', '-m', commitMessage]);

  console.log('✅ Changes committed');
  return true;
}

function determineCommitType(title) {
  const lower = title.toLowerCase();
  if (lower.includes('test')) return 'test';
  if (lower.includes('fix')) return 'fix';
  if (lower.includes('refactor')) return 'refactor';
  if (lower.includes('docs')) return 'docs';
  return 'feat';
}

function getScope(task) {
  // Extract scope from description or default to 'backlog'
  if (task.description && task.description.includes('services/')) {
    const match = task.description.match(/services\/([^/]+)/);
    if (match) return match[1];
  }
  return 'backlog';
}

async function pushBranch(branchName) {
  console.log('\n📤 Pushing branch...');

  await execCommand('git', ['push', '-u', 'origin', branchName]);

  console.log('✅ Branch pushed');
}

async function createPullRequest(task, story, acs, branchName, testsPassed, qualityPassed) {
  console.log('\n🔀 Creating pull request...');

  // Build PR body
  const acChecklist = acs
    .map((ac) => `- [x] ${ac.id}: ${ac.given} → ${ac.thenClause}`)
    .join('\n');

  // Build warning section if tests/quality failed
  let warningSection = '';
  if (!testsPassed || !qualityPassed) {
    warningSection = `
## ⚠️ WARNING: Manual Review Required

This PR was created automatically but has issues that need attention:

${!testsPassed ? '- ❌ **Tests are failing** - The agent attempted to fix test failures but was unable to resolve them after multiple attempts' : ''}
${!qualityPassed ? '- ❌ **Quality checks failing** - Code formatting or linting issues need manual attention' : ''}

**The work may still be salvageable.** Please review the changes and either:
1. Fix the remaining issues manually
2. Use the changes as a starting point
3. Close this PR if the approach is not viable

`;
  }

  const prBody = `## Task Details

**Task ID:** ${TASK_ID}
**Story:** ${story.title} (#${story.id})
**Implemented by:** Autonomous Agent
${warningSection}
## Changes

${task.description || 'Implementation of task requirements'}

## Acceptance Criteria

${acChecklist}

## Testing

- [${testsPassed ? 'x' : ' '}] Unit tests pass
- [${testsPassed ? 'x' : ' '}] Integration tests pass
- [${qualityPassed ? 'x' : ' '}] Code quality checks pass (fmt, clippy)

## Review Checklist

- [ ] Code follows hexagonal architecture
- [ ] Tests are comprehensive
- [ ] OpenAPI specs updated (if applicable)
- [ ] No security issues
- [ ] Performance acceptable
${!testsPassed || !qualityPassed ? '- [ ] Fix test/quality issues before merging' : ''}

---

🤖 Automatically generated by autonomous agent
Branch: \`${branchName}\`
Task: ${TASK_ID}`;

  // Create PR using GitHub CLI
  const prTitle = `${!testsPassed || !qualityPassed ? '[NEEDS REVIEW] ' : ''}[Task] ${task.title}`;

  const args = [
    'pr',
    'create',
    '--title',
    prTitle,
    '--body',
    prBody,
    '--base',
    GIT_BASE_BRANCH,
  ];

  // Add reviewers if configured
  if (PR_REVIEWERS) {
    args.push('--reviewer', PR_REVIEWERS);
  }

  const result = await execCommand('gh', args, { silent: true });

  // Extract PR URL from output
  const prUrl = result.stdout.trim().split('\n').pop();

  console.log(`✅ Pull request created: ${prUrl}`);
  if (!testsPassed || !qualityPassed) {
    console.log('⚠️  This PR has failing tests/quality checks - manual review required');
  }

  return prUrl;
}

async function waitForPRApproval(prUrl) {
  console.log('\n⏳ Waiting for CI and reviews...');

  const prNumber = prUrl.split('/').pop();
  let attempts = 0;
  const maxAttempts = 60; // 1 hour with 60s intervals

  while (attempts < maxAttempts) {
    // Check CI status
    const checksResult = await execCommand(
      'gh',
      ['pr', 'checks', prNumber, '--json', 'state', '-q', '.[].state'],
      { silent: true }
    );

    const checkStates = checksResult.stdout.trim().split('\n');
    const allPassed = checkStates.every((state) => state === 'SUCCESS');
    const anyFailed = checkStates.some((state) => state === 'FAILURE');

    if (anyFailed) {
      console.error('❌ CI checks failed!');
      throw new Error('CI checks failed. Review the PR for details: ' + prUrl);
    }

    // Check review status
    const reviewResult = await execCommand(
      'gh',
      ['pr', 'view', prNumber, '--json', 'reviewDecision', '-q', '.reviewDecision'],
      { silent: true }
    );

    const reviewStatus = reviewResult.stdout.trim();

    console.log(`  CI: ${allPassed ? '✅' : '⏳'} | Reviews: ${reviewStatus || 'PENDING'}`);

    if (allPassed && reviewStatus === 'APPROVED') {
      console.log('✅ PR approved and CI passed!');
      return { approved: true, prNumber };
    }

    if (reviewStatus === 'CHANGES_REQUESTED') {
      console.error('❌ Changes requested by reviewer');
      throw new Error('Changes requested. Review the PR: ' + prUrl);
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, 60000)); // 60 seconds
    attempts++;
  }

  throw new Error('Timeout waiting for PR approval');
}

async function mergePR(prNumber) {
  console.log('\n🔀 Merging pull request...');

  await execCommand('gh', ['pr', 'merge', prNumber, '--squash', '--delete-branch']);

  console.log('✅ PR merged and branch deleted');
}

async function buildPromptWithGitInstructions(task, story, acs, branchName) {
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

# Acceptance Criteria

${acText}

# Git Workflow

✅ You are on branch: \`${branchName}\`
✅ Implement your changes BY CREATING/MODIFYING FILES
✅ Ensure all tests pass
❌ DO NOT commit (I will commit for you)
❌ DO NOT push (I will push for you)

After you finish:
- Your changes will be automatically committed
- A pull request will be created
- CI tests will run
- Code reviewers will check your work

Write high-quality code that will pass review!

# Architecture Guidelines

Follow guidelines in \`CLAUDE.md\`:
- Hexagonal architecture (domain → application → adapters)
- TDD approach (tests first)
- Update OpenAPI specs if needed
- Run cargo fmt and cargo clippy

# Working Directory

${process.cwd()}

# CRITICAL INSTRUCTIONS - READ CAREFULLY

You MUST actually create or modify files to complete this task. Do NOT just plan or describe what to do.

**Required actions:**
1. Analyze task and acceptance criteria
2. Identify EXACTLY which files to create/modify
3. **USE THE Write/Edit TOOLS** to create tests first (TDD)
4. **USE THE Write/Edit TOOLS** to implement functionality
5. **USE THE Bash TOOL** to verify tests pass (cargo test)
6. **USE THE Bash TOOL** to run quality checks (cargo fmt, cargo clippy)

**What NOT to do:**
- ❌ Do NOT just describe what needs to be done
- ❌ Do NOT just create a plan without implementing it
- ❌ Do NOT say "ready for commit" without actually creating/modifying files
- ❌ Do NOT skip writing actual code

**Success criteria:**
- ✅ At least one file must be created or modified
- ✅ Tests must be written and passing
- ✅ Quality checks must pass
- ✅ The implementation must be complete, not a plan

Implement this task NOW using Write/Edit/Bash tools.`;
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
  try {
    // Execute Claude CLI with --print flag and pipe prompt to stdin
    const result = await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');

      const claude = spawn('claude', [
        '--print',
        '--model', 'sonnet',
        '--dangerously-skip-permissions'  // YOLO mode: auto-approve all actions (safe with git)
      ], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  console.log('\n📝 Claude Code Response:\n');
  console.log(content);
  console.log('\n');

  return content;
}

async function runTests() {
  console.log('\n🧪 Running tests...');
  try {
    await execCommand('cargo', ['test', '--package', 'backlog', '--quiet']);
    console.log('✅ All tests passed');
    return { success: true };
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runQualityChecks() {
  console.log('\n🔍 Running quality checks...');
  try {
    await execCommand('cargo', ['fmt', '--all', '--check']);
    await execCommand('cargo', ['clippy', '--all-targets', '--', '-D', 'warnings']);
    console.log('✅ Quality checks passed');
    return { success: true };
  } catch (error) {
    console.error('❌ Quality checks failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Build fix prompt from test failures
function buildFixPrompt(task, testResult, attempt) {
  return `The previous implementation has compilation or test errors. Please fix them.

# Task Being Implemented
**Title:** ${task.title}
**Description:** ${task.description || 'No description'}

# Error Details (Attempt ${attempt}/${MAX_FIX_RETRIES})

\`\`\`
${testResult.error}
\`\`\`

# Instructions

The tests/compilation were passing BEFORE you started implementing this task. Your implementation broke them.

Please analyze the errors carefully and fix ALL issues:

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
  let branchName = null;

  try {
    console.log('🚀 Claude Code Task Executor (with Git Workflow)');
    console.log(`📋 Task ID: ${TASK_ID}`);
    console.log(`📖 Story ID: ${STORY_ID}\n`);

    // Fetch task details
    const { task, story, acs } = await fetchTaskDetails(TASK_ID, STORY_ID);

    console.log(`✅ Task: ${task.title}`);
    console.log(`📖 Story: ${story.title}`);
    console.log(`📝 Acceptance Criteria: ${acs.length}\n`);

    // Step 1: Create branch
    branchName = await createBranch(task);

    // Check if PR already exists for this branch
    const existingPR = await checkExistingPR(branchName);
    if (existingPR) {
      console.log(`\n✅ PR already exists for this task: ${existingPR}`);
      console.log('   Work appears to be complete. Skipping implementation.');
      console.log(`   Review PR: ${existingPR}`);
      process.exit(0);
    }

    // Step 2: Build prompt
    const prompt = await buildPromptWithGitInstructions(task, story, acs, branchName);

    // Step 3: Invoke Claude
    await invokeClaude(prompt);

    // Step 3.5: Check what changed
    console.log('\n📊 Checking for changes after Claude execution...');
    const statusAfterClaude = await execCommand('git', ['status', '--porcelain'], { silent: true });
    const changedFiles = statusAfterClaude.stdout.trim().split('\n').filter(line => line);

    if (changedFiles.length === 0) {
      console.log('⚠️  WARNING: No files were changed by Claude!');
      console.log('   Claude may have just provided a plan without implementing it.');
      console.log('   This could mean:');
      console.log('   - The task was unclear or too abstract');
      console.log('   - Claude decided no changes were needed');
      console.log('   - Claude misunderstood the instructions');
      console.log('\n   Proceeding with cleanup...');
      await cleanupBranch(branchName);
      process.exit(1);
    }

    console.log(`✅ Claude modified ${changedFiles.length} file(s):`);
    changedFiles.forEach(file => console.log(`   ${file}`));

    // Step 4: Test/Fix Loop (with retries)
    let testResult;
    let qualityResult;
    let fixAttempt = 0;
    let testsPassed = false;
    let qualityPassed = false;

    while (fixAttempt <= MAX_FIX_RETRIES) {
      // Run tests
      testResult = await runTests();

      if (!testResult.success) {
        fixAttempt++;

        if (fixAttempt > MAX_FIX_RETRIES) {
          console.error(`\n❌ Tests still failing after ${MAX_FIX_RETRIES} fix attempts`);
          console.log('⚠️  Will create PR with failing tests for manual review');
          break;
        }

        // Try to fix the failures
        console.log(`\n🔧 Attempt ${fixAttempt}/${MAX_FIX_RETRIES}: Asking Claude to fix test failures...`);
        const fixPrompt = buildFixPrompt(task, testResult, fixAttempt);
        await invokeClaude(fixPrompt);
        continue;
      }

      // Tests passed, try quality checks
      testsPassed = true;
      qualityResult = await runQualityChecks();

      if (!qualityResult.success) {
        fixAttempt++;

        if (fixAttempt > MAX_FIX_RETRIES) {
          console.error(`\n❌ Quality checks still failing after ${MAX_FIX_RETRIES} fix attempts`);
          console.log('⚠️  Will create PR with quality issues for manual review');
          break;
        }

        // Try to fix quality issues
        console.log(`\n🔧 Attempt ${fixAttempt}/${MAX_FIX_RETRIES}: Asking Claude to fix quality issues...`);
        const fixPrompt = buildFixPrompt(task, qualityResult, fixAttempt);
        await invokeClaude(fixPrompt);
        continue;
      }

      // Both passed!
      testsPassed = true;
      qualityPassed = true;
      break;
    }

    // Step 5: Commit changes
    const committed = await commitChanges(task, story, acs);
    if (!committed) {
      console.log('⚠️  No changes to commit. Cleaning up...');
      await cleanupBranch(branchName);
      return;
    }

    // Step 6: Push branch
    await pushBranch(branchName);

    // Step 7: Create PR (with test/quality status)
    const prUrl = await createPullRequest(task, story, acs, branchName, testsPassed, qualityPassed);

    // Step 8: Only wait for approval if tests and quality passed
    if (testsPassed && qualityPassed) {
      // Step 9: Wait for approval
      const { prNumber } = await waitForPRApproval(prUrl);

      // Step 10: Merge (if auto-merge enabled)
      if (AUTO_MERGE) {
        await mergePR(prNumber);
      } else {
        console.log('\n⏸️  Auto-merge disabled. Waiting for manual merge...');
        // Could poll here to detect when merged
      }

      console.log('\n✅ Task executed successfully!');
    } else {
      console.log('\n⚠️  Task completed with issues - manual review required');
      console.log('   The PR has been created but needs attention before merging');
    }

    console.log(`📋 Task ID: ${TASK_ID}`);
    console.log(`🔀 PR: ${prUrl}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Task execution failed:', error.message);

    // Cleanup: delete branch if it was created
    if (branchName) {
      await cleanupBranch(branchName);
    }

    process.exit(1);
  }
}

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

// Run
main();
