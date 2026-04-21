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


export type LauncherSection = 'apps-integradas' | 'frontend' | 'backend';

export interface LauncherAppItem {
  id: string;
  name: string;
  description: string;
  path: string;
  section: LauncherSection;
  status: 'legacy' | 'migrada' | 'beta';
  runtime: {
    enabled: boolean;
    requires_credentials: boolean;
    degraded: boolean;
  };
  source?: {
    kind: string;
    directory?: string;
    manifest_path?: string;
  };
  launcher?: {
    healthcheck?: {
      type?: 'http' | 'tcp';
      target?: string;
    } | null;
  } | null;
}

export interface LauncherSectionItem {
  id: LauncherSection;
  title: string;
  description: string;
}

interface LauncherCatalogResponse {
  sections: LauncherSectionItem[];
  apps: LauncherAppItem[];
  meta?: {
    integrated_apps_root?: string;
    environment?: string;
  };
}

export interface LauncherRuntimeResponse {
  app_id: string;
  status?: 'running' | 'stopped';
  pid?: number | null;
  started_at?: string;
  stopped_at?: string;
  action?: 'install' | 'start' | 'stop';
  exit_code?: number;
}

export interface LauncherLogsResponse {
  app_id: string;
  lines: string[];
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

  getLauncherCatalog: async () =>
    httpClient.get<LauncherCatalogResponse>(endpoints.launcher.catalog(), { includeAuth: false }),

  launcherInstall: async (appId: string) =>
    httpClient.post<LauncherRuntimeResponse>(endpoints.launcher.appAction(appId, 'install'), undefined),

  launcherStart: async (appId: string) =>
    httpClient.post<LauncherRuntimeResponse>(endpoints.launcher.appAction(appId, 'start'), undefined),

  launcherStop: async (appId: string) =>
    httpClient.post<LauncherRuntimeResponse>(endpoints.launcher.appAction(appId, 'stop'), undefined),

  launcherStatus: async (appId: string) =>
    httpClient.get<LauncherRuntimeResponse>(endpoints.launcher.appAction(appId, 'status')),

  launcherLogs: async (appId: string, tail?: number) => {
    const query = tail ? new URLSearchParams({ tail: String(tail) }) : undefined;
    return httpClient.get<LauncherLogsResponse>(endpoints.launcher.appLogs(appId, query));
  },
};
