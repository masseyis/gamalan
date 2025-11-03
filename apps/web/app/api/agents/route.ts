import { NextRequest, NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const REPO_ROOT = path.resolve(process.cwd(), '../../');
const LOG_DIR = path.join(REPO_ROOT, 'logs/autonomous-agents');
const PID_DIR = LOG_DIR;

const AGENT_ROLES = ['dev', 'qa', 'po', 'devops', 'documenter'];
const AGENT_KEYS = {
  dev: 'battra-dev-key-1',
  qa: 'battra-qa-key-1',
  po: 'battra-po-key-1',
  devops: 'battra-devops-key-1',
  documenter: 'battra-documenter-key-1',
};

interface AgentStatus {
  role: string;
  running: boolean;
  pid?: number;
  logFile: string;
  enabled: boolean;
}

// Get status of all agents
async function getAgentStatus(): Promise<AgentStatus[]> {
  const statuses: AgentStatus[] = [];

  for (const role of AGENT_ROLES) {
    const pidFile = path.join(PID_DIR, `${role}-agent.pid`);
    const logFile = path.join(LOG_DIR, `${role}-agent.log`);

    let running = false;
    let pid: number | undefined;

    try {
      const pidContent = await fs.readFile(pidFile, 'utf-8');
      pid = parseInt(pidContent.trim(), 10);

      // Check if process is actually running
      try {
        process.kill(pid, 0); // Signal 0 checks if process exists
        running = true;
      } catch {
        running = false;
      }
    } catch {
      // PID file doesn't exist
      running = false;
    }

    statuses.push({
      role,
      running,
      pid,
      logFile: `${role}-agent.log`,
      enabled: true, // Could be stored in a config file
    });
  }

  return statuses;
}

// Start an agent
async function startAgent(
  role: string,
  sprintId?: string,
  useCLI?: boolean,
  anthropicApiKey?: string
): Promise<void> {
  const apiKey = AGENT_KEYS[role as keyof typeof AGENT_KEYS];
  if (!apiKey) {
    throw new Error(`Unknown role: ${role}`);
  }

  // Validate configuration
  if (useCLI === false && !anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required when not using Claude Code CLI');
  }

  // Determine sprint ID
  let sprint = sprintId;
  if (!sprint) {
    // Auto-detect active sprint
    const apiBase = process.env.BATTRA_API_BASE || 'http://localhost:8000/api/v1';
    try {
      const { stdout } = await execAsync(
        `curl -s "${apiBase}/teams" -H "X-API-Key: ${apiKey}" | jq -r '.[0].id'`
      );
      const teamId = stdout.trim();

      const { stdout: sprintOut } = await execAsync(
        `curl -s "${apiBase}/teams/${teamId}/sprints/active" -H "X-API-Key: ${apiKey}" | jq -r '.id'`
      );
      sprint = sprintOut.trim();
    } catch (error) {
      throw new Error('Failed to auto-detect sprint. Please specify sprint ID.');
    }
  }

  // Create log directory if needed
  await fs.mkdir(LOG_DIR, { recursive: true });

  const logFile = path.join(LOG_DIR, `${role}-agent.log`);
  const pidFile = path.join(PID_DIR, `${role}-agent.pid`);

  // Start the agent in background
  const scriptPath = path.join(REPO_ROOT, 'scripts/autonomous-agent.sh');

  // Build environment variables
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BATTRA_API_BASE: process.env.BATTRA_API_BASE || 'http://localhost:8000/api/v1',
    USE_WORKTREE: 'true',
    GIT_WORKFLOW_ENABLED: 'true',
    GIT_PR_BASE_BRANCH: 'main',
    MAX_ITERATIONS: '0', // Infinite
    POLL_INTERVAL: '30',
  };

  // Configure Claude invocation method based on UI settings
  if (useCLI === true) {
    // Use Claude Code CLI (recommended)
    env.USE_CLAUDE_CLI = 'true';
  } else if (useCLI === false && anthropicApiKey) {
    // Use Anthropic API with provided key
    env.USE_CLAUDE_API = 'true';
    env.ANTHROPIC_API_KEY = anthropicApiKey;
  } else {
    // Default to CLI if no preference specified
    env.USE_CLAUDE_CLI = 'true';
  }

  const child = spawn(scriptPath, [apiKey, sprint, role], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: REPO_ROOT,
    env,
  });

  // Write PID file
  await fs.writeFile(pidFile, child.pid?.toString() || '', 'utf-8');

  // Redirect output to log file
  const logStream = await fs.open(logFile, 'a');
  child.stdout?.pipe((await logStream.createWriteStream()) as any);
  child.stderr?.pipe((await logStream.createWriteStream()) as any);

  child.unref(); // Detach from parent
}

// Stop an agent
async function stopAgent(role: string): Promise<void> {
  const pidFile = path.join(PID_DIR, `${role}-agent.pid`);

  try {
    const pidContent = await fs.readFile(pidFile, 'utf-8');
    const pid = parseInt(pidContent.trim(), 10);

    // Kill the process
    process.kill(pid, 'SIGTERM');

    // Remove PID file
    await fs.unlink(pidFile);
  } catch (error) {
    throw new Error(`Failed to stop ${role} agent: ${error}`);
  }
}

// GET /api/agents - Get status of all agents
export async function GET() {
  try {
    const statuses = await getAgentStatus();
    return NextResponse.json({ agents: statuses });
  } catch (error) {
    console.error('Error getting agent status:', error);
    return NextResponse.json(
      { error: 'Failed to get agent status' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Start/stop agents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, role, sprintId, useCLI, apiKey } = body;

    if (!action || !role) {
      return NextResponse.json(
        { error: 'Missing action or role' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      await startAgent(role, sprintId, useCLI, apiKey);
      return NextResponse.json({ success: true, message: `${role} agent started` });
    } else if (action === 'stop') {
      await stopAgent(role);
      return NextResponse.json({ success: true, message: `${role} agent stopped` });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error controlling agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to control agent' },
      { status: 500 }
    );
  }
}
