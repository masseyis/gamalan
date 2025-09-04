#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up Vercel project for Next.js frontend...${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Vercel CLI is not installed. Installing now...${NC}"
    npm install -g vercel
fi

# Check if we're in the right directory
if [ ! -f "apps/web/package.json" ]; then
    echo -e "${RED}This script must be run from the project root directory${NC}"
    exit 1
fi

# Change to the web app directory
cd apps/web

echo -e "${BLUE}Current directory: $(pwd)${NC}"

# Initialize Vercel project
echo -e "${YELLOW}Initializing Vercel project...${NC}"
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${BLUE}Running vercel init...${NC}"
    vercel --confirm
else
    echo -e "${YELLOW}Vercel project already initialized${NC}"
fi

# Function to set up environment variables for a specific environment
setup_env_vars() {
    local environment=$1
    echo -e "${YELLOW}Setting up environment variables for ${environment}...${NC}"
    
    # Create environment-specific configuration
    case $environment in
        "production")
            API_BASE_URL="https://api.salunga.com"
            WEB_BASE_URL="https://app.salunga.com"
            NODE_ENV="production"
            ;;
        "preview"|"staging")
            API_BASE_URL="https://api-staging.salunga.com"
            WEB_BASE_URL="https://staging.salunga.com"
            NODE_ENV="development"
            ;;
        *)
            echo -e "${RED}Unknown environment: ${environment}${NC}"
            return 1
            ;;
    esac
    
    # Set environment variables using Vercel CLI
    echo -e "${BLUE}Setting environment variables for ${environment}...${NC}"
    
    # Clerk configuration (same for all environments, but different values)
    vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY "${environment}" --force || true
    vercel env add CLERK_SECRET_KEY "${environment}" --force || true
    vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_URL "${environment}" --force || true
    vercel env add NEXT_PUBLIC_CLERK_SIGN_UP_URL "${environment}" --force || true
    vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL "${environment}" --force || true
    vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL "${environment}" --force || true
    
    # API configuration
    vercel env add NEXT_PUBLIC_API_BASE_URL "${environment}" --value "${API_BASE_URL}" --force || true
    vercel env add NEXT_PUBLIC_WEB_BASE_URL "${environment}" --value "${WEB_BASE_URL}" --force || true
    
    # Node environment
    vercel env add NODE_ENV "${environment}" --value "${NODE_ENV}" --force || true
    
    # Analytics and monitoring (if using)
    vercel env add NEXT_PUBLIC_ANALYTICS_ID "${environment}" --force || true
    vercel env add SENTRY_DSN "${environment}" --force || true
    
    echo -e "${GREEN}✓ Environment variables configured for ${environment}${NC}"
}

# Function to create environment-specific configuration files
create_env_files() {
    echo -e "${YELLOW}Creating environment configuration files...${NC}"
    
    # Production environment file
    cat > .env.production.local.example <<EOF
# Production Environment Variables
# Copy this file to .env.production.local and fill in actual values

# Clerk Authentication (Production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_[YOUR_CLERK_SECRET_KEY]
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# API Configuration (Production)
NEXT_PUBLIC_API_BASE_URL=https://api.salunga.com
NEXT_PUBLIC_WEB_BASE_URL=https://app.salunga.com

# Node Environment
NODE_ENV=production

# Analytics & Monitoring (Optional)
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
SENTRY_DSN=your-sentry-dsn
EOF
    
    # Staging environment file
    cat > .env.staging.local.example <<EOF
# Staging Environment Variables
# Copy this file to .env.staging.local and fill in actual values

# Clerk Authentication (Development/Staging)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# API Configuration (Staging)
NEXT_PUBLIC_API_BASE_URL=https://api-staging.salunga.com
NEXT_PUBLIC_WEB_BASE_URL=https://staging.salunga.com

# Node Environment
NODE_ENV=development

# Analytics & Monitoring (Optional)
NEXT_PUBLIC_ANALYTICS_ID=your-staging-analytics-id
SENTRY_DSN=your-staging-sentry-dsn
EOF
    
    echo -e "${GREEN}✓ Created environment configuration files${NC}"
}

# Function to create Vercel configuration
create_vercel_config() {
    echo -e "${YELLOW}Creating vercel.json configuration...${NC}"
    
    cat > vercel.json <<EOF
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_API_BASE_URL": "@api-base-url",
    "NEXT_PUBLIC_WEB_BASE_URL": "@web-base-url",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "@clerk-publishable-key",
    "CLERK_SECRET_KEY": "@clerk-secret-key"
  },
  "build": {
    "env": {
      "NEXT_PUBLIC_API_BASE_URL": "@api-base-url",
      "NEXT_PUBLIC_WEB_BASE_URL": "@web-base-url",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "@clerk-publishable-key"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-Requested-With, X-HTTP-Method-Override, Content-Type, Cache-Control, Accept, Authorization"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/",
      "destination": "/dashboard",
      "permanent": false
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "$NEXT_PUBLIC_API_BASE_URL/:path*"
    }
  ]
}
EOF
    
    echo -e "${GREEN}✓ Created vercel.json configuration${NC}"
}

