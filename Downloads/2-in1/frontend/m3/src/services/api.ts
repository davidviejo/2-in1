import { createHttpClient } from './httpClient';
import { endpoints } from './endpoints';

interface AuthResponse {
  token: string;
  role: string;
  scope?: string;
  error?: string;
}

export interface ToolCatalogItem {
  id: string;
  name: string;
  path: string;
  status: 'legacy' | 'migrada' | 'beta';
  description: string;
  available: boolean;
  runtime: {
    enabled: boolean;
    requires_credentials: boolean;
    degraded: boolean;
  };
}

interface ToolsCatalogResponse {
  tools: ToolCatalogItem[];
}

export interface RuntimeAppItem {
  id: string;
  name: string;
  command: string[];
  cwd: string;
  running: boolean;
  pid: number | null;
  started_at: string | null;
  last_error: string | null;
}

interface RuntimeAppsResponse {
  apps: RuntimeAppItem[];
}

interface RuntimeActionResponse {
  status: 'started' | 'stopped' | 'already_running' | 'already_stopped' | 'error';
  app: RuntimeAppItem;
  message?: string;
}

interface OperatorExecutionTrace {
  tool: string;
  mode: string;
  executed_at: string;
  executed_by: string;
  role: string;
  ip: string | null;
}

interface RunOperatorToolResponse {
  status: string;
  message: string;
  tool: string;
  mode: string;
  trace: OperatorExecutionTrace;
}

interface OperatorExecutionHistoryResponse {
  mode: string;
  items: OperatorExecutionTrace[];
}

const httpClient = createHttpClient({ service: 'api' });

export const api = {
  authClientsArea: async (password: string): Promise<AuthResponse> => {
    const data = await httpClient.post<AuthResponse>(endpoints.auth.clientsArea(), { password }, { includeAuth: false });
    if (data.token) {
      sessionStorage.setItem('portal_token', data.token);
      sessionStorage.setItem('portal_role', data.role);
    }
    return data;
  },

  authProject: async (slug: string, password: string): Promise<AuthResponse> => {
    const data = await httpClient.post<AuthResponse>(endpoints.auth.project(slug), { password }, { includeAuth: false });
    if (data.token) {
      sessionStorage.setItem('portal_token', data.token);
      sessionStorage.setItem('portal_role', data.role);
      sessionStorage.setItem('portal_scope', data.scope || '');
    }
    return data;
  },

  authOperator: async (password: string): Promise<AuthResponse> => {
    const data = await httpClient.post<AuthResponse>(endpoints.auth.operator(), { password }, { includeAuth: false });
    if (data.token) {
      sessionStorage.setItem('portal_token', data.token);
      sessionStorage.setItem('portal_role', data.role);
    }
    return data;
  },

  logout: () => {
    sessionStorage.removeItem('portal_token');
    sessionStorage.removeItem('portal_role');
    sessionStorage.removeItem('portal_scope');
    window.location.href = '/';
  },

  getClients: async () => httpClient.get(endpoints.clients.list()),

  getPublicClients: async () => httpClient.get(endpoints.clients.listPublic(), { includeAuth: false }),

  getProjectOverview: async (slug: string) => httpClient.get(endpoints.clients.projectOverview(slug)),

  runOperatorTool: async (tool: string) =>
    httpClient.post<RunOperatorToolResponse>(endpoints.tools.run(tool), undefined),
  getOperatorExecutions: async () =>
    httpClient.get<OperatorExecutionHistoryResponse>(endpoints.tools.executions()),

  getToolsCatalog: async () =>
    httpClient.get<ToolsCatalogResponse>(endpoints.tools.catalog(), { includeAuth: false }),
  getRuntimeApps: async () =>
    httpClient.get<RuntimeAppsResponse>(endpoints.apps.runtime()),
  startRuntimeApp: async (appId: string) =>
    httpClient.post<RuntimeActionResponse>(endpoints.apps.start(appId), undefined),
  stopRuntimeApp: async (appId: string) =>
    httpClient.post<RuntimeActionResponse>(endpoints.apps.stop(appId), undefined),
};
