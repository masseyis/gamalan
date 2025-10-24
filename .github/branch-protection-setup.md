# Branch Protection Setup Guide

This guide will help you set up branch protection rules for the `main` branch to ensure all changes go through Pull Requests and pass required checks.

## Required Branch Protection Rules

### 1. Navigate to Repository Settings

1. Go to your GitHub repository: https://github.com/masseyis/gamalan
2. Click on **Settings** tab
3. In the left sidebar, click **Branches**
4. Click **Add rule** or **Add branch protection rule**

### 2. Configure Branch Protection Rule

**Branch name pattern:** `main`

#### ✅ Required Settings

**Protect matching branches:**

- ✅ **Require a pull request before merging**
  - ✅ Require approvals: `1` (minimum)
  - ✅ Dismiss stale PR approvals when new commits are pushed
  - ✅ Require review from code owners (if you have CODEOWNERS file)
  - ✅ Restrict pushes that create pull requests

- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - **Required status checks to add:**
    - `Lint and Type Check`
    - `Unit Tests`
    - `E2E Tests`
    - `Build Check`
    - `Security Audit`
    - `ci / test-and-build-rust-workspace` (if Rust checks are required)

- ✅ **Require conversation resolution before merging**

- ✅ **Require signed commits** (recommended for security)

- ✅ **Require linear history** (optional, prevents merge commits)

- ✅ **Restrict pushes that create pull requests**

**Administrative settings:**

- ✅ **Include administrators** (applies rules to admins too)
- ✅ **Allow force pushes** → ❌ **Disable** (prevents force pushes)
- ✅ **Allow deletions** → ❌ **Disable** (prevents branch deletion)

### 3. Required Status Checks Configuration

The following CI jobs must pass before a PR can be merged:

#### Frontend CI Jobs (from `.github/workflows/frontend-ci.yml`):

- `lint` - Lint and Type Check
- `test` - Unit Tests
- `e2e` - E2E Tests
- `build` - Build Check
- `security` - Security Audit

#### Rust CI Jobs (from `.github/workflows/ci.yml`):

- `test-and-build-rust-workspace` - Core Rust tests and build
- Any other critical Rust-specific checks

### 4. Optional: CODEOWNERS File

Create `.github/CODEOWNERS` to automatically require reviews from specific people:

```
# Global owners
* @masseyis

# Frontend code
/apps/web/ @masseyis
/apps/web/**/*.tsx @masseyis
/apps/web/**/*.ts @masseyis

# Backend/Rust code
/services/ @masseyis
/libs/ @masseyis
*.rs @masseyis

# Infrastructure and CI
/.github/ @masseyis
/Makefile @masseyis
/docker-compose*.yml @masseyis
```

### 5. Verification

After setting up the rules:

1. Try to push directly to `main` - it should be rejected
2. Create a test PR from a feature branch
3. Verify that all required status checks appear
4. Verify that merge is blocked until checks pass
5. Verify that merge is blocked until approval is given

## Benefits of This Setup

- ✅ **No direct pushes to main** - All changes must go through PR review
- ✅ **Quality gates** - CI must pass before merge
- ✅ **Code review required** - At least one approval needed
- ✅ **Force push protection** - Prevents history rewriting
- ✅ **Branch deletion protection** - Prevents accidental deletion
- ✅ **Conversation resolution** - All PR comments must be resolved
- ✅ **Administrator compliance** - Even admins follow the rules

## Troubleshooting

### Status Checks Not Appearing

- Ensure the workflow names in the protection rules match exactly with your `.github/workflows/*.yml` job names
- Status checks only appear after they've run at least once on a PR

### Can't Merge Despite Passing Checks

- Check if "Require branches to be up to date before merging" is enabled
- You may need to rebase or merge main into your feature branch

### Admin Override Needed

- In emergency situations, admins can temporarily disable protection rules
- Remember to re-enable them after the emergency

## Quick Setup Commands

If you prefer to set this up via GitHub CLI (requires `gh` CLI installed):

```bash
# Enable branch protection for main
gh api repos/masseyis/gamalan/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Lint and Type Check","Unit Tests","E2E Tests","Build Check","Security Audit"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```
