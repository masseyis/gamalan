#!/bin/bash
lldb -- \
  /Users/jamesmassey/ai-dev/gamalan/ai-agile/target/debug/api-gateway <<EOF
breakpoint set --name main
settings set target.env-vars DATABASE_URL=postgres://postgres:password@localhost:5432/gamalan,CORS_ALLOWED_ORIGINS=http://localhost:3000,CLERK_JWKS_URL=https://major-snake-79.clerk.accounts.dev/.well-known/jwks.json,CLERK_DOMAIN=major-snake-79.clerk.accounts.dev,CLERK_AUDIENCE=major-snake-79.clerk.accounts.dev
run
thread step-over
thread step-over
thread step-over
thread step-over
thread step-over
EOF