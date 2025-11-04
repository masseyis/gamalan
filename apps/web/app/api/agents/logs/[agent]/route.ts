import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const REPO_ROOT = path.resolve(process.cwd(), '../../');
const LOG_DIR = path.join(REPO_ROOT, 'logs/autonomous-agents');

// GET /api/agents/logs/[agent] - Get logs for a specific agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const lines = parseInt(searchParams.get('lines') || '100', 10);

    const logFile = path.join(LOG_DIR, `${agent}-agent.log`);

    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const allLines = content.split('\n');
      const lastLines = allLines.slice(-lines);

      return NextResponse.json({
        agent,
        lines: lastLines,
        totalLines: allLines.length,
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return NextResponse.json({
          agent,
          lines: [],
          totalLines: 0,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading logs:', error);
    return NextResponse.json(
      { error: 'Failed to read logs' },
      { status: 500 }
    );
  }
}
