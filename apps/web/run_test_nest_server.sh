#!/bin/bash

# --- Playwright E2E and Clerk Environment Variables ---

# Clerk Public Key
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='pk_test_bWFqb3Itc25ha2UtNzkuY2xlcmsuYWNjb3VudHMuZGV2JA'

# Clerk Secret Key
export CLERK_SECRET_KEY='sk_test_nEqFdsNLenuDU5zq2FV4Ni1DRzmOLzNnrFQjBs7Edx'

# E2E Test User Credentials
export E2E_CLERK_USER_USERNAME='dummy+clerk_test@mock.com'
export E2E_CLERK_USER_PASSWORD='punvyx-ceczIf-3remza'

# Clerk Routing URLs
export NEXT_PUBLIC_CLERK_SIGN_IN_URL='/sign-in'
export NEXT_PUBLIC_CLERK_SIGN_UP_URL='/sign-up'
export NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL='/dashboard'
export NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL='/dashboard'

# API Endpoints
export NEXT_PUBLIC_PROJECTS_API_URL='http://localhost:8001'
export NEXT_PUBLIC_BACKLOG_API_URL='http://localhost:8002'
export NEXT_PUBLIC_READINESS_API_URL='http://localhost:8003'
export NEXT_PUBLIC_PROMPT_BUILDER_API_URL='http://localhost:8004'

# Feature Flags
export NEXT_PUBLIC_ENABLE_AI_FEATURES='true'
export NODE_ENV='test'
# --- Run Development Server ---

echo "Starting development server with pnpm dev..."
pnpm dev
