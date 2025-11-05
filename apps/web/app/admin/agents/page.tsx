'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AgentStatus {
  role: string;
  running: boolean;
  pid?: number;
  logFile: string;
  enabled: boolean;
}

interface LogData {
  agent: string;
  lines: string[];
  totalLines: number;
}

export default function AgentControlPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sprintId, setSprintId] = useState('');
  const [aiMode, setAiMode] = useState<'claude-cli' | 'claude-api' | 'codex-cli'>('claude-cli');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [codexApiKey, setCodexApiKey] = useState('');
  const [executionMode, setExecutionMode] = useState<'serial' | 'parallel'>('serial');

  // Fetch agent statuses
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (err) {
      console.error('Failed to fetch agent status:', err);
    }
  };

  // Fetch logs for selected agent
  const fetchLogs = async (agent: string) => {
    try {
      const response = await fetch(`/api/agents/logs/${agent}?lines=50`);
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  // Start an agent
  const startAgent = async (role: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          role,
          sprintId: sprintId || undefined,
          aiMode,
          anthropicApiKey: aiMode === 'claude-api' && anthropicApiKey ? anthropicApiKey : undefined,
          codexApiKey: aiMode === 'codex-cli' && codexApiKey ? codexApiKey : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start agent');
      }

      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Stop an agent
  const stopAgent = async (role: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to stop agent');
      }

      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  // Fetch logs when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      fetchLogs(selectedAgent);
      const interval = setInterval(() => fetchLogs(selectedAgent), 3000); // Refresh every 3s
      return () => clearInterval(interval);
    }
  }, [selectedAgent]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Autonomous Agent Control</h1>
        <p className="text-gray-600">
          Start, stop, and monitor your autonomous development agents
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sprint ID */}
            <div>
              <label htmlFor="sprintId" className="block text-sm font-medium mb-2">
                Sprint ID (optional)
              </label>
              <input
                id="sprintId"
                type="text"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                placeholder="Auto-detect active sprint if empty"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to automatically use the active sprint
              </p>
            </div>

            {/* Execution Mode */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Agent Execution Mode
              </label>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    id="mode-serial"
                    type="radio"
                    checked={executionMode === 'serial'}
                    onChange={() => setExecutionMode('serial')}
                    className="mt-1 h-4 w-4 border-gray-300"
                  />
                  <div className="flex-1">
                    <label htmlFor="mode-serial" className="text-sm font-medium cursor-pointer">
                      Serial (recommended)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Agents start one at a time, waiting for each to claim a task before starting the next
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <input
                    id="mode-parallel"
                    type="radio"
                    checked={executionMode === 'parallel'}
                    onChange={() => setExecutionMode('parallel')}
                    className="mt-1 h-4 w-4 border-gray-300"
                  />
                  <div className="flex-1">
                    <label htmlFor="mode-parallel" className="text-sm font-medium cursor-pointer">
                      Parallel
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      All agents start simultaneously (may cause race conditions)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium mb-3">AI Provider Configuration</h3>
              <div className="space-y-3">
                {/* Claude Code CLI */}
                <div className="flex items-start gap-3">
                  <input
                    id="mode-claude-cli"
                    type="radio"
                    checked={aiMode === 'claude-cli'}
                    onChange={() => setAiMode('claude-cli')}
                    className="mt-1 h-4 w-4 border-gray-300"
                  />
                  <div className="flex-1">
                    <label htmlFor="mode-claude-cli" className="text-sm font-medium cursor-pointer">
                      Claude Code CLI (recommended)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Uses your Claude Code Plus subscription (no additional API costs)
                    </p>
                  </div>
                </div>

                {/* Claude API */}
                <div className="flex items-start gap-3">
                  <input
                    id="mode-claude-api"
                    type="radio"
                    checked={aiMode === 'claude-api'}
                    onChange={() => setAiMode('claude-api')}
                    className="mt-1 h-4 w-4 border-gray-300"
                  />
                  <div className="flex-1">
                    <label htmlFor="mode-claude-api" className="text-sm font-medium cursor-pointer">
                      Claude API (Anthropic)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Direct API calls. Uses separate API credits.
                    </p>
                    {aiMode === 'claude-api' && (
                      <div className="mt-2">
                        <label htmlFor="anthropicApiKey" className="block text-xs text-gray-600 mb-1">
                          Anthropic API Key
                        </label>
                        <input
                          id="anthropicApiKey"
                          type="password"
                          value={anthropicApiKey}
                          onChange={(e) => setAnthropicApiKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Codex CLI */}
                <div className="flex items-start gap-3">
                  <input
                    id="mode-codex-cli"
                    type="radio"
                    checked={aiMode === 'codex-cli'}
                    onChange={() => setAiMode('codex-cli')}
                    className="mt-1 h-4 w-4 border-gray-300"
                  />
                  <div className="flex-1">
                    <label htmlFor="mode-codex-cli" className="text-sm font-medium cursor-pointer">
                      Codex CLI (OpenAI)
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Uses OpenAI Codex CLI. Optional API key override.
                    </p>
                    {aiMode === 'codex-cli' && (
                      <div className="mt-2">
                        <label htmlFor="codexApiKey" className="block text-xs text-gray-600 mb-1">
                          Codex API Key (optional)
                        </label>
                        <input
                          id="codexApiKey"
                          type="password"
                          value={codexApiKey}
                          onChange={(e) => setCodexApiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to use default Codex authentication
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {agents.map((agent) => (
          <Card
            key={agent.role}
            className={`cursor-pointer transition-all ${
              selectedAgent === agent.role
                ? 'ring-2 ring-blue-500'
                : 'hover:shadow-lg'
            }`}
            onClick={() => setSelectedAgent(agent.role)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg capitalize">{agent.role}</CardTitle>
                <Badge variant={agent.running ? 'default' : 'secondary'}>
                  {agent.running ? 'Running' : 'Stopped'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {agent.running && agent.pid && (
                <p className="text-sm text-gray-600 mb-3">PID: {agent.pid}</p>
              )}
              <div className="flex gap-2">
                {!agent.running ? (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      startAgent(agent.role);
                    }}
                    disabled={loading}
                    size="sm"
                    className="flex-1"
                  >
                    Start
                  </Button>
                ) : (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      stopAgent(agent.role);
                    }}
                    disabled={loading}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                  >
                    Stop
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Log Viewer */}
      {selectedAgent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="capitalize">
                {selectedAgent} Agent Logs
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => fetchLogs(selectedAgent)}
                  variant="outline"
                  size="sm"
                >
                  Refresh
                </Button>
                <Button
                  onClick={() => setSelectedAgent(null)}
                  variant="ghost"
                  size="sm"
                >
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-auto max-h-[500px]">
              {logs && logs.lines.length > 0 ? (
                <>
                  <div className="mb-2 text-xs text-gray-400">
                    Showing last {logs.lines.length} lines (total: {logs.totalLines})
                  </div>
                  {logs.lines.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap break-words">
                      {line}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-gray-400 text-center py-8">
                  No logs available yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={async () => {
                const stoppedAgents = agents.filter((agent) => !agent.running);

                if (executionMode === 'serial') {
                  // Start agents one at a time with proper delays
                  for (const agent of stoppedAgents) {
                    await startAgent(agent.role);
                    // Wait 10 seconds between starts to let each agent claim a task
                    // This prevents race conditions where multiple agents try to claim the same task
                    if (stoppedAgents.indexOf(agent) < stoppedAgents.length - 1) {
                      await new Promise((resolve) => setTimeout(resolve, 10000));
                    }
                  }
                } else {
                  // Start all agents in parallel (properly awaited to prevent overwhelming the system)
                  await Promise.all(stoppedAgents.map((agent) => startAgent(agent.role)));
                }
              }}
              disabled={loading}
            >
              Start All ({executionMode})
            </Button>
            <Button
              onClick={async () => {
                const runningAgents = agents.filter((agent) => agent.running);
                await Promise.all(runningAgents.map((agent) => stopAgent(agent.role)));
              }}
              disabled={loading}
              variant="destructive"
            >
              Stop All
            </Button>
            <Button onClick={fetchStatus} variant="outline">
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
