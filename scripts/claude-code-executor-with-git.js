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
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GIT_BASE_BRANCH = process.env.GIT_PR_BASE_BRANCH || 'main';
const AUTO_MERGE = process.env.GIT_AUTO_MERGE === 'true';
const PR_REVIEWERS = process.env.GIT_PR_REVIEWERS || '';

// Validation
if (!TASK_ID || !API_KEY || !ANTHROPIC_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Usage: node claude-code-executor-with-git.js <task_id>');
  console.error('Required: BATTRA_API_KEY, ANTHROPIC_API_KEY');
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

  // Check if we're in a worktree
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

async function commitChanges(task, story, acs) {
  console.log('\n💾 Committing changes...');

  // Stage all changes
  await execCommand('git', ['add', '.']);

  // Check if there are changes to commit
  const statusResult = await execCommand('git', ['status', '--porcelain'], { silent: true });
  if (!statusResult.stdout.trim()) {
    console.log('⚠️  No changes to commit');
    return false;
  }

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

async function createPullRequest(task, story, acs, branchName) {
  console.log('\n🔀 Creating pull request...');

  // Build PR body
  const acChecklist = acs
    .map((ac) => `- [x] ${ac.id}: ${ac.given} → ${ac.thenClause}`)
    .join('\n');

  const prBody = `## Task Details

**Task ID:** ${TASK_ID}
**Story:** ${story.title} (#${story.id})
**Implemented by:** Autonomous Agent

## Changes

${task.description || 'Implementation of task requirements'}

## Acceptance Criteria

${acChecklist}

## Testing

- [x] Unit tests pass
- [x] Integration tests pass
- [x] Code quality checks pass (fmt, clippy)

## Review Checklist

- [ ] Code follows hexagonal architecture
- [ ] Tests are comprehensive
- [ ] OpenAPI specs updated (if applicable)
- [ ] No security issues
- [ ] Performance acceptable

---

🤖 Automatically generated by autonomous agent
Branch: \`${branchName}\`
Task: ${TASK_ID}`;

  // Create PR using GitHub CLI
  const prTitle = `[Task] ${task.title}`;

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
✅ Implement your changes
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

# Instructions

1. Analyze task and acceptance criteria
2. Identify files to create/modify
3. Write tests first
4. Implement functionality
5. Verify tests pass
6. Run quality checks

Implement this task now.`;
}

async function invokeClaude(prompt) {
  console.log('\n🤖 Invoking Claude Code...');

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
  await execCommand('cargo', ['test', '--package', 'backlog', '--quiet']);
  console.log('✅ All tests passed');
}

async function runQualityChecks() {
  console.log('\n🔍 Running quality checks...');
  await execCommand('cargo', ['fmt', '--all', '--check']);
  await execCommand('cargo', ['clippy', '--all-targets', '--', '-D', 'warnings']);
  console.log('✅ Quality checks passed');
}

// Main execution
async function main() {
  let branchName = null;

  try {
    console.log('🚀 Claude Code Task Executor (with Git Workflow)');
    console.log(`📋 Task ID: ${TASK_ID}\n`);

    // Fetch task details
    const { task, story, acs } = await fetchTaskDetails(TASK_ID);

    console.log(`✅ Task: ${task.title}`);
    console.log(`📖 Story: ${story.title}`);
    console.log(`📝 Acceptance Criteria: ${acs.length}\n`);

    // Step 1: Create branch
    branchName = await createBranch(task);

    // Step 2: Build prompt
    const prompt = await buildPromptWithGitInstructions(task, story, acs, branchName);

    // Step 3: Invoke Claude
    await invokeClaude(prompt);

    // Step 4: Run tests
    await runTests();

    // Step 5: Run quality checks
    await runQualityChecks();

    // Step 6: Commit changes
    const committed = await commitChanges(task, story, acs);
    if (!committed) {
      console.log('⚠️  No changes to commit. Cleaning up...');
      await execCommand('git', ['checkout', GIT_BASE_BRANCH]);
      await execCommand('git', ['branch', '-D', branchName]);
      return;
    }

    // Step 7: Push branch
    await pushBranch(branchName);

    // Step 8: Create PR
    const prUrl = await createPullRequest(task, story, acs, branchName);

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
    console.log(`📋 Task ID: ${TASK_ID}`);
    console.log(`🔀 PR: ${prUrl}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Task execution failed:', error.message);

    // Cleanup: delete branch if it was created
    if (branchName) {
      console.log('\n🧹 Cleaning up branch...');
      try {
        await execCommand('git', ['checkout', GIT_BASE_BRANCH]);
        await execCommand('git', ['branch', '-D', branchName]);
      } catch (cleanupError) {
        console.error('Failed to cleanup branch:', cleanupError.message);
      }
    }

    process.exit(1);
  }
}

async function fetchTaskDetails(taskId) {
  console.log('📥 Fetching task details...');
  const task = await apiGet(`tasks/${taskId}`);
  const story = await apiGet(`stories/${task.storyId}`);
  const acs = await apiGet(`stories/${task.storyId}/acceptance-criteria`);
  return { task, story, acs };
}

// Run
main();
