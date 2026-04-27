import { prisma } from '@/lib/db';
import { normalizeModelLabel } from '@/lib/filters/normalization';
import { detectBrandMentions } from '@/lib/responses/brand-mention-detection';
import { extractAndNormalizeCitations } from '@/lib/responses/citations';
import { createRun, updateRunStatus } from '@/lib/runs/tracking';
import { Prisma } from '@prisma/client';

import type { CreateRunInput } from '@/lib/runs/validation';

type LiveAnalysisInput = {
  projectId: string;
  userId: string | null;
  payload: CreateRunInput;
};

type ProviderOutput = {
  text: string;
  model: string;
  rawSources: unknown;
  rawResponse: unknown;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function firstString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

async function callOpenAi(promptText: string, model: string): Promise<ProviderOutput> {
  const apiKey = requiredEnv('OPENAI_API_KEY');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [{ role: 'user', content: [{ type: 'input_text', text: promptText }] }]
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  const text = firstString([
    payload.output_text,
    ...(Array.isArray(payload.output)
      ? payload.output.flatMap((item) => {
          if (!item || typeof item !== 'object') {
            return [];
          }
          const record = item as Record<string, unknown>;
          const content = Array.isArray(record.content) ? record.content : [];
          return content
            .map((part) => (part && typeof part === 'object' ? (part as Record<string, unknown>).text : null))
            .filter((value): value is string => typeof value === 'string');
        })
      : [])
  ]);

  if (!text) {
    throw new Error('OpenAI response did not include text output.');
  }

  return {
    text,
    model,
    rawSources: payload,
    rawResponse: payload
  };
}

async function callGemini(promptText: string, model: string): Promise<ProviderOutput> {
  const apiKey = requiredEnv('GEMINI_API_KEY');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = (candidates[0] ?? null) as Record<string, unknown> | null;
  const content = first && typeof first.content === 'object' ? (first.content as Record<string, unknown>) : null;
  const parts = Array.isArray(content?.parts) ? content?.parts : [];
  const text = firstString(parts.map((part) => (part && typeof part === 'object' ? (part as Record<string, unknown>).text : null)));

  if (!text) {
    throw new Error('Gemini response did not include text output.');
  }

  return {
    text,
    model,
    rawSources: payload,
    rawResponse: payload
  };
}

async function callDataForSeoAiMode(promptText: string, language: string): Promise<ProviderOutput> {
  const login = requiredEnv('DATAFORSEO_LOGIN');
  const password = requiredEnv('DATAFORSEO_PASSWORD');
  const locationCode = Number.parseInt(process.env.DATAFORSEO_LOCATION_CODE ?? '2840', 10);

  const authToken = Buffer.from(`${login}:${password}`).toString('base64');

  const response = await fetch('https://api.dataforseo.com/v3/serp/google/ai_mode/live/advanced', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authToken}`
    },
    body: JSON.stringify([
      {
        keyword: promptText,
        location_code: Number.isFinite(locationCode) ? locationCode : 2840,
        language_code: language || 'en',
        device: 'desktop',
        os: 'windows'
      }
    ])
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`DataForSEO request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const task = (tasks[0] ?? null) as Record<string, unknown> | null;
  const result = Array.isArray(task?.result) ? task?.result : [];
  const firstResult = (result[0] ?? null) as Record<string, unknown> | null;
  const items = Array.isArray(firstResult?.items) ? firstResult?.items : [];

  const aiOverview = items.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).type === 'ai_overview') as
    | Record<string, unknown>
    | undefined;

  const text = firstString([
    aiOverview?.markdown,
    aiOverview?.description,
    ...items
      .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).description : null))
      .filter((value): value is string => typeof value === 'string')
  ]);

  if (!text) {
    throw new Error('DataForSEO did not return AI text for this query.');
  }

  return {
    text,
    model: 'unknown',
    rawSources: items,
    rawResponse: payload
  };
}

