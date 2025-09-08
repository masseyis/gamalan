#!/bin/bash
set -euo pipefail

# Bootstrap Shuttle Projects for CI/CD
# This script creates the required Shuttle projects and outputs GitHub secrets setup commands

echo "🚀 Shuttle Project Bootstrap Script"
echo "=================================="

# Check if Shuttle CLI is installed
if ! command -v shuttle &> /dev/null; then
    echo "❌ Shuttle CLI not found. Please install it first:"
    echo "   cargo install cargo-shuttle"
    exit 1
fi

# Check if user is logged in
echo "🔐 Checking Shuttle authentication..."
if ! shuttle account --output json &> /dev/null; then
    echo "❌ Please log in to Shuttle first: shuttle login"
    exit 1
fi

# Function to create project and extract ID
create_project() {
    local project_name="$1"
    local env_name="$2"
    
    echo "📦 Creating project: $project_name"
    
    # Create project (this will fail if it already exists, which is fine)
    shuttle project create --name "$project_name" --output json > /tmp/shuttle_create_output.json 2>&1 || {
        echo "⚠️  Project $project_name might already exist, checking..."
    }
    
    # Get project list and extract the ID for our project
    echo "🔍 Finding project ID for $project_name..."
    shuttle project list --output json > /tmp/shuttle_projects.json
    
    # Parse JSON to find project ID
    PROJECT_ID=$(cat /tmp/shuttle_projects.json | jq -r ".projects[] | select(.name == \"$project_name\") | .id")
    
    if [ "$PROJECT_ID" = "" ] || [ "$PROJECT_ID" = "null" ]; then
        echo "❌ Failed to find project ID for $project_name"
        echo "Available projects:"
        cat /tmp/shuttle_projects.json | jq -r ".projects[] | \"  - \(.name) (\(.id))\""
        return 1
    fi
    
    echo "✅ Project $project_name ID: $PROJECT_ID"
    
    # Output GitHub CLI command to set secret
    local env_upper=$(echo "$env_name" | tr '[:lower:]' '[:upper:]')
    echo "🔧 GitHub secret setup command:"
    echo "   gh secret set SHUTTLE_PROJECT_ID_${env_upper} --body '$PROJECT_ID'"
    echo ""
    
    # Store in temporary file for summary
    echo "SHUTTLE_PROJECT_ID_${env_upper}=$PROJECT_ID" >> /tmp/shuttle_secrets.env
}

# Create temporary files
rm -f /tmp/shuttle_secrets.env
touch /tmp/shuttle_secrets.env

echo ""
echo "Creating Shuttle projects..."
echo ""

# Create staging project
create_project "salunga-ai-staging" "staging"

# Create production project  
create_project "salunga-ai-production" "production"

echo "======================================"
echo "🎉 Bootstrap Complete!"
echo ""
echo "📋 Summary of secrets to set in GitHub:"
echo ""
cat /tmp/shuttle_secrets.env
echo ""
echo "🔧 Quick setup commands (run these in your repo):"
echo ""
while IFS= read -r line; do
    secret_name=$(echo "$line" | cut -d'=' -f1)
    secret_value=$(echo "$line" | cut -d'=' -f2)
    echo "gh secret set $secret_name --body '$secret_value'"
done < /tmp/shuttle_secrets.env
echo ""
echo "💡 Your GitHub Actions workflow can now use these project IDs!"
echo ""
echo "🧹 Cleaning up temporary files..."
rm -f /tmp/shuttle_create_output.json /tmp/shuttle_projects.json /tmp/shuttle_secrets.env

echo "✅ Done!"