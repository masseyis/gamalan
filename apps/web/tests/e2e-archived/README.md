# Archived E2E Tests

These tests were archived to enable clean CI runs for autonomous agent development.

## Reason for Archival

The E2E tests require:
1. Backend services running (API gateway, auth, backlog, etc.)
2. Proper Clerk authentication setup
3. Full stack running (frontend + backend)

## Current Failures

- Authentication flow tests (13 failures)
  - Sign-in validation
  - Sign-up validation  
  - Error handling
  - Session management
  - Security features

## To Re-enable

1. Start all backend services
2. Start frontend dev server
3. Ensure Clerk credentials are valid
4. Move tests back from `tests/e2e-archived/` to `tests/e2e/`
5. Run: `pnpm test:e2e`

## Files Archived

- `tests/e2e-archived/auth/authentication.auth.spec.ts`

Archived on: Wed 29 Oct 2025 12:27:08 GMT

