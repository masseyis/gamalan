import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import process from 'process';

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

class BattraClient {
  private http: AxiosInstance;
  private orgId?: string;
  private userId?: string;

  constructor() {
    const baseURL = process.env.BATTRA_API_BASE ?? 'http://localhost:8000/api/v1';

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const authHeader = process.env.BATTRA_AUTHORIZATION;
    if (authHeader) {
      defaultHeaders.Authorization = authHeader;
    }

    const apiKey = process.env.BATTRA_API_KEY;
    if (apiKey) {
      defaultHeaders['X-API-Key'] = apiKey;
    }

    this.orgId = process.env.BATTRA_ORG_ID ?? undefined;
    this.userId = process.env.BATTRA_USER_ID ?? undefined;

    this.http = axios.create({
      baseURL,
      headers: defaultHeaders,
      timeout: 15_000,
    });

    this.http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const headers = AxiosHeaders.from(config.headers ?? {});

      if (this.userId) {
        headers.set('X-User-Id', this.userId);
      }
      if (this.orgId) {
        headers.set('X-Organization-Id', this.orgId);
      }

      config.headers = headers;
      return config;
    });
  }

  async listProjects() {
    return this.request('get', '/projects');
  }

  async getProject(projectId: string) {
    return this.request('get', `/projects/${projectId}`);
  }

  async listStories(projectId: string, status?: string) {
    const config: AxiosRequestConfig = {};
    if (status) {
      config.params = { status };
    }
    return this.request('get', `/projects/${projectId}/stories`, config);
  }

  async createStory(projectId: string, payload: Record<string, unknown>) {
    return this.request('post', `/projects/${projectId}/stories`, {
      data: payload,
    });
  }

  async updateStoryStatus(storyId: string, status: string) {
    return this.request('patch', `/stories/${storyId}/status`, {
      data: { status },
    });
  }

  async createTask(storyId: string, payload: Record<string, unknown>) {
    return this.request('post', `/stories/${storyId}/tasks`, {
      data: payload,
    });
  }

  async listStoryTasks(storyId: string) {
    return this.request('get', `/stories/${storyId}/tasks`);
  }

  async updateTaskStatus(taskId: string, status: string) {
    return this.request('patch', `/tasks/${taskId}/status`, {
      data: { status },
    });
  }

  async createSprint(
    projectId: string,
    payload: { name: string; goal: string; stories: string[]; capacity_points?: number },
  ) {
    return this.request('post', `/projects/${projectId}/sprints`, {
      data: payload,
    });
  }

  async getActiveSprint(projectId: string) {
    return this.request('get', `/projects/${projectId}/sprints/active`);
  }

  async rehydrateReadinessProjections() {
    return this.request('post', `/readiness/projections/hydrate`);
  }

  private async request(
    method: 'get' | 'post' | 'patch' | 'delete',
    url: string,
    config: AxiosRequestConfig = {},
  ) {
    if (method === 'get') {
      return (await this.http.get(url, config)).data;
    }
    if (method === 'post') {
      return (await this.http.post(url, config.data ?? {}, config)).data;
    }
    if (method === 'patch') {
      return (await this.http.patch(url, config.data ?? {}, config)).data;
    }
    if (method === 'delete') {
      return (await this.http.delete(url, config)).data;
    }
    throw new Error(`Unsupported method: ${method}`);
  }
}