# Function to set up custom domains
setup_custom_domains() {
    echo -e "${YELLOW}Setting up custom domains...${NC}"
    
    # Production domain
    echo -e "${BLUE}Adding production domain: app.salunga.com${NC}"
    vercel domains add app.salunga.com || echo -e "${YELLOW}Domain might already be added${NC}"
    
    # Staging domain
    echo -e "${BLUE}Adding staging domain: staging.salunga.com${NC}"
    vercel domains add staging.salunga.com || echo -e "${YELLOW}Domain might already be added${NC}"
    
    echo -e "${GREEN}✓ Custom domains configured${NC}"
}

# Function to configure build settings
configure_build_settings() {
    echo -e "${YELLOW}Configuring build settings...${NC}"
    
    # Create a build configuration script
    cat > build-config.js <<EOF
// Build configuration for Vercel deployment
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  
  const nextConfig = {
    // Enable SWC minification for better performance
    swcMinify: true,
    
    // Enable React strict mode
    reactStrictMode: true,
    
    // Configure image domains
    images: {
      domains: [
        'images.clerk.dev',
        'api.salunga.com',
        'api-staging.salunga.com'
      ],
    },
    
    // Configure redirects
    async redirects() {
      return [
        {
          source: '/',
          destination: '/dashboard',
          permanent: false,
        },
      ];
    },
    
    // Configure headers for security
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'origin-when-cross-origin',
            },
            {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=()',
            },
          ],
        },
      ];
    },
    
    // Environment variables
    env: {
      NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
      NEXT_PUBLIC_BUILD_ENVIRONMENT: process.env.NODE_ENV,
    },
  };
  
  return nextConfig;
};
EOF
    
    echo -e "${GREEN}✓ Build configuration created${NC}"
}

# Main execution
echo -e "${BLUE}Starting Vercel project setup...${NC}"

# Create configuration files
create_env_files
create_vercel_config
configure_build_settings

# Set up environment variables
echo -e "${YELLOW}Note: Environment variables should be set manually or via GitHub Actions${NC}"
echo -e "${BLUE}To set environment variables manually:${NC}"
echo -e "  vercel env add VARIABLE_NAME production"
echo -e "  vercel env add VARIABLE_NAME preview"

# Set up custom domains (optional)
read -p "Do you want to set up custom domains? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    setup_custom_domains
fi

# Get project information
PROJECT_INFO=$(vercel project ls --format json 2>/dev/null | jq -r '.[0] // empty' || echo "{}")
PROJECT_NAME=$(echo "$PROJECT_INFO" | jq -r '.name // "unknown"')
PROJECT_ID=$(echo "$PROJECT_INFO" | jq -r '.id // "unknown"')

echo -e "${GREEN}✅ Vercel project setup completed!${NC}"

echo -e "${BLUE}Project Information:${NC}"
echo -e "  • Project Name: ${PROJECT_NAME}"
echo -e "  • Project ID: ${PROJECT_ID}"
echo -e "  • Directory: apps/web"

echo -e "${BLUE}Configuration Files Created:${NC}"
echo -e "  • ${GREEN}✓${NC} vercel.json - Vercel deployment configuration"
echo -e "  • ${GREEN}✓${NC} .env.production.local.example - Production environment template"
echo -e "  • ${GREEN}✓${NC} .env.staging.local.example - Staging environment template"
echo -e "  • ${GREEN}✓${NC} build-config.js - Next.js build configuration"

echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Copy environment example files and fill in actual values:"
echo -e "     ${BLUE}cp .env.production.local.example .env.production.local${NC}"
echo -e "     ${BLUE}cp .env.staging.local.example .env.staging.local${NC}"
echo -e "  2. Set environment variables in Vercel dashboard or via CLI"
echo -e "  3. Configure custom domains in Vercel dashboard"
echo -e "  4. Set up GitHub integration for automatic deployments"
echo -e "  5. Test deployment: ${BLUE}vercel --prod${NC}"

echo -e "${YELLOW}Environment Variables to Set:${NC}"
echo -e "  • NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo -e "  • CLERK_SECRET_KEY"
echo -e "  • NEXT_PUBLIC_API_BASE_URL"
echo -e "  • NEXT_PUBLIC_WEB_BASE_URL"
echo -e "  • NODE_ENV"

echo -e "${BLUE}Vercel Dashboard: https://vercel.com/dashboard${NC}"

# Return to project root
cd - > /dev/null