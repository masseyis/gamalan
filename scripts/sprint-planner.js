#!/usr/bin/env node
/**
 * Sprint Planner - Autonomous sprint planning logic
 *
 * Responsibilities:
 * 1. Fetch ready stories from Readiness service
 * 2. Select stories to fit sprint capacity (based on points)
 * 3. Create sprint via API with selected stories
 * 4. Return sprint details
 *
 * Selection Strategy:
 * - FIFO: Take stories from top (default)
 * - AI: Use Claude to evaluate and select high-value stories (future)
 *
 * Usage:
 *   node sprint-planner.js <project_id>
 */

const { execSync } = require('child_process');

// Configuration
const PROJECT_ID = process.argv[2];
const API_BASE = process.env.BATTRA_API_BASE || 'http://localhost:8000/api/v1';
const API_KEY = process.env.BATTRA_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SPRINT_CAPACITY = parseInt(process.env.SPRINT_CAPACITY || '40');
const SPRINT_DURATION = parseInt(process.env.SPRINT_DURATION || '14');
const SELECTION_STRATEGY = process.env.SPRINT_SELECTION_STRATEGY || 'fifo'; // 'fifo' or 'ai'

// Validation
if (!PROJECT_ID || !API_KEY) {
  console.error('❌ Missing required arguments or environment variables');
  console.error('Usage: node sprint-planner.js <project_id>');
  console.error('Required: BATTRA_API_KEY');
  console.error('Optional: ANTHROPIC_API_KEY (for AI-based selection)');
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
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} ${error}`);
  }
  return response.json();
}

// Fetch ready stories
async function getReadyStories() {
  console.error('📥 Fetching ready stories...');

  // Get stories with status=ready
  const stories = await apiGet(`projects/${PROJECT_ID}/stories?status=ready`);

  if (!stories || stories.length === 0) {
    console.error('⚠️  No ready stories found');
    return [];
  }

  console.error(`✅ Found ${stories.length} ready stories`);
  return stories;
}

// Select stories using FIFO strategy
function selectStoriesFIFO(stories, capacity) {
  console.error(`📊 Selecting stories (FIFO strategy, capacity: ${capacity} points)...`);

  const selected = [];
  let totalPoints = 0;

  for (const story of stories) {
    const points = story.estimated_points || 0;

    if (points === 0) {
      console.error(`⚠️  Skipping story "${story.title}" (no points estimated)`);
      continue;
    }

    if (totalPoints + points <= capacity) {
      selected.push(story);
      totalPoints += points;
      console.error(`  ✓ Selected: [${points}pts] ${story.title}`);
    } else {
      console.error(`  ✗ Skipped: [${points}pts] ${story.title} (would exceed capacity)`);
    }
  }

  console.error(`✅ Selected ${selected.length} stories (${totalPoints} points)`);
  return { stories: selected, totalPoints };
}

// Select stories using AI strategy
async function selectStoriesAI(stories, capacity) {
  console.error(`🤖 Selecting stories (AI strategy, capacity: ${capacity} points)...`);

  if (!ANTHROPIC_KEY) {
    console.error('⚠️  ANTHROPIC_API_KEY not set, falling back to FIFO');
    return selectStoriesFIFO(stories, capacity);
  }

  // Build prompt for Claude
  const storiesDesc = stories
    .map(
      (s, i) =>
        `${i + 1}. [${s.estimated_points || 0}pts] ${s.title}\n   Description: ${s.description || 'No description'}`
    )
    .join('\n\n');

  const prompt = `You are a product-focused Scrum Master selecting stories for a ${SPRINT_DURATION}-day sprint with ${capacity} story points capacity.

Available Ready Stories:

${storiesDesc}

Task: Select the stories that provide the most value to users and stakeholders, while staying within the ${capacity} point capacity.

Respond ONLY with a JSON array of story indices (1-based) in order of priority.
Example: [1, 3, 5] means select stories 1, 3, and 5.

