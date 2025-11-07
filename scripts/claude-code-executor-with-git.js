#!/usr/bin/env node
/**
 * AI Coding Assistant Task Executor with Git Workflow
 *
 * Implements task with proper git hygiene:
 * 1. Create branch per task
 * 2. Implement changes via AI (Claude or Codex)
 * 3. Commit with conventional format
 * 4. Push branch
 * 5. Create PR
 * 6. Wait for CI/reviews
 * 7. Mark complete after merge
 *
 * Supports three execution modes:
 * - Claude Code CLI (default) - Uses local Claude Code CLI
 * - Claude API - Direct Anthropic API calls (requires ANTHROPIC_API_KEY)
 * - Codex CLI - Uses OpenAI Codex CLI (set USE_CODEX_CLI=true)
 *
 * Usage:
 *   node claude-code-executor-with-git.js <task_id>
 *
 * Environment:
 *   BATTRA_API_KEY, BATTRA_STORY_ID - Required
 *   USE_CLAUDE_CLI, USE_CLAUDE_API, USE_CODEX_CLI - Pick one execution mode
 *   ANTHROPIC_API_KEY - For Claude API mode
 *   CODEX_API_KEY - Optional Codex CLI auth override
 */

const { spawn } = require('child_process');

// Configuration
const TASK_ID = process.argv[2];
const API_BASE = process.env.BATTRA_API_BASE || 'http://localhost:8000/api/v1';
const API_KEY = process.env.BATTRA_API_KEY;
const STORY_ID = process.env.BATTRA_STORY_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY; // Optional - uses CLI if not set
const CODEX_API_KEY = process.env.CODEX_API_KEY; // Optional - for Codex CLI auth
const GIT_BASE_BRANCH = process.env.GIT_PR_BASE_BRANCH || 'main';
const AUTO_MERGE = process.env.GIT_AUTO_MERGE === 'true';
const PR_REVIEWERS = process.env.GIT_PR_REVIEWERS || '';
const MAX_FIX_RETRIES = parseInt(process.env.MAX_FIX_RETRIES || '3', 10);

// Determine which AI coding assistant to use
// Options: Claude CLI, Claude API, or Codex CLI
const FORCE_CLAUDE_CLI = process.env.USE_CLAUDE_CLI === 'true';
const FORCE_CLAUDE_API = process.env.USE_CLAUDE_API === 'true';
const FORCE_CODEX_CLI = process.env.USE_CODEX_CLI === 'true';

// Execution mode: 'claude-cli' | 'claude-api' | 'codex-cli'
let EXECUTION_MODE;

// Check for conflicting flags
const forcedModes = [FORCE_CLAUDE_CLI, FORCE_CLAUDE_API, FORCE_CODEX_CLI].filter(Boolean).length;
if (forcedModes > 1) {
  console.error('❌ Error: Cannot set multiple execution modes');
  console.error('   Only one of USE_CLAUDE_CLI, USE_CLAUDE_API, or USE_CODEX_CLI should be true');
  process.exit(1);
}

// Determine execution mode
if (FORCE_CLAUDE_CLI) {
  EXECUTION_MODE = 'claude-cli';
  console.log('ℹ️  Forced to use Claude Code CLI (USE_CLAUDE_CLI=true)');
} else if (FORCE_CLAUDE_API) {
  if (!ANTHROPIC_KEY) {
    console.error('❌ Error: USE_CLAUDE_API=true but ANTHROPIC_API_KEY not set');
    process.exit(1);
  }
  EXECUTION_MODE = 'claude-api';
  console.log('ℹ️  Forced to use Claude API (USE_CLAUDE_API=true)');
} else if (FORCE_CODEX_CLI) {
  EXECUTION_MODE = 'codex-cli';
  console.log('ℹ️  Forced to use Codex CLI (USE_CODEX_CLI=true)');
} else {
  // Auto-detect: prefer Claude CLI, fall back to API if ANTHROPIC_KEY is set
  EXECUTION_MODE = ANTHROPIC_KEY ? 'claude-api' : 'claude-cli';
  if (EXECUTION_MODE === 'claude-cli') {
    console.log('ℹ️  Using Claude Code CLI (default)');
  } else {
    console.log('ℹ️  Using Claude API (ANTHROPIC_API_KEY detected)');
  }
}