class McpServer {
  private tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }> = new Map();
  private battra = new BattraClient();

  constructor() {
    this.registerTools();
  }

  private registerTools() {
    this.registerTool(
      {
        name: 'list_projects',
        description: 'List all projects the current context can access.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      async () => this.battra.listProjects(),
    );

    this.registerTool(
      {
        name: 'get_project',
        description: 'Retrieve details for a project.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string' },
          },
          required: ['project_id'],
        },
      },
      async ({ project_id }) => this.battra.getProject(validateString('project_id', project_id)),
    );

    this.registerTool(
      {
        name: 'list_project_stories',
        description: 'List stories for a project, optionally filtered by status.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string' },
            status: { type: 'string', description: 'Optional status filter (e.g., ready, committed).' },
          },
          required: ['project_id'],
        },
      },
      async ({ project_id, status }) =>
        this.battra.listStories(
          validateString('project_id', project_id),
          status ? validateString('status', status) : undefined,
        ),
    );

    this.registerTool(
      {
        name: 'create_story',
        description: 'Create a story within a project.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            labels: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['project_id', 'title'],
        },
      },
      async ({ project_id, title, description, labels }) =>
        this.battra.createStory(validateString('project_id', project_id), {
          title: validateString('title', title),
          description: description ? validateString('description', description) : undefined,
          labels: Array.isArray(labels) ? labels : undefined,
        }),
    );

    this.registerTool(
      {
        name: 'update_story_status',
        description: 'Update the status of a story.',
        inputSchema: {
          type: 'object',
          properties: {
            story_id: { type: 'string' },
            status: { type: 'string' },
          },
          required: ['story_id', 'status'],
        },
      },
      async ({ story_id, status }) =>
        this.battra.updateStoryStatus(
          validateString('story_id', story_id),
          validateString('status', status),
        ),
    );

    this.registerTool(
      {
        name: 'create_task',
        description: 'Create a task for a story.',
        inputSchema: {
          type: 'object',
          properties: {
            story_id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            acceptance_criteria_refs: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['story_id', 'title'],
        },
      },
      async ({ story_id, title, description, acceptance_criteria_refs }) =>
        this.battra.createTask(validateString('story_id', story_id), {
          title: validateString('title', title),
          description: description ? validateString('description', description) : undefined,
          acceptance_criteria_refs: Array.isArray(acceptance_criteria_refs)
            ? acceptance_criteria_refs
            : [],
        }),
    );

    this.registerTool(
      {
        name: 'list_story_tasks',
        description: 'List tasks associated with a story.',
        inputSchema: {
          type: 'object',
          properties: {
            story_id: { type: 'string' },
          },
          required: ['story_id'],
        },
      },
      async ({ story_id }) => this.battra.listStoryTasks(validateString('story_id', story_id)),
    );

    this.registerTool(
      {
        name: 'update_task_status',
        description: 'Update the status of a task.',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string' },
            status: { type: 'string' },
          },
          required: ['task_id', 'status'],
        },
      },
      async ({ task_id, status }) =>
        this.battra.updateTaskStatus(
          validateString('task_id', task_id),
          validateString('status', status),
        ),
    );

    this.registerTool(
      {
        name: 'create_sprint',
        description: 'Create and start a sprint for a project with selected stories.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string' },
            name: { type: 'string' },
            goal: { type: 'string' },
            stories: {
              type: 'array',
              items: { type: 'string' },
            },
            capacity_points: {
              type: 'number',
              description: 'Optional override for sprint capacity points.',
            },
          },
          required: ['project_id', 'name', 'goal', 'stories'],
        },
      },
      async ({ project_id, name, goal, stories, capacity_points }) =>
        this.battra.createSprint(validateString('project_id', project_id), {
          name: validateString('name', name),
          goal: validateString('goal', goal),
          stories: Array.isArray(stories) ? stories : [],
          capacity_points:
            typeof capacity_points === 'number' ? Math.floor(capacity_points) : undefined,
        }),
    );

    this.registerTool(
      {
        name: 'get_active_sprint',
        description: 'Fetch the active sprint for a project.',
        inputSchema: {
          type: 'object',
          properties: { project_id: { type: 'string' } },
          required: ['project_id'],
        },
      },
      async ({ project_id }) => this.battra.getActiveSprint(validateString('project_id', project_id)),
    );

    this.registerTool(
      {
        name: 'rehydrate_readiness_projections',
        description:
          'Trigger a rebuild of readiness projections for the current organization context.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => this.battra.rehydrateReadinessProjections(),
    );
  }

  private registerTool(definition: ToolDefinition, handler: ToolHandler) {
    this.tools.set(definition.name, { definition, handler });
  }

  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, id, params } = request;

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              serverInfo: {
                name: 'battra-mcp-server',
                version: '0.1.0',
              },
              capabilities: {
                tools: {},
              },
            },
          };

        case 'ping':
          return { jsonrpc: '2.0', id, result: 'pong' };

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: Array.from(this.tools.values()).map((entry) => entry.definition),
            },
          };

        case 'tools/call': {
          const args = (params ?? {}) as Record<string, unknown>;
          const toolName = validateString('name', args.name);
          const tool = this.tools.get(toolName);
          if (!tool) {
            throw new Error(`Unknown tool: ${toolName}`);
          }

          const toolArgs = (args.arguments ?? {}) as Record<string, unknown>;
          const result = await tool.handler(toolArgs);
          return { jsonrpc: '2.0', id, result };
        }

        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    } catch (error) {
      return this.buildErrorResponse(id, error);
    }
  }

  private buildErrorResponse(id: JsonRpcId, error: unknown): JsonRpcResponse {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const responseData = error.response?.data as Record<string, unknown> | undefined;
      const message =
        (typeof responseData?.message === 'string' ? responseData.message : undefined) ??
        error.message ??
        'Unknown HTTP error when talking to Battra API';
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: status,
          message,
          data: responseData,
        },
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message,
      },
    };
  }
}

function validateString(field: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected non-empty string for ${field}`);
  }
  return value;
}

const server = new McpServer();

let buffer = '';
process.stdin.on('data', (chunk: Buffer) => {
  buffer += chunk.toString('utf8');
  void processBuffer();
});

async function processBuffer(): Promise<void> {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }

    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      console.error('Missing Content-Length header');
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = Number.parseInt(match[1], 10);
    const totalLength = headerEnd + 4 + contentLength;
    if (buffer.length < totalLength) {
      return;
    }

    const body = buffer.slice(headerEnd + 4, totalLength);
    buffer = buffer.slice(totalLength);

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(body) as JsonRpcRequest;
    } catch (error) {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Failed to parse request: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
      sendMessage(response);
      continue;
    }

    try {
      const response = await server.handleRequest(request);
      sendMessage(response);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
      sendMessage({
        jsonrpc: '2.0',
        id: request.id ?? null,
        error: { code: -32000, message },
      });
    }
  }
}

function sendMessage(message: JsonRpcResponse) {
  const json = JSON.stringify(message);
  const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
  process.stdout.write(payload);
}

process.stdin.resume();