Selection:`;

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('⚠️  Claude API error, falling back to FIFO');
      return selectStoriesFIFO(stories, capacity);
    }

    const data = await response.json();
    const content = data.content.find((block) => block.type === 'text')?.text || '[]';

    // Extract JSON array from response
    const match = content.match(/\[[\d,\s]+\]/);
    if (!match) {
      console.error('⚠️  Could not parse Claude response, falling back to FIFO');
      return selectStoriesFIFO(stories, capacity);
    }

    const indices = JSON.parse(match[0]);

    // Select stories by indices
    const selected = [];
    let totalPoints = 0;

    for (const idx of indices) {
      const story = stories[idx - 1]; // Convert to 0-based
      if (!story) continue;

      const points = story.estimated_points || 0;
      if (totalPoints + points <= capacity) {
        selected.push(story);
        totalPoints += points;
        console.error(`  ✓ Selected: [${points}pts] ${story.title}`);
      }
    }

    console.error(`✅ AI selected ${selected.length} stories (${totalPoints} points)`);
    return { stories: selected, totalPoints };
  } catch (error) {
    console.error(`⚠️  AI selection failed: ${error.message}`);
    return selectStoriesFIFO(stories, capacity);
  }
}

// Generate sprint name
function generateSprintName() {
  const now = new Date();
  const sprintNumber = Math.floor((now.getTime() - new Date('2025-01-01').getTime()) / (1000 * 60 * 60 * 24 * 14)) + 1;
  return `Sprint ${sprintNumber} - ${now.toISOString().split('T')[0]}`;
}

// Create sprint
async function createSprint(selectedStories, totalPoints) {
  const sprintName = generateSprintName();
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + SPRINT_DURATION * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  console.error(`📝 Creating sprint: ${sprintName}`);
  console.error(`  Start: ${startDate}`);
  console.error(`  End: ${endDate}`);
  console.error(`  Stories: ${selectedStories.length}`);
  console.error(`  Points: ${totalPoints}`);

  const sprintData = {
    name: sprintName,
    start_date: startDate,
    end_date: endDate,
    capacity_points: SPRINT_CAPACITY,
    story_ids: selectedStories.map((s) => s.id),
  };

  try {
    const sprint = await apiPost(`projects/${PROJECT_ID}/sprints`, sprintData);

    console.error(`✅ Sprint created successfully`);

    // Return sprint details with story info for display
    return {
      id: sprint.id,
      name: sprint.name,
      start_date: sprint.start_date,
      end_date: sprint.end_date,
      story_count: selectedStories.length,
      total_points: totalPoints,
      stories: selectedStories.map((s) => ({
        id: s.id,
        title: s.title,
        estimated_points: s.estimated_points,
      })),
    };
  } catch (error) {
    console.error(`❌ Failed to create sprint: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.error('🚀 Sprint Planner');
    console.error(`📋 Project ID: ${PROJECT_ID}`);
    console.error(`📊 Capacity: ${SPRINT_CAPACITY} points`);
    console.error(`📅 Duration: ${SPRINT_DURATION} days`);
    console.error(`🎯 Strategy: ${SELECTION_STRATEGY.toUpperCase()}`);
    console.error('');

    // Step 1: Fetch ready stories
    const readyStories = await getReadyStories();

    if (readyStories.length === 0) {
      console.error('⚠️  No ready stories available for sprint planning');
      process.exit(1);
    }

    // Step 2: Select stories
    let selected;
    if (SELECTION_STRATEGY === 'ai') {
      selected = await selectStoriesAI(readyStories, SPRINT_CAPACITY);
    } else {
      selected = selectStoriesFIFO(readyStories, SPRINT_CAPACITY);
    }

    if (selected.stories.length === 0) {
      console.error('⚠️  No stories selected (capacity too small or no suitable stories)');
      process.exit(1);
    }

    // Step 3: Create sprint
    const sprint = await createSprint(selected.stories, selected.totalPoints);

    // Output sprint details as JSON (for bash script to parse)
    console.log(JSON.stringify(sprint, null, 2));

    console.error('');
    console.error('✅ Sprint planning complete!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Sprint planning failed: ${error.message}`);
    process.exit(1);
  }
}

// Run
main();