// Validation
if (!TASK_ID || !API_KEY || !STORY_ID) {
  console.error('❌ Missing required environment variables');
  console.error('Usage: node claude-code-executor-with-git.js <task_id>');
  console.error('');
  console.error('Required:');
  console.error('  BATTRA_API_KEY - API key for Battra backend');
  console.error('  BATTRA_STORY_ID - Story ID for task context');
  console.error('');
  console.error('Execution Mode (pick one):');
  console.error('  USE_CLAUDE_CLI=true - Use Claude Code CLI (default)');
  console.error('  USE_CLAUDE_API=true - Use Claude API (requires ANTHROPIC_API_KEY)');
  console.error('  USE_CODEX_CLI=true - Use Codex CLI (optional CODEX_API_KEY)');
  console.error('');
  console.error('Optional:');
  console.error('  ANTHROPIC_API_KEY - For Claude API mode');
  console.error('  CODEX_API_KEY - For Codex CLI authentication override');
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

// Clean up dirty git state before branch operations
async function cleanupGitState() {
  console.log('\n🧹 Checking for uncommitted changes...');

  // Check git status
  const statusResult = await execCommand('git', ['status', '--porcelain'], { silent: true });
  const changes = statusResult.stdout.trim();

  if (!changes) {
    console.log('✅ Working directory is clean');
    return;
  }

  // We have uncommitted changes - need to handle them
  console.log('⚠️  Found uncommitted changes:');
  const changedFiles = changes.split('\n');
  changedFiles.forEach(file => console.log(`   ${file}`));

  console.log('\n🤖 Asking Claude Code to investigate and clean up...\n');

  // Get detailed diff
  const diffResult = await execCommand('git', ['diff', 'HEAD'], { silent: true });
  const diffOutput = diffResult.stdout;

  const statusFull = await execCommand('git', ['status'], { silent: true });
  const statusOutput = statusFull.stdout;

  // Build prompt for Claude to investigate
  const cleanupPrompt = `# Git Working Directory Cleanup

## Situation
The autonomous agent is trying to create a new branch to work on a task, but there are uncommitted changes in the working directory that would be overwritten by checking out the base branch.

## Git Status
\`\`\`
${statusOutput}
\`\`\`

## Changes
\`\`\`diff
${diffOutput}
\`\`\`

## Your Task
Investigate these uncommitted changes and decide how to handle them:

1. **If the changes look like legitimate work from a previous task:**
   - Create a descriptive commit message explaining what these changes are
   - Commit them with: \`git add -A && git commit -m "your message"\`
   - Make sure the commit message follows conventional commits format (feat:, fix:, docs:, etc.)

2. **If the changes are incomplete or look like work-in-progress:**
   - Stash them with: \`git stash push -m "Auto-stashed changes before new task"\`

3. **If the changes are trivial (like log files, temp files, IDE files):**
   - Check if they should be in .gitignore
   - If yes, add them to .gitignore and commit the .gitignore update
   - Clean them with: \`git clean -fd\` or \`git checkout -- <file>\`

4. **If you're unsure:**
   - Default to stashing: \`git stash push -m "Auto-stashed changes before new task"\`

**IMPORTANT:**
- After handling the changes, verify with \`git status\` that the working directory is clean
- The working directory MUST be clean (no uncommitted changes) when you're done
- Document your reasoning in your response

Please analyze the changes and clean up the working directory now.`;

  // Invoke Claude to handle the cleanup
  await invokeClaude(cleanupPrompt);

  // Verify the directory is now clean
  const finalStatus = await execCommand('git', ['status', '--porcelain'], { silent: true });
  const finalChanges = finalStatus.stdout.trim();

  if (finalChanges) {
    console.error('\n❌ ERROR: Working directory is still not clean after cleanup attempt!');
    console.error('   Remaining changes:');
    finalChanges.split('\n').forEach(file => console.error(`   ${file}`));
    throw new Error('Failed to clean up git working directory');
  }

  console.log('\n✅ Working directory is now clean');
}

// Pull with automatic conflict resolution
async function pullWithConflictResolution(branch) {
  console.log(`\n🔄 Pulling from origin/${branch}...`);

  try {
    await execCommand('git', ['pull', 'origin', branch]);
    console.log('✅ Pull successful');
    return true;
  } catch (error) {
    // Check if it's a merge conflict
    console.log('⚠️  Pull encountered issues - checking for conflicts...');

    const statusResult = await execCommand('git', ['status'], { silent: true });
    const statusOutput = statusResult.stdout;

    if (statusOutput.includes('CONFLICT') || statusOutput.includes('Unmerged paths')) {
      console.log('🔍 Merge conflicts detected!');

      // Get list of conflicted files
      const conflictsResult = await execCommand('git', ['diff', '--name-only', '--diff-filter=U'], { silent: true });
      const conflictFiles = conflictsResult.stdout.trim().split('\n').filter(f => f);

      if (conflictFiles.length === 0) {
        console.log('⚠️  Conflict markers in status but no unmerged files found');
        console.log('   Attempting to abort merge and retry...');
        await execCommand('git', ['merge', '--abort']);
        throw new Error('Pull failed - conflict state unclear, merge aborted');
      }

      console.log(`📝 Found ${conflictFiles.length} conflicted file(s):`);
      conflictFiles.forEach(file => console.log(`   - ${file}`));

      console.log('\n🤖 Asking Claude Code to resolve merge conflicts...\n');

      // Get diff with conflict markers
      const diffResult = await execCommand('git', ['diff', '--diff-filter=U'], { silent: true });
      const diffOutput = diffResult.stdout;

      // Build prompt for conflict resolution
      const conflictPrompt = `# Merge Conflict Resolution

## Situation
The autonomous agent pulled changes from the remote branch and encountered merge conflicts. These conflicts need to be resolved before continuing with the task.

## Conflicted Files
${conflictFiles.map(f => `- ${f}`).join('\n')}

## Conflict Details
\`\`\`diff
${diffOutput}
\`\`\`

## Your Task
Resolve these merge conflicts by:

1. **Review both versions** (HEAD vs incoming changes)
2. **Keep the best changes from each**:
   - If HEAD has incomplete work, integrate incoming changes carefully
   - If incoming changes are important bug fixes/features, include them
   - Resolve intelligently - don't just pick one side blindly
3. **Remove conflict markers** (<<<<<<, =======, >>>>>>>)
4. **Test that the merged code makes sense**
5. **Mark conflicts as resolved**: \`git add <file>\`
6. **Complete the merge**: \`git commit -m "fix: Resolve merge conflicts from origin/${branch}"\`

**IMPORTANT:**
- All conflict markers MUST be removed
- Code must compile/work after resolution
- Use \`git status\` to verify all conflicts are resolved
- The merge commit should explain what conflicts were resolved

Please resolve the conflicts now.`;

      // Invoke Claude to resolve conflicts
      await invokeClaude(conflictPrompt);

      // Verify conflicts are resolved
      const finalStatus = await execCommand('git', ['status', '--porcelain'], { silent: true });
      const finalOutput = finalStatus.stdout;

      // Check for remaining unmerged files
      const stillConflicted = finalOutput.split('\n').filter(line => line.startsWith('UU ') || line.startsWith('AA '));

      if (stillConflicted.length > 0) {
        console.error('\n❌ ERROR: Conflicts still exist after resolution attempt!');
        console.error('   Remaining conflicts:');
        stillConflicted.forEach(line => console.error(`   ${line}`));
        throw new Error('Failed to resolve merge conflicts');
      }

      // Check that merge was completed
      const statusCheck = await execCommand('git', ['status'], { silent: true });
      if (statusCheck.stdout.includes('You have unmerged paths')) {
        console.error('\n❌ ERROR: Merge not completed properly');
        throw new Error('Merge conflicts not fully resolved');
      }

      console.log('\n✅ Merge conflicts resolved successfully');
      return true;

    } else {
      // Not a merge conflict, some other pull error
      console.error('❌ Pull failed but not due to merge conflict');
      throw error;
    }
  }
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

    // Clean up any uncommitted changes before checkout
    await cleanupGitState();

    // Just checkout the existing branch
    await execCommand('git', ['checkout', branchName]);

    // Pull latest changes for this branch
    try {
      await pullWithConflictResolution(branchName);
    } catch (error) {
      if (error.message.includes('merge conflict')) {
        throw error; // Conflict resolution failed
      }
      console.log('   Branch exists locally but not on remote (that\'s OK)');
    }

    console.log(`✅ Using existing branch: ${branchName}`);
    return branchName;
  }

  // Branch doesn't exist, create it
  const isWorktree = await checkIfWorktree();

  if (isWorktree) {
    console.log('📂 Detected git worktree environment');
    // In a worktree, we're on a workspace branch (e.g., dev-1-workspace)
    // We need to create task branches from origin/main, NOT from workspace branch
    const currentBranch = await getCurrentBranch();
    console.log(`   Current workspace branch: ${currentBranch}`);

    // Clean up any uncommitted changes before operations
    await cleanupGitState();

    // Fetch latest from origin to ensure we have fresh refs
    console.log('🔄 Fetching latest from origin...');
    try {
      await execCommand('git', ['fetch', 'origin', GIT_BASE_BRANCH]);
    } catch (error) {
      console.log('⚠️  Could not fetch from origin (may be new repo or no remote)');
    }

    // Create branch from origin/main, NOT from current workspace branch
    // This keeps workspace branches clean and ensures all task branches start from the same point
    console.log(`🌿 Creating task branch from origin/${GIT_BASE_BRANCH}...`);
    await execCommand('git', ['checkout', '-b', branchName, `origin/${GIT_BASE_BRANCH}`]);
  } else {
    console.log('📁 Standard git repository (not worktree)');

    // Clean up any uncommitted changes before checkout
    await cleanupGitState();

    // Standard repo: checkout base branch first
    await execCommand('git', ['checkout', GIT_BASE_BRANCH]);
    await pullWithConflictResolution(GIT_BASE_BRANCH);

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

async function getWorktreeWorkspaceBranch() {
  try {
    // Get the git directory path to extract worktree name
    const gitDirResult = await execCommand('git', ['rev-parse', '--git-dir'], { silent: true });
    const gitDir = gitDirResult.stdout.trim();

    // Extract agent name from worktree path
    // Format: '../.git/worktrees/agent-name' or similar
    const worktreeMatch = gitDir.match(/\/worktrees\/([^\/]+)$/);

    if (worktreeMatch) {
      const agentName = worktreeMatch[1];
      const expectedBranch = `${agentName}-workspace`;

      // Verify this branch exists
      try {
        await execCommand('git', ['rev-parse', '--verify', expectedBranch], { silent: true });
        return expectedBranch;
      } catch {
        // Branch doesn't exist, continue to fallback
      }
    }

    // Fallback: check if current branch is a workspace branch
    const currentBranch = await getCurrentBranch();
    if (currentBranch && currentBranch.endsWith('-workspace')) {
      return currentBranch;
    }

    return null;
  } catch {
    return null;
  }
}

async function cleanupBranch(branchName) {
  console.log('\n🧹 Cleaning up branch...');

  const isWorktree = await checkIfWorktree();

  if (isWorktree) {
    // In a worktree, we can't checkout main (it's in use by another worktree)
    // Return to workspace branch and optionally delete the task branch
    try {
      // Get the workspace branch name for this specific worktree
      const workspaceBranch = await getWorktreeWorkspaceBranch();

      if (workspaceBranch) {
        console.log(`🔄 Returning to workspace branch: ${workspaceBranch}`);
        await execCommand('git', ['checkout', workspaceBranch]);
      } else {
        console.log('⚠️  No workspace branch found, staying on current branch');
      }

      // Optionally delete the task branch (but don't fail if it can't be deleted)
      // The branch might still be needed if the PR hasn't been merged yet
      try {
        await execCommand('git', ['branch', '-D', branchName]);
        console.log(`✅ Task branch ${branchName} deleted`);
      } catch (error) {
        console.log(`ℹ️  Task branch ${branchName} kept (PR may still be open)`);
      }
    } catch (error) {
      console.error(`⚠️  Could not cleanup: ${error.message}`);
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

  try {
    await execCommand('git', ['push', '-u', 'origin', branchName]);
    console.log('✅ Branch pushed');
    return;
  } catch (error) {
    const errorMsg = error.message || '';

    // Check if push was rejected because remote has advanced
    if (errorMsg.includes('rejected') || errorMsg.includes('non-fast-forward') || errorMsg.includes('Updates were rejected')) {
      console.log('\n⚠️  Push rejected - remote branch has new commits');
      console.log('🔄 Pulling remote changes and integrating...\n');

      // Pull with conflict resolution (this will handle any merge conflicts)
      try {
        await pullWithConflictResolution(branchName);
      } catch (pullError) {
        console.error('❌ Failed to pull and merge remote changes');
        throw pullError;
      }

      // Try push again
      console.log('\n📤 Retrying push after merge...');
      try {
        await execCommand('git', ['push', '-u', 'origin', branchName]);
        console.log('✅ Branch pushed successfully after merge');
        return;
      } catch (retryError) {
        console.error('❌ Push still failed after merging remote changes');
        throw retryError;
      }
    }

    // Some other push error (auth, network, etc.)
    console.error('❌ Push failed with non-merge error');
    throw error;
  }
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

  // Get agent role from environment for role-specific instructions
  const agentRole = process.env.AGENT_ROLE || 'dev';

  // Build role-specific guidance
  let roleGuidance = '';

  if (agentRole === 'documenter') {
    roleGuidance = `

# Your Role: Documentation Engineer (First Mover)

You create Architecture Decision Records (ADRs) that serve as **technical contracts** for other agents.

## FIRST: Ensure All Stories Have Documentation Tasks

Before working on any task, check if all stories in the current sprint have documentation tasks:

1. **Check sprint stories**: Use the API to get all stories in the current sprint
2. **For each story without a documentation task**: Create a task with:
   - Title: \`[Docs] Document [Story Title] Architecture\`
   - Description: \`Create ADR with technical contracts (API endpoints, component interfaces, data models). Map contracts to acceptance criteria.\`
   - This ensures QA and Dev agents have contracts to work from

**API Usage Example:**
\`\`\`bash
# Get stories in sprint
curl -H "X-API-Key: $BATTRA_API_KEY" \\
  "$BATTRA_API_BASE/sprints/$BATTRA_SPRINT_ID/stories"

# For each story, check if documentation task exists
curl -H "X-API-Key: $BATTRA_API_KEY" \\
  "$BATTRA_API_BASE/stories/{story_id}/tasks"

# If no [Docs] task found, create one
curl -X POST -H "X-API-Key: $BATTRA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "[Docs] Document Story Architecture", "description": "..."}' \\
  "$BATTRA_API_BASE/stories/{story_id}/tasks"
\`\`\`

## THEN: Create ADRs for Your Tasks

Once all stories have documentation tasks, work on assigned documentation tasks:

1. **Create ADR** in \`docs/adr/ADR-XXXX-[feature-name].md\`
2. **Document Technical Contracts:**
   - API endpoints (method, path, request/response schemas)
   - Component interfaces (props, events, state)
   - Data models and types
   - Map each contract to its Acceptance Criteria

## Template to Follow

\`\`\`markdown
# ADR-XXXX: [Feature Name]

## Context
[Brief explanation of what needs to be built]

## Technical Contracts

### API Endpoints
\`\`\`
GET /api/v1/resource/{id}
Response: ResourceType

ResourceType {
  id: string
  name: string
  ...
}
\`\`\`

### Frontend Components
\`\`\`typescript
interface ComponentProps {
  data: ResourceType
  onAction: (id: string) => void
}
\`\`\`

### Acceptance Criteria Mapping
- AC1: [criterion] → [API endpoint or component that fulfills it]
- AC2: [criterion] → [...]

## Decision
[What was decided and why]

## Consequences
[What this enables/constrains]
\`\`\`

**Mark task complete when ADR is committed.**`;
  } else if (agentRole === 'qa') {
    roleGuidance = `

# Your Role: QA Engineer (Specification Phase)

You write **specification tests** that validate technical contracts from the ADR.

## IMPORTANT: Specification Test Rules

1. **Find the ADR**: Look in \`docs/adr/\` for the relevant ADR (matches story/feature)
2. **Read the contracts**: Understand API schemas, component interfaces
3. **Write tests that validate contracts** (NOT the implementation)
4. **Mark spec tests**: Add comment \`// @spec-test: AC1, AC2\`
5. **Tests WILL fail**: This is EXPECTED and CORRECT
6. **Do NOT make tests pass**: You're defining the contract

## Spec Test Template

\`\`\`typescript
// @spec-test: AC1, AC2
// This test validates the contract. Expected to FAIL until implementation.
it('should return tasks with required fields', async () => {
  const response = await api.getTasks(sprintId)

  // Validate contract from ADR
  expect(response).toBeArray()
  expect(response[0]).toMatchSchema({
    id: expect.any(String),
    title: expect.any(String),
    status: expect.stringMatching(/^(available|inprogress|completed)$/),
    // ... fields from ADR contract
  })
})
\`\`\`

**Expected Outcome:** Tests are committed and FAIL. Mark task complete.

**Success Criteria:**
✓ Spec tests written for all ACs
✓ Tests marked with @spec-test
✓ Tests committed (failures are OK!)`;
  } else if (agentRole === 'dev') {
    roleGuidance = `

# Your Role: Developer (Implementation Phase)

You implement features to make **story-appropriate tests** pass.

## Step 1: Find Relevant Tests

Tests are mapped to acceptance criteria. Find tests for THIS task:

\`\`\`bash
# Extract AC IDs from your task's acceptance_criteria_refs
# Then search for tests matching those AC IDs
grep -r "AC.*<ac_id>" __tests__/ tests/
grep -r "ac_id.*:" __tests__/ tests/

# Look for test descriptions matching your ACs
# Example: If AC says "displays sprint name", search for:
grep -ri "display.*sprint.*name" __tests__/ tests/
\`\`\`

**IMPORTANT:** Work with story-appropriate tests, not random integration tests.

## Step 2: Implement to Pass Tests

1. **Read the relevant tests** - understand what they expect
2. **Implement functionality** - make tests pass
3. **Do NOT modify tests** unless they have bugs
4. **Add new tests** only if needed for edge cases

## Step 3: Verify Quality (REQUIRED)

### For Frontend Tasks:
\`\`\`bash
# 1. Run relevant tests
pnpm test <test-file-name> --run

# 2. Type check
pnpm run type-check

# 3. Lint check
pnpm lint

# If any fail, FIX THEM before finishing
\`\`\`

### For Backend/Rust Tasks:
\`\`\`bash
# 1. Run relevant tests
cargo test --package <service-name>

# 2. Format check
cargo fmt --all --check

# 3. Lint check
cargo clippy --all-targets --all-features -- -D warnings
\`\`\`

## Step 4: Know When to Stop

**Maximum 3 attempts** to fix failing tests. If tests still fail after 3 tries:

1. **Document the issue** in a comment on your implementation
2. **Mark task status appropriately** (e.g., blocked if tests are unfixable)
3. **Do NOT waste time** on tests that may need infrastructure changes
4. **Move on** - let the review process handle it

## Success Criteria

✅ Story-appropriate tests passing (based on AC IDs)
✅ Type check passing (\`pnpm run type-check\` or \`cargo check\`)
✅ Linting passing (\`pnpm lint\` or \`cargo clippy\`)
✅ Implementation complete and ready for review

**If any quality check fails after 3 attempts, STOP and document the blocker.**`;
  }

  return `You are an AI ${agentRole} implementing a task for the Battra AI project.${roleGuidance}

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

// Call AI coding assistant via selected method
async function invokeClaude(prompt) {
  console.log('\n🤖 Invoking AI coding assistant...');
  console.log('   (This may take several minutes for complex tasks)\n');

  switch (EXECUTION_MODE) {
    case 'claude-cli':
      return invokeClaudeCLI(prompt);
    case 'claude-api':
      return invokeCloudeAPI(prompt);
    case 'codex-cli':
      return invokeCodexCLI(prompt);
    default:
      throw new Error(`Unknown execution mode: ${EXECUTION_MODE}`);
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

// Call Codex CLI
async function invokeCodexCLI(prompt) {
  try {
    // Execute Codex CLI with exec command and prompt as argument
    const result = await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');

      // Build environment with Codex API key if provided
      const env = { ...process.env };
      if (CODEX_API_KEY) {
        env.CODEX_API_KEY = CODEX_API_KEY;
      }

      const codex = spawn('codex', [
        'exec',
        '--yolo',  // Allow file edits (similar to Claude's --dangerously-skip-permissions)
        '--model', 'gpt-5-codex',  // Use latest Codex model
        prompt  // Prompt as direct argument
      ], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      let stdout = '';
      let stderr = '';

      codex.stdout.on('data', (data) => {
        stdout += data.toString();
        // Stream output in real-time
        process.stdout.write(data);
      });

      codex.stderr.on('data', (data) => {
        stderr += data.toString();
        // Codex streams activity to stderr, which is expected
        process.stderr.write(data);
      });

      codex.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Codex CLI exited with code ${code}: ${stderr}`));
        }
      });

      codex.on('error', (error) => {
        reject(error);
      });
    });

    console.log('\n\n📝 Codex CLI execution completed\n');

    return result;
  } catch (error) {
    console.error('❌ Codex CLI error:', error.message);
    throw error;
  }
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