async function executeProvider(mode: string, promptText: string, model: string, language: string): Promise<ProviderOutput> {
  if (mode === 'chatgpt') {
    return callOpenAi(promptText, model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4.1-mini');
  }

  if (mode === 'gemini') {
    return callGemini(promptText, model || process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-pro');
  }

  if (mode === 'ai_mode' || mode === 'ai_overview') {
    return callDataForSeoAiMode(promptText, language);
  }

  throw new Error(`Unsupported analysis mode: ${mode}`);
}

export async function executeLiveAnalysis(input: LiveAnalysisInput) {
  const run = await createRun(input.projectId, input.userId, input.payload);

  if (!run) {
    return { error: 'prompt_not_found' as const };
  }

  await updateRunStatus(input.projectId, run.id, {
    status: 'RUNNING',
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
    response: null
  });

  try {
    const promptText = run.prompt.promptText;
    const providerOutput = await executeProvider(
      input.payload.analysisMode,
      promptText,
      normalizeModelLabel(input.payload.model) ?? input.payload.model,
      input.payload.language ?? 'en'
    );

    await updateRunStatus(input.projectId, run.id, {
      status: 'SUCCEEDED',
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
      response: {
        rawText: providerOutput.text,
        cleanedText: providerOutput.text,
        status: 'SUCCEEDED',
        language: input.payload.language,
        mentionDetected: false,
        mentionType: null,
        sentiment: null
      }
    });

    const responseRow = await prisma.response.findFirst({
      where: { runId: run.id },
      select: { id: true, cleanedText: true, rawText: true }
    });

    if (responseRow) {
      const [projectRaw, competitorsRaw] = await Promise.all([
        prisma.project.findUnique({
          where: { id: input.projectId },
          include: { brandAliases: true }
        }),
        prisma.competitor.findMany({ where: { projectId: input.projectId } })
      ]);

      const project = projectRaw as { primaryDomain: string; brandAliases: Array<{ id: string; alias: string }> } | null;
      const competitors = competitorsRaw as Array<{ id: string; name: string; domain: string; aliases: string[] }>;

      if (project) {
        const responseText = responseRow.cleanedText || responseRow.rawText;
        const detection = detectBrandMentions({
          responseText,
          client: {
            primaryDomain: project.primaryDomain,
            aliases: project.brandAliases.map((alias) => alias.alias)
          },
          competitors: competitors.map((competitor) => ({
            name: competitor.name,
            domain: competitor.domain,
            aliases: competitor.aliases
          }))
        });

        const citations = extractAndNormalizeCitations({
          responseText,
          rawSources: providerOutput.rawSources,
          clientDomains: [project.primaryDomain],
          competitorDomains: competitors.map((competitor) => competitor.domain)
        });

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.citation.deleteMany({ where: { responseId: responseRow.id } });
          await tx.responseBrandMention.deleteMany({ where: { responseId: responseRow.id } });

          await tx.response.update({
            where: { id: responseRow.id },
            data: {
              mentionDetected: detection.clientMentioned,
              mentionType:
                detection.mentionType === 'exact'
                  ? 'EXACT'
                  : detection.mentionType === 'alias'
                    ? 'ALIAS'
                    : detection.mentionType === 'domain_only'
                      ? 'DOMAIN_ONLY'
                      : detection.mentionType === 'implicit'
                        ? 'IMPLICIT'
                        : null,
              rawText: providerOutput.text,
              cleanedText: providerOutput.text
            }
          });

          if (detection.clientMentioned) {
            const alias = project.brandAliases[0] ?? null;
            await tx.responseBrandMention.create({
              data: {
                responseId: responseRow.id,
                projectId: input.projectId,
                brandAliasId: alias?.id,
                mentionType: 'OWN_BRAND',
                mentionText: alias?.alias ?? project.primaryDomain,
                mentionCount: 1
              }
            });
          }

          for (const mention of detection.competitorMentions) {
            const competitor = competitors.find((entry) => entry.name === mention.competitorName);
            if (!competitor) {
              continue;
            }

            await tx.responseBrandMention.create({
              data: {
                responseId: responseRow.id,
                projectId: input.projectId,
                competitorId: competitor.id,
                mentionType: 'COMPETITOR',
                mentionText: mention.matchedTerm,
                mentionCount: 1
              }
            });
          }

          if (citations.length > 0) {
            await tx.citation.createMany({
              data: citations.map((citation, index) => ({
                responseId: responseRow.id,
                sourceUrl: citation.url ?? `https://${citation.host ?? citation.domain ?? 'unknown'}`,
                sourceDomain: citation.rootDomain ?? citation.host ?? 'unknown',
                title: null,
                snippet: null,
                position: index + 1
              }))
            });
          }
        });
      }
    }

    return {
      runId: run.id,
      status: 'SUCCEEDED' as const,
      providerPayload: providerOutput.rawResponse
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Live analysis failed.';
    await updateRunStatus(input.projectId, run.id, {
      status: 'FAILED',
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: message,
      response: {
        rawText: message,
        cleanedText: message,
        status: 'FAILED',
        language: input.payload.language,
        mentionDetected: false,
        mentionType: null,
        sentiment: null
      }
    });

    return {
      runId: run.id,
      status: 'FAILED' as const,
      errorMessage: message
    };
  }
}
