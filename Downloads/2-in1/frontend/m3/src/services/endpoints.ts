const encodePathParam = (value: string | number): string => encodeURIComponent(String(value));

export const endpoints = {
  auth: {
    clientsArea: () => 'api/auth/clients-area',
    project: (slug: string) => `api/auth/project/${encodePathParam(slug)}`,
    operator: () => 'api/auth/operator',
  },
  clients: {
    list: () => 'api/clients',
    listPublic: () => 'api/public/clients',
    projectOverview: (slug: string) => `api/${encodePathParam(slug)}/overview`,
  },
  templates: {
    catalog: () => 'api/templates',
  },
  tools: {
    run: (tool: string) => `api/tools/run/${encodePathParam(tool)}`,
    executions: () => 'api/tools/executions',
    catalog: () => 'api/tools/catalog',
  },
  launcher: {
    catalog: () => 'api/launcher/catalog',
  },
  ai: {
    seoAnalysis: () => 'api/ai/seo-analysis',
    taskEnhance: () => 'api/ai/task-enhance',
    roadmapGenerate: () => 'api/ai/roadmap-generate',
    openaiEnhanceTask: () => 'api/ai/openai/enhance-task',
    openaiSeoAnalysis: () => 'api/ai/openai/seo-analysis',
    openaiClusterize: () => 'api/ai/openai/clusterize',
    openaiConfigStatus: () => 'api/ai/openai/config-status',
    headlineChallenge: () => 'api/ai/headline-challenge',
    checklistEvaluate: () => 'api/ai/checklist-evaluate',
    visibilityRun: () => 'api/ai/visibility/run',
    visibilityHistory: (clientId: string) => `api/ai/visibility/history/${encodePathParam(clientId)}`,
    visibilityConfig: (clientId: string) => `api/ai/visibility/config/${encodePathParam(clientId)}`,
    visibilitySchedule: (clientId: string) => `api/ai/visibility/schedule/${encodePathParam(clientId)}`,
    visibilityScheduleAction: (clientId: string, action: 'pause' | 'resume') =>
      `api/ai/visibility/schedule/${encodePathParam(clientId)}/${action}`,
  },
  gsc: {
    inspectUrlsBatch: () => 'api/gsc/url-inspection/batch',
  },
  engine: {
    capabilities: () => 'api/capabilities',
    analyze: () => 'api/analyze',
    jobs: () => 'api/jobs',
    runnerHealth: () => 'api/jobs/runner/health',
    byId: (jobId: string) => `api/jobs/${encodePathParam(jobId)}`,
    jobAction: (jobId: string, action: 'pause' | 'resume' | 'cancel') =>
      `api/jobs/${encodePathParam(jobId)}/${encodePathParam(action)}`,
    jobItems: (jobId: string, query?: URLSearchParams | string) => {
      const queryString = typeof query === 'string' ? query : query?.toString();
      const basePath = `api/jobs/${encodePathParam(jobId)}/items`;
      return queryString ? `${basePath}?${queryString}` : basePath;
    },
    jobItemResult: (jobId: string, itemId: string) =>
      `api/jobs/${encodePathParam(jobId)}/items/${encodePathParam(itemId)}/result`,
  },
};

export type Endpoints = typeof endpoints;
